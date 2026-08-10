import type { DealBillingInterval, DealPricingType } from "@prisma/client";
import {
  DEAL_BILLING_INTERVAL_LABELS,
  DEAL_PRICING_TYPE_LABELS,
  formatCurrency,
} from "@/constants/crm";

/**
 * The shape every pricing calculation needs. Deliberately narrower than the
 * Prisma model so the fetchers, the modal form and the AI tools can all share
 * these helpers.
 */
export interface DealPricingLine {
  type: DealPricingType;
  unitAmount: number;
  quantity: number;
  interval?: DealBillingInterval | null;
}

/** Months covered by one billing period, used to normalise retainers. */
const MONTHS_PER_INTERVAL: Record<DealBillingInterval, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  ANNUAL: 12,
};

/** Short per-period suffix, e.g. "$5,000/mo". */
const INTERVAL_SUFFIX: Record<DealBillingInterval, string> = {
  MONTHLY: "/mo",
  QUARTERLY: "/qtr",
  ANNUAL: "/yr",
};

/** Noun for a single billing period, pluralised by the caller. */
const INTERVAL_PERIOD_NOUN: Record<DealBillingInterval, string> = {
  MONTHLY: "month",
  QUARTERLY: "quarter",
  ANNUAL: "year",
};

/** Label for the quantity input, which means something different per type. */
export const PRICING_QUANTITY_LABELS: Record<DealPricingType, string> = {
  PROJECT: "Quantity",
  HOURLY: "Hours",
  RETAINER: "Periods",
};

/** Label for the amount input, which means something different per type. */
export const PRICING_AMOUNT_LABELS: Record<DealPricingType, string> = {
  PROJECT: "Fixed fee",
  HOURLY: "Rate per hour",
  RETAINER: "Amount per period",
};

export function intervalPeriodNoun(
  interval: DealBillingInterval,
  quantity: number
): string {
  const noun = INTERVAL_PERIOD_NOUN[interval];
  return quantity === 1 ? noun : `${noun}s`;
}

/** Total contribution of a single line to the contract value. */
export function pricingItemAmount(item: DealPricingLine): number {
  return Math.round(item.unitAmount * item.quantity);
}

/** Total contract value across every pricing line. */
export function dealContractValue(items: DealPricingLine[]): number {
  return items.reduce((total, item) => total + pricingItemAmount(item), 0);
}

/**
 * Recurring revenue normalised to a month. Display only, so the contract value
 * stays the single stored number on the deal.
 */
export function dealMonthlyRecurring(items: DealPricingLine[]): number {
  return items.reduce((total, item) => {
    if (item.type !== "RETAINER" || !item.interval) return total;
    return total + item.unitAmount / MONTHS_PER_INTERVAL[item.interval];
  }, 0);
}

/** Deduped pricing types in a stable order, for badges. */
export function dealPricingTypes(items: DealPricingLine[]): DealPricingType[] {
  const order: DealPricingType[] = ["PROJECT", "HOURLY", "RETAINER"];
  return order.filter((type) => items.some((item) => item.type === type));
}

/** Human summary of the pricing mix, e.g. "Project + Retainer". */
export function describePricingMix(items: DealPricingLine[]): string {
  const types = dealPricingTypes(items);
  if (types.length === 0) return "No pricing set";
  return types.map((type) => DEAL_PRICING_TYPE_LABELS[type]).join(" + ");
}

/** Human summary of a single line, e.g. "$5,000/mo x 3 months". */
export function describePricingItem(
  item: DealPricingLine,
  currency: string
): string {
  const unit = formatCurrency(item.unitAmount, currency);

  if (item.type === "HOURLY") {
    return `${unit}/hr x ${item.quantity} ${item.quantity === 1 ? "hour" : "hours"}`;
  }

  if (item.type === "RETAINER") {
    const interval = item.interval ?? "MONTHLY";
    return `${unit}${INTERVAL_SUFFIX[interval]} x ${item.quantity} ${intervalPeriodNoun(
      interval,
      item.quantity
    )}`;
  }

  return item.quantity > 1
    ? `${unit} x ${item.quantity}`
    : `${unit} fixed`;
}

/** Long-form line used by the AI tools, which have no currency formatting. */
export function pricingItemSummary(
  item: DealPricingLine,
  currency: string
): string {
  const interval =
    item.type === "RETAINER" && item.interval
      ? ` (${DEAL_BILLING_INTERVAL_LABELS[item.interval].toLowerCase()})`
      : "";

  return `${DEAL_PRICING_TYPE_LABELS[item.type]}${interval}: ${describePricingItem(
    item,
    currency
  )} = ${formatCurrency(pricingItemAmount(item), currency)}`;
}
