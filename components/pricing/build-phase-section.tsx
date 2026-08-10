import { Check, FileText } from "lucide-react";
import { formatCurrency } from "@/constants/crm";
import { AnimatedSection, StaggeredItem } from "@/components/landing/animated-section";
import { SectionHeading } from "@/components/pricing/section-heading";
import {
  BUILD_FEE,
  BUILD_INCLUSIONS,
  BUILD_TERMS,
} from "@/constants/businessos-pricing";

export function BuildPhaseSection() {
  return (
    <section
      id="build"
      className="border-b border-neutral-200 bg-white px-6 py-20 sm:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-14">
        <SectionHeading
          eyebrow="Step one"
          title="The build is a fixed price"
          subtitle="We agree the scope on the call and write it down before you sign. That document is the contract, and it is the reason this number does not move."
        />

        <AnimatedSection>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary-200 bg-primary-50 p-8 text-center">
            <span className="text-5xl font-bold tracking-tight text-primary-900 sm:text-6xl">
              {formatCurrency(BUILD_FEE, "USD")}
            </span>
            <p className="max-w-xl text-base leading-relaxed text-primary-800">
              One price for the whole build. If we underestimated the work, we
              absorb it. You will never receive an invoice because we misjudged
              our own scope.
            </p>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <StaggeredItem index={0} className="h-full">
            <div className="flex h-full flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-8">
              <div className="flex items-center gap-3">
                <Check className="size-5 text-success-600" />
                <h3 className="text-lg font-bold text-neutral-900">
                  What the fee covers
                </h3>
              </div>
              <ul className="flex flex-col gap-3">
                {BUILD_INCLUSIONS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-0.5 size-4 shrink-0 text-success-600" />
                    <span className="text-base leading-relaxed text-neutral-700">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </StaggeredItem>

          <StaggeredItem index={1} className="h-full">
            <div className="flex h-full flex-col gap-5 rounded-2xl border border-neutral-200 bg-white p-8">
              <div className="flex items-center gap-3">
                <FileText className="size-5 text-neutral-500" />
                <h3 className="text-lg font-bold text-neutral-900">
                  How payment and terms work
                </h3>
              </div>
              <ul className="flex flex-col gap-3">
                {BUILD_TERMS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-neutral-400"
                    />
                    <span className="text-base leading-relaxed text-neutral-700">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </StaggeredItem>
        </div>
      </div>
    </section>
  );
}
