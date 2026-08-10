"use client";

import { useState, useEffect } from "react";
import { ChatLauncher } from "./chat-launcher";
import { GlobalAIChatPanel } from "./GlobalAIChatPanel";

export function GlobalAIChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + L to toggle chat
      if ((event.metaKey || event.ctrlKey) && event.key === "l") {
        event.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Escape to close
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {!isOpen && <ChatLauncher onClick={() => setIsOpen(true)} />}
      <GlobalAIChatPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
