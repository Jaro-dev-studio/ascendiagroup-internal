"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { ChatMessage, ExecutedToolCall, PendingAction } from "@/components/ai/chat/types";

export type VoiceStatus = "idle" | "connecting" | "live";

export interface VoiceResolution {
  pendingActionId: string;
  status: "EXECUTED" | "REJECTED" | "FAILED";
  note: string;
  executed: ExecutedToolCall;
}

interface UseVoiceSessionOptions {
  /** Chat the panel currently shows, used for approvals after a call ends. */
  chatId: string | null;
  /** Resolves the chat to talk in, creating one when the panel is empty. */
  ensureChatId: () => Promise<string | null>;
  appendMessage: (message: ChatMessage) => void;
  replaceMessageId: (localId: string, serverId: string) => void;
  applyResolutions: (resolutions: VoiceResolution[]) => void;
  onTitle: (chatId: string, title: string) => void;
}

interface RealtimeServerEvent {
  type: string;
  delta?: string;
  transcript?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  response?: { status?: string; status_details?: { error?: { message?: string } } };
  error?: { message?: string };
}

interface QueuedToolCall {
  callId: string;
  name: string;
  args: Record<string, unknown>;
}

const AWAITING_APPROVAL_OUTPUT = JSON.stringify({
  status: "awaiting_user_approval",
  message:
    "Nothing has run yet. The action is on screen as an approval card and only the user can approve it. Tell them in one short sentence what is waiting, then stop.",
});

/** Room noise sometimes transcribes as bare punctuation, which is not a turn. */
function isSpeech(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}

