import type { Slide } from "./slide-types";
import { TextMediaSideSlideComponent } from "./slides/text-media-side-slide";
import { TextMediaStackSlideComponent } from "./slides/text-media-stack-slide";
import { TextCenterSlideComponent } from "./slides/text-center-slide";

interface SlideRendererProps {
  slide: Slide;
}

export function SlideRenderer({ slide }: SlideRendererProps) {
  switch (slide.type) {
    case "text_media_side":
      return <TextMediaSideSlideComponent data={slide} />;
    case "text_media_stack":
      return <TextMediaStackSlideComponent data={slide} />;
    case "text_center":
      return <TextCenterSlideComponent data={slide} />;
    default:
      return null;
  }
}
