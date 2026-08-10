"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";
import { EditableSlideRenderer, TypeSelector } from "@/components/presentations/editable-slide-renderer";
import type { Slide, SlideType } from "@/components/presentations/slide-types";
import { createDefaultSlide } from "@/components/presentations/slide-types";
import { updatePresentation } from "@/lib/actions";
import type { Presentation } from "@prisma/client";

interface LiveEditClientProps {
  presentation: Presentation;
}

export function LiveEditClient({ presentation }: LiveEditClientProps) {
  const router = useRouter();
  const [slides, setSlides] = useState<Slide[]>(
    (presentation.slides as unknown as Slide[]) || []
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await updatePresentation(presentation.id, {
        title: presentation.title,
        slides,
      });
      if (result.error) {
        alert(result.error);
        return;
      }
      setLastSaved(new Date());
    } catch {
      alert("Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [presentation.id, presentation.title, slides]);

  const goNext = useCallback(() => {
    if (isEditing) return;
    setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length, isEditing]);

  const goPrev = useCallback(() => {
    if (isEditing) return;
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, [isEditing]);

  const exit = useCallback(() => {
    router.push(`/dashboard/presentations/${presentation.id}`);
  }, [router, presentation.id]);

  const handleSlideChange = useCallback(
    (updated: Slide) => {
      setSlides((prev) => {
        const next = [...prev];
        next[currentIndex] = updated;
        return next;
      });
    },
    [currentIndex]
  );

  const addSlideAfter = useCallback(() => {
    const newSlide = createDefaultSlide("text_center");
    setSlides((prev) => {
      const next = [...prev];
      next.splice(currentIndex + 1, 0, newSlide);
      return next;
    });
    setCurrentIndex((prev) => prev + 1);
  }, [currentIndex]);

  const handleTypeChange = useCallback((newType: SlideType) => {
    setSlides((prev) => {
      const next = [...prev];
      const current = next[currentIndex];
      const text = current.text;
      switch (newType) {
        case "text_media_side":
          next[currentIndex] = {
            type: "text_media_side",
            text,
            mediaUrl: "mediaUrl" in current ? current.mediaUrl : "",
            mediaType: "mediaType" in current ? current.mediaType : "",
          };
          break;
        case "text_media_stack":
          next[currentIndex] = {
            type: "text_media_stack",
            text,
            mediaUrl: "mediaUrl" in current ? current.mediaUrl : "",
            mediaType: "mediaType" in current ? current.mediaType : "",
          };
          break;
        case "text_center":
          next[currentIndex] = {
            type: "text_center",
            text,
            subtitle: "subtitle" in current ? current.subtitle : "",
          };
          break;
      }
      return next;
    });
  }, [currentIndex]);

  const deleteCurrentSlide = useCallback(() => {
    if (slides.length <= 1) return;
    setSlides((prev) => {
      const next = [...prev];
      next.splice(currentIndex, 1);
      return next;
    });
    setCurrentIndex((prev) => Math.min(prev, slides.length - 2));
  }, [currentIndex, slides.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable;

      if (inInput) {
        if (e.key === "Escape") {
          (target as HTMLElement).blur();
          setIsEditing(false);
        }
        return;
      }

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
        case "s":
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            handleSave();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, exit, handleSave, isEditing]);

  useEffect(() => {
    const handler = () => setIsEditing(true);
    const blurHandler = () => setIsEditing(false);

    document.addEventListener("dblclick", handler);
    document.addEventListener("focusout", blurHandler);
    return () => {
      document.removeEventListener("dblclick", handler);
      document.removeEventListener("focusout", blurHandler);
    };
  }, []);

  if (slides.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <p>No slides in this presentation.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <div className="relative size-full">
        <div className="flex size-full items-center justify-center p-4">
          <div
            className="aspect-video max-h-full w-full"
            style={{ maxWidth: "calc(100vh * 16 / 9)" }}
          >
            <EditableSlideRenderer
              slide={slides[currentIndex]}
              onChange={handleSlideChange}
              onTypeChange={handleTypeChange}
            />
          </div>
        </div>

        {/* Top toolbar */}
        <div className="absolute right-0 top-0 z-30 flex items-center gap-2 p-4">
          <TypeSelector
            currentType={slides[currentIndex].type}
            onChange={handleTypeChange}
          />
          {lastSaved && (
            <span className="text-xs text-white/40">
                Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-md bg-primary-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>

        {/* Bottom toolbar */}
        <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteCurrentSlide();
            }}
            disabled={slides.length <= 1}
            className="hover:bg-red-600/80 flex items-center gap-1.5 rounded-md bg-black/60 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-30"
            title="Delete slide"
          >
            <Trash2 className="size-3.5" />
          </button>

          <div className="rounded-full bg-black/60 px-4 py-1.5 text-sm font-medium text-white/80">
            {currentIndex + 1} / {slides.length}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              addSlideAfter();
            }}
            className="flex items-center gap-1.5 rounded-md bg-black/60 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:bg-primary-600/80 hover:text-white"
            title="Add slide after"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {/* Navigation arrows */}
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
      </div>
    </div>
  );
}
