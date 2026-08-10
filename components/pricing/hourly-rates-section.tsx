import { AnimatedSection, StaggeredItem } from "@/components/landing/animated-section";
import { SectionHeading } from "@/components/pricing/section-heading";
import { HOURLY_RATES } from "@/constants/businessos-pricing";

export function HourlyRatesSection() {
  return (
    <section
      id="rates"
      className="border-b border-neutral-200 bg-neutral-50 px-6 py-20 sm:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-14">
        <SectionHeading
          eyebrow="Hourly work"
          title="The rates, in full, before you ask for them"
          subtitle="Hours exist for work beyond what your plan includes, and for people who would rather not have a plan at all. Calls with clients on a plan are included, never metered."
        />

        {/* Desktop table */}
        <AnimatedSection className="hidden md:block">
          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th
                    scope="col"
                    className="p-5 text-sm font-semibold text-neutral-900"
                  >
                    Type of work
                  </th>
                  <th
                    scope="col"
                    className="p-5 text-right text-sm font-semibold text-neutral-900"
                  >
                    Rate
                  </th>
                  <th
                    scope="col"
                    className="p-5 text-sm font-semibold text-neutral-900"
                  >
                    Billed in
                  </th>
                  <th
                    scope="col"
                    className="p-5 text-sm font-semibold text-neutral-900"
                  >
                    When it applies
                  </th>
                </tr>
              </thead>
              <tbody>
                {HOURLY_RATES.map((rate) => (
                  <tr
                    key={rate.work}
                    className="border-b border-neutral-200 last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="p-5 text-sm font-medium text-neutral-900"
                    >
                      {rate.work}
                    </th>
                    <td className="whitespace-nowrap p-5 text-right text-sm font-semibold text-neutral-900">
                      {rate.rate}
                    </td>
                    <td className="p-5 text-sm text-neutral-600">
                      {rate.minimum ?? "Not applicable"}
                    </td>
                    <td className="p-5 text-sm leading-relaxed text-neutral-600">
                      {rate.applies}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AnimatedSection>

        {/* Mobile cards */}
        <div className="flex flex-col gap-4 md:hidden">
          {HOURLY_RATES.map((rate, index) => (
            <StaggeredItem key={rate.work} index={index}>
              <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-6">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-sm font-semibold text-neutral-900">
                    {rate.work}
                  </span>
                  <span className="whitespace-nowrap text-base font-bold text-neutral-900">
                    {rate.rate}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-neutral-600">
                  {rate.applies}
                </p>
                {rate.minimum && (
                  <p className="text-sm text-neutral-500">
                    Billed in {rate.minimum.toLowerCase()}
                  </p>
                )}
              </div>
            </StaggeredItem>
          ))}
        </div>
      </div>
    </section>
  );
}
