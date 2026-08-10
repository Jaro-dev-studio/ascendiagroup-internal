export const SOFTWARE_NAICS_CODES: Record<string, string> = {
  "541511": "Custom Computer Programming Services",
  "541512": "Computer Systems Design Services",
  "541519": "Other Computer Related Services",
  "513210": "Software Publishers",
};

export const SOFTWARE_PSC_CODES: Record<string, string> = {
  D302: "IT and Telecom - Systems Development",
  D307: "IT and Telecom - IT Strategy and Architecture",
  D310: "IT and Telecom - Cyber Security and Data Backup",
  D301: "IT and Telecom - Facility Operation and Maintenance",
  D306: "IT and Telecom - Systems Analysis",
  D399: "IT and Telecom - Other",
};

export const NAICS_CODE_LIST = Object.keys(SOFTWARE_NAICS_CODES);
export const PSC_CODE_LIST = Object.keys(SOFTWARE_PSC_CODES);

export const SAM_GOV_OPPORTUNITY_TYPES: Record<string, string> = {
  "Solicitation": "Solicitation",
  "Presolicitation": "Presolicitation",
  "Combined Synopsis/Solicitation": "Combined Synopsis/Solicitation",
  "Sources Sought": "Sources Sought",
  "Special Notice": "Special Notice",
  "Intent to Bundle Requirements (Alarm)": "Intent to Bundle",
  "Award Notice": "Award Notice",
  "Justification and Approval (J&A)": "Justification & Approval",
  "Fair Opportunity / Limited Sources Justification": "Fair Opportunity",
  "Sale of Surplus Property": "Surplus Property",
};

export const SAM_GOV_PTYPE_CODES: Record<string, string> = {
  o: "Solicitation",
  p: "Presolicitation",
  k: "Combined Synopsis/Solicitation",
  r: "Sources Sought",
  s: "Special Notice",
  i: "Intent to Bundle",
  a: "Award Notice",
  u: "Justification and Approval",
  g: "Sale of Surplus Property",
};

export const USASPENDING_CONTRACT_AWARD_TYPES: Record<string, string> = {
  A: "BPA Call",
  B: "Purchase Order",
  C: "Delivery Order",
  D: "Definitive Contract",
};

export function getFiscalYear(date: Date): number {
  const month = date.getMonth();
  const year = date.getFullYear();
  return month >= 9 ? year + 1 : year;
}

export function getFiscalYearRange(fy: number): {
  start_date: string;
  end_date: string;
} {
  return {
    start_date: `${fy - 1}-10-01`,
    end_date: `${fy}-09-30`,
  };
}

export const CURRENT_FISCAL_YEAR = getFiscalYear(new Date());

export const FISCAL_YEARS_TO_FETCH = Array.from(
  { length: 6 },
  (_, i) => CURRENT_FISCAL_YEAR - i
);

export function formatCurrencyCompact(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}
