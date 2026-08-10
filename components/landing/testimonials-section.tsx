"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { AnimatedSection } from "@/components/landing/animated-section";

function StarRating() {
  return (
    <div className="mb-5 flex gap-1" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className="size-5 text-warning-400"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 0 0 .95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 0 0-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 0 0-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 0 0-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 0 0 .951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({
  brand,
  quote,
  authorName,
  authorRole,
  authorImage,
}: {
  brand: ReactNode;
  quote: ReactNode;
  authorName: string;
  authorRole: string;
  authorImage: string;
}) {
  return (
    <div className="relative flex h-full flex-col rounded-2xl border-2 border-primary-400 bg-neutral-900 p-7 md:p-8">
      <div className="mb-6 flex items-center gap-2.5">{brand}</div>
      <StarRating />
      <p className="mb-8 flex-1 text-lg leading-relaxed text-white">{quote}</p>
      <div className="flex items-center gap-3">
        <Image
          src={authorImage}
          alt={authorName}
          width={48}
          height={48}
          className="size-12 rounded-full object-cover"
        />
        <div>
          <p className="font-semibold text-white">{authorName}</p>
          <p className="text-sm text-neutral-400">{authorRole}</p>
        </div>
      </div>
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section className="relative overflow-hidden bg-neutral-50 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-5xl">
        <AnimatedSection className="mb-14 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl">
            What Our Clients Say
          </h2>
        </AnimatedSection>

        <div className="grid gap-6 md:grid-cols-2">
          <AnimatedSection delay={0.1}>
            <TestimonialCard
              brand={
                <Image
                  src="/logos/openai.png"
                  alt="OpenAI"
                  width={140}
                  height={38}
                  className="h-8 w-auto object-contain"
                />
              }
              quote={
                <>
                  Some of the finest engineers I&apos;ve had the pleasure of working with. Beyond being consummate professionals, they&apos;re brilliant communicators - a rarity in software engineering. There are few, if any, I&apos;d recommend before them.
                </>
              }
              authorName="Patrick Cason"
              authorRole="Engineering Manager at OpenAI"
              authorImage="/testimonials/patrick-cason.jpg"
            />
          </AnimatedSection>

          <AnimatedSection delay={0.2}>
            <TestimonialCard
              brand={
                <>
                  <Image
                    src="/logos/bundlebuilder.png"
                    alt="BundleBuilder"
                    width={32}
                    height={32}
                    className="size-8 rounded-md object-contain"
                  />
                  <span className="text-lg font-bold tracking-tight text-white">
                    BundleBuilder
                  </span>
                </>
              }
              quote="I can highly recommend them, absolutely great to work with. They use the right stack, and are very knowledgeable about what tech to use, and how to use it in the right way."
              authorName="Richard Spencer Davies"
              authorRole="Founder at BundleBuilder"
              authorImage="/testimonials/richard-spencer-davies.jpg"
            />
          </AnimatedSection>
        </div>
      </div>
    </section>
  );
}
