"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { PRICING_CTA_URL } from "@/constants/businessos-pricing";
import { PricingHero } from "@/components/pricing/pricing-hero";
import { HowItWorksSection } from "@/components/pricing/how-it-works-section";
import { BuildPhaseSection } from "@/components/pricing/build-phase-section";
import { OwnershipSection } from "@/components/pricing/ownership-section";
import { CareTierMatrix } from "@/components/pricing/care-tier-matrix";
import { NewWorkSection } from "@/components/pricing/new-work-section";
import { HourlyRatesSection } from "@/components/pricing/hourly-rates-section";
import { InfraCostsSection } from "@/components/pricing/infra-costs-section";
import { IncentivesSection } from "@/components/pricing/incentives-section";
import { PricingFaq } from "@/components/pricing/pricing-faq";
import { PricingCta } from "@/components/pricing/pricing-cta";

const SECTION_LINKS = [
  { href: "#build", label: "Build" },
  { href: "#plans", label: "Plans" },
  { href: "#infrastructure", label: "Running costs" },
  { href: "#faq", label: "FAQ" },
];

interface BusinessOSPricingClientProps {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export default function BusinessOSPricingClient({
  utmSource,
  utmMedium,
  utmCampaign,
  utmTerm,
  utmContent,
}: BusinessOSPricingClientProps) {
  const [showStickyBar, setShowStickyBar] = useState(false);

  const buildCtaUrl = (baseUrl: string) => {
    const params = new URLSearchParams();
    if (utmSource) params.set("utm_source", utmSource);
    if (utmMedium) params.set("utm_medium", utmMedium);
    if (utmCampaign) params.set("utm_campaign", utmCampaign);
    if (utmTerm) params.set("utm_term", utmTerm);
    if (utmContent) params.set("utm_content", utmContent);
    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  };

  const ctaUrl = buildCtaUrl(PRICING_CTA_URL);

  // The bar only appears once the hero CTA has scrolled away.
  useEffect(() => {
    const handleScroll = () => setShowStickyBar(window.scrollY > 600);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <AnimatePresence>
        {showStickyBar && (
          <motion.div
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed inset-x-0 top-0 z-50 border-b border-neutral-200 bg-white"
          >
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Jaro.dev"
                  width={28}
                  height={28}
                  className="rounded"
                />
                <span className="hidden text-sm font-semibold text-neutral-900 sm:inline">
                  BusinessOS pricing
                </span>
              </div>

              <nav className="hidden items-center gap-6 lg:flex">
                {SECTION_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium text-neutral-600 transition-colors hover:text-neutral-900"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>

              <a
                href={ctaUrl}
                className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
              >
                Book a call
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <PricingHero ctaUrl={ctaUrl} />
      <HowItWorksSection />
      <BuildPhaseSection />
      <OwnershipSection />
      <CareTierMatrix ctaUrl={ctaUrl} />
      <NewWorkSection />
      <HourlyRatesSection />
      <InfraCostsSection />
      <IncentivesSection />
      <PricingFaq />
      <PricingCta ctaUrl={ctaUrl} />

      <footer className="border-t border-neutral-200 bg-white px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Jaro.dev"
              width={28}
              height={28}
              className="rounded"
            />
            <span className="text-sm text-neutral-600">
              BusinessOS© by <span className="font-semibold">Jaro.dev</span>
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} Jaro.dev. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
