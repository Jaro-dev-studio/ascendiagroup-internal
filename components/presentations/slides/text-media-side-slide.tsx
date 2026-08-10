import type { TextMediaSideSlide } from "../slide-types";
import { SlideWrapper } from "../slide-wrapper";
import { SlideMedia } from "../slide-media";

interface TextMediaSideSlideComponentProps {
  data: TextMediaSideSlide;
}

export function TextMediaSideSlideComponent({ data }: TextMediaSideSlideComponentProps) {
  return (
    <SlideWrapper>
      <div className="flex min-h-0 flex-1 items-center gap-12">
        <div className="flex-1">
          <h2 className="text-4xl font-black leading-tight tracking-tight text-neutral-900">
            {data.text || "Text goes here"}
          </h2>
        </div>

        {data.mediaUrl && (
          <div className="h-full w-1/2 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 shadow-lg">
            <SlideMedia url={data.mediaUrl} type={data.mediaType} className="rounded-none" />
          </div>
        )}
      </div>
    </SlideWrapper>
  );
}
