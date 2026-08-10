"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen, Plus, X } from "lucide-react";
import { useAiChat } from "@/hooks/use-ai-chat";
import { useVoiceSession } from "@/hooks/use-voice-session";
import { ChatSidebar } from "./chat/chat-sidebar";
import { MessageList } from "./chat/message-list";
import { ChatComposer } from "./chat/chat-composer";
import { VoiceBar } from "./chat/voice-bar";
import type { ChatMessage } from "./chat/types";

const SIDEBAR_STORAGE_KEY = "ai-chat-sidebar-open";

interface GlobalAIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalAIChatPanel({ isOpen, onClose }: GlobalAIChatPanelProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const {
    chats,
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
    stop,
    appendMessage,
    replaceMessageId,
    applyResolutions,
    setChatTitle,
  } = useAiChat({ isOpen });

  const {
    status: voiceStatus,
    isLive: isVoiceLive,
    isConnecting: isVoiceConnecting,
    error: voiceError,
    isMuted,
    isUserSpeaking,
    isAssistantSpeaking,
    userDraft,
    assistantDraft,
    activeToolLabels: voiceToolLabels,
    start: startVoice,
    stop: stopVoice,
    toggleMute,
    sendText: sendVoiceText,
    resolveActions: resolveVoiceActions,
  } = useVoiceSession({
    chatId: activeChatId,
    ensureChatId: ensureChat,
    appendMessage,
    replaceMessageId,
    applyResolutions,
    onTitle: setChatTitle,
  });

  // Leaving the panel would hide a live microphone, so the call ends with it.
  useEffect(() => {
    if (!isOpen) stopVoice();
  }, [isOpen, stopVoice]);

  /** Live speech renders as provisional bubbles until the turn is persisted. */
  const visibleMessages = useMemo<ChatMessage[]>(() => {
    if (!userDraft && !assistantDraft) return messages;

    const drafts: ChatMessage[] = [];
    const createdAt = new Date().toISOString();

    if (userDraft) {
      drafts.push({
        id: "voice-draft-user",
        role: "user",
        content: userDraft,
        createdAt,
        isDraft: true,
      });
    }

    if (assistantDraft) {
      drafts.push({
        id: "voice-draft-assistant",
        role: "assistant",
        content: assistantDraft,
        createdAt,
        isDraft: true,
      });
    }

    return [...messages, ...drafts];
  }, [messages, userDraft, assistantDraft]);

  // A live call owns the conversation, so typed messages join it there instead.
  const handleSend = useCallback(
    (text: string) => {
      if (sendVoiceText(text)) return;
      void sendMessage(text);
    },
    [sendMessage, sendVoiceText]
  );

  const voiceActionIds = useMemo(
    () =>
      new Set(
        messages.flatMap((message) =>
          (message.pendingActions ?? [])
            .filter((action) => action.isVoice)
            .map((action) => action.id)
        )
      ),
    [messages]
  );

  const handleResolveActions = useCallback(
    (decisions: Array<{ pendingActionId: string; approved: boolean }>) => {
      const voiceDecisions = decisions.filter((decision) =>
        voiceActionIds.has(decision.pendingActionId)
      );
      const textDecisions = decisions.filter(
        (decision) => !voiceActionIds.has(decision.pendingActionId)
      );

      if (voiceDecisions.length > 0) void resolveVoiceActions(voiceDecisions);
      if (textDecisions.length > 0) void resolveActions(textDecisions);
    },
    [resolveActions, resolveVoiceActions, voiceActionIds]
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    setIsSidebarOpen(stored === null ? window.innerWidth >= 1024 : stored === "true");
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!prev));
      return !prev;
    });
  };

  const activeTitle = chats.find((chat) => chat.id === activeChatId)?.title ?? "New chat";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-background-overlay"
            aria-hidden="true"
          />

          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            role="dialog"
            aria-label="AI assistant"
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-glass md:w-[min(1100px,92vw)]"
          >
            <header className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2.5">
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={isSidebarOpen ? "Hide chat history" : "Show chat history"}
                className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                {isSidebarOpen ? (
                  <PanelLeftClose className="size-4" />
                ) : (
                  <PanelLeftOpen className="size-4" />
                )}
              </button>

              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-900">
                {activeTitle}
              </h2>

              <button
                type="button"
                onClick={() => void createChat()}
                aria-label="New chat"
                className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <Plus className="size-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close assistant"
                className="rounded-md p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="relative flex min-h-0 flex-1">
              <AnimatePresence initial={false}>
                {isSidebarOpen && (
                  <motion.button
                    key="sidebar-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    type="button"
                    onClick={toggleSidebar}
                    aria-label="Hide chat history"
                    className="absolute inset-0 z-10 bg-background-overlay md:hidden"
                  />
                )}

                {isSidebarOpen && (
                  <motion.div
                    key="sidebar"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 256, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-y-0 left-0 z-20 overflow-hidden md:relative md:z-auto"
                  >
                    <ChatSidebar
                      chats={chats}
                      activeChatId={activeChatId}
                      isLoading={isLoadingChats}
                      searchQuery={searchQuery}
                      onSearchChange={setSearchQuery}
                      onSelect={(chatId) => {
                        selectChat(chatId);
                        if (window.innerWidth < 768) toggleSidebar();
                      }}
                      onCreate={() => void createChat()}
                      onDelete={(chatId) => void deleteChat(chatId)}
                      onRename={(chatId, title) => void renameChat(chatId, title)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="min-h-0 flex-1">
                  <MessageList
                    messages={visibleMessages}
                    isLoading={isLoadingMessages}
                    isStreaming={isStreaming}
                    streamingContent={streamingContent}
                    statusMessage={statusMessage}
                    activeTools={activeTools}
                    onSend={handleSend}
                    onResolveActions={handleResolveActions}
                    onRegenerate={regenerate}
                  />
                </div>

                {voiceStatus !== "idle" && (
                  <VoiceBar
                    status={voiceStatus}
                    isMuted={isMuted}
                    isUserSpeaking={isUserSpeaking}
                    isAssistantSpeaking={isAssistantSpeaking}
                    activeToolLabels={voiceToolLabels}
                    error={voiceError}
                    onToggleMute={toggleMute}
                    onEnd={stopVoice}
                  />
                )}

                <ChatComposer
                  isStreaming={isStreaming}
                  isVoiceLive={isVoiceLive}
                  isVoiceConnecting={isVoiceConnecting}
                  onSend={handleSend}
                  onStop={stop}
                  onStartVoice={() => void startVoice()}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
