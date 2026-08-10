import type { TextCenterSlide } from "../slide-types";
import { SlideWrapper } from "../slide-wrapper";

interface TextCenterSlideComponentProps {
  data: TextCenterSlide;
}

export function TextCenterSlideComponent({ data }: TextCenterSlideComponentProps) {
  return (
    <SlideWrapper>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <h2 className="max-w-4xl text-5xl font-black leading-tight tracking-tight text-primary-500">
          {data.text || "Text goes here"}
        </h2>
        {data.subtitle && (
          <p className="mt-4 max-w-2xl text-xl font-medium text-neutral-400">
            {data.subtitle}
          </p>
        )}
      </div>
    </SlideWrapper>
  );
}
