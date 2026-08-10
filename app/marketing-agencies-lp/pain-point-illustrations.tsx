"use client";

import { PainPointsGrid, type PainPoint } from "@/components/landing/pain-points-grid";

const PAIN_POINTS: PainPoint[] = [
  {
    key: "only-john",
    text: (
      <>
        Campaign setups that <span className="font-bold text-neutral-900">only one person</span> knows how to do
      </>
    ),
    src: "/illustrations/business-os/only-john.svg?v=2",
    alt: "Person unsure about undocumented campaign workflows",
  },
  {
    key: "zapier-tape",
    text: (
      <>
        Ad platforms, CRMs and reporting tools <span className="font-bold text-neutral-900">duct-taped together</span>
      </>
    ),
    src: "/illustrations/business-os/zapier-tape.svg?v=2",
    alt: "Fragmented ad platforms loosely connected together",
  },
  {
    key: "someone-leaves",
    text: (
      <>
        When an account manager leaves, <span className="font-bold text-neutral-900">client relationships fall apart</span>
      </>
    ),
    src: "/illustrations/business-os/someone-leaves.svg?v=2",
    alt: "Account manager leaving and client handovers breaking",
  },
  {
    key: "crm-days",
    text: (
      <>
        Pulling campaign reports and client dashboards <span className="font-bold text-neutral-900">eats entire days</span>
      </>
    ),
    src: "/illustrations/business-os/crm-days.svg?v=2",
    alt: "Repetitive copy and paste between ad platforms and CRMs",
  },
  {
    key: "lead-sources",
    text: (
      <>
        You can&apos;t tell which campaigns are <span className="font-bold text-neutral-900">actually profitable</span>
      </>
    ),
    src: "/illustrations/business-os/lead-sources.svg?v=2",
    alt: "Researching unclear campaign profitability",
  },
  {
    key: "team-perf",
    text: (
      <>
        You can&apos;t see how your teams are <span className="font-bold text-neutral-900">performing across accounts</span>
      </>
    ),
    src: "/illustrations/business-os/team-perf.svg?v=2",
    alt: "Team performance dashboard without clear visibility",
  },
  {
    key: "disjointed-tools",
    text: (
      <>
        Each team picked their own tools and <span className="font-bold text-neutral-900">nothing talks to each other</span>
      </>
    ),
    src: "/illustrations/business-os/disjointed-tools.svg?v=2",
    alt: "Disconnected marketing tools and workflows",
  },
  {
    key: "unused-tools",
    text: (
      <>
        You&apos;re paying for marketing tools you <span className="font-bold text-neutral-900">barely use</span>
      </>
    ),
    src: "/illustrations/business-os/unused-tools.svg?v=2",
    alt: "Paying for unused marketing software subscriptions",
  },
  {
    key: "excel-weekly",
    text: (
      <>
        You&apos;re building client reports in Excel <span className="font-bold text-neutral-900">every week</span>
      </>
    ),
    src: "/illustrations/business-os/excel-weekly.svg?v=2",
    alt: "Manual weekly client reporting in spreadsheets",
  },
  {
    key: "no-realtime",
    text: (
      <>
        There&apos;s no <span className="font-bold text-neutral-900">real-time insight</span> into campaign performance
      </>
    ),
    src: "/illustrations/business-os/no-realtime.svg?v=2",
    alt: "Outdated campaign data instead of real-time insight",
  },
  {
    key: "no-audit",
    text: (
      <>
        No <span className="font-bold text-neutral-900">audit trails</span> for client approvals and changes
      </>
    ),
    src: "/illustrations/business-os/no-audit.svg?v=2",
    alt: "Missing client approval records and audit trails",
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
