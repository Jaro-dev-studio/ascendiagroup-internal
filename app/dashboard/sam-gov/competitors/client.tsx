"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Search,
  Trophy,
  Building2,
  DollarSign,
  TrendingUp,
  ArrowUpDown,
  ChevronRight,
  Users,
  Download,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SOFTWARE_NAICS_CODES,
  formatCurrencyCompact,
} from "@/constants/gov-market-research";

interface CompetitorRanking {
  recipientName: string;
  recipientNameNormalized: string | null;
  totalWins: number;
  totalAwardValue: number;
  avgAwardValue: number;
  minAwardValue: number;
  maxAwardValue: number;
  topAgency: string;
  topSetAside: string | null;
  firstWinDate: Date | null;
  lastWinDate: Date | null;
}

interface SamAwardee {
  awardeeName: string;
  awardeeNameNormalized: string | null;
  wins: number;
  totalValue: number;
}

interface SetAsideType {
  setAsideType: string;
  count: number;
}

interface CompetitorsClientProps {
  rankings: CompetitorRanking[];
  samAwardees: SamAwardee[];
  setAsideTypes: SetAsideType[];
  activeNaics: string;
  activeSetAside: string;
}

type SortField = "totalAwardValue" | "totalWins" | "avgAwardValue" | "recipientName";
type SortDir = "asc" | "desc";

