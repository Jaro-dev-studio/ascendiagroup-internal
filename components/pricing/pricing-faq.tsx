"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AnimatedSection } from "@/components/landing/animated-section";
import { SectionHeading } from "@/components/pricing/section-heading";
import { PRICING_FAQS } from "@/constants/businessos-pricing";

export function PricingFaq() {
  return (
    <section
      id="faq"
      className="border-b border-neutral-200 bg-white px-6 py-20 sm:py-24"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-12">
        <SectionHeading
          eyebrow="Straight answers"
          title="The questions we get asked every time"
        />

        <AnimatedSection>
          <Accordion type="single" collapsible className="flex flex-col">
            {PRICING_FAQS.map((faq) => (
              <AccordionItem
                key={faq.question}
                value={faq.question}
                className="border-neutral-200"
              >
                <AccordionTrigger className="gap-6 py-5 text-left text-base font-semibold text-neutral-900 sm:text-lg">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-6 pr-6 text-base leading-relaxed text-neutral-600">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </AnimatedSection>
      </div>
    </section>
  );
}
