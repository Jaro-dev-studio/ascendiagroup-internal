/**
 * Shapes of the automated company research, kept free of server dependencies so
 * both the research agent and the UI can describe the same data.
 */

export type ResearchConfidence = "high" | "medium" | "low";

/**
 * Where an opportunity's evidence came from. Declaring it keeps the agent
 * honest and tells the salesperson whether to treat the observation as
 * something the lead said or something we worked out.
 */
export type ResearchEvidence = "their-form-answers" | "their-website" | "web-research";

export interface ResearchOpportunity {
  /** Short name for the piece of work, e.g. "Automate quote turnaround". */
  title: string;
  /** The specific thing found in the research that makes this relevant. */
  observation: string;
  /** Which of the three inputs the observation came from. */
  evidence: string;
  /** What we would build for them. */
  proposal: string;
  /** Which of our service lines it sells, a value from SERVICE_LINES. */
  service: string;
  /** The business outcome, in their terms. */
  impact: string;
}

export interface ResearchSource {
  title: string;
  url: string;
}
