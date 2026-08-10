"use client";

import { PainPointsGrid, type PainPoint } from "@/components/landing/pain-points-grid";

const PAIN_POINTS: PainPoint[] = [
  {
    key: "only-john",
    text: (
      <>
        <span className="font-bold text-neutral-900">Undocumented manual workflows</span> that only &quot;John&quot; knows
      </>
    ),
    src: "/illustrations/business-os/only-john.svg?v=2",
    alt: "Person unsure about undocumented workflows",
  },
  {
    key: "zapier-tape",
    text: (
      <>
        Tools <span className="font-bold text-neutral-900">duct-taped together</span> with Zapier and spreadsheets
      </>
    ),
    src: "/illustrations/business-os/zapier-tape.svg?v=2",
    alt: "Fragmented tools loosely connected together",
  },
  {
    key: "someone-leaves",
    text: (
      <>
        When someone leaves, <span className="font-bold text-neutral-900">something always breaks</span>
      </>
    ),
    src: "/illustrations/business-os/someone-leaves.svg?v=2",
    alt: "Someone leaving and processes breaking",
  },
  {
    key: "crm-days",
    text: (
      <>
        Updating CRMs and spreadsheets <span className="font-bold text-neutral-900">eats entire days</span>
      </>
    ),
    src: "/illustrations/business-os/crm-days.svg?v=2",
    alt: "Repetitive copy and paste between tools",
  },
  {
    key: "lead-sources",
    text: (
      <>
        You don&apos;t know where your <span className="font-bold text-neutral-900">leads are coming from</span>
      </>
    ),
    src: "/illustrations/business-os/lead-sources.svg?v=2",
    alt: "Researching unclear lead sources",
  },
  {
    key: "team-perf",
    text: (
      <>
        You can&apos;t see how your teams are <span className="font-bold text-neutral-900">actually performing</span>
      </>
    ),
    src: "/illustrations/business-os/team-perf.svg?v=2",
    alt: "Performance dashboard without clear visibility",
  },
  {
    key: "disjointed-tools",
    text: (
      <>
        <span className="font-bold text-neutral-900">Disjointed tools</span> that don&apos;t talk to each other
      </>
    ),
    src: "/illustrations/business-os/disjointed-tools.svg?v=2",
    alt: "Disconnected tools and workflows",
  },
  {
    key: "unused-tools",
    text: (
      <>
        You&apos;re paying for tools you <span className="font-bold text-neutral-900">barely use</span>
      </>
    ),
    src: "/illustrations/business-os/unused-tools.svg?v=2",
    alt: "Paying for unused software subscriptions",
  },
  {
    key: "excel-weekly",
    text: (
      <>
        You&apos;re building reports in Excel <span className="font-bold text-neutral-900">every week</span>
      </>
    ),
    src: "/illustrations/business-os/excel-weekly.svg?v=2",
    alt: "Manual weekly data collection and reporting",
  },
  {
    key: "no-realtime",
    text: (
      <>
        There&apos;s no <span className="font-bold text-neutral-900">real-time insight</span> into what&apos;s going on
      </>
    ),
    src: "/illustrations/business-os/no-realtime.svg?v=2",
    alt: "Outdated information instead of real-time insight",
  },
  {
    key: "no-audit",
    text: (
      <>
        You don&apos;t have <span className="font-bold text-neutral-900">audit trails</span> or consistent records
      </>
    ),
    src: "/illustrations/business-os/no-audit.svg?v=2",
    alt: "Missing documents and incomplete records",
  },
  {
    key: "ai-paralysis",
    text: (
      <>
        You want to use <span className="font-bold text-neutral-900">AI</span>, but don&apos;t know where to start
      </>
    ),
    src: "/illustrations/business-os/ai-paralysis.svg?v=2",
    alt: "Wanting to start with AI but unsure how",
  },
];

export function PainPointsCarousel() {
  return <PainPointsGrid points={PAIN_POINTS} />;
}