function exportToCsv(data: CompetitorRanking[], filename: string) {
  const headers = [
    "Rank",
    "Company",
    "Wins",
    "Total Value",
    "Avg Value",
    "Min Value",
    "Max Value",
    "Top Agency",
    "Set-Aside",
    "First Win",
    "Last Win",
  ];
  const rows = data.map((r, i) => [
    i + 1,
    `"${r.recipientName.replace(/"/g, "\"\"")}"`,
    r.totalWins,
    r.totalAwardValue.toFixed(2),
    r.avgAwardValue.toFixed(2),
    r.minAwardValue.toFixed(2),
    r.maxAwardValue.toFixed(2),
    `"${(r.topAgency || "").replace(/"/g, "\"\"")}"`,
    `"${(r.topSetAside || "").replace(/"/g, "\"\"")}"`,
    r.firstWinDate ? new Date(r.firstWinDate).toLocaleDateString() : "",
    r.lastWinDate ? new Date(r.lastWinDate).toLocaleDateString() : "",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CompetitorsClient({
  rankings,
  samAwardees,
  setAsideTypes,
  activeNaics,
  activeSetAside,
}: CompetitorsClientProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("totalAwardValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const updateFilters = useCallback(
    (naics: string, setAside: string) => {
      const params = new URLSearchParams();
      if (naics !== "all") params.set("naics", naics);
      if (setAside !== "all") params.set("setAside", setAside);
      const qs = params.toString();
      router.push(`/dashboard/sam-gov/competitors${qs ? `?${qs}` : ""}`);
    },
    [router]
  );

  const samAwardeeMap = useMemo(() => {
    const byNormalized = new Map<string, SamAwardee>();
    const byExact = new Map<string, SamAwardee>();
    for (const a of samAwardees) {
      byExact.set(a.awardeeName.toLowerCase(), a);
      if (a.awardeeNameNormalized) {
        byNormalized.set(a.awardeeNameNormalized, a);
      }
    }
    return { byExact, byNormalized };
  }, [samAwardees]);

  const findSamMatch = useCallback(
    (competitor: CompetitorRanking): SamAwardee | undefined => {
      const exact = samAwardeeMap.byExact.get(
        competitor.recipientName.toLowerCase()
      );
      if (exact) return exact;
      if (competitor.recipientNameNormalized) {
        return samAwardeeMap.byNormalized.get(
          competitor.recipientNameNormalized
        );
      }
      return undefined;
    },
    [samAwardeeMap]
  );

  const filtered = useMemo(() => {
    let results = [...rankings];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (r) =>
          r.recipientName.toLowerCase().includes(q) ||
          r.topAgency?.toLowerCase().includes(q) ||
          r.topSetAside?.toLowerCase().includes(q)
      );
    }

    results.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDir === "asc" ? numA - numB : numB - numA;
    });

    return results;
  }, [rankings, searchQuery, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const totalCompanies = filtered.length;
  const totalAwardVolume = filtered.reduce((s, r) => s + r.totalAwardValue, 0);
  const totalWins = filtered.reduce((s, r) => s + r.totalWins, 0);

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
              <Trophy className="text-primary size-6" />
              <h1 className="text-text-dark text-2xl font-bold">Competitor Analysis</h1>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              Companies winning federal software development contracts
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() =>
            exportToCsv(filtered, `competitors-${new Date().toISOString().split("T")[0]}.csv`)
          }
          disabled={filtered.length === 0}
        >
          <Download className="mr-2 size-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-lg p-2">
              <Users className="text-primary size-5" />
            </div>
            <div>
              <p className="text-sm text-text-secondary">Companies</p>
              <p className="text-text-dark text-xl font-bold">
                {totalCompanies.toLocaleString()}
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
              <p className="text-sm text-text-secondary">Total Award Volume</p>
              <p className="text-text-dark text-xl font-bold">
                {formatCurrencyCompact(totalAwardVolume)}
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
              <p className="text-sm text-text-secondary">Total Contracts</p>
              <p className="text-text-dark text-xl font-bold">
                {totalWins.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
          <Input
            placeholder="Search companies, agencies, or set-asides..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={activeNaics}
          onValueChange={(v) => updateFilters(v, activeSetAside)}
        >
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
        <Select
          value={activeSetAside}
          onValueChange={(v) => updateFilters(activeNaics, v)}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Set-Aside Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Set-Aside Types</SelectItem>
            {setAsideTypes.map((sa) => (
              <SelectItem key={sa.setAsideType} value={sa.setAsideType}>
                {sa.setAsideType} ({sa.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Rankings Table */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="mx-auto size-12 text-text-secondary" />
          <h3 className="text-text-dark mt-4 text-lg font-semibold">No Competitors Found</h3>
          <p className="mt-2 text-sm text-text-secondary">
            {rankings.length === 0
              ? "Sync USASpending data first to populate competitor data from awarded contracts."
              : "No companies match your filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background-secondary/30">
                  <th className="w-10 px-4 py-3 font-medium text-text-secondary">#</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">
                    <button
                      className="hover:text-text-dark flex items-center gap-1"
                      onClick={() => toggleSort("recipientName")}
                    >
                      Company
                      <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-text-secondary">
                    <button
                      className="hover:text-text-dark flex items-center gap-1"
                      onClick={() => toggleSort("totalWins")}
                    >
                      Wins
                      <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">
                    <button
                      className="hover:text-text-dark ml-auto flex items-center gap-1"
                      onClick={() => toggleSort("totalAwardValue")}
                    >
                      Total Value
                      <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">
                    <button
                      className="hover:text-text-dark ml-auto flex items-center gap-1"
                      onClick={() => toggleSort("avgAwardValue")}
                    >
                      Avg Value
                      <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Range</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Top Agency</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Set-Aside</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">SAM.gov</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Active Since</th>
                  <th className="w-10 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((competitor, i) => {
                  const samData = findSamMatch(competitor);
                  return (
                    <tr
                      key={competitor.recipientName}
                      className="border-b border-border transition-colors last:border-0 hover:bg-background-secondary/20"
                    >
                      <td className="px-4 py-3 font-medium text-text-secondary">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/sam-gov/competitors/${encodeURIComponent(competitor.recipientName)}`}
                          className="text-text-dark hover:text-primary font-medium hover:underline"
                        >
                          {competitor.recipientName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{competitor.totalWins}</Badge>
                      </td>
                      <td className="text-text-dark px-4 py-3 text-right font-semibold">
                        {formatCurrencyCompact(competitor.totalAwardValue)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {formatCurrencyCompact(competitor.avgAwardValue)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-text-secondary">
                        {formatCurrencyCompact(competitor.minAwardValue)} -{" "}
                        {formatCurrencyCompact(competitor.maxAwardValue)}
                      </td>
                      <td className="max-w-[180px] px-4 py-3">
                        <span className="flex items-center gap-1 truncate text-xs text-text-secondary">
                          <Building2 className="size-3 shrink-0" />
                          {competitor.topAgency || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {competitor.topSetAside ? (
                          <Badge variant="outline" className="text-xs">
                            <Shield className="mr-1 size-3" />
                            {competitor.topSetAside.length > 20
                              ? competitor.topSetAside.slice(0, 18) + "..."
                              : competitor.topSetAside}
                          </Badge>
                        ) : (
                          <span className="text-xs text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {samData ? (
                          <Badge variant="outline" className="text-xs">
                            {samData.wins} ({formatCurrencyCompact(samData.totalValue)})
                          </Badge>
                        ) : (
                          <span className="text-xs text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-text-secondary">
                        {competitor.firstWinDate
                          ? new Date(competitor.firstWinDate).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/sam-gov/competitors/${encodeURIComponent(competitor.recipientName)}`}
                        >
                          <Button variant="ghost" size="icon" className="size-7">
                            <ChevronRight className="size-4" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="border-t border-border px-4 py-2 text-xs text-text-secondary">
              Showing {filtered.length} of {rankings.length} companies
              {activeNaics !== "all" && ` (NAICS ${activeNaics})`}
              {activeSetAside !== "all" && ` (${activeSetAside})`}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
