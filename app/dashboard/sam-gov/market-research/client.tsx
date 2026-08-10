"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  RefreshCw,
  TrendingUp,
  Building2,
  DollarSign,
  FileText,
  BarChart3,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { syncUsaSpending } from "@/lib/actions";
import { SyncModal } from "@/components/modals/sync-modal";
import {
  SOFTWARE_NAICS_CODES,
  FISCAL_YEARS_TO_FETCH,
  formatCurrencyCompact,
} from "@/constants/gov-market-research";
import type { GovSpendingRecord, GovAwardedContract } from "@prisma/client";
import type { EChartsOption } from "echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface SpendingByAgency {
  agencyName: string;
  totalSpent: number;
  totalContracts: number;
}

interface SpendingByYear {
  fiscalYear: number;
  totalSpent: number;
  totalContracts: number;
}

interface SpendingByNaics {
  naicsCode: string;
  naicsDescription: string;
  totalSpent: number;
  totalContracts: number;
}

interface MarketResearchSummary {
  spendingByAgency: SpendingByAgency[];
  spendingByYear: SpendingByYear[];
  spendingByNaics: SpendingByNaics[];
  totalAwardedContracts: number;
  medianContractSize: number;
  lastSamSync: Date | null;
  lastUsaSpendingSync: Date | null;
}

