import { Handshake } from "lucide-react";
import { AnimatedSection, StaggeredItem } from "@/components/landing/animated-section";
import { SectionHeading } from "@/components/pricing/section-heading";
import { INCENTIVE_POINTS } from "@/constants/businessos-pricing";

export function IncentivesSection() {
  const [leadPoint, ...restPoints] = INCENTIVE_POINTS;

  return (
    <section
      id="incentives"
      className="border-b border-neutral-200 bg-neutral-50 px-6 py-20 sm:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-14">
        <SectionHeading
          eyebrow="Why it is priced this way"
          title="Every choice here costs us something"
          subtitle="A pricing model tells you what an agency is optimising for. This is ours, along with what each decision gives up, so you can judge it properly."
        />

        <div className="flex flex-col gap-6">
          <AnimatedSection>
            <div className="flex flex-col gap-4 rounded-2xl border border-primary-200 bg-primary-50 p-8 sm:p-10">
              <Handshake className="size-7 text-primary-600" />
              <h3 className="max-w-2xl text-2xl font-bold text-primary-900 sm:text-3xl">
                {leadPoint.title}
              </h3>
              <p className="max-w-3xl text-base leading-relaxed text-primary-800 sm:text-lg">
                {leadPoint.body}
              </p>
            </div>
          </AnimatedSection>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {restPoints.map((point, index) => (
              <StaggeredItem key={point.title} index={index} className="h-full">
                <div className="flex h-full flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-8">
                  <h3 className="text-lg font-bold text-neutral-900">
                    {point.title}
                  </h3>
                  <p className="text-base leading-relaxed text-neutral-600">
                    {point.body}
                  </p>
                </div>
              </StaggeredItem>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
