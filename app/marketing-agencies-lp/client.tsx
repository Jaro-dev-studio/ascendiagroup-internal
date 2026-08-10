"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import ROICalculator from "@/app/business-os/roi-calculator";
import { PainPointsCarousel } from "@/app/marketing-agencies-lp/pain-point-illustrations";
import { AnimatedSection, StaggeredItem } from "@/components/landing/animated-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";

function Typewriter({ text, delay = 0, onComplete }: { text: string; delay?: number; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        onComplete?.();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [started, text, onComplete]);

  return (
    <span>
      {displayedText}
      {displayedText.length < text.length && started && (
        <span className="animate-pulse text-primary-400">|</span>
      )}
    </span>
  );
}

interface MarketingAgenciesClientProps {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export default function MarketingAgenciesClient({
  utmSource,
  utmMedium,
  utmCampaign,
  utmTerm,
  utmContent,
}: MarketingAgenciesClientProps) {
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);
  const [calculatorCTAVisible, setCalculatorCTAVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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

  const ctaUrl = buildCtaUrl("https://jaro.dev/contact-businessos");

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), isMobile ? 300 : 1000);
    return () => clearTimeout(timer);
  }, [isMobile]);

  useEffect(() => {
    if (!isVideoModalOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsVideoModalOpen(false);
      }
    };
    
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isVideoModalOpen]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setCalculatorCTAVisible(entry.isIntersecting);
      },
      { threshold: 0.5 }
    );

    const checkForCTA = () => {
      const ctaElement = document.getElementById("calculator-cta");
      if (ctaElement) {
        observer.observe(ctaElement);
      }
    };

    checkForCTA();
    const timer = setTimeout(checkForCTA, 1000);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = window.innerHeight;
      const pastHero = window.scrollY > heroHeight * 0.8;
      setShowFloatingCTA(pastHero && !calculatorCTAVisible);
    };
    
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [calculatorCTAVisible]);

  const phases = [
    {
      phase: 1,
      title: <>We Connect & <span className="text-primary-500">Unify</span> Your Data</>,
      description: "Centralize everything into a single source of truth.",
      quote: "For the first time, everything's in one place. I finally trust the data.",
      icon: (
        <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      ),
    },
    {
      phase: 2,
      title: <>We <span className="text-primary-500">Automate</span> Your Reporting</>,
      description: "Turn raw data into real-time insights with live dashboards.",
      quote: "I no longer wait for reports. I know what's happening, right now.",
      icon: (
        <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      phase: 3,
      title: <>We <span className="text-primary-500">Standardize</span> Manual Processes</>,
      description: "Fix what's undocumented, inconsistent, or in employee's heads.",
      quote: "Everyone finally does it the same way. There's clarity, not chaos.",
      icon: (
        <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      phase: 4,
      title: <>We <span className="text-primary-500">Automate</span> Repeatable Work</>,
      description: "Remove human steps from standardized processes.",
      quote: "Things just happen now. No chasing. No reminding.",
      icon: (
        <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
    {
      phase: 5,
      title: <>We Layer in <span className="text-primary-500">AI</span></>,
      description: "Upgrade automation with AI agents that learn and adapt.",
      quote: "It's like having another team working 24/7, without adding headcount.",
      icon: (
        <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
    {
      phase: 6,
      title: <>We Optimize, Scale & <span className="text-primary-500">Self-Improve</span></>,
      description: "Build a system that improves itself over time.",
      quote: "The system runs, and gets smarter, without me.",
      icon: (
        <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Floating CTA */}
      {showFloatingCTA && (
        <motion.div
          className="fixed right-6 top-6 z-50"
          initial={{ opacity: 0, y: -16 }}
          animate={{ 
            opacity: 1, 
            y: 0,
            x: [0, -4, 4, -4, 4, 0],
          }}
          transition={{
            opacity: { duration: 0.3 },
            y: { duration: 0.3 },
            x: {
              duration: 0.6,
              delay: 12,
              repeat: Infinity,
              repeatDelay: 12,
              ease: "easeInOut",
            },
          }}
        >
          <Link
            href={ctaUrl}
            className="flex items-center gap-2 rounded-full bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-500/25 transition-all hover:bg-primary-600 hover:shadow-xl hover:shadow-primary-500/30"
          >
            Book Free Consultation
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </motion.div>
      )}

      {/* Hero Section */}
      <section className="relative flex min-h-screen items-center justify-center px-6 pt-24">
        {/* Logo */}
        <div className="absolute left-6 top-6 z-10 flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Jaro.dev"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <span className="text-lg font-bold text-neutral-900">
            BusinessOS <span className="font-normal text-neutral-500">by Jaro.dev</span>
          </span>
        </div>

        {/* Background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="hidden md:block">
            <div className="absolute -right-20 top-20 size-[800px] rounded-full bg-gradient-to-br from-primary-100/80 to-primary-200/40 blur-[120px]" />
            <div className="absolute -left-20 bottom-20 size-[600px] rounded-full bg-gradient-to-tr from-primary-50/60 to-transparent blur-[100px]" />
          </div>
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")"
            }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          {/* Trust badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2"
          >
            <span className="flex items-center gap-1">
              <span className="size-2 animate-pulse rounded-full bg-success-500" />
              <span className="text-sm font-medium text-primary-700">Trusted by OpenAI & JPMorgan Chase</span>
            </span>
          </motion.div>

          {/* Main Headline */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-6 text-5xl font-bold leading-tight tracking-tight text-neutral-900 md:text-6xl lg:text-7xl"
          >
            <span className="md:hidden">BusinessOS</span>
            <span className="hidden md:inline">
              <Typewriter text="BusinessOS" delay={200} />
            </span>
            <span className="text-primary-600">©</span>
            <br />
            <span className="text-3xl font-semibold text-neutral-600 md:text-4xl lg:text-5xl">
              for Marketing Agencies
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={showContent ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            className="mx-auto mb-4 max-w-3xl text-xl text-neutral-600 md:text-2xl"
          >
            The custom-built internal platform that{" "}
            <span className="font-semibold text-neutral-900">automates your agency operations</span>{" "}
            and runs your marketing agency while you sleep.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={showContent ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mx-auto mb-10 max-w-2xl text-lg text-neutral-500"
          >
            For marketing agencies ready to eliminate chaos and scale.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={showContent ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link
              href={ctaUrl}
              className="group inline-flex items-center gap-3 rounded-full bg-neutral-900 px-8 py-4 text-lg font-semibold text-white shadow-2xl shadow-neutral-900/20 transition-all duration-300 hover:bg-neutral-800 hover:shadow-xl"
            >
              Book My Free Consultation
              <svg className="size-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <button
              onClick={() => setIsVideoModalOpen(true)}
              className="group inline-flex items-center gap-3 rounded-full border-2 border-neutral-200 bg-white px-8 py-[16px] text-lg font-semibold text-neutral-700 transition-all duration-200 hover:border-primary-300 hover:bg-primary-50"
            >
              <div className="flex size-7 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg shadow-primary-500/30">
                <svg className="ml-0.5 size-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              Watch 2-Min Demo
            </button>
          </motion.div>

          {/* Quick stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={showContent ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-8 border-t border-neutral-100 py-10 md:gap-16"
          >
            <div className="text-center">
              <p className="text-3xl font-bold text-primary-600">6.7x</p>
              <p className="text-sm text-neutral-500">Avg. ROI</p>
            </div>
            <div className="hidden size-1 rounded-full bg-neutral-300 md:block" />
            <div className="hidden size-1 rounded-full bg-neutral-300 md:block" />
            <div className="text-center">
              <p className="text-3xl font-bold text-primary-600">30 Days</p>
              <p className="text-sm text-neutral-500">To First Results</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="border-y border-neutral-100 bg-white px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <p className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-neutral-400">
            Trusted by industry leaders
          </p>
          <div className="flex items-center justify-center">
            <Image
              src="/logos/trusted.png"
              alt="Trusted by OpenAI, JPMorgan Chase, Deutsche Bank, Hawaii Life, Huckberry, and Raise"
              width={900}
              height={150}
              className="h-auto w-full max-w-4xl"
            />
          </div>
        </div>
      </section>

      <TestimonialsSection />

      {/* Problem Section */}
      <section className="relative overflow-hidden bg-white px-6 py-32 md:py-40">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-16 text-center">
            <AnimatedSection>
              <span className="mb-8 inline-block text-base font-medium uppercase tracking-widest text-danger-500 md:text-lg">
                The Problem
              </span>
            </AnimatedSection>
            <AnimatedSection delay={0.1}>
              <h2 className="text-5xl font-bold tracking-tight text-neutral-900 md:text-6xl lg:text-7xl">
                Your Agency is Growing
              </h2>
            </AnimatedSection>
            <AnimatedSection delay={0.15}>
              <p className="mt-4 text-2xl text-danger-500 md:text-3xl">
                But Your Operations Are Breaking
              </p>
            </AnimatedSection>
            <AnimatedSection delay={0.2}>
              <p className="mx-auto mt-8 max-w-xl text-lg text-neutral-500">
                Marketing agencies, do these sound familiar?
              </p>
            </AnimatedSection>
          </div>

          {/* Pain Points Grid */}
          <AnimatedSection delay={0.25}>
            <PainPointsCarousel />
          </AnimatedSection>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative bg-white px-6 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <AnimatedSection className="mb-16 text-center">
            <span className="mb-4 inline-block rounded-full bg-primary-50 px-4 py-2 text-base font-semibold text-primary-600 md:text-lg">
              The Solution
            </span>
            <h2 className="mb-4 text-4xl font-bold text-neutral-900 md:text-5xl">
              How We Transform Your Operations
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-neutral-600">
              A proven 6-phase approach that takes you from chaos to clarity
            </p>
          </AnimatedSection>
          
          {/* Phases List */}
          <div className="grid gap-6">
            {phases.map((phase, index) => (
              <StaggeredItem key={phase.phase} index={index * 0.1}>
                <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm md:p-12">
                  <div className="flex flex-col items-center text-center">
                    <div className="mb-6 flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25">
                      <div className="scale-125">
                        {phase.icon}
                      </div>
                    </div>
                    <span className="mb-4 inline-block rounded-full bg-primary-50 px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-primary-600">
                      Phase {phase.phase}
                    </span>
                    <h3 className="mb-4 text-2xl font-bold text-neutral-900 md:text-3xl">
                      {phase.title}
                    </h3>
                    <p className="mb-6 max-w-lg text-lg leading-relaxed text-neutral-600">
                      {phase.description}
                    </p>
                    <div className="w-full max-w-md rounded-xl bg-neutral-50 p-4">
                      <p className="text-base italic text-neutral-500">
                        &ldquo;{phase.quote}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
              </StaggeredItem>
            ))}
          </div>
        </div>
      </section>

      {/* ROI Calculator Section */}
      <ROICalculator 
        lightMode 
        utmSource={utmSource}
        utmMedium={utmMedium}
        utmCampaign={utmCampaign}
        utmTerm={utmTerm}
        utmContent={utmContent}
      />

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Jaro.dev"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="text-neutral-600">
              BusinessOS© by{" "}
              <span className="font-semibold text-neutral-900">
                Jaro.dev
              </span>
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} Jaro.dev. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Video Modal */}
      <Dialog open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
        <DialogContent 
          className="flex w-[calc(100vw-2rem)] items-center justify-center border-none bg-transparent p-0 shadow-none md:w-[70vw] md:max-w-4xl"
          hideCloseButton
          onEscapeKeyDown={() => setIsVideoModalOpen(false)}
          onPointerDownOutside={() => setIsVideoModalOpen(false)}
          onInteractOutside={() => setIsVideoModalOpen(false)}
        >
          <VisuallyHidden>
            <DialogTitle>BusinessOS Demo Video</DialogTitle>
          </VisuallyHidden>
          <div className="relative aspect-video w-full">
            <iframe
              src={`https://fast.wistia.net/embed/iframe/iy3kq6lumi?autoplay=${isMobile ? 0 : 1}`}
              title="BusinessOS Demo"
              allow="autoplay; fullscreen"
              allowFullScreen
              className="absolute inset-0 size-full rounded-none md:rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
