"use client";

import type { ReactNode } from "react";

export interface PainPoint {
  key: string;
  text: ReactNode;
  src: string;
  alt: string;
}

function PainPointCard({ text, src, alt }: Omit<PainPoint, "key">) {
  return (
    <div className="group relative h-full rounded-2xl border-2 border-primary-300 bg-white transition-transform duration-300 hover:-translate-y-1">
      <div className="flex h-full flex-col overflow-hidden rounded-[22px]">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden p-1">
          <img
            src={src}
            alt={alt}
            className="size-full scale-150 object-contain transition-transform duration-300 group-hover:scale-[1.65]"
          />
        </div>
        <div className="border-t border-primary-100 bg-primary-50 p-4 text-center md:p-5">
          <p className="text-sm font-medium leading-snug text-neutral-700 md:text-base">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

export function PainPointsGrid({ points }: { points: PainPoint[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {points.map((point) => (
        <PainPointCard
          key={point.key}
          text={point.text}
          src={point.src}
          alt={point.alt}
        />
      ))}
    </div>
  );
}