function humanizeToolName(name: string): string {
  const spaced = name.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function parseArguments(raw: string | undefined): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Runs a continuous OpenAI Realtime call over WebRTC against the chat the panel
 * is showing. Audio never touches our servers: the browser trades SDP with
 * OpenAI using a short lived token, then every transcript, tool call and approval
 * travels over the data channel and is mirrored into the chat as text.
 */
export function useVoiceSession({
  chatId,
  ensureChatId,
  appendMessage,
  replaceMessageId,
  applyResolutions,
  onTitle,
}: UseVoiceSessionOptions) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [userDraft, setUserDraft] = useState("");
  const [assistantDraft, setAssistantDraft] = useState("");
  const [activeToolLabels, setActiveToolLabels] = useState<string[]>([]);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const statusRef = useRef<VoiceStatus>("idle");
  const sessionChatIdRef = useRef<string | null>(null);
  const chatIdRef = useRef<string | null>(chatId);

  const userTranscriptRef = useRef("");
  const assistantTranscriptRef = useRef("");
  const turnToolCallsRef = useRef<ExecutedToolCall[]>([]);
  const queuedCallsRef = useRef<QueuedToolCall[]>([]);

  const callbacksRef = useRef({ appendMessage, replaceMessageId, applyResolutions, onTitle });
  callbacksRef.current = { appendMessage, replaceMessageId, applyResolutions, onTitle };

  chatIdRef.current = chatId;
  statusRef.current = status;

  const sendEvent = useCallback((event: Record<string, unknown>): boolean => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") return false;
    channel.send(JSON.stringify(event));
    return true;
  }, []);

  const sendToolOutput = useCallback(
    (callId: string, output: string) => {
      sendEvent({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output },
      });
    },
    [sendEvent]
  );

  const teardown = useCallback(() => {
    channelRef.current?.close();
    channelRef.current = null;

    peerRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    peerRef.current?.close();
    peerRef.current = null;

    micRef.current?.getTracks().forEach((track) => track.stop());
    micRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }

    userTranscriptRef.current = "";
    assistantTranscriptRef.current = "";
    turnToolCallsRef.current = [];
    queuedCallsRef.current = [];
  }, []);

  const stop = useCallback(() => {
    if (statusRef.current === "idle") return;

    console.log("[AIVoice] ending voice session");
    teardown();

    statusRef.current = "idle";
    setStatus("idle");
    setIsMuted(false);
    setIsUserSpeaking(false);
    setIsAssistantSpeaking(false);
    setUserDraft("");
    setAssistantDraft("");
    setActiveToolLabels([]);
  }, [teardown]);

  /** Writes a spoken turn into the chat so voice and text share one transcript. */
  const commitMessage = useCallback(
    async (role: "user" | "assistant", content: string, toolCalls?: ExecutedToolCall[]) => {
      const targetChatId = sessionChatIdRef.current;
      if (!targetChatId) return;

      const localId = `voice-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      callbacksRef.current.appendMessage({
        id: localId,
        role,
        content,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : null,
        pendingActions: [],
        createdAt: new Date().toISOString(),
      });

      try {
        const response = await fetch(`/api/ai-chat/${targetChatId}/voice/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, content, toolCalls }),
        });
        const payload = await response.json();

        if (payload.data) {
          callbacksRef.current.replaceMessageId(localId, payload.data.id);
          if (payload.data.title) {
            callbacksRef.current.onTitle(targetChatId, payload.data.title);
          }
        }
      } catch (saveError) {
        console.error("[AIVoice] failed to save transcript:", saveError);
      }
    },
    []
  );

  /** Closes off whatever the assistant has said so far as its own message. */
  const flushAssistantTurn = useCallback(async () => {
    const text = assistantTranscriptRef.current.trim();

    assistantTranscriptRef.current = "";
    setAssistantDraft("");

    // Tools that ran before the assistant said anything would leave an empty
    // bubble behind, so their chips ride along on whatever it says next.
    if (!text) return;

    const toolCalls = turnToolCallsRef.current;
    turnToolCallsRef.current = [];

    await commitMessage("assistant", text, toolCalls);
  }, [commitMessage]);

  const runToolCalls = useCallback(
    async (calls: QueuedToolCall[]) => {
      const targetChatId = sessionChatIdRef.current;
      if (!targetChatId) return;

      console.log(`[AIVoice] running ${calls.length} tool call(s) from the call`);

      try {
        const response = await fetch(`/api/ai-chat/${targetChatId}/voice/tool-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ calls }),
        });
        const payload = await response.json();

        if (!payload.data) {
          const message = payload.error ?? "The tool could not be run";
          calls.forEach((call) => sendToolOutput(call.callId, JSON.stringify({ error: message })));
          return;
        }

        const completed = (payload.data.completed ?? []) as Array<{
          callId: string;
          output: string;
          executed: ExecutedToolCall;
        }>;

        completed.forEach((entry) => {
          turnToolCallsRef.current.push(entry.executed);
          sendToolOutput(entry.callId, entry.output);
        });

        const pending = payload.data.pending as {
          messageId: string;
          actions: PendingAction[];
          callIds: string[];
        } | null;

        if (pending) {
          // The spoken lead-in belongs above the cards, and the sentence about them
          // below, so the turn so far is committed before the cards are added.
          await flushAssistantTurn();

          callbacksRef.current.appendMessage({
            id: pending.messageId,
            role: "assistant",
            content: "",
            toolCalls: null,
            pendingActions: pending.actions,
            createdAt: new Date().toISOString(),
          });

          pending.callIds.forEach((callId) =>
            sendToolOutput(callId, AWAITING_APPROVAL_OUTPUT)
          );
        }
      } catch (toolError) {
        console.error("[AIVoice] tool call failed:", toolError);
        calls.forEach((call) =>
          sendToolOutput(call.callId, JSON.stringify({ error: "The tool could not be run" }))
        );
      } finally {
        setActiveToolLabels([]);
        sendEvent({ type: "response.create" });
      }
    },
    [flushAssistantTurn, sendEvent, sendToolOutput]
  );

  const handleResponseDone = useCallback(
    async (event: RealtimeServerEvent) => {
      const calls = queuedCallsRef.current;
      queuedCallsRef.current = [];

      // Tool calls keep the turn alive: the model speaks once it has the results.
      if (calls.length > 0) {
        await runToolCalls(calls);
        return;
      }

      setIsAssistantSpeaking(false);
      setActiveToolLabels([]);

      if (event.response?.status === "failed") {
        const message =
          event.response.status_details?.error?.message ?? "The assistant stopped unexpectedly";
        console.error("[AIVoice] response failed:", message);
        setError(message);
        assistantTranscriptRef.current = "";
        setAssistantDraft("");
        return;
      }

      await flushAssistantTurn();
      turnToolCallsRef.current = [];
    },
    [flushAssistantTurn, runToolCalls]
  );

  const handleServerEvent = useCallback(
    (event: RealtimeServerEvent) => {
      switch (event.type) {
        case "input_audio_buffer.speech_started":
          setIsUserSpeaking(true);
          break;

        case "input_audio_buffer.speech_stopped":
          setIsUserSpeaking(false);
          break;

        case "conversation.item.input_audio_transcription.delta":
          userTranscriptRef.current += event.delta ?? "";
          setUserDraft(userTranscriptRef.current);
          break;

        case "conversation.item.input_audio_transcription.completed": {
          const text = (event.transcript ?? userTranscriptRef.current).trim();
          userTranscriptRef.current = "";
          setUserDraft("");
          if (isSpeech(text)) void commitMessage("user", text);
          break;
        }

        case "conversation.item.input_audio_transcription.failed":
          userTranscriptRef.current = "";
          setUserDraft("");
          break;

        case "response.created":
          setIsAssistantSpeaking(true);
          break;

        case "response.output_audio_transcript.delta":
        case "response.output_text.delta":
          assistantTranscriptRef.current += event.delta ?? "";
          setAssistantDraft(assistantTranscriptRef.current);
          break;

        case "response.function_call_arguments.done":
          if (event.call_id && event.name) {
            queuedCallsRef.current.push({
              callId: event.call_id,
              name: event.name,
              args: parseArguments(event.arguments),
            });
            setActiveToolLabels((prev) => [...prev, humanizeToolName(event.name as string)]);
          }
          break;

        case "response.done":
          void handleResponseDone(event);
          break;

        case "error": {
          const message = event.error?.message ?? "The voice session hit an error";
          console.error("[AIVoice] realtime error:", message);
          setError(message);
          break;
        }

        default:
          break;
      }
    },
    [commitMessage, handleResponseDone]
  );

  const start = useCallback(async () => {
    if (statusRef.current !== "idle") return;

    statusRef.current = "connecting";
    setStatus("connecting");
    setError(null);

    try {
      const targetChatId = await ensureChatId();
      if (!targetChatId) throw new Error("Could not open a chat for the call");
      sessionChatIdRef.current = targetChatId;

      console.log(`[AIVoice] requesting realtime credentials for chat ${targetChatId}...`);

      const sessionResponse = await fetch(`/api/ai-chat/${targetChatId}/voice/session`, {
        method: "POST",
      });
      const sessionPayload = await sessionResponse.json();

      if (!sessionPayload.data) {
        throw new Error(sessionPayload.error ?? "Could not start the voice session");
      }

      const { token, model, callsUrl, history } = sessionPayload.data as {
        token: string;
        model: string;
        callsUrl: string;
        history: Array<{ role: "user" | "assistant"; content: string }>;
      };

      console.log("[AIVoice] asking for microphone access...");

      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      micRef.current = mic;

      const peer = new RTCPeerConnection();
      peerRef.current = peer;

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;

      peer.ontrack = (trackEvent) => {
        audio.srcObject = trackEvent.streams[0];
        void audio.play().catch(() => undefined);
      };

      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed" || peer.connectionState === "closed") {
          console.error(`[AIVoice] peer connection ${peer.connectionState}`);
          setError("The call dropped");
          stop();
        }
      };

      mic.getAudioTracks().forEach((track) => peer.addTrack(track, mic));

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;

      channel.onmessage = (messageEvent) => {
        try {
          handleServerEvent(JSON.parse(messageEvent.data) as RealtimeServerEvent);
        } catch (parseError) {
          console.error("[AIVoice] could not parse realtime event:", parseError);
        }
      };

      channel.onopen = () => {
        console.log(`[AIVoice] call connected, replaying ${history.length} message(s)`);

        history.forEach((item) => {
          sendEvent({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: item.role,
              content: [
                {
                  type: item.role === "user" ? "input_text" : "output_text",
                  text: item.content,
                },
              ],
            },
          });
        });

        sendEvent({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "system",
            content: [
              {
                type: "input_text",
                text: history.length
                  ? "The voice call just connected and you are continuing the conversation above. Greet the user in one short sentence that references where you left off, then stop and listen."
                  : "The voice call just connected. Greet the user in one short sentence and invite them to ask for something, then stop and listen.",
              },
            ],
          },
        });

        sendEvent({ type: "response.create" });

        statusRef.current = "live";
        setStatus("live");
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const answer = await fetch(`${callsUrl}?model=${encodeURIComponent(model)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp" },
        body: offer.sdp ?? "",
      });

      if (!answer.ok) {
        throw new Error(`OpenAI rejected the connection (${answer.status})`);
      }

      await peer.setRemoteDescription({ type: "answer", sdp: await answer.text() });
    } catch (startError) {
      const message =
        (startError as Error).name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser to use voice mode."
          : (startError as Error).message || "Could not start the voice session";

      console.error("[AIVoice] failed to start:", startError);
      teardown();
      statusRef.current = "idle";
      setStatus("idle");
      setError(message);
      toast.error(message);
    }
  }, [ensureChatId, handleServerEvent, sendEvent, stop, teardown]);

  const toggleMute = useCallback(() => {
    const tracks = micRef.current?.getAudioTracks() ?? [];
    if (tracks.length === 0) return;

    const nextMuted = tracks[0].enabled;
    tracks.forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }, []);

  /** Typed messages join the live call so the two modes share one conversation. */
  const sendText = useCallback(
    (text: string): boolean => {
      if (statusRef.current !== "live") return false;

      const delivered = sendEvent({
        type: "conversation.item.create",
        item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
      });

      if (!delivered) return false;

      sendEvent({ type: "response.create" });
      void commitMessage("user", text);
      return true;
    },
    [commitMessage, sendEvent]
  );

  /**
   * Approvals raised on a call resolve here whether or not the call is still up.
   * A live session is told the outcome as a note so it can speak the result.
   */
  const resolveActions = useCallback(
    async (decisions: Array<{ pendingActionId: string; approved: boolean }>) => {
      const targetChatId = sessionChatIdRef.current ?? chatIdRef.current;
      if (!targetChatId) return;

      try {
        const response = await fetch(`/api/ai-chat/${targetChatId}/voice/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decisions }),
        });
        const payload = await response.json();

        if (!payload.data) {
          toast.error(payload.error ?? "Could not apply those actions");
          return;
        }

        const resolutions = payload.data.resolutions as VoiceResolution[];
        callbacksRef.current.applyResolutions(resolutions);

        if (statusRef.current === "live") {
          sendEvent({
            type: "conversation.item.create",
            item: {
              type: "message",
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: `Approval results:\n${resolutions
                    .map((resolution) => resolution.note)
                    .join("\n")}\n\nTell the user the outcome in one or two short sentences.`,
                },
              ],
            },
          });
          sendEvent({ type: "response.create" });
        }
      } catch (resolveError) {
        console.error("[AIVoice] failed to resolve actions:", resolveError);
        toast.error("Could not apply those actions");
      }
    },
    [sendEvent]
  );

  // Switching chats mid-call would mix two conversations, so the call ends first.
  useEffect(() => {
    if (statusRef.current === "idle") return;
    if (!sessionChatIdRef.current || chatId === sessionChatIdRef.current) return;
    stop();
  }, [chatId, stop]);

  useEffect(() => () => teardown(), [teardown]);

  return {
    status,
    isLive: status === "live",
    isConnecting: status === "connecting",
    error,
    isMuted,
    isUserSpeaking,
    isAssistantSpeaking,
    userDraft,
    assistantDraft,
    activeToolLabels,
    start,
    stop,
    toggleMute,
    sendText,
    resolveActions,
  };
}
