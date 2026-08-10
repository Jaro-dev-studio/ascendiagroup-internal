/**
 * What Jaro.dev actually sells. The research agent may only propose work that
 * maps to one of these lines, which is what keeps its ideas sellable instead of
 * generic consulting advice.
 */

export const SERVICE_LINES = [
  {
    value: "custom-software-autopilot",
    label: "Custom Software (Autopilot)",
    positioning:
      "We design, build and run bespoke software end to end — an MVP from scratch, an internal tool, or a customer-facing product — on a fixed monthly engagement, so the client gets a shipping product team without hiring one.",
  },
  {
    value: "ai-automation",
    label: "AI & Automation",
    positioning:
      "We replace manual, repetitive back-office work with AI agents and automated workflows: document and email handling, data entry, quoting, triage, reporting, and hand-offs between systems that people currently bridge by hand.",
  },
  {
    value: "high-volume-scraping",
    label: "High Volume Scraping",
    positioning:
      "We build large-scale data collection pipelines: continuously harvesting listings, prices, catalogues, public records or competitor data at volume, cleaned and delivered into the client's own systems.",
  },
  {
    value: "web-to-native-mobile",
    label: "Web to Native Mobile",
    positioning:
      "We turn an existing web app into real native iOS and Android apps on the App Store and Play Store, keeping one codebase, so a business with a web-only product gets mobile without a separate mobile team.",
  },
] as const;

export type ServiceLineValue = (typeof SERVICE_LINES)[number]["value"];

export const SERVICE_LINE_VALUES = SERVICE_LINES.map((line) => line.value) as ServiceLineValue[];

/** Includes retired form options, so historical submissions still read cleanly. */
export const SERVICE_LABELS: Record<string, string> = {
  ...Object.fromEntries(SERVICE_LINES.map((line) => [line.value, line.label])),
  "new-web-app": "New Web App",
  "fix-rebuild": "Fix/Rebuild",
  other: "Other",
};

export function serviceLabel(value: string): string {
  return SERVICE_LABELS[value] ?? value;
}
