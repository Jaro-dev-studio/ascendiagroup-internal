import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/constants/crm";
import { AnimatedSection, StaggeredItem } from "@/components/landing/animated-section";
import { SectionHeading } from "@/components/pricing/section-heading";
import {
  CARE_FEATURE_ROWS,
  CARE_PLAN_FOOTNOTES,
  CARE_TIERS,
} from "@/constants/businessos-pricing";

interface CareTierMatrixProps {
  ctaUrl: string;
}

function TierPrice({ price }: { price: number }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-3xl font-bold tracking-tight text-neutral-900">
        {formatCurrency(price, "USD")}
      </span>
      <span className="text-sm font-medium text-neutral-500">/mo</span>
    </span>
  );
}

export function CareTierMatrix({ ctaUrl }: CareTierMatrixProps) {
  return (
    <section
      id="plans"
      className="border-b border-neutral-200 bg-neutral-50 px-6 py-20 sm:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-14">
        <SectionHeading
          eyebrow="Step two"
          title="One plan instead of four separate bills"
          subtitle="Support, bug fixes, small changes and new development all live in the same monthly number. We would rather you never have to decide whether a request is worth the invoice."
        />

        {/* Desktop comparison table */}
        <AnimatedSection className="hidden md:block">
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                BusinessOS care plan tiers compared feature by feature
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="w-1/3 p-6 align-bottom">
                    <span className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
                      Care plans
                    </span>
                  </th>
                  {CARE_TIERS.map((tier) => (
                    <th
                      key={tier.id}
                      scope="col"
                      className={cn(
                        "border-l border-neutral-200 p-6 align-bottom",
                        tier.recommended && "bg-primary-50"
                      )}
                    >
                      <div className="flex flex-col gap-2">
                        {tier.recommended && (
                          <span className="w-fit rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                            Most clients
                          </span>
                        )}
                        <span className="text-lg font-bold text-neutral-900">
                          {tier.name}
                        </span>
                        <TierPrice price={tier.price} />
                        <span className="text-sm font-normal leading-relaxed text-neutral-500">
                          {tier.tagline}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CARE_FEATURE_ROWS.map((row) => (
                  <tr key={row.label} className="border-t border-neutral-200">
                    <th scope="row" className="p-6 align-top">
                      <span className="block text-sm font-semibold text-neutral-900">
                        {row.label}
                      </span>
                      {row.hint && (
                        <span className="mt-1 block text-sm font-normal leading-relaxed text-neutral-500">
                          {row.hint}
                        </span>
                      )}
                    </th>
                    {row.values.map((value, tierIndex) => (
                      <td
                        key={CARE_TIERS[tierIndex].id}
                        className={cn(
                          "border-l border-neutral-200 p-6 align-top text-sm leading-relaxed text-neutral-700",
                          CARE_TIERS[tierIndex].recommended &&
                            "bg-primary-50 font-medium text-neutral-900"
                        )}
                      >
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t border-neutral-200">
                  <td className="p-6" />
                  {CARE_TIERS.map((tier) => (
                    <td
                      key={tier.id}
                      className={cn(
                        "border-l border-neutral-200 p-6",
                        tier.recommended && "bg-primary-50"
                      )}
                    >
                      <a
                        href={ctaUrl}
                        className={cn(
                          "inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                          tier.recommended
                            ? "bg-primary-600 text-white hover:bg-primary-700"
                            : "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
                        )}
                      >
                        Start with {tier.name}
                      </a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </AnimatedSection>

        {/* Mobile: the same data as stacked cards, since a 4-column table is unreadable */}
        <div className="flex flex-col gap-6 md:hidden">
          {CARE_TIERS.map((tier, tierIndex) => (
            <StaggeredItem key={tier.id} index={tierIndex}>
              <div
                className={cn(
                  "flex flex-col gap-5 rounded-2xl border bg-white p-6",
                  tier.recommended
                    ? "border-primary-300"
                    : "border-neutral-200"
                )}
              >
                <div className="flex flex-col gap-2">
                  {tier.recommended && (
                    <span className="w-fit rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                      Most clients
                    </span>
                  )}
                  <span className="text-lg font-bold text-neutral-900">
                    {tier.name}
                  </span>
                  <TierPrice price={tier.price} />
                  <span className="text-sm leading-relaxed text-neutral-500">
                    {tier.tagline}
                  </span>
                </div>

                <dl className="flex flex-col gap-3 border-t border-neutral-200 pt-5">
                  {CARE_FEATURE_ROWS.map((row) => (
                    <div
                      key={row.label}
                      className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                    >
                      <dt className="text-sm text-neutral-500">{row.label}</dt>
                      <dd className="text-sm font-medium text-neutral-900 sm:text-right">
                        {row.values[tierIndex]}
                      </dd>
                    </div>
                  ))}
                </dl>

                <a
                  href={ctaUrl}
                  className={cn(
                    "inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition-colors",
                    tier.recommended
                      ? "bg-primary-600 text-white hover:bg-primary-700"
                      : "border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50"
                  )}
                >
                  Start with {tier.name}
                </a>
              </div>
            </StaggeredItem>
          ))}
        </div>

        <AnimatedSection>
          <ul className="flex flex-col gap-2">
            {CARE_PLAN_FOOTNOTES.map((note) => (
              <li key={note} className="flex items-start gap-2">
                <Info className="mt-0.5 size-4 shrink-0 text-neutral-400" />
                <span className="text-sm leading-relaxed text-neutral-500">
                  {note}
                </span>
              </li>
            ))}
          </ul>
        </AnimatedSection>
      </div>
    </section>
  );
}
