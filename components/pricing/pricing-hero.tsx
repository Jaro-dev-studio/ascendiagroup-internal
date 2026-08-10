"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { CountUp } from "@/components/pricing/count-up";
import { HERO_STATS } from "@/constants/businessos-pricing";

interface PricingHeroProps {
  ctaUrl: string;
}

export function PricingHero({ ctaUrl }: PricingHeroProps) {
  return (
    <section className="border-b border-neutral-200 bg-white px-6 pb-16 pt-28 sm:pb-20 sm:pt-32">
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-2"
        >
          <ShieldCheck className="size-4 text-primary-600" />
          <span className="text-sm font-semibold text-primary-700">
            You own the code and the IP from day one
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-8 text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl"
        >
          What BusinessOS Costs
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600"
        >
          One fixed price to build it. Monthly plans to expand functionalities.
          Your own accounts for the infrastructure, at cost, with no markup from
          us.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <a
            href={ctaUrl}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-primary-700"
          >
            Book a scoping call
            <ArrowRight className="size-4" />
          </a>
          <a
            href="#infrastructure"
            className="inline-flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-6 py-3.5 text-base font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
          >
            See the running costs
          </a>
        </motion.div>

        <motion.dl
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 grid w-full grid-cols-1 gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4"
        >
          {HERO_STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1 bg-white p-6 text-left"
            >
              <dd className="text-3xl font-bold tracking-tight text-neutral-900">
                <CountUp value={stat.value} />
              </dd>
              <dt className="text-sm font-semibold text-neutral-900">
                {stat.label}
              </dt>
              <p className="text-sm leading-relaxed text-neutral-500">
                {stat.detail}
              </p>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
