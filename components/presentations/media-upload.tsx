"use client";

import { useState, useRef } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MediaUploadProps {
  value: string;
  mediaType: "image" | "video" | "";
  onUpload: (url: string, type: "image" | "video") => void;
  onRemove: () => void;
  className?: string;
}

export function MediaUpload({ value, mediaType, onUpload, onRemove, className }: MediaUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      const type = file.type.startsWith("video/") ? "video" : "image";
      onUpload(data.url, type);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (value) {
    return (
      <div className={cn("relative overflow-hidden rounded-lg border border-secondary-200", className)}>
        {mediaType === "video" ? (
          <video
            src={value}
            className="h-40 w-full object-cover"
            muted
            playsInline
          />
        ) : (
          <img src={value} alt="" className="h-40 w-full object-cover" />
        )}
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute right-2 top-2 size-6"
          onClick={onRemove}
        >
          <X className="size-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="flex h-28 w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-secondary-300 text-sm text-secondary-500 transition-colors hover:border-primary-400 hover:text-primary-600"
      >
        {isUploading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="size-4" />
            Upload Image or Video
          </>
        )}
      </button>
    </div>
  );
}