interface MarketResearchClientProps {
  summary: MarketResearchSummary | null;
  records: GovSpendingRecord[];
  awardedContracts: GovAwardedContract[];
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

export function MarketResearchClient({ summary, records, awardedContracts }: MarketResearchClientProps) {
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [selectedFy, setSelectedFy] = useState<string>("all");
  const [selectedNaics, setSelectedNaics] = useState<string>("all");
  const [selectedContract, setSelectedContract] = useState<GovAwardedContract | null>(null);

  const handleSync = async (fullSync: boolean) => {
    await syncUsaSpending(fullSync);
    window.location.reload();
  };

  const filteredRecords = records.filter((r) => {
    if (selectedFy !== "all" && r.fiscalYear !== parseInt(selectedFy)) return false;
    if (selectedNaics !== "all" && r.naicsCode !== selectedNaics) return false;
    return true;
  });

  const filteredByAgency = filteredRecords.reduce<Record<string, { totalSpent: number; totalContracts: number }>>((acc, r) => {
    if (!acc[r.agencyName]) acc[r.agencyName] = { totalSpent: 0, totalContracts: 0 };
    acc[r.agencyName].totalSpent += r.totalObligated;
    acc[r.agencyName].totalContracts += r.contractCount;
    return acc;
  }, {});

  const agencyChartData = Object.entries(filteredByAgency)
    .sort(([, a], [, b]) => b.totalSpent - a.totalSpent)
    .slice(0, 15);

  const hasData = summary && (summary.spendingByAgency.length > 0 || summary.spendingByYear.length > 0);

  const totalSpending = summary?.spendingByAgency.reduce((sum, a) => sum + a.totalSpent, 0) || 0;
  const totalContracts = summary?.totalAwardedContracts || 0;

  const yearTrendOption: EChartsOption = useMemo(() => ({
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const p = (params as Array<{ name: string; value: number }>)[0];
        return `${p.name}<br/>Total Obligated: <b>$${p.value.toLocaleString()}</b>`;
      },
    },
    grid: { left: 80, right: 30, top: 20, bottom: 40 },
    xAxis: {
      type: "category",
      data: (summary?.spendingByYear || []).map((y) => `FY${y.fiscalYear}`),
      axisLabel: { fontSize: 12 },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        fontSize: 11,
        formatter: (v: number) => formatCurrencyCompact(v),
      },
      splitLine: { lineStyle: { type: "dashed", opacity: 0.3 } },
    },
    series: [
      {
        type: "line",
        data: (summary?.spendingByYear || []).map((y) => y.totalSpent),
        smooth: true,
        lineStyle: { width: 3 },
        areaStyle: { opacity: 0.15 },
        itemStyle: { borderWidth: 2 },
        symbolSize: 8,
      },
    ],
  }), [summary]);

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
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0, 0, 0, 0.2)" },
        },
        data: (summary?.spendingByNaics || []).map((n, i) => ({
          name: n.naicsDescription || n.naicsCode,
          value: n.totalSpent,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
        })),
      },
    ],
  }), [summary]);

  const agencyBarOption: EChartsOption = useMemo(() => {
    const sorted = [...agencyChartData].reverse();
    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const p = (params as Array<{ name: string; value: number }>)[0];
          return `${p.name}<br/>Obligated: <b>$${p.value.toLocaleString()}</b>`;
        },
      },
      grid: { left: 220, right: 40, top: 10, bottom: 30 },
      xAxis: {
        type: "value",
        axisLabel: {
          fontSize: 11,
          formatter: (v: number) => formatCurrencyCompact(v),
        },
        splitLine: { lineStyle: { type: "dashed", opacity: 0.3 } },
      },
      yAxis: {
        type: "category",
        data: sorted.map(([name]) =>
          name.length > 32 ? name.slice(0, 30) + "..." : name
        ),
        axisLabel: { fontSize: 10 },
      },
      series: [
        {
          type: "bar",
          data: sorted.map(([, d]) => d.totalSpent),
          barMaxWidth: 24,
          itemStyle: { borderRadius: [0, 4, 4, 0] },
          emphasis: { itemStyle: { shadowBlur: 6, shadowColor: "rgba(0,0,0,0.15)" } },
        },
      ],
    };
  }, [agencyChartData]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/sam-gov">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="text-primary size-6" />
              <h1 className="text-text-dark text-2xl font-bold">Market Research</h1>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              Federal spending analytics for software development &amp; SaaS
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedFy} onValueChange={setSelectedFy}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Fiscal Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {FISCAL_YEARS_TO_FETCH.map((fy) => (
                <SelectItem key={fy} value={fy.toString()}>
                  FY{fy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedNaics} onValueChange={setSelectedNaics}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="NAICS Code" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All NAICS Codes</SelectItem>
              {Object.entries(SOFTWARE_NAICS_CODES).map(([code, desc]) => (
                <SelectItem key={code} value={code}>
                  {code} - {desc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setSyncModalOpen(true)} variant="outline">
            <RefreshCw className="mr-2 size-4" />
            Sync Data
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2">
              <DollarSign className="text-primary size-5" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Total Spending</p>
              <p className="text-text-dark text-xl font-bold">
                {formatCurrencyCompact(totalSpending)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-accent/10 p-2">
              <FileText className="size-5 text-accent" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Total Contracts</p>
              <p className="text-text-dark text-xl font-bold">
                {totalContracts.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success-100 p-2">
              <Building2 className="size-5 text-success-700" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Agencies</p>
              <p className="text-text-dark text-xl font-bold">
                {summary?.spendingByAgency.length || 0}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning-100 p-2">
              <TrendingUp className="size-5 text-warning-700" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Avg Contract Size</p>
              <p className="text-text-dark text-xl font-bold">
                {totalContracts > 0
                  ? formatCurrencyCompact(totalSpending / totalContracts)
                  : "$0"}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2">
              <Activity className="text-primary size-5" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Median Contract Size</p>
              <p className="text-text-dark text-xl font-bold">
                {formatCurrencyCompact(summary?.medianContractSize || 0)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sync status */}
      {summary && (
        <div className="flex items-center gap-4 text-xs text-text-secondary">
          <span>
            USASpending last synced:{" "}
            {summary.lastUsaSpendingSync
              ? new Date(summary.lastUsaSpendingSync).toLocaleString()
              : "Never"}
          </span>
          <span>
            SAM.gov last synced:{" "}
            {summary.lastSamSync
              ? new Date(summary.lastSamSync).toLocaleString()
              : "Never"}
          </span>
        </div>
      )}

      {!hasData ? (
        <Card className="p-12 text-center">
          <BarChart3 className="mx-auto size-12 text-text-secondary" />
          <h3 className="text-text-dark mt-4 text-lg font-semibold">No Data Yet</h3>
          <p className="mt-2 text-sm text-text-secondary">
            Click &quot;Sync Data&quot; to fetch spending data from USASpending.gov.
            This will pull federal contract spending data for software development and SaaS NAICS codes.
          </p>
          <Button onClick={() => setSyncModalOpen(true)} className="mt-4">
            <RefreshCw className="mr-2 size-4" />
            Sync USASpending Data
          </Button>
        </Card>
      ) : (
        <>
          {/* Spending by Year Trend */}
          <Card className="p-6">
            <h2 className="text-text-dark mb-4 text-lg font-semibold">
              Spending Trend by Fiscal Year
            </h2>
            <ReactECharts option={yearTrendOption} style={{ height: 320 }} />
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Spending by NAICS */}
            <Card className="p-6">
              <h2 className="text-text-dark mb-4 text-lg font-semibold">
                Spending by NAICS Category
              </h2>
              {(summary?.spendingByNaics?.length ?? 0) > 0 ? (
                <ReactECharts option={naicsPieOption} style={{ height: 288 }} />
              ) : (
                <p className="py-8 text-center text-sm text-text-secondary">No data available</p>
              )}
            </Card>

            {/* Top Agencies Quick View */}
            <Card className="p-6">
              <h2 className="text-text-dark mb-4 text-lg font-semibold">
                Top Agencies by Spending
              </h2>
              <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: "280px" }}>
                {(summary?.spendingByAgency || []).slice(0, 10).map((agency, i) => (
                  <div key={agency.agencyName} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 text-sm font-medium text-text-secondary">
                        {i + 1}.
                      </span>
                      <span className="text-text-dark truncate text-sm">{agency.agencyName}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge variant="secondary" className="text-xs">
                        {agency.totalContracts.toLocaleString()} contracts
                      </Badge>
                      <span className="text-text-dark text-sm font-semibold">
                        {formatCurrencyCompact(agency.totalSpent)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Spending by Agency Bar Chart */}
          <Card className="p-6">
            <h2 className="text-text-dark mb-4 text-lg font-semibold">
              Top Agencies - Obligated Spending
              {selectedFy !== "all" && ` (FY${selectedFy})`}
              {selectedNaics !== "all" && ` - NAICS ${selectedNaics}`}
            </h2>
            <ReactECharts option={agencyBarOption} style={{ height: 420 }} />
          </Card>

          {/* Individual Awarded Contracts */}
          {awardedContracts.length > 0 && (
            <Card className="p-6">
              <h2 className="text-text-dark mb-4 text-lg font-semibold">
                Individual Awarded Contracts
              </h2>
              <p className="mb-4 text-sm text-text-secondary">
                Top contracts by award amount from USASpending.gov
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 pr-4 font-medium text-text-secondary">Recipient</th>
                      <th className="pb-3 pr-4 font-medium text-text-secondary">Awarding Agency</th>
                      <th className="pb-3 pr-4 font-medium text-text-secondary">NAICS</th>
                      <th className="pb-3 pr-4 font-medium text-text-secondary">Type</th>
                      <th className="pb-3 pr-4 text-right font-medium text-text-secondary">Award Amount</th>
                      <th className="pb-3 pr-4 font-medium text-text-secondary">Period</th>
                      <th className="pb-3 font-medium text-text-secondary">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {awardedContracts.slice(0, 50).map((contract) => (
                      <tr
                        key={contract.id}
                        className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-background-secondary/50"
                        onClick={() => setSelectedContract(contract)}
                      >
                        <td className="text-text-dark max-w-[180px] truncate py-2.5 pr-4 font-medium">
                          {contract.recipientName}
                        </td>
                        <td className="max-w-[160px] truncate py-2.5 pr-4 text-text-secondary">
                          {contract.awardingAgency}
                        </td>
                        <td className="py-2.5 pr-4">
                          {contract.naicsCode && (
                            <Badge variant="outline" className="text-xs">
                              {contract.naicsCode}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-text-secondary">
                          {contract.awardType || "-"}
                        </td>
                        <td className="text-text-dark py-2.5 pr-4 text-right font-medium">
                          {formatCurrencyCompact(contract.awardAmount)}
                        </td>
                        <td className="whitespace-nowrap py-2.5 pr-4 text-xs text-text-secondary">
                          {contract.startDate
                            ? new Date(contract.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                            : ""}
                          {contract.startDate && contract.endDate ? " - " : ""}
                          {contract.endDate
                            ? new Date(contract.endDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                            : ""}
                        </td>
                        <td className="max-w-[200px] truncate py-2.5 text-xs text-text-secondary">
                          {contract.description || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {awardedContracts.length > 50 && (
                  <p className="pt-3 text-center text-xs text-text-secondary">
                    Showing top 50 of {awardedContracts.length} awarded contracts
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Detailed Table */}
          <Card className="p-6">
            <h2 className="text-text-dark mb-4 text-lg font-semibold">
              Detailed Spending Records
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-3 pr-4 font-medium text-text-secondary">Agency</th>
                    <th className="pb-3 pr-4 font-medium text-text-secondary">NAICS</th>
                    <th className="pb-3 pr-4 font-medium text-text-secondary">FY</th>
                    <th className="pb-3 pr-4 text-right font-medium text-text-secondary">Obligated</th>
                    <th className="pb-3 pr-4 text-right font-medium text-text-secondary">Contracts</th>
                    <th className="pb-3 text-right font-medium text-text-secondary">Avg Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.slice(0, 50).map((record) => (
                    <tr key={record.id} className="border-b border-border last:border-0">
                      <td className="text-text-dark max-w-[200px] truncate py-2.5 pr-4">
                        {record.agencyName}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="outline" className="text-xs">
                          {record.naicsCode}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-text-secondary">FY{record.fiscalYear}</td>
                      <td className="text-text-dark py-2.5 pr-4 text-right font-medium">
                        {formatCurrencyCompact(record.totalObligated)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-text-secondary">
                        {record.contractCount.toLocaleString()}
                      </td>
                      <td className="py-2.5 text-right text-text-secondary">
                        {record.avgContractValue
                          ? formatCurrencyCompact(record.avgContractValue)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRecords.length === 0 && (
                <p className="py-8 text-center text-sm text-text-secondary">
                  No records match current filters
                </p>
              )}
              {filteredRecords.length > 50 && (
                <p className="pt-3 text-center text-xs text-text-secondary">
                  Showing first 50 of {filteredRecords.length} records
                </p>
              )}
            </div>
          </Card>
        </>
      )}

      {/* Awarded Contract Detail Modal */}
      <Dialog open={!!selectedContract} onOpenChange={() => setSelectedContract(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Awarded Contract Details</DialogTitle>
          </DialogHeader>
          {selectedContract && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs text-text-secondary">Recipient</p>
                <p className="text-text-dark text-sm font-medium">{selectedContract.recipientName}</p>
                {selectedContract.recipientUei && (
                  <p className="text-xs text-text-secondary">UEI: {selectedContract.recipientUei}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text-secondary">Award Amount</p>
                  <p className="text-text-dark text-sm font-semibold">
                    {formatCurrencyCompact(selectedContract.awardAmount)}
                  </p>
                </div>
                {selectedContract.totalObligated != null && (
                  <div>
                    <p className="text-xs text-text-secondary">Total Obligated</p>
                    <p className="text-text-dark text-sm font-semibold">
                      {formatCurrencyCompact(selectedContract.totalObligated)}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-text-secondary">Awarding Agency</p>
                  <p className="text-text-dark text-sm">{selectedContract.awardingAgency}</p>
                  {selectedContract.awardingSubAgency && (
                    <p className="text-xs text-text-secondary">{selectedContract.awardingSubAgency}</p>
                  )}
                </div>
                {selectedContract.fundingAgency && (
                  <div>
                    <p className="text-xs text-text-secondary">Funding Agency</p>
                    <p className="text-text-dark text-sm">{selectedContract.fundingAgency}</p>
                    {selectedContract.fundingSubAgency && (
                      <p className="text-xs text-text-secondary">{selectedContract.fundingSubAgency}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedContract.naicsCode && (
                  <div>
                    <p className="text-xs text-text-secondary">NAICS Code</p>
                    <p className="text-text-dark text-sm">
                      {selectedContract.naicsCode}
                      {selectedContract.naicsDescription && ` - ${selectedContract.naicsDescription}`}
                    </p>
                  </div>
                )}
                {selectedContract.pscCode && (
                  <div>
                    <p className="text-xs text-text-secondary">PSC Code</p>
                    <p className="text-text-dark text-sm">{selectedContract.pscCode}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedContract.awardType && (
                  <div>
                    <p className="text-xs text-text-secondary">Award Type</p>
                    <p className="text-text-dark text-sm">{selectedContract.awardType}</p>
                  </div>
                )}
                {selectedContract.setAsideType && (
                  <div>
                    <p className="text-xs text-text-secondary">Set-Aside Type</p>
                    <p className="text-text-dark text-sm">{selectedContract.setAsideType}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {selectedContract.startDate && (
                  <div>
                    <p className="text-xs text-text-secondary">Start Date</p>
                    <p className="text-text-dark text-sm">
                      {new Date(selectedContract.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                )}
                {selectedContract.endDate && (
                  <div>
                    <p className="text-xs text-text-secondary">End Date</p>
                    <p className="text-text-dark text-sm">
                      {new Date(selectedContract.endDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                )}
              </div>

              {selectedContract.placeOfPerformance && (
                <div>
                  <p className="text-xs text-text-secondary">Place of Performance</p>
                  <p className="text-text-dark text-sm">{selectedContract.placeOfPerformance}</p>
                </div>
              )}

              {selectedContract.description && (
                <div>
                  <p className="text-xs text-text-secondary">Description</p>
                  <p className="text-text-dark whitespace-pre-wrap text-sm">{selectedContract.description}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-text-secondary">Award ID</p>
                <p className="text-text-dark font-mono text-sm">{selectedContract.awardId}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SyncModal
        open={syncModalOpen}
        onOpenChange={setSyncModalOpen}
        title="Sync USASpending Data"
        description="Choose how to sync federal spending data from USASpending.gov for software development NAICS codes."
        onSync={handleSync}
      />
    </div>
  );
}
