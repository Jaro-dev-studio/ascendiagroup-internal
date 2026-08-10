import { cn } from "@/lib/utils";

interface SlideMediaProps {
  url: string;
  type: "image" | "video" | "";
  className?: string;
}

export function SlideMedia({ url, type, className }: SlideMediaProps) {
  if (!url || !type) return null;

  if (type === "video") {
    return (
      <video
        src={url}
        autoPlay
        muted
        loop
        playsInline
        className={cn("max-h-full max-w-full h-full w-full rounded-2xl object-cover", className)}
      />
    );
  }

  return (
    <img
      src={url}
      alt=""
      className={cn("max-h-full max-w-full h-full w-full rounded-2xl object-cover", className)}
    />
  );
}
