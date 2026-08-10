import { Info, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/constants/crm";
import { AnimatedSection, StaggeredItem } from "@/components/landing/animated-section";
import { SectionHeading } from "@/components/pricing/section-heading";
import { CountUp } from "@/components/pricing/count-up";
import {
  INFRA_ITEMS,
  INFRA_NOTES,
  SAAS_COMPARISON,
  SAAS_COMPARISON_SEATS,
  infraTotals,
} from "@/constants/businessos-pricing";

const BILLING_STYLES: Record<string, string> = {
  "Flat fee": "bg-neutral-100 text-neutral-700",
  Usage: "bg-warning-100 text-warning-800",
  Free: "bg-success-100 text-success-800",
};

function BillingPill({ billing }: { billing: string }) {
  return (
    <span
      className={cn(
        "w-fit whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        BILLING_STYLES[billing] ?? BILLING_STYLES["Flat fee"]
      )}
    >
      {billing}
    </span>
  );
}

export function InfraCostsSection() {
  const totals = infraTotals();
  const saasLow = SAAS_COMPARISON.reduce(
    (sum, row) => sum + row.lowAtTwentySeats,
    0
  );
  const saasHigh = SAAS_COMPARISON.reduce(
    (sum, row) => sum + row.highAtTwentySeats,
    0
  );

  return (
    <section
      id="infrastructure"
      className="border-b border-neutral-200 bg-white px-6 py-20 sm:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-14">
        <SectionHeading
          eyebrow="What you pay someone else"
          title="Infrastructure and usage, paid by you, at cost"
          subtitle="Your system runs on services that bill for what they use. Those accounts are opened in your company's name with your card on file, so you pay the vendors directly and we never touch a cent of it."
        />

        <AnimatedSection>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-3">
            <div className="flex flex-col gap-1 bg-white p-6">
              <span className="text-sm font-semibold text-neutral-500">
                Quiet month
              </span>
              <span className="text-3xl font-bold tracking-tight text-neutral-900">
                <CountUp value={formatCurrency(totals.low, "USD")} />
              </span>
            </div>
            <div className="flex flex-col gap-1 bg-primary-50 p-6">
              <span className="text-sm font-semibold text-primary-700">
                What most clients see
              </span>
              <span className="text-3xl font-bold tracking-tight text-primary-900">
                <CountUp value={formatCurrency(totals.expected, "USD")} />
              </span>
              <span className="text-sm text-primary-700">per month, total</span>
            </div>
            <div className="flex flex-col gap-1 bg-white p-6">
              <span className="text-sm font-semibold text-neutral-500">
                Busy, AI-heavy month
              </span>
              <span className="text-3xl font-bold tracking-tight text-neutral-900">
                <CountUp value={formatCurrency(totals.heavy, "USD")} />
              </span>
            </div>
          </div>
        </AnimatedSection>

        {/* Desktop table */}
        <AnimatedSection className="hidden lg:block">
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Estimated monthly infrastructure and usage costs by service
              </caption>
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th
                    scope="col"
                    className="p-5 text-sm font-semibold text-neutral-900"
                  >
                    Service
                  </th>
                  <th
                    scope="col"
                    className="p-5 text-sm font-semibold text-neutral-900"
                  >
                    How the vendor charges
                  </th>
                  <th
                    scope="col"
                    className="p-5 text-right text-sm font-semibold text-neutral-900"
                  >
                    Quiet
                  </th>
                  <th
                    scope="col"
                    className="p-5 text-right text-sm font-semibold text-primary-700"
                  >
                    Expected
                  </th>
                  <th
                    scope="col"
                    className="p-5 text-right text-sm font-semibold text-neutral-900"
                  >
                    Busy
                  </th>
                </tr>
              </thead>
              <tbody>
                {INFRA_ITEMS.map((item) => (
                  <tr key={item.name} className="border-b border-neutral-200">
                    <th scope="row" className="p-5 align-top">
                      <span className="flex flex-col gap-1.5">
                        <span className="text-sm font-semibold text-neutral-900">
                          {item.name}
                        </span>
                        <span className="text-sm font-normal leading-relaxed text-neutral-500">
                          {item.purpose}
                        </span>
                        <BillingPill billing={item.billing} />
                      </span>
                    </th>
                    <td className="p-5 align-top text-sm leading-relaxed text-neutral-600">
                      {item.vendorPricing}
                    </td>
                    <td className="whitespace-nowrap p-5 text-right align-top text-sm text-neutral-600">
                      {formatCurrency(item.low, "USD")}
                    </td>
                    <td className="whitespace-nowrap bg-primary-50 p-5 text-right align-top text-sm font-semibold text-primary-900">
                      {formatCurrency(item.expected, "USD")}
                    </td>
                    <td className="whitespace-nowrap p-5 text-right align-top text-sm text-neutral-600">
                      {formatCurrency(item.heavy, "USD")}
                    </td>
                  </tr>
                ))}
                <tr className="bg-neutral-50">
                  <th
                    scope="row"
                    colSpan={2}
                    className="p-5 text-sm font-bold text-neutral-900"
                  >
                    Estimated monthly total
                  </th>
                  <td className="whitespace-nowrap p-5 text-right text-sm font-bold text-neutral-900">
                    {formatCurrency(totals.low, "USD")}
                  </td>
                  <td className="whitespace-nowrap bg-primary-100 p-5 text-right text-base font-bold text-primary-900">
                    {formatCurrency(totals.expected, "USD")}
                  </td>
                  <td className="whitespace-nowrap p-5 text-right text-sm font-bold text-neutral-900">
                    {formatCurrency(totals.heavy, "USD")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </AnimatedSection>

        {/* Mobile and tablet cards */}
        <div className="flex flex-col gap-4 lg:hidden">
          {INFRA_ITEMS.map((item, index) => (
            <StaggeredItem key={item.name} index={index}>
              <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-base font-semibold text-neutral-900">
                      {item.name}
                    </span>
                    <span className="text-sm leading-relaxed text-neutral-500">
                      {item.purpose}
                    </span>
                  </div>
                  <span className="whitespace-nowrap text-lg font-bold text-neutral-900">
                    {formatCurrency(item.expected, "USD")}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-neutral-600">
                  {item.vendorPricing}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <BillingPill billing={item.billing} />
                  <span className="text-sm text-neutral-500">
                    Range {formatCurrency(item.low, "USD")} to{" "}
                    {formatCurrency(item.heavy, "USD")}
                  </span>
                </div>
              </div>
            </StaggeredItem>
          ))}
          <div className="flex items-baseline justify-between gap-4 rounded-2xl border border-primary-200 bg-primary-50 p-6">
            <span className="text-base font-bold text-primary-900">
              Estimated monthly total
            </span>
            <span className="text-2xl font-bold text-primary-900">
              {formatCurrency(totals.expected, "USD")}
            </span>
          </div>
        </div>

        <AnimatedSection>
          <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-8">
            <div className="flex items-center gap-3">
              <Wallet className="size-5 text-neutral-500" />
              <h3 className="text-lg font-bold text-neutral-900">
                Three things worth being explicit about
              </h3>
            </div>
            <ul className="flex flex-col gap-3">
              {INFRA_NOTES.map((note) => (
                <li key={note} className="flex items-start gap-3">
                  <Info className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                  <span className="text-base leading-relaxed text-neutral-700">
                    {note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </AnimatedSection>

        {/* Per-seat comparison */}
        <AnimatedSection>
          <div className="flex flex-col gap-6 rounded-2xl border border-neutral-200 bg-white p-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <TrendingUp className="size-5 text-primary-600" />
                <h3 className="text-lg font-bold text-neutral-900">
                  Why this bill stays small as you grow
                </h3>
              </div>
              <p className="text-base leading-relaxed text-neutral-600">
                The tools BusinessOS replaces almost all charge per user, so
                every person you hire raises the bill. Here is roughly what that
                stack costs at {SAAS_COMPARISON_SEATS} people, using published
                pricing ranges by category rather than picking on any one vendor.
              </p>
            </div>

            <ul className="flex flex-col gap-3">
              {SAAS_COMPARISON.map((row) => (
                <li
                  key={row.category}
                  className="flex flex-col gap-1 border-b border-neutral-200 pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <span className="text-sm font-medium text-neutral-900">
                    {row.category}
                  </span>
                  <span className="flex flex-wrap items-baseline gap-x-2 text-sm text-neutral-500 sm:justify-end">
                    <span>{row.typicalPricing}</span>
                    <span className="font-semibold text-neutral-700">
                      {formatCurrency(row.lowAtTwentySeats, "USD")} to{" "}
                      {formatCurrency(row.highAtTwentySeats, "USD")}/mo
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1 rounded-xl border border-neutral-200 bg-neutral-50 p-6">
                <span className="text-sm font-semibold text-neutral-500">
                  Per-seat stack at {SAAS_COMPARISON_SEATS} people
                </span>
                <span className="text-2xl font-bold text-neutral-900">
                  {formatCurrency(saasLow, "USD")} to{" "}
                  {formatCurrency(saasHigh, "USD")}
                </span>
                <span className="text-sm text-neutral-500">
                  Rises with every hire
                </span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border border-primary-200 bg-primary-50 p-6">
                <span className="text-sm font-semibold text-primary-700">
                  Your BusinessOS at {SAAS_COMPARISON_SEATS} people
                </span>
                <span className="text-2xl font-bold text-primary-900">
                  {formatCurrency(totals.expected, "USD")}
                </span>
                <span className="text-sm text-primary-700">
                  Barely moves at 100 people
                </span>
              </div>
            </div>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
