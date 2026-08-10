/** Readable labels for the coded answers stored on EmbedFormSubmission. */

export const BUDGET_LABELS: Record<string, string> = {
  "0-10k": "$0 - $10k",
  "11k-30k": "$11k - $30k",
  "31k-100k": "$31k - $100k",
  "101k-500k": "$101k - $500k",
  "501k-2M": "$501k - $2M",
  "2M+": "$2M+",
};

export const REVENUE_LABELS: Record<string, string> = {
  "under-20k": "Under $20k/mo",
  "21-70k": "$21-70k/mo",
  "71-150k": "$71-150k/mo",
  "150-300k": "$150-300k/mo",
  "301-600k": "$301-600k/mo",
  "601k+": "$601k+/mo",
};

export const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  mobile: "Mobile",
  both: "Web & Mobile",
};

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  internal: "Internal",
  external: "External",
};

export const HEADCOUNT_LABELS: Record<string, string> = {
  "0-50": "0-50",
  "51-200": "51-200",
  "201-1000": "201-1000",
  "1001+": "1001+",
};
