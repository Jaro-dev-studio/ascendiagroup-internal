"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type {
  ChatMessage,
  ChatSummary,
  ExecutedToolCall,
  PendingAction,
  PendingActionStatus,
} from "@/components/ai/chat/types";

interface StreamEvent {
  type:
    | "status"
    | "title"
    | "tool_start"
    | "tool_end"
    | "content"
    | "confirmation_required"
    | "done"
    | "error";
  message?: string;
  title?: string;
  name?: string;
  label?: string;
  ok?: boolean;
  content?: string;
  messageId?: string | null;
  actions?: PendingAction[];
  toolCalls?: ExecutedToolCall[];
}

interface UseAiChatOptions {
  isOpen: boolean;
}

export function useAiChat({ isOpen }: UseAiChatOptions) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesCache, setMessagesCache] = useState<Record<string, ChatMessage[]>>({});

  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const [streamingContent, setStreamingContent] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);
  const activeChatIdRef = useRef<string | null>(null);

  activeChatIdRef.current = activeChatId;

  const filteredChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return chats;

    return chats.filter((chat) => {
      if (chat.title.toLowerCase().includes(query)) return true;
      if (chat.lastMessage?.toLowerCase().includes(query)) return true;
      return (messagesCache[chat.id] ?? []).some((message) =>
        message.content.toLowerCase().includes(query)
      );
    });
  }, [chats, searchQuery, messagesCache]);

  const cacheMessages = useCallback((chatId: string, next: ChatMessage[]) => {
    setMessagesCache((prev) => ({ ...prev, [chatId]: next }));
  }, []);

  /** Applies an edit to the visible thread and its cache entry together. */
  const updateMessages = useCallback(
    (updater: (previous: ChatMessage[]) => ChatMessage[]) => {
      const chatId = activeChatIdRef.current;

      setMessages((prev) => {
        const next = updater(prev);
        if (chatId) cacheMessages(chatId, next);
        return next;
      });
    },
    [cacheMessages]
  );

  const appendMessage = useCallback(
    (message: ChatMessage) => {
      updateMessages((prev) =>
        prev.some((entry) => entry.id === message.id) ? prev : [...prev, message]
      );
    },
    [updateMessages]
  );

  /** Swaps an optimistic id for the persisted one once the write lands. */
  const replaceMessageId = useCallback(
    (localId: string, serverId: string) => {
      updateMessages((prev) =>
        prev.map((message) => (message.id === localId ? { ...message, id: serverId } : message))
      );
    },
    [updateMessages]
  );

  const setChatTitle = useCallback((chatId: string, title: string) => {
    setChats((prev) => prev.map((chat) => (chat.id === chatId ? { ...chat, title } : chat)));
  }, []);

  /**
   * Marks confirmation cards resolved and files the tool results on the message
   * they belong to, matching what the server just persisted.
   */
  const applyResolutions = useCallback(
    (
      resolutions: Array<{
        pendingActionId: string;
        status: PendingActionStatus;
        executed: ExecutedToolCall;
      }>
    ) => {
      const byId = new Map(resolutions.map((entry) => [entry.pendingActionId, entry]));

      updateMessages((prev) =>
        prev.map((message) => {
          const owned = (message.pendingActions ?? []).filter((action) => byId.has(action.id));
          if (owned.length === 0) return message;

          return {
            ...message,
            pendingActions: (message.pendingActions ?? []).map((action) => {
              const resolution = byId.get(action.id);
              return resolution ? { ...action, status: resolution.status } : action;
            }),
            toolCalls: [
              ...(message.toolCalls ?? []),
              ...owned.map((action) => byId.get(action.id)!.executed),
            ],
          };
        })
      );
    },
    [updateMessages]
  );

  const fetchChats = useCallback(async () => {
    try {
      setIsLoadingChats(true);
      const response = await fetch("/api/ai-chat");
      const payload = await response.json();

      if (!payload.data) return;

      const loaded = payload.data as ChatSummary[];
      setChats(loaded);

      const cache: Record<string, ChatMessage[]> = {};
      loaded.forEach((chat) => {
        if (chat.messages) cache[chat.id] = chat.messages;
      });
      setMessagesCache(cache);

      if (loaded.length > 0) {
        setActiveChatId(loaded[0].id);
        setMessages(loaded[0].messages ?? []);
      }
    } catch (error) {
      console.error("[AIChat] failed to fetch chats:", error);
    } finally {
      setIsLoadingChats(false);
    }
  }, []);

  const fetchMessages = useCallback(
    async (chatId: string, showLoader = true) => {
      try {
        if (showLoader) setIsLoadingMessages(true);
        const response = await fetch(`/api/ai-chat/${chatId}`);
        const payload = await response.json();

        if (payload.data) {
          const next = payload.data.messages as ChatMessage[];
          if (activeChatIdRef.current === chatId) setMessages(next);
          cacheMessages(chatId, next);
        }
      } catch (error) {
        console.error("[AIChat] failed to fetch messages:", error);
      } finally {
        if (showLoader) setIsLoadingMessages(false);
      }
    },
    [cacheMessages]
  );

  useEffect(() => {
    if (!isOpen || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    void fetchChats();
  }, [isOpen, fetchChats]);

  const selectChat = useCallback(
    (chatId: string) => {
      if (chatId === activeChatIdRef.current) return;

      abortRef.current?.abort();
      setIsStreaming(false);
      setStreamingContent("");
      setStatusMessage(null);
      setActiveTools([]);
      setActiveChatId(chatId);

      const cached = messagesCache[chatId];
      if (cached) {
        setMessages(cached);
        void fetchMessages(chatId, false);
      } else {
        setMessages([]);
        void fetchMessages(chatId);
      }
    },
    [messagesCache, fetchMessages]
  );

  const createChat = useCallback(async () => {
    try {
      const response = await fetch("/api/ai-chat", { method: "POST" });
      const payload = await response.json();
      if (!payload.data) return null;

      const chat: ChatSummary = {
        id: payload.data.id,
        title: payload.data.title,
        lastMessage: null,
        updatedAt: payload.data.createdAt,
      };

      setChats((prev) => [chat, ...prev]);
      setActiveChatId(chat.id);
      setMessages([]);
      cacheMessages(chat.id, []);
      return chat.id;
    } catch (error) {
      console.error("[AIChat] failed to create chat:", error);
      toast.error("Could not start a new chat");
      return null;
    }
  }, [cacheMessages]);

  /** The chat on screen, or a fresh one when the panel has nothing open yet. */
  const ensureChat = useCallback(async () => {
    return activeChatIdRef.current ?? (await createChat());
  }, [createChat]);

  const deleteChat = useCallback(
    async (chatId: string) => {
      try {
        await fetch(`/api/ai-chat/${chatId}`, { method: "DELETE" });

        setChats((prev) => {
          const next = prev.filter((chat) => chat.id !== chatId);
          if (activeChatIdRef.current === chatId) {
            const fallback = next[0] ?? null;
            setActiveChatId(fallback?.id ?? null);
            setMessages(fallback ? messagesCache[fallback.id] ?? [] : []);
          }
          return next;
        });
      } catch (error) {
        console.error("[AIChat] failed to delete chat:", error);
        toast.error("Could not delete that chat");
      }
    },
    [messagesCache]
  );

  const renameChat = useCallback(async (chatId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    setChats((prev) =>
      prev.map((chat) => (chat.id === chatId ? { ...chat, title: trimmed } : chat))
    );

    try {
      await fetch(`/api/ai-chat/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch (error) {
      console.error("[AIChat] failed to rename chat:", error);
    }
  }, []);

  const consumeStream = useCallback(
    async (response: Response, chatId: string) => {
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let content = "";
      let needsRefetch = false;

      const commit = (message: ChatMessage) => {
        setMessages((prev) => {
          const next = [...prev, message];
          cacheMessages(chatId, next);
          return next;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;

          let event: StreamEvent;
          try {
            event = JSON.parse(dataLine.slice(6)) as StreamEvent;
          } catch {
            continue;
          }

          switch (event.type) {
            case "status":
              setStatusMessage(event.message ?? null);
              break;

            case "title":
              if (event.title) {
                setChats((prev) =>
                  prev.map((chat) =>
                    chat.id === chatId ? { ...chat, title: event.title as string } : chat
                  )
                );
              }
              break;

            case "tool_start":
              if (event.label) setActiveTools((prev) => [...prev, event.label as string]);
              break;

            case "tool_end":
              if (event.label) {
                setActiveTools((prev) => prev.filter((tool) => tool !== event.label));
              }
              break;

            case "content":
              content += event.content ?? "";
              setStreamingContent(content);
              break;

            case "confirmation_required":
              commit({
                id: event.messageId ?? `pending-${Date.now()}`,
                role: "assistant",
                content,
                toolCalls: null,
                pendingActions: event.actions ?? [],
                createdAt: new Date().toISOString(),
              });
              content = "";
              setStreamingContent("");
              setStatusMessage(null);
              break;

            case "done":
              commit({
                id: event.messageId ?? `assistant-${Date.now()}`,
                role: "assistant",
                content,
                toolCalls: event.toolCalls ?? null,
                pendingActions: [],
                createdAt: new Date().toISOString(),
              });
              content = "";
              setStreamingContent("");
              setStatusMessage(null);
              break;

            case "error":
              toast.error(event.message ?? "Something went wrong");
              needsRefetch = true;
              break;
          }
        }
      }

      return needsRefetch;
    },
    [cacheMessages]
  );

  const runStream = useCallback(
    async (chatId: string, url: string, body: unknown) => {
      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setStreamingContent("");
      setStatusMessage("Thinking...");
      setActiveTools([]);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok && !response.body) {
          throw new Error("Request failed");
        }

        await consumeStream(response, chatId);

        setChats((prev) => {
          const index = prev.findIndex((chat) => chat.id === chatId);
          if (index === -1) return prev;
          const next = [...prev];
          const [chat] = next.splice(index, 1);
          return [{ ...chat, updatedAt: new Date().toISOString() }, ...next];
        });
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          setStatusMessage(null);
          return;
        }
        console.error("[AIChat] stream failed:", error);
        toast.error("The assistant stopped unexpectedly");
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
        setStatusMessage(null);
        setActiveTools([]);
        setStreamingContent("");
      }
    },
    [consumeStream]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      let chatId = activeChatIdRef.current;
      if (!chatId) {
        chatId = await createChat();
        if (!chatId) return;
      }

      const userMessage: ChatMessage = {
        id: `local-${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);

      await runStream(chatId, `/api/ai-chat/${chatId}/message`, { message: trimmed });
    },
    [createChat, isStreaming, runStream]
  );

  const resolveActions = useCallback(
    async (decisions: Array<{ pendingActionId: string; approved: boolean }>) => {
      const chatId = activeChatIdRef.current;
      if (!chatId || isStreaming) return;

      const resolvedIds = new Set(decisions.map((decision) => decision.pendingActionId));

      setMessages((prev) =>
        prev.map((message) => ({
          ...message,
          pendingActions: message.pendingActions?.map((action) =>
            resolvedIds.has(action.id) && action.status === "PENDING"
              ? {
                ...action,
                status: decisions.find((d) => d.pendingActionId === action.id)?.approved
                  ? ("EXECUTED" as const)
                  : ("REJECTED" as const),
              }
              : action
          ),
        }))
      );

      await runStream(chatId, `/api/ai-chat/${chatId}/confirm`, { decisions });
      await fetchMessages(chatId, false);
    },
    [fetchMessages, isStreaming, runStream]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const lastUserMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") return messages[index].content;
    }
    return null;
  }, [messages]);

  const regenerate = useCallback(() => {
    if (!lastUserMessage) return;
    void sendMessage(lastUserMessage);
  }, [lastUserMessage, sendMessage]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    chats: filteredChats,
    totalChats: chats.length,
    activeChatId,
    messages,
    isLoadingChats,
    isLoadingMessages,
    isStreaming,
    streamingContent,
    statusMessage,
    activeTools,
    searchQuery,
    setSearchQuery,
    selectChat,
    createChat,
    ensureChat,
    deleteChat,
    renameChat,
    sendMessage,
    resolveActions,
    regenerate,
    canRegenerate: Boolean(lastUserMessage),
    stop,
    appendMessage,
    replaceMessageId,
    applyResolutions,
    setChatTitle,
    refreshMessages: fetchMessages,
  };
}
