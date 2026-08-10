"use client";

import { X, Send, Sparkles, Loader2, Check, XCircle, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface BlockData {
  type: "page" | "externalApi" | "customLogic";
  name: string;
  description: string;
  apiUrl?: string;
}

interface SuccessCriteriaData {
  nodeId: string;
  nodeName: string;
  successCriteria: string[];
}

interface ProductBuilderAIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  existingNodes: Array<{
    id: string;
    type: string;
    name: string;
    description?: string;
    successCriteria?: Array<{ id: string; text: string }>;
  }>;
  onAddBlocks: (blocks: BlockData[]) => void;
  onAddSuccessCriteria: (criteria: SuccessCriteriaData[]) => void;
}

interface PendingBlockChange {
  id: string;
  type: "blocks";
  blocks: BlockData[];
  message: string;
}

interface PendingCriteriaChange {
  id: string;
  type: "criteria";
  criteria: SuccessCriteriaData[];
  message: string;
}

type PendingChange = PendingBlockChange | PendingCriteriaChange;

interface ChatMessage {
  type: "user" | "ai";
  content: string;
  blocks?: BlockData[];
  criteria?: SuccessCriteriaData[];
  pendingChangeId?: string;
  approved?: boolean;
}

export function ProductBuilderAIChatPanel({
  isOpen,
  onClose,
  existingNodes,
  onAddBlocks,
  onAddSuccessCriteria,
}: ProductBuilderAIChatPanelProps) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, PendingChange>>(new Map());
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      type: "ai",
      content: "Hi! I can help you build your MVP. I can:\n\n- **Add blocks**: \"Add a dashboard and settings page\"\n- **Generate success criteria**: \"Generate success criteria for the Dashboard\"\n\nJust describe what you need!",
    },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    const userMessage = message.trim();
    setChatHistory((prev) => [...prev, { type: "user", content: userMessage }]);
    setMessage("");

    try {
      const response = await fetch("/api/chat/product-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          existingNodes: existingNodes.map((n) => ({
            id: n.id,
            type: n.type,
            name: n.name,
            description: n.description,
            successCriteria: n.successCriteria,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const data = await response.json();

      // If blocks were returned, store as pending for approval
      if (data.action === "add_blocks" && data.blocks && data.blocks.length > 0) {
        const changeId = `change-${Date.now()}`;
        const pendingChange: PendingBlockChange = {
          id: changeId,
          type: "blocks",
          blocks: data.blocks,
          message: data.message,
        };
        
        setPendingChanges((prev) => new Map(prev).set(changeId, pendingChange));
        setChatHistory((prev) => [
          ...prev,
          { type: "ai", content: data.message, blocks: data.blocks, pendingChangeId: changeId },
        ]);
      } else if (data.action === "generate_success_criteria" && data.criteria && data.criteria.length > 0) {
        const changeId = `change-${Date.now()}`;
        const pendingChange: PendingCriteriaChange = {
          id: changeId,
          type: "criteria",
          criteria: data.criteria,
          message: data.message,
        };
        
        setPendingChanges((prev) => new Map(prev).set(changeId, pendingChange));
        setChatHistory((prev) => [
          ...prev,
          { type: "ai", content: data.message, criteria: data.criteria, pendingChangeId: changeId },
        ]);
      } else {
        setChatHistory((prev) => [...prev, { type: "ai", content: data.message }]);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setChatHistory((prev) => [
        ...prev,
        { type: "ai", content: "Sorry, there was an error processing your request. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveChange = (changeId: string) => {
    const change = pendingChanges.get(changeId);
    if (!change) return;

    // Apply the change based on type
    if (change.type === "blocks") {
      onAddBlocks(change.blocks);
    } else if (change.type === "criteria") {
      onAddSuccessCriteria(change.criteria);
    }

    // Remove from pending
    setPendingChanges((prev) => {
      const updated = new Map(prev);
      updated.delete(changeId);
      return updated;
    });

    // Mark as approved in chat history
    setChatHistory((prev) =>
      prev.map((msg) =>
        msg.pendingChangeId === changeId ? { ...msg, approved: true, pendingChangeId: undefined } : msg
      )
    );
  };

  const handleRejectChange = (changeId: string) => {
    // Remove from pending
    setPendingChanges((prev) => {
      const updated = new Map(prev);
      updated.delete(changeId);
      return updated;
    });

    // Mark as rejected in chat history
    setChatHistory((prev) =>
      prev.map((msg) =>
        msg.pendingChangeId === changeId ? { ...msg, approved: false, pendingChangeId: undefined } : msg
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getBlockTypeLabel = (type: string) => {
    switch (type) {
      case "page":
        return "Page";
      case "externalApi":
        return "API";
      case "customLogic":
        return "Logic";
      default:
        return type;
    }
  };

  const getBlockTypeColor = (type: string) => {
    switch (type) {
      case "page":
        return "bg-primary-100 text-primary-700";
      case "externalApi":
        return "bg-success-100 text-success-700";
      case "customLogic":
        return "bg-warning-100 text-warning-700";
      default:
        return "bg-secondary-100 text-secondary-700";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="absolute bottom-4 right-4 z-50 flex h-[500px] w-[400px] flex-col overflow-hidden rounded-xl border border-secondary-200 bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-secondary-200 bg-secondary-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100">
                <Sparkles className="size-4 text-primary-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-secondary-900">AI Assistant</h2>
                <p className="text-xs text-secondary-500">Powered by GPT-5.2</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>

          {/* Chat History */}
          <div
            ref={chatContainerRef}
            className="flex-1 space-y-4 overflow-y-auto p-4"
          >
            {chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    msg.type === "user"
                      ? "bg-primary-600 text-white"
                      : "bg-secondary-100 text-secondary-900"
                  }`}
                >
                  {msg.type === "ai" ? (
                    <div className="space-y-2">
                      <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert">
                        {msg.content}
                      </ReactMarkdown>
                      
                      {/* Blocks display */}
                      {msg.blocks && msg.blocks.length > 0 && (
                        <div className="mt-2 space-y-2 border-t border-secondary-200 pt-2">
                          <div className="flex flex-wrap gap-1">
                            {msg.blocks.map((block, i) => (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${getBlockTypeColor(block.type)}`}
                              >
                                {getBlockTypeLabel(block.type)}: {block.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Success criteria display */}
                      {msg.criteria && msg.criteria.length > 0 && (
                        <div className="mt-2 space-y-2 border-t border-secondary-200 pt-2">
                          {msg.criteria.map((item, i) => (
                            <div key={i} className="rounded border border-secondary-200 bg-secondary-50 p-2">
                              <div className="flex items-center gap-1 text-xs font-medium text-secondary-700">
                                <ClipboardCheck className="size-3" />
                                {item.nodeName}
                              </div>
                              <ul className="ml-4 mt-1 space-y-0.5">
                                {item.successCriteria.map((criterion, j) => (
                                  <li key={j} className="text-xs text-secondary-600">
                                    {criterion}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Pending approval buttons */}
                      {msg.pendingChangeId && (
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => handleApproveChange(msg.pendingChangeId!)}
                          >
                            <Check className="size-3" />
                            Apply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => handleRejectChange(msg.pendingChangeId!)}
                          >
                            <XCircle className="size-3" />
                            Reject
                          </Button>
                        </div>
                      )}
                      
                      {/* Approved/Rejected status */}
                      {msg.approved === true && !msg.pendingChangeId && (msg.blocks || msg.criteria) && (
                        <div className="flex items-center gap-1 pt-1 text-xs text-success-600">
                          <Check className="size-3" />
                          Applied
                        </div>
                      )}
                      {msg.approved === false && !msg.pendingChangeId && (msg.blocks || msg.criteria) && (
                        <div className="flex items-center gap-1 pt-1 text-xs text-secondary-500">
                          <XCircle className="size-3" />
                          Rejected
                        </div>
                      )}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-lg bg-secondary-100 px-3 py-2">
                  <Loader2 className="size-4 animate-spin text-secondary-500" />
                  <span className="text-sm text-secondary-500">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2 border-t border-secondary-200 bg-secondary-50 p-3">
            <input
              ref={inputRef}
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe what to add..."
              className="flex-1 rounded-lg border border-secondary-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={handleSubmit}
              disabled={isLoading || !message.trim()}
              className="shrink-0"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
