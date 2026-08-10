"use client";

import { X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { Node } from "@xyflow/react";

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  setNodes: (nodes: Node[]) => void;
  edges: any[];
  setEdges: (edges: any[]) => void;
}

export function AIChatPanel({ isOpen, onClose, nodes, setNodes, edges, setEdges }: AIChatPanelProps) {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ type: "user" | "ai", content: string }>>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus the input when panel opens
    inputRef.current?.focus();
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!message.trim() || isLoading) return;
    
    setIsLoading(true);
    const userMessage = message.trim();
    setChatHistory(prev => [...prev, { type: "user", content: userMessage }]);
    setMessage("");
    
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMessage,
          nodes,
          edges
        }),
      });
      
      if (!response.ok) throw new Error("Failed to send message");
      
      const data = await response.json();
      
      if (data.nodes) {
        setNodes(data.nodes);
        if (data.edges) setEdges(data.edges);
        setChatHistory(prev => [...prev, { type: "ai", content: data.message }]);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setChatHistory(prev => [...prev, { type: "ai", content: "Sorry, there was an error processing your request." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 z-50 flex h-full w-96 flex-col bg-background p-4 shadow-lg dark:bg-background-dark"
    >
      <div className="flex items-center justify-between border-b border-border pb-4 dark:border-border-dark">
        <h2 className="text-lg font-semibold">AI Chat</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto py-4">
        {chatHistory.map((msg, index) => (
          <div
            key={index}
            className={`rounded-lg p-3 text-sm ${
              msg.type === "user" 
                ? "bg-primary text-text-light ml-8" 
                : "mr-8 bg-background-secondary dark:bg-background-dark-secondary"
            }`}
          >
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="mr-8 animate-pulse rounded-lg bg-background-secondary p-3 dark:bg-background-dark-secondary">
            <div className="h-4 w-12 rounded-full bg-background-tertiary dark:bg-background-dark" />
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-border pt-4 dark:border-border-dark">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="focus:ring-primary flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 dark:border-border-dark dark:bg-background-dark"
          disabled={isLoading}
        />
        <Button 
          size="icon" 
          onClick={handleSubmit}
          disabled={isLoading}
        >
          <Send className="size-4" />
        </Button>
      </div>
    </motion.div>
  );
} 