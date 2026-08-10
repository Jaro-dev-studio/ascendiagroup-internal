"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, Loader2, X, ChevronDown } from "lucide-react";
import { SlideWrapper } from "./slide-wrapper";
import { SlideMedia } from "./slide-media";
import type { Slide, SlideType } from "./slide-types";
import { SLIDE_TYPE_LABELS } from "./slide-types";

interface EditableSlideRendererProps {
  slide: Slide;
  onChange: (updated: Slide) => void;
  onTypeChange?: (type: SlideType) => void;
}

function EditableText({
  value,
  placeholder,
  onChange,
  className,
}: {
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
  className: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleDoubleClick = () => {
    setIsEditing(true);
    setTimeout(() => ref.current?.focus(), 0);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setIsEditing(false);
          }
        }}
        className={`${className} resize-none rounded-lg border-none bg-transparent p-2 outline-none ring-2 ring-primary-500 ring-offset-2`}
        rows={Math.max(1, value.split("\n").length)}
        style={{ field_sizing: "content" } as React.CSSProperties}
      />
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`${className} cursor-text rounded-lg transition-all hover:ring-2 hover:ring-primary-300 hover:ring-offset-2`}
      title="Double-click to edit"
    >
      {value || <span className="opacity-40">{placeholder}</span>}
    </div>
  );
}

function MediaDropZone({
  mediaUrl,
  mediaType,
  onUpload,
  onRemove,
  className,
}: {
  mediaUrl: string;
  mediaType: "image" | "video" | "";
  onUpload: (url: string, type: "image" | "video") => void;
  onRemove: () => void;
  className?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("context", "presentations");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");

      const type = file.type.startsWith("video/") ? "video" : "image";
      onUpload(data.url, type);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload");
    } finally {
      setIsUploading(false);
    }
  }, [onUpload]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
        uploadFile(file);
      }
    },
    [uploadFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  if (mediaUrl) {
    return (
      <div
        className={`group relative ${className || ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <SlideMedia url={mediaUrl} type={mediaType} className="rounded-none" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
        >
          <X className="size-4" />
        </button>
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary-500/20 backdrop-blur-sm">
            <p className="text-lg font-bold text-primary-700">Drop to replace</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center ${className || ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        className="hidden"
      />
      {isUploading ? (
        <div className="flex flex-col items-center gap-2 text-neutral-400">
          <Loader2 className="size-8 animate-spin" />
          <span className="text-sm font-medium">Uploading...</span>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-8 py-6 transition-colors ${
            isDragging
              ? "border-primary-500 bg-primary-50 text-primary-600"
              : "border-neutral-300 text-neutral-400 hover:border-primary-400 hover:text-primary-500"
          }`}
        >
          <Upload className="size-6" />
          <span className="text-sm font-medium">
            Drop or click to upload
          </span>
        </button>
      )}
    </div>
  );
}

export function TypeSelector({
  currentType,
  onChange,
}: {
  currentType: SlideType;
  onChange: (type: SlideType) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const types = Object.entries(SLIDE_TYPE_LABELS) as [SlideType, string][];

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-black/80 hover:text-white"
      >
        {SLIDE_TYPE_LABELS[currentType]}
        <ChevronDown className="size-3" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-lg bg-white py-1 shadow-xl ring-1 ring-black/10">
            {types.map(([type, label]) => (
              <button
                key={type}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(type);
                  setIsOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-100 ${
                  type === currentType ? "font-semibold text-primary-600" : "text-neutral-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function EditableSlideRenderer({ slide, onChange, onTypeChange }: EditableSlideRendererProps) {
  const handleTypeChange = (newType: SlideType) => {
    if (newType === slide.type) return;
    if (onTypeChange) {
      onTypeChange(newType);
      return;
    }

    const text = slide.text;
    switch (newType) {
      case "text_media_side":
        onChange({
          type: "text_media_side",
          text,
          mediaUrl: "mediaUrl" in slide ? slide.mediaUrl : "",
          mediaType: "mediaType" in slide ? slide.mediaType : "",
        });
        break;
      case "text_media_stack":
        onChange({
          type: "text_media_stack",
          text,
          mediaUrl: "mediaUrl" in slide ? slide.mediaUrl : "",
          mediaType: "mediaType" in slide ? slide.mediaType : "",
        });
        break;
      case "text_center":
        onChange({
          type: "text_center",
          text,
          subtitle: "subtitle" in slide ? slide.subtitle : "",
        });
        break;
    }
  };

  const handleMediaUpload = (url: string, type: "image" | "video") => {
    if (slide.type === "text_media_side" || slide.type === "text_media_stack") {
      onChange({ ...slide, mediaUrl: url, mediaType: type });
    }
  };

  const handleMediaRemove = () => {
    if (slide.type === "text_media_side" || slide.type === "text_media_stack") {
      onChange({ ...slide, mediaUrl: "", mediaType: "" });
    }
  };

  return (
    <div className="group/slide relative">
      {slide.type === "text_media_side" && (
        <SlideWrapper>
          <div className="flex min-h-0 flex-1 items-center gap-12">
            <div className="flex-1">
              <EditableText
                value={slide.text}
                placeholder="Text goes here"
                onChange={(text) => onChange({ ...slide, text })}
                className="text-4xl font-black leading-tight tracking-tight text-neutral-900"
              />
            </div>
            <div className="flex h-full w-1/2 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 shadow-lg">
              <MediaDropZone
                mediaUrl={slide.mediaUrl}
                mediaType={slide.mediaType}
                onUpload={handleMediaUpload}
                onRemove={handleMediaRemove}
                className="size-full"
              />
            </div>
          </div>
        </SlideWrapper>
      )}

      {slide.type === "text_media_stack" && (
        <SlideWrapper>
          <div className="shrink-0 text-center">
            <EditableText
              value={slide.text}
              placeholder="Text goes here"
              onChange={(text) => onChange({ ...slide, text })}
              className="text-4xl font-black leading-tight tracking-tight text-neutral-900"
            />
          </div>
          <div className="mt-6 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 shadow-lg">
            <MediaDropZone
              mediaUrl={slide.mediaUrl}
              mediaType={slide.mediaType}
              onUpload={handleMediaUpload}
              onRemove={handleMediaRemove}
              className="size-full"
            />
          </div>
        </SlideWrapper>
      )}

      {slide.type === "text_center" && (
        <SlideWrapper>
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <EditableText
              value={slide.text}
              placeholder="Text goes here"
              onChange={(text) => onChange({ ...slide, text })}
              className="max-w-4xl text-5xl font-black leading-tight tracking-tight text-primary-500"
            />
            <div className="mt-4">
              <EditableText
                value={slide.subtitle}
                placeholder="Subtitle (optional)"
                onChange={(subtitle) => onChange({ ...slide, subtitle })}
                className="max-w-2xl text-xl font-medium text-neutral-400"
              />
            </div>
          </div>
        </SlideWrapper>
      )}
    </div>
  );
}
