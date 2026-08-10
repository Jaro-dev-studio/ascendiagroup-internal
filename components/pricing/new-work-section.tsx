import { StaggeredItem } from "@/components/landing/animated-section";
import { SectionHeading } from "@/components/pricing/section-heading";
import { FEATURE_BANDS } from "@/constants/businessos-pricing";

export function NewWorkSection() {
  return (
    <section
      id="new-work"
      className="border-b border-neutral-200 bg-white px-6 py-20 sm:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-14">
        <SectionHeading
          eyebrow="New features"
          title="How anything new gets priced"
          subtitle="Which case a request falls into depends on whether it fits the hours already sitting in your plan. You know which one before we start, and nothing that costs extra happens without your approval."
        />

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {FEATURE_BANDS.map((band, index) => (
            <StaggeredItem key={band.scenario} index={index} className="h-full">
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-8">
                <span className="w-fit rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-700">
                  {band.scenario}
                </span>
                <p className="text-lg font-semibold leading-snug text-neutral-900">
                  {band.pricing}
                </p>
                <p className="mt-auto text-sm text-neutral-500">
                  Paid: {band.payment}
                </p>
              </div>
            </StaggeredItem>
          ))}
        </div>
      </div>
    </section>
  );
}
