import { cn } from "@/lib/utils";
import { AnimatedSection } from "@/components/landing/animated-section";

interface SectionHeadingProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left"
      )}
    >
      <AnimatedSection>
        <span className="rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-700">
          {eyebrow}
        </span>
      </AnimatedSection>
      <AnimatedSection delay={0.1}>
        <h2 className="max-w-3xl text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          {title}
        </h2>
      </AnimatedSection>
      {subtitle && (
        <AnimatedSection delay={0.15}>
          <p
            className={cn(
              "max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg",
              align === "center" && "mx-auto"
            )}
          >
            {subtitle}
          </p>
        </AnimatedSection>
      )}
    </div>
  );
}
