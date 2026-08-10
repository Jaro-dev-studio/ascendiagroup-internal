import { ArrowRight } from "lucide-react";
import { AnimatedSection } from "@/components/landing/animated-section";

interface PricingCtaProps {
  ctaUrl: string;
}

export function PricingCta({ ctaUrl }: PricingCtaProps) {
  return (
    <section className="bg-neutral-950 px-6 py-20 sm:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <AnimatedSection>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            The next step is a call, not a contract
          </h2>
        </AnimatedSection>
        <AnimatedSection delay={0.1}>
          <p className="max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
            We spend an hour mapping how your operation actually runs, then tell
            you what we would build and what it would cost. If the honest answer
            is that you do not need custom software yet, we will say so.
          </p>
        </AnimatedSection>
        <AnimatedSection delay={0.2}>
          <a
            href={ctaUrl}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 text-base font-semibold text-neutral-900 transition-colors hover:bg-neutral-200"
          >
            Book a scoping call
            <ArrowRight className="size-4" />
          </a>
        </AnimatedSection>
        <AnimatedSection delay={0.25}>
          <p className="text-sm text-neutral-500">
            No obligation, and the scope document is yours to keep either way.
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
