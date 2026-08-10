import type { TextMediaStackSlide } from "../slide-types";
import { SlideWrapper } from "../slide-wrapper";
import { SlideMedia } from "../slide-media";

interface TextMediaStackSlideComponentProps {
  data: TextMediaStackSlide;
}

export function TextMediaStackSlideComponent({ data }: TextMediaStackSlideComponentProps) {
  return (
    <SlideWrapper>
      {/* Text top */}
      <div className="shrink-0 text-center">
        <h2 className="text-4xl font-black leading-tight tracking-tight text-neutral-900">
          {data.text || "Text goes here"}
        </h2>
      </div>

      {/* Media fills remaining space */}
      {data.mediaUrl && (
        <div className="mt-6 min-h-0 flex-1 overflow-hidden rounded-2xl border border-neutral-200 shadow-lg">
          <SlideMedia url={data.mediaUrl} type={data.mediaType} className="rounded-none" />
        </div>
      )}
    </SlideWrapper>
  );
}
