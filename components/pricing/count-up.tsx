"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "framer-motion";

// Splits "~$1,500+" into prefix "~$", number 1500 and suffix "+" so a formatted
// display value can animate without the caller having to pass its parts.
const VALUE_PATTERN = /^([^\d]*)([\d,.]+)(.*)$/;

interface ParsedValue {
  prefix: string;
  suffix: string;
  target: number;
  decimals: number;
  canAnimate: boolean;
}

function parseValue(value: string): ParsedValue {
  const match = value.match(VALUE_PATTERN);

  if (!match) {
    return { prefix: "", suffix: "", target: 0, decimals: 0, canAnimate: false };
  }

  const [, prefix, digits, suffix] = match;
  const target = Number(digits.replace(/,/g, ""));
  const decimals = digits.includes(".") ? digits.split(".")[1]?.length ?? 0 : 0;

  return { prefix, suffix, target, decimals, canAnimate: Number.isFinite(target) };
}

interface CountUpProps {
  value: string;
  durationMs?: number;
}

export function CountUp({ value, durationMs = 1100 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  const { prefix, suffix, target, decimals, canAnimate } = useMemo(
    () => parseValue(value),
    [value]
  );

  const format = useCallback(
    (amount: number) =>
      `${prefix}${amount.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`,
    [prefix, suffix, decimals]
  );

  // Falls back to the raw string for values the pattern cannot parse.
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (!canAnimate) return;
    setDisplay(format(0));
  }, [canAnimate, format]);

  useEffect(() => {
    if (!canAnimate || !isInView) return;

    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const progress = Math.min((now - start) / durationMs, 1);
      // Ease-out so the number settles rather than stopping dead.
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplay(format(target * eased));

      if (progress < 1) frame = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(frame);
  }, [canAnimate, isInView, target, durationMs, format]);

  return <span ref={ref}>{display}</span>;
}
