"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageSquare, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ChatSummary } from "./types";

interface ChatSidebarProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSelect: (chatId: string) => void;
  onCreate: () => void;
  onDelete: (chatId: string) => void;
  onRename: (chatId: string, title: string) => void;
}

export function ChatSidebar({
  chats,
  activeChatId,
  isLoading,
  searchQuery,
  onSearchChange,
  onSelect,
  onCreate,
  onDelete,
  onRename,
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editRef.current?.focus();
  }, [editingId]);

  const commitRename = () => {
    if (editingId) onRename(editingId, draftTitle);
    setEditingId(null);
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="flex flex-col gap-2 border-b border-neutral-200 p-3">
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-100"
        >
          <Plus className="size-4" />
          New chat
        </button>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-4 animate-spin text-neutral-400" />
          </div>
        ) : chats.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-neutral-400">No chats yet</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {chats.map((chat) => (
              <li key={chat.id}>
                {editingId === chat.id ? (
                  <div className="flex items-center gap-1 p-1">
                    <Input
                      ref={editRef}
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitRename();
                        if (event.key === "Escape") setEditingId(null);
                      }}
                      className="h-8 text-sm"
                      aria-label="Chat title"
                    />
                    <button
                      type="button"
                      onClick={commitRename}
                      className="rounded-sm p-1.5 text-neutral-500 hover:text-neutral-900"
                      aria-label="Save title"
                    >
                      <Check className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "group flex items-center gap-2 rounded-md px-2 py-2 transition-colors",
                      chat.id === activeChatId
                        ? "bg-white shadow-sm"
                        : "hover:bg-neutral-100"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(chat.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <MessageSquare className="size-3.5 shrink-0 text-neutral-400" />
                      <span className="truncate text-sm text-neutral-800">{chat.title}</span>
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(chat.id);
                          setDraftTitle(chat.title);
                        }}
                        className="rounded-sm p-1 text-neutral-400 hover:text-neutral-800"
                        aria-label={`Rename ${chat.title}`}
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(chat.id)}
                        className="rounded-sm p-1 text-neutral-400 hover:text-danger-600"
                        aria-label={`Delete ${chat.title}`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
