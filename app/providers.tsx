"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </TooltipProvider>
    </SessionProvider>
  );
}
