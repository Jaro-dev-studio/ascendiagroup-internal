"use client";

import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { AIChatPanel } from "./AIChatPanel";
import type { Node, Edge } from "@xyflow/react";

interface AIChatButtonProps {
  nodes: Node[];
  setNodes: (nodes: Node[]) => void;
  edges: Edge[];
  setEdges: (edges: Edge[]) => void;
}

export function AIChatButton({ nodes, setNodes, edges, setEdges }: AIChatButtonProps) {
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
      <AIChatPanel 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        nodes={nodes}
        setNodes={setNodes}
        edges={edges}
        setEdges={setEdges}
      />
    </>
  );
} 