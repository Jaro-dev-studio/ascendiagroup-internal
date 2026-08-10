"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MediaUpload } from "./media-upload";
import { SlideRenderer } from "./slide-renderer";
import {
  type Slide,
  type SlideType,
  SLIDE_TYPE_LABELS,
} from "./slide-types";

const ALL_SLIDE_TYPES = Object.keys(SLIDE_TYPE_LABELS) as SlideType[];

interface SlideFormProps {
  slides: Slide[];
  onSlidesChange: (slides: Slide[]) => void;
  onAiSplit: (script: string) => Promise<string | null>;
  isSplitting: boolean;
}

function scriptToSlides(script: string, existingSlides: Slide[]): Slide[] {
  const lines = script.split("\n").filter((line) => line.trim().length > 0);
  return lines.map((line, i) => {
    const existing = existingSlides[i];
    if (existing && existing.text === line.trim()) return existing;
    if (existing) return { ...existing, text: line.trim() };
    return { type: "text_center" as const, text: line.trim(), subtitle: "" };
  });
}

function slidesToScript(slides: Slide[]): string {
  return slides.map((s) => s.text).join("\n");
}

export function SlideForm({ slides, onSlidesChange, onAiSplit, isSplitting }: SlideFormProps) {
  const [script, setScript] = useState(() => slidesToScript(slides));
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const scriptRef = useRef(script);

  useEffect(() => {
    scriptRef.current = script;
  }, [script]);

  const syncSlidesFromScript = useCallback((newScript: string) => {
    setScript(newScript);
    const newSlides = scriptToSlides(newScript, slides);
    onSlidesChange(newSlides);
  }, [slides, onSlidesChange]);

  const handleAiSplit = async () => {
    const currentScript = scriptRef.current;
    if (!currentScript.trim()) return;
    const result = await onAiSplit(currentScript);
    if (result) {
      syncSlidesFromScript(result);
    }
  };

  const updateSlideType = (index: number, newType: SlideType) => {
    const next = [...slides];
    const text = next[index].text;
    if (newType === "text_center") {
      next[index] = { type: "text_center", text, subtitle: "" };
    } else if (newType === "text_media_stack") {
      next[index] = { type: "text_media_stack", text, mediaUrl: "", mediaType: "" };
    } else {
      next[index] = { type: "text_media_side", text, mediaUrl: "", mediaType: "" };
    }
    onSlidesChange(next);
  };

  const updateSlideMedia = (index: number, mediaUrl: string, mediaType: "image" | "video" | "") => {
    const next = [...slides];
    const slide = next[index];
    if (slide.type !== "text_center") {
      next[index] = { ...slide, mediaUrl, mediaType };
      onSlidesChange(next);
    }
  };

  const removeSlideMedia = (index: number) => {
    updateSlideMedia(index, "", "");
  };

  const removeSlide = (index: number) => {
    const lines = script.split("\n").filter((l) => l.trim().length > 0);
    lines.splice(index, 1);
    syncSlidesFromScript(lines.join("\n"));
    if (previewIndex === index) setPreviewIndex(null);
  };

  const moveSlide = (index: number, direction: "up" | "down") => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    onSlidesChange(next);
    setScript(slidesToScript(next));
  };

  const addSlideAfter = (index: number) => {
    const lines = script.split("\n").filter((l) => l.trim().length > 0);
    lines.splice(index + 1, 0, "New slide");
    syncSlidesFromScript(lines.join("\n"));
  };

  return (
    <div className="space-y-4">
      {/* Script Editor */}
      <Card className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Script</h3>
            <p className="text-sm text-secondary-500">
              Each line becomes a slide. Use the AI button to auto-split, or add newlines yourself.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const capitalized = script
                  .split("\n")
                  .map((line) => line.length > 0 ? line.charAt(0).toUpperCase() + line.slice(1) : line)
                  .join("\n");
                syncSlidesFromScript(capitalized);
              }}
              disabled={!script.trim()}
            >
              Aa
            </Button>
            <Button
              type="button"
              onClick={handleAiSplit}
              disabled={isSplitting || !script.trim()}
              size="sm"
            >
              {isSplitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Splitting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" />
                  AI Split
                </>
              )}
            </Button>
          </div>
        </div>
        <textarea
          value={script}
          onChange={(e) => syncSlidesFromScript(e.target.value)}
          placeholder="Paste your video script here... Each line becomes a slide."
          rows={12}
          className="w-full rounded-lg border border-secondary-200 p-3 font-mono text-sm leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <p className="mt-2 text-xs text-secondary-400">
          {slides.length} slide{slides.length !== 1 ? "s" : ""}
        </p>
      </Card>

      {/* Slides list */}
      {slides.map((slide, index) => (
        <div key={index}>
          <Card className="overflow-hidden border-secondary-200">
            {/* Slide header */}
            <div className="flex items-center gap-3 border-b border-secondary-100 bg-secondary-50 px-4 py-2.5">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary-500 text-xs font-bold text-white">
                {index + 1}
              </span>

              <p className="flex-1 truncate text-sm font-medium text-secondary-700">
                {slide.text || "Empty slide"}
              </p>

              <div className="flex items-center gap-1">
                {/* Type selector */}
                <select
                  value={slide.type}
                  onChange={(e) => updateSlideType(index, e.target.value as SlideType)}
                  className="rounded-md border border-secondary-200 bg-white px-2 py-1 text-xs font-medium text-secondary-600 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {ALL_SLIDE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SLIDE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setPreviewIndex(previewIndex === index ? null : index)}
                >
                  {previewIndex === index ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => moveSlide(index, "up")}
                  disabled={index === 0}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => moveSlide(index, "down")}
                  disabled={index === slides.length - 1}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-danger-500 hover:text-danger-600"
                  onClick={() => removeSlide(index)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>

            {/* Preview */}
            {previewIndex === index && (
              <div className="border-b border-secondary-200 bg-neutral-100 p-4">
                <div className="mx-auto max-w-3xl overflow-hidden rounded-lg shadow-lg">
                  <SlideRenderer slide={slide} />
                </div>
              </div>
            )}

            {/* Media upload for media types */}
            {slide.type !== "text_center" && (
              <div className="p-4">
                <label className="mb-1 block text-xs font-medium text-secondary-500">
                  {slide.type === "text_media_stack" ? "Media (below text)" : "Media (right side)"}
                </label>
                <MediaUpload
                  value={slide.mediaUrl}
                  mediaType={slide.mediaType}
                  onUpload={(url, type) => updateSlideMedia(index, url, type)}
                  onRemove={() => removeSlideMedia(index)}
                />
              </div>
            )}

            {/* Subtitle for text_center */}
            {slide.type === "text_center" && (
              <div className="p-4">
                <label className="mb-1 block text-xs font-medium text-secondary-500">Subtitle (optional)</label>
                <input
                  value={slide.subtitle}
                  onChange={(e) => {
                    const next = [...slides];
                    next[index] = { ...slide, subtitle: e.target.value };
                    onSlidesChange(next);
                  }}
                  placeholder="Optional subtitle..."
                  className="w-full rounded-lg border border-secondary-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            )}
          </Card>

          {/* Insert slide button */}
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={() => addSlideAfter(index)}
              className="flex items-center gap-1 rounded-full border border-dashed border-secondary-300 bg-white px-3 py-1 text-xs font-medium text-secondary-400 transition-colors hover:border-primary-500 hover:text-primary-500"
            >
              <Plus className="size-3" />
              Add slide
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
