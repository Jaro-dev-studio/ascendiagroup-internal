"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Trophy,
  TrendingUp,
  ExternalLink,
  Briefcase,
  Download,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatCurrencyCompact,
  SAM_GOV_OPPORTUNITY_TYPES,
} from "@/constants/gov-market-research";
import type { GovAwardedContract, GovOpportunity } from "@prisma/client";
import type { EChartsOption } from "echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface AgencyBreakdown {
  awardingAgency: string;
  wins: number;
  totalValue: number;
  avgValue: number;
}

interface NaicsBreakdown {
  naicsCode: string;
  naicsDescription: string | null;
  wins: number;
  totalValue: number;
}

interface YearlyTrend {
  year: number;
  wins: number;
  totalValue: number;
}

interface SetAsideBreakdown {
  setAsideType: string;
  wins: number;
  totalValue: number;
}

interface CompetitorProfile {
  recipientName: string;
  totalWins: number;
  totalAwardValue: number;
  avgAwardValue: number;
  contracts: GovAwardedContract[];
  samAwards: GovOpportunity[];
  agencyBreakdown: AgencyBreakdown[];
  naicsBreakdown: NaicsBreakdown[];
  yearlyTrend: YearlyTrend[];
  setAsideBreakdown: SetAsideBreakdown[];
}

interface CompetitorProfileClientProps {
  profile: CompetitorProfile;
}

const CHART_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
];

