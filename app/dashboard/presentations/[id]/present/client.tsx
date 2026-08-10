"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SlideRenderer } from "@/components/presentations/slide-renderer";
import type { Slide } from "@/components/presentations/slide-types";
import type { Presentation } from "@prisma/client";

interface PresentViewerClientProps {
  presentation: Presentation;
}

export function PresentViewerClient({ presentation }: PresentViewerClientProps) {
  const router = useRouter();
  const slides = (presentation.slides as unknown as Slide[]) || [];
  const [currentIndex, setCurrentIndex] = useState(0);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const exit = useCallback(() => {
    router.push(`/dashboard/presentations/${presentation.id}`);
  }, [router, presentation.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case " ":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
          e.preventDefault();
          goPrev();
          break;
        case "Escape":
          e.preventDefault();
          exit();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, exit]);

  if (slides.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <p>No slides in this presentation.</p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex cursor-pointer items-center justify-center bg-black"
      onClick={goNext}
    >
      <div className="relative size-full">
        <div className="flex size-full items-center justify-center p-4">
          <div className="aspect-video max-h-full w-full" style={{ maxWidth: "calc(100vh * 16 / 9)" }}>
            <SlideRenderer slide={slides[currentIndex]} />
          </div>
        </div>

        {/* Slide counter */}
        <div className="absolute bottom-4 right-6 rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white/80">
          {currentIndex + 1} / {slides.length}
        </div>

        {/* Navigation hints */}
        <button
          className="absolute left-0 top-0 flex h-full w-16 items-center justify-center text-white/0 transition-colors hover:text-white/30"
          onClick={(e) => {
            e.stopPropagation();
            goPrev();
          }}
        >
          &larr;
        </button>
        <button
          className="absolute right-0 top-0 flex h-full w-16 items-center justify-center text-white/0 transition-colors hover:text-white/30"
          onClick={(e) => {
            e.stopPropagation();
            goNext();
          }}
        >
          &rarr;
        </button>

        {/* ESC hint */}
        <button
          className="absolute left-6 top-4 rounded-md bg-black/60 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:text-white/90"
          onClick={(e) => {
            e.stopPropagation();
            exit();
          }}
        >
          ESC to exit
        </button>
      </div>
    </div>
  );
}
