import { StaggeredItem } from "@/components/landing/animated-section";
import { SectionHeading } from "@/components/pricing/section-heading";
import { HOW_IT_WORKS } from "@/constants/businessos-pricing";

export function HowItWorksSection() {
  return (
    <section className="border-b border-neutral-200 bg-neutral-50 px-6 py-20 sm:py-24">
      <div className="mx-auto flex max-w-6xl flex-col gap-14">
        <SectionHeading
          eyebrow="The shape of it"
          title="Three commitments, in this order"
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((step, index) => (
            <StaggeredItem key={step.title} index={index} className="h-full">
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-8">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold text-primary-700">
                    {step.detail}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-neutral-900">
                  {step.title}
                </h3>
                <p className="text-base leading-relaxed text-neutral-600">
                  {step.body}
                </p>
              </div>
            </StaggeredItem>
          ))}
        </div>
      </div>
    </section>
  );
}
