import { GitBranch, KeyRound, Layers, ScrollText } from "lucide-react";
import { AnimatedSection, StaggeredItem } from "@/components/landing/animated-section";
import { OWNERSHIP_POINTS } from "@/constants/businessos-pricing";

const POINT_ICONS = [GitBranch, ScrollText, KeyRound, Layers];

export function OwnershipSection() {
  return (
    <section
      id="ownership"
      className="border-b border-neutral-800 bg-neutral-950 px-6 py-20 sm:py-24"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-14">
        <div className="flex flex-col items-center gap-4 text-center">
          <AnimatedSection>
            <span className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-300">
              Ownership
            </span>
          </AnimatedSection>
          <AnimatedSection delay={0.1}>
            <h2 className="max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
              You own all of it, from the very first commit
            </h2>
          </AnimatedSection>
          <AnimatedSection delay={0.15}>
            <p className="mx-auto max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg">
              Most agencies hold the code, the accounts, or both, and call it a
              partnership. We hand you everything at the start, which means we
              have to keep earning the relationship rather than holding it
              hostage.
            </p>
          </AnimatedSection>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {OWNERSHIP_POINTS.map((point, index) => {
            const Icon = POINT_ICONS[index % POINT_ICONS.length];

            return (
              <StaggeredItem key={point.title} index={index} className="h-full">
                <div className="flex h-full flex-col gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-8">
                  <Icon className="size-6 text-primary-400" />
                  <h3 className="text-lg font-bold text-white">
                    {point.title}
                  </h3>
                  <p className="text-base leading-relaxed text-neutral-400">
                    {point.body}
                  </p>
                </div>
              </StaggeredItem>
            );
          })}
        </div>
      </div>
    </section>
  );
}