function exportContractsCsv(contracts: GovAwardedContract[], companyName: string) {
  const headers = [
    "Award ID",
    "Agency",
    "Sub Agency",
    "NAICS",
    "PSC",
    "Type",
    "Set-Aside",
    "Amount",
    "Obligated",
    "Start Date",
    "End Date",
    "Description",
    "Place of Performance",
  ];
  const rows = contracts.map((c) => [
    `"${c.awardId}"`,
    `"${(c.awardingAgency || "").replace(/"/g, "\"\"")}"`,
    `"${(c.awardingSubAgency || "").replace(/"/g, "\"\"")}"`,
    c.naicsCode || "",
    c.pscCode || "",
    c.awardType || "",
    `"${(c.setAsideType || "").replace(/"/g, "\"\"")}"`,
    c.awardAmount.toFixed(2),
    c.totalObligated?.toFixed(2) || "",
    c.startDate ? new Date(c.startDate).toLocaleDateString() : "",
    c.endDate ? new Date(c.endDate).toLocaleDateString() : "",
    `"${(c.description || "").replace(/"/g, "\"\"").slice(0, 200)}"`,
    `"${(c.placeOfPerformance || "").replace(/"/g, "\"\"")}"`,
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${companyName.replace(/[^a-zA-Z0-9]/g, "_")}-contracts.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CompetitorProfileClient({ profile }: CompetitorProfileClientProps) {
  const [activeTab, setActiveTab] = useState<"contracts" | "sam-awards">("contracts");

  const trendOption: EChartsOption = useMemo(() => ({
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const items = params as Array<{ name: string; seriesName: string; value: number; color: string }>;
        let html = `<b>${items[0].name}</b><br/>`;
        items.forEach((item) => {
          const val = item.seriesName === "Award Value"
            ? `$${item.value.toLocaleString()}`
            : item.value.toString();
          html += `<span style="color:${item.color}">\u25CF</span> ${item.seriesName}: <b>${val}</b><br/>`;
        });
        return html;
      },
    },
    legend: { data: ["Award Value", "Wins"], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { left: 80, right: 50, top: 20, bottom: 40 },
    xAxis: {
      type: "category",
      data: profile.yearlyTrend.map((y) => y.year.toString()),
      axisLabel: { fontSize: 12 },
    },
    yAxis: [
      {
        type: "value",
        name: "Value",
        axisLabel: { fontSize: 11, formatter: (v: number) => formatCurrencyCompact(v) },
        splitLine: { lineStyle: { type: "dashed", opacity: 0.3 } },
      },
      {
        type: "value",
        name: "Wins",
        axisLabel: { fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "Award Value",
        type: "bar",
        data: profile.yearlyTrend.map((y) => y.totalValue),
        barMaxWidth: 40,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: "#6366f1" },
      },
      {
        name: "Wins",
        type: "line",
        yAxisIndex: 1,
        data: profile.yearlyTrend.map((y) => y.wins),
        smooth: true,
        lineStyle: { width: 2, color: "#f59e0b" },
        itemStyle: { color: "#f59e0b" },
        symbolSize: 8,
      },
    ],
  }), [profile.yearlyTrend]);

  const agencyBarOption: EChartsOption = useMemo(() => {
    const sorted = [...profile.agencyBreakdown].slice(0, 10).reverse();
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const p = (params as Array<{ name: string; value: number }>)[0];
          return `${p.name}<br/>Total Value: <b>$${p.value.toLocaleString()}</b>`;
        },
      },
      grid: { left: 200, right: 40, top: 10, bottom: 20 },
      xAxis: {
        type: "value",
        axisLabel: { fontSize: 11, formatter: (v: number) => formatCurrencyCompact(v) },
        splitLine: { lineStyle: { type: "dashed", opacity: 0.3 } },
      },
      yAxis: {
        type: "category",
        data: sorted.map((a) =>
          a.awardingAgency.length > 28 ? a.awardingAgency.slice(0, 26) + "..." : a.awardingAgency
        ),
        axisLabel: { fontSize: 10 },
      },
      series: [
        {
          type: "bar",
          data: sorted.map((a) => a.totalValue),
          barMaxWidth: 24,
          itemStyle: { borderRadius: [0, 4, 4, 0], color: "#3b82f6" },
          emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.15)" } },
        },
      ],
    };
  }, [profile.agencyBreakdown]);

  const naicsPieOption: EChartsOption = useMemo(() => ({
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number };
        return `${p.name}<br/>$${p.value.toLocaleString()} (${p.percent}%)`;
      },
    },
    legend: {
      orient: "vertical",
      right: 10,
      top: "center",
      textStyle: { fontSize: 11 },
    },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        center: ["35%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: "#fff" },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 13, fontWeight: "bold" },
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0,0,0,0.2)" },
        },
        data: profile.naicsBreakdown.map((n, i) => ({
          name: n.naicsDescription || n.naicsCode,
          value: n.totalValue,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
        })),
      },
    ],
  }), [profile.naicsBreakdown]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/sam-gov/competitors">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Briefcase className="text-primary size-6" />
              <h1 className="text-text-dark text-2xl font-bold">{profile.recipientName}</h1>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              Competitor profile and award history
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => exportContractsCsv(profile.contracts, profile.recipientName)}
          disabled={profile.contracts.length === 0}
        >
          <Download className="mr-2 size-4" />
          Export Contracts CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2">
              <Trophy className="text-primary size-5" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Total Wins</p>
              <p className="text-text-dark text-xl font-bold">
                {profile.totalWins.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent/10 p-2">
              <DollarSign className="size-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Total Award Value</p>
              <p className="text-text-dark text-xl font-bold">
                {formatCurrencyCompact(profile.totalAwardValue)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success-100 p-2">
              <TrendingUp className="size-5 text-success-700" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Avg Contract Value</p>
              <p className="text-text-dark text-xl font-bold">
                {formatCurrencyCompact(profile.avgAwardValue)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning-100 p-2">
              <Building2 className="size-5 text-warning-700" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Agencies</p>
              <p className="text-text-dark text-xl font-bold">
                {profile.agencyBreakdown.length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Trend Chart */}
      {profile.yearlyTrend.length > 1 && (
        <Card className="p-6">
          <h2 className="text-text-dark mb-4 text-lg font-semibold">Award Trend Over Time</h2>
          <ReactECharts option={trendOption} style={{ height: 320 }} />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Agency Breakdown */}
        {profile.agencyBreakdown.length > 0 && (
          <Card className="p-6">
            <h2 className="text-text-dark mb-4 text-lg font-semibold">Wins by Agency</h2>
            <ReactECharts option={agencyBarOption} style={{ height: 320 }} />
          </Card>
        )}

        {/* NAICS Breakdown */}
        {profile.naicsBreakdown.length > 0 && (
          <Card className="p-6">
            <h2 className="text-text-dark mb-4 text-lg font-semibold">Wins by NAICS Category</h2>
            <ReactECharts option={naicsPieOption} style={{ height: 320 }} />
          </Card>
        )}
      </div>

      {/* Agency Details Table */}
      {profile.agencyBreakdown.length > 0 && (
        <Card className="p-6">
          <h2 className="text-text-dark mb-4 text-lg font-semibold">Agency Relationship Details</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 pr-4 font-medium text-text-secondary">Agency</th>
                  <th className="pb-3 pr-4 text-right font-medium text-text-secondary">Wins</th>
                  <th className="pb-3 pr-4 text-right font-medium text-text-secondary">Total Value</th>
                  <th className="pb-3 text-right font-medium text-text-secondary">Avg Value</th>
                </tr>
              </thead>
              <tbody>
                {profile.agencyBreakdown.map((agency) => (
                  <tr key={agency.awardingAgency} className="border-b border-border last:border-0">
                    <td className="text-text-dark py-2.5 pr-4 font-medium">
                      {agency.awardingAgency}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <Badge variant="secondary">{agency.wins}</Badge>
                    </td>
                    <td className="text-text-dark py-2.5 pr-4 text-right font-semibold">
                      {formatCurrencyCompact(agency.totalValue)}
                    </td>
                    <td className="py-2.5 text-right text-text-secondary">
                      {formatCurrencyCompact(agency.avgValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Set-Aside Breakdown */}
      {profile.setAsideBreakdown.length > 0 && (
        <Card className="p-6">
          <h2 className="text-text-dark mb-4 flex items-center gap-2 text-lg font-semibold">
            <Shield className="text-primary size-5" />
            Set-Aside Breakdown
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 pr-4 font-medium text-text-secondary">Set-Aside Type</th>
                  <th className="pb-3 pr-4 text-right font-medium text-text-secondary">Wins</th>
                  <th className="pb-3 text-right font-medium text-text-secondary">Total Value</th>
                </tr>
              </thead>
              <tbody>
                {profile.setAsideBreakdown.map((sa) => (
                  <tr key={sa.setAsideType} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-4">
                      <Badge variant="outline" className="text-xs">
                        {sa.setAsideType}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <Badge variant="secondary">{sa.wins}</Badge>
                    </td>
                    <td className="text-text-dark py-2.5 text-right font-semibold">
                      {formatCurrencyCompact(sa.totalValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Contract Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "contracts"
              ? "border-primary text-primary border-b-2"
              : "hover:text-text-dark text-text-secondary"
          }`}
          onClick={() => setActiveTab("contracts")}
        >
          USASpending Contracts ({profile.contracts.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "sam-awards"
              ? "border-primary text-primary border-b-2"
              : "hover:text-text-dark text-text-secondary"
          }`}
          onClick={() => setActiveTab("sam-awards")}
        >
          SAM.gov Award Notices ({profile.samAwards.length})
        </button>
      </div>

      {/* USASpending Contracts */}
      {activeTab === "contracts" && (
        <Card className="overflow-hidden p-0">
          {profile.contracts.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-secondary">
              No USASpending contracts found for this company.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-background-secondary/30">
                    <th className="px-4 py-3 font-medium text-text-secondary">Award ID</th>
                    <th className="px-4 py-3 font-medium text-text-secondary">Agency</th>
                    <th className="px-4 py-3 font-medium text-text-secondary">NAICS</th>
                    <th className="px-4 py-3 font-medium text-text-secondary">Type</th>
                    <th className="px-4 py-3 text-right font-medium text-text-secondary">Amount</th>
                    <th className="px-4 py-3 font-medium text-text-secondary">Period</th>
                    <th className="px-4 py-3 font-medium text-text-secondary">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.contracts.map((contract) => (
                    <tr
                      key={contract.id}
                      className="border-b border-border last:border-0 hover:bg-background-secondary/20"
                    >
                      <td className="text-text-dark px-4 py-2.5 font-mono text-xs">
                        {contract.awardId}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-2.5 text-text-secondary">
                        {contract.awardingAgency}
                      </td>
                      <td className="px-4 py-2.5">
                        {contract.naicsCode && (
                          <Badge variant="outline" className="text-xs">
                            {contract.naicsCode}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-text-secondary">
                        {contract.awardType || "-"}
                      </td>
                      <td className="text-text-dark px-4 py-2.5 text-right font-semibold">
                        {formatCurrencyCompact(contract.awardAmount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-secondary">
                        {contract.startDate
                          ? new Date(contract.startDate).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })
                          : ""}
                        {contract.startDate && contract.endDate ? " - " : ""}
                        {contract.endDate
                          ? new Date(contract.endDate).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })
                          : ""}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-2.5 text-xs text-text-secondary">
                        {contract.description || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* SAM.gov Award Notices */}
      {activeTab === "sam-awards" && (
        <Card className="overflow-hidden p-0">
          {profile.samAwards.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-secondary">
              No SAM.gov award notices found for this company.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-background-secondary/30">
                    <th className="px-4 py-3 font-medium text-text-secondary">Title</th>
                    <th className="px-4 py-3 font-medium text-text-secondary">Agency</th>
                    <th className="px-4 py-3 font-medium text-text-secondary">Type</th>
                    <th className="px-4 py-3 text-right font-medium text-text-secondary">Value</th>
                    <th className="px-4 py-3 font-medium text-text-secondary">Award Date</th>
                    <th className="px-4 py-3 font-medium text-text-secondary">Award #</th>
                    <th className="w-10 px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {profile.samAwards.map((opp) => (
                    <tr
                      key={opp.id}
                      className="border-b border-border last:border-0 hover:bg-background-secondary/20"
                    >
                      <td className="text-text-dark max-w-[250px] truncate px-4 py-2.5 font-medium">
                        {opp.title}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-2.5 text-text-secondary">
                        {opp.agency}
                      </td>
                      <td className="px-4 py-2.5">
                        {opp.type && (
                          <Badge variant="outline" className="text-xs">
                            {SAM_GOV_OPPORTUNITY_TYPES[opp.type] || opp.type}
                          </Badge>
                        )}
                      </td>
                      <td className="text-text-dark px-4 py-2.5 text-right font-semibold">
                        {opp.estimatedValue
                          ? formatCurrencyCompact(opp.estimatedValue)
                          : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-text-secondary">
                        {opp.awardDate
                          ? new Date(opp.awardDate).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-text-secondary">
                        {opp.awardNumber || "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        {opp.samGovUrl && (
                          <a
                            href={opp.samGovUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="ghost" size="icon" className="size-7">
                              <ExternalLink className="size-3.5" />
                            </Button>
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
