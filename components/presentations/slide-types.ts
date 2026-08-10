export interface TextMediaSideSlide {
  type: "text_media_side";
  text: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "";
}

export interface TextMediaStackSlide {
  type: "text_media_stack";
  text: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "";
}

export interface TextCenterSlide {
  type: "text_center";
  text: string;
  subtitle: string;
}

export type Slide = TextMediaSideSlide | TextMediaStackSlide | TextCenterSlide;

export type SlideType = Slide["type"];

export const SLIDE_TYPE_LABELS: Record<SlideType, string> = {
  text_media_side: "Text + Media (Side by Side)",
  text_media_stack: "Text + Media (Stacked)",
  text_center: "Text (Centered)",
};

export function createDefaultSlide(type: SlideType): Slide {
  switch (type) {
    case "text_media_side":
      return { type: "text_media_side", text: "", mediaUrl: "", mediaType: "" };
    case "text_media_stack":
      return { type: "text_media_stack", text: "", mediaUrl: "", mediaType: "" };
    case "text_center":
      return { type: "text_center", text: "", subtitle: "" };
  }
}

export function getDefaultSlides(): Slide[] {
  return [
    createDefaultSlide("text_center"),
  ];
}
