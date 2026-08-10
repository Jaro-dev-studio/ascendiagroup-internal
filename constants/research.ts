import type { ResearchEvidence } from "@/types/research";

/** The evidence an opportunity may cite, and how each reads in the UI. */
export const RESEARCH_EVIDENCE_VALUES: readonly ResearchEvidence[] = [
  "their-form-answers",
  "their-website",
  "web-research",
];

export const RESEARCH_EVIDENCE_LABELS: Record<string, string> = {
  "their-form-answers": "From what they told us",
  "their-website": "From their website",
  "web-research": "From our web research",
};
