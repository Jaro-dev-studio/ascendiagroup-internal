"use client";

import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { FunnelAIChatPanel } from "./FunnelAIChatPanel";

interface FunnelAIChatButtonProps {
  flowData: any;
}

export function FunnelAIChatButton({ flowData }: FunnelAIChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Button variant="ghost" onClick={() => setIsOpen(true)}>
        <MessageSquarePlus className="mr-2 size-4" />
        AI Chat
      </Button>
      <FunnelAIChatPanel 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        flowData={flowData}
      />
    </>
  );
} 