"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  RefreshCw,
  ExternalLink,
  Import,
  X,
  Loader2,
  FileText,
  CheckCircle,
  AlertCircle,
  User,
  Mail,
  Phone,
  Award,
  Briefcase,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Brain,
  ChevronDown,
  ChevronRight,
  RotateCw,
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  syncSamOpportunities,
  importOpportunityToContract,
  dismissOpportunity,
  reanalyzeOpportunity,
} from "@/lib/actions";
import { SyncModal } from "@/components/modals/sync-modal";
import {
  SOFTWARE_NAICS_CODES,
  SAM_GOV_OPPORTUNITY_TYPES,
  formatCurrencyCompact,
} from "@/constants/gov-market-research";
import type { GovOpportunity, GovOpportunityAnalysis } from "@prisma/client";

type OpportunityWithAnalysis = GovOpportunity & {
  analysis: GovOpportunityAnalysis | null;
};

const SCORE_TIERS = [
  { min: 85, label: "Pursue", color: "bg-success-100 text-success-700" },
  { min: 70, label: "Strong", color: "bg-primary/10 text-primary" },
  { min: 55, label: "Consider", color: "bg-warning-100 text-warning-700" },
  { min: 40, label: "Opportunistic", color: "bg-orange-100 text-orange-700" },
  { min: 0, label: "Skip", color: "bg-destructive/10 text-destructive" },
] as const;

function getScoreTier(score: number) {
  return SCORE_TIERS.find((t) => score >= t.min) || SCORE_TIERS[SCORE_TIERS.length - 1];
}

const CRITERIA_LABELS: Record<string, { label: string; weight: number }> = {
  strategicFit: { label: "Strategic Fit", weight: 40 },
  revenuePotential: { label: "Revenue Potential", weight: 20 },
  winProbability: { label: "Probability of Winning", weight: 20 },
  competitiveAdvantage: { label: "Competitive Advantage", weight: 10 },
  relationshipAccess: { label: "Relationship Access", weight: 10 },
};

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const HTML_ENTITIES: Record<string, string> = {
  "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
  "&quot;": "\"", "&apos;": "'", "&#39;": "'",
  "&rsquo;": "\u2019", "&lsquo;": "\u2018",
  "&rdquo;": "\u201D", "&ldquo;": "\u201C",
  "&ndash;": "\u2013", "&mdash;": "\u2014",
  "&hellip;": "\u2026", "&bull;": "\u2022",
  "&copy;": "\u00A9", "&reg;": "\u00AE", "&trade;": "\u2122",
};

function cleanDescription(raw: string): string {
  let text = raw.replace(/<[^>]*>/g, " ");
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    text = text.replaceAll(entity, char);
  }
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

type SortField = "title" | "agency" | "type" | "naicsCode" | "estimatedValue" | "postedDate" | "responseDeadline" | "aiScore";
type SortDir = "asc" | "desc";

interface OpportunitiesClientProps {
  opportunities: OpportunityWithAnalysis[];
}

export function OpportunitiesClient({
  opportunities: initialOpportunities,
}: OpportunitiesClientProps) {
  const [opportunities, setOpportunities] = useState(initialOpportunities);
  const [searchQuery, setSearchQuery] = useState("");
  const [naicsFilter, setNaicsFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("postedDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const solicitationMap = useMemo(() => {
    const map = new Map<string, OpportunityWithAnalysis>();
    for (const opp of opportunities) {
      if (opp.solicitationNumber) {
        const existing = map.get(opp.solicitationNumber);
        if (!existing || opp.type !== "Award Notice") {
          map.set(opp.solicitationNumber, opp);
        }
      }
    }
    return map;
  }, [opportunities]);

  const [importingId, setImportingId] = useState<string | null>(null);
  const [reanalyzingId, setReanalyzingId] = useState<string | null>(null);
  const [detailOpp, setDetailOpp] = useState<OpportunityWithAnalysis | null>(null);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);

  const filteredOpportunities = useMemo(() => {
    const results = opportunities.filter((opp) => {
      if (naicsFilter !== "all" && opp.naicsCode !== naicsFilter) return false;
      if (statusFilter === "active" && !opp.isActive) return false;
      if (statusFilter === "imported" && !opp.isImported) return false;
      if (statusFilter === "expired" && opp.isActive) return false;
      if (typeFilter !== "all" && opp.type !== typeFilter) return false;

      if (scoreFilter !== "all") {
        const score = opp.analysis?.overallScore;
        if (scoreFilter === "pending" && score !== undefined && score !== null) return false;
        if (scoreFilter === "pursue" && (score === undefined || score === null || score < 85)) return false;
        if (scoreFilter === "strong" && (score === undefined || score === null || score < 70 || score >= 85)) return false;
        if (scoreFilter === "consider" && (score === undefined || score === null || score < 55 || score >= 70)) return false;
        if (scoreFilter === "opportunistic" && (score === undefined || score === null || score < 40 || score >= 55)) return false;
        if (scoreFilter === "skip" && (score === undefined || score === null || score >= 40)) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          opp.title.toLowerCase().includes(q) ||
          opp.agency.toLowerCase().includes(q) ||
          opp.solicitationNumber?.toLowerCase().includes(q) ||
          opp.description?.toLowerCase().includes(q)
        );
      }

      return true;
    });

    results.sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortField) {
        case "title":
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case "agency":
          aVal = a.agency.toLowerCase();
          bVal = b.agency.toLowerCase();
          break;
        case "type":
          aVal = (a.type || "").toLowerCase();
          bVal = (b.type || "").toLowerCase();
          break;
        case "naicsCode":
          aVal = a.naicsCode || "";
          bVal = b.naicsCode || "";
          break;
        case "estimatedValue":
          aVal = a.estimatedValue ?? -1;
          bVal = b.estimatedValue ?? -1;
          break;
        case "postedDate":
          aVal = a.postedDate ? new Date(a.postedDate).getTime() : 0;
          bVal = b.postedDate ? new Date(b.postedDate).getTime() : 0;
          break;
        case "responseDeadline":
          aVal = a.responseDeadline ? new Date(a.responseDeadline).getTime() : 0;
          bVal = b.responseDeadline ? new Date(b.responseDeadline).getTime() : 0;
          break;
        case "aiScore":
          aVal = a.analysis?.overallScore ?? -1;
          bVal = b.analysis?.overallScore ?? -1;
          break;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return sortDir === "asc" ? numA - numB : numB - numA;
    });

    return results;
  }, [opportunities, searchQuery, naicsFilter, statusFilter, typeFilter, scoreFilter, sortField, sortDir]);

  const toggleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("desc");
      return field;
    });
  }, []);

  const handleSync = async (fullSync: boolean) => {
    await syncSamOpportunities(fullSync);
    window.location.reload();
  };

  const handleImport = async (oppId: string) => {
    setImportingId(oppId);
    try {
      const result = await importOpportunityToContract(oppId);
      if (result.data) {
        setOpportunities((prev) =>
          prev.map((o) =>
            o.id === oppId
              ? { ...o, isImported: true, importedContractId: result.data!.id }
              : o
          )
        );
      }
    } finally {
      setImportingId(null);
    }
  };

  const handleDismiss = async (oppId: string) => {
    const result = await dismissOpportunity(oppId);
    if (result.data) {
      setOpportunities((prev) => prev.filter((o) => o.id !== oppId));
    }
  };

  const handleReanalyze = async (oppId: string) => {
    setReanalyzingId(oppId);
    try {
      const result = await reanalyzeOpportunity(oppId);
      if (result.data) {
        setOpportunities((prev) =>
          prev.map((o) =>
            o.id === oppId ? { ...o, analysis: result.data } : o
          )
        );
        if (detailOpp?.id === oppId) {
          setDetailOpp((prev) => prev ? { ...prev, analysis: result.data } : prev);
        }
      }
    } finally {
      setReanalyzingId(null);
    }
  };

  const uniqueTypes = [...new Set(opportunities.map((o) => o.type).filter(Boolean))] as string[];
  const activeCount = opportunities.filter((o) => o.isActive && !o.isImported).length;
  const importedCount = opportunities.filter((o) => o.isImported).length;
  const isFiltered = searchQuery.trim() || naicsFilter !== "all" || statusFilter !== "all" || typeFilter !== "all" || scoreFilter !== "all";

  function SortHeader({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) {
    const isActive = sortField === field;
    return (
      <button
        className={`hover:text-text-dark flex items-center gap-1 ${className || ""}`}
        onClick={() => toggleSort(field)}
      >
        {children}
        {isActive ? (
          sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    );
  }

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
              <FileText className="text-primary size-6" />
              <h1 className="text-text-dark text-2xl font-bold">Opportunities</h1>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {activeCount} active | {importedCount} imported to pipeline
            </p>
          </div>
        </div>
        <Button onClick={() => setSyncModalOpen(true)}>
          <RefreshCw className="mr-2 size-4" />
          Sync SAM.gov
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="p-0">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <Filter className="size-4 text-text-secondary" />
          <span className="text-text-dark text-sm font-medium">Filters</span>
          {isFiltered && (
            <Badge variant="secondary" className="text-xs">
              {filteredOpportunities.length} of {opportunities.length}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <Input
              placeholder="Search title, agency, solicitation #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="imported">Imported</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={naicsFilter} onValueChange={setNaicsFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="NAICS Code" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All NAICS</SelectItem>
              {Object.entries(SOFTWARE_NAICS_CODES).map(([code, desc]) => (
                <SelectItem key={code} value={code}>
                  {code} - {desc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {uniqueTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {SAM_GOV_OPPORTUNITY_TYPES[type] || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="AI Score" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scores</SelectItem>
              <SelectItem value="pursue">Pursue (85+)</SelectItem>
              <SelectItem value="strong">Strong (70-84)</SelectItem>
              <SelectItem value="consider">Consider (55-69)</SelectItem>
              <SelectItem value="opportunistic">Opportunistic (40-54)</SelectItem>
              <SelectItem value="skip">Skip (&lt;40)</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setNaicsFilter("all");
                setStatusFilter("all");
                setTypeFilter("all");
                setScoreFilter("all");
              }}
            >
              <X className="mr-1 size-3" />
              Clear
            </Button>
          )}
        </div>
      </Card>

      {/* Table */}
      {filteredOpportunities.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="mx-auto size-12 text-text-secondary" />
          <h3 className="text-text-dark mt-4 text-lg font-semibold">No Opportunities Found</h3>
          <p className="mt-2 text-sm text-text-secondary">
            {opportunities.length === 0
              ? "Click \"Sync SAM.gov\" to fetch opportunities from SAM.gov for software development NAICS codes."
              : "No opportunities match your current filters."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-background-secondary/30">
                  <th className="px-4 py-3 font-medium text-text-secondary">
                    <SortHeader field="title">Title</SortHeader>
                  </th>
                  <th className="px-4 py-3 font-medium text-text-secondary">
                    <SortHeader field="agency">Agency</SortHeader>
                  </th>
                  <th className="px-4 py-3 font-medium text-text-secondary">
                    <SortHeader field="type">Type</SortHeader>
                  </th>
                  <th className="px-4 py-3 font-medium text-text-secondary">
                    <SortHeader field="naicsCode">NAICS</SortHeader>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">
                    <SortHeader field="estimatedValue" className="ml-auto">Value</SortHeader>
                  </th>
                  <th className="px-4 py-3 font-medium text-text-secondary">
                    <SortHeader field="postedDate">Posted</SortHeader>
                  </th>
                  <th className="px-4 py-3 font-medium text-text-secondary">
                    <SortHeader field="responseDeadline">Deadline</SortHeader>
                  </th>
                  <th className="px-4 py-3 font-medium text-text-secondary">Status</th>
                  <th className="px-4 py-3 font-medium text-text-secondary">
                    <SortHeader field="aiScore">AI Score</SortHeader>
                  </th>
                  <th className="w-24 px-4 py-3 font-medium text-text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpportunities.map((opp) => {
                  const deadlinePassed = opp.responseDeadline && new Date(opp.responseDeadline) < new Date();
                  return (
                    <tr
                      key={opp.id}
                      className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-background-secondary/20"
                      onClick={() => setDetailOpp(opp)}
                    >
                      <td className="max-w-[320px] px-4 py-3">
                        <p className="text-text-dark line-clamp-1 font-medium">{opp.title}</p>
                        {opp.solicitationNumber && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">{opp.solicitationNumber}</p>
                        )}
                      </td>
                      <td className="max-w-[180px] px-4 py-3">
                        <p className="line-clamp-1 text-text-secondary">{opp.agency}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {opp.type && (
                          <Badge variant="outline" className="text-xs">
                            {SAM_GOV_OPPORTUNITY_TYPES[opp.type] || opp.type}
                          </Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {opp.naicsCode || "-"}
                      </td>
                      <td className="text-text-dark whitespace-nowrap px-4 py-3 text-right font-medium">
                        {opp.estimatedValue ? formatCurrencyCompact(opp.estimatedValue) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {opp.postedDate ? formatDate(opp.postedDate) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {opp.responseDeadline ? (
                          <span className={deadlinePassed ? "text-destructive" : "text-text-secondary"}>
                            {formatDate(opp.responseDeadline)}
                          </span>
                        ) : (
                          <span className="text-text-secondary">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {opp.isImported ? (
                            <Badge variant="default" className="text-xs">
                              <CheckCircle className="mr-1 size-3" />
                              Imported
                            </Badge>
                          ) : opp.isActive ? (
                            <Badge variant="secondary" className="bg-success-100 text-xs text-success-700">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Expired
                            </Badge>
                          )}
                          {opp.setAsideType && (
                            <Badge variant="outline" className="max-w-[100px] truncate text-xs">
                              {opp.setAsideType}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {opp.analysis ? (
                          <Badge variant="secondary" className={`text-xs ${getScoreTier(opp.analysis.overallScore).color}`}>
                            {opp.analysis.overallScore} - {getScoreTier(opp.analysis.overallScore).label}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs text-text-secondary">
                            Pending
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          {opp.samGovUrl && (
                            <a href={opp.samGovUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="size-7">
                                <ExternalLink className="size-3.5" />
                              </Button>
                            </a>
                          )}
                          {!opp.isImported && opp.isActive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => handleImport(opp.id)}
                              disabled={importingId === opp.id}
                            >
                              {importingId === opp.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Import className="size-3.5" />
                              )}
                            </Button>
                          )}
                          {!opp.isImported && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-text-secondary"
                              onClick={() => handleDismiss(opp.id)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-4 py-2 text-xs text-text-secondary">
            Showing {filteredOpportunities.length}
            {isFiltered && ` of ${opportunities.length}`} opportunities
          </div>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailOpp} onOpenChange={() => setDetailOpp(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          {detailOpp && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{detailOpp.title}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {detailOpp.isActive ? (
                    <Badge variant="default">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Expired</Badge>
                  )}
                  {detailOpp.isImported && (
                    <Badge variant="default">
                      <CheckCircle className="mr-1 size-3" />
                      Imported
                    </Badge>
                  )}
                  {detailOpp.type && (
                    <Badge variant="outline">
                      {SAM_GOV_OPPORTUNITY_TYPES[detailOpp.type] || detailOpp.type}
                    </Badge>
                  )}
                  {detailOpp.setAsideType && (
                    <Badge variant="secondary">{detailOpp.setAsideType}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-secondary">Agency</span>
                    <p className="text-text-dark font-medium">{detailOpp.agency}</p>
                  </div>
                  {detailOpp.subAgency && (
                    <div>
                      <span className="text-text-secondary">Sub-Agency</span>
                      <p className="text-text-dark font-medium">{detailOpp.subAgency}</p>
                    </div>
                  )}
                  {detailOpp.office && (
                    <div>
                      <span className="text-text-secondary">Office</span>
                      <p className="text-text-dark font-medium">{detailOpp.office}</p>
                    </div>
                  )}
                  {detailOpp.solicitationNumber && (
                    <div>
                      <span className="text-text-secondary">Solicitation #</span>
                      <p className="text-text-dark font-medium">{detailOpp.solicitationNumber}</p>
                    </div>
                  )}
                  {detailOpp.naicsCode && (
                    <div>
                      <span className="text-text-secondary">NAICS Code</span>
                      <p className="text-text-dark font-medium">
                        {detailOpp.naicsCode}
                        {SOFTWARE_NAICS_CODES[detailOpp.naicsCode] &&
                          ` - ${SOFTWARE_NAICS_CODES[detailOpp.naicsCode]}`}
                      </p>
                    </div>
                  )}
                  {detailOpp.pscCode && (
                    <div>
                      <span className="text-text-secondary">PSC Code</span>
                      <p className="text-text-dark font-medium">{detailOpp.pscCode}</p>
                    </div>
                  )}
                  {detailOpp.estimatedValue && (
                    <div>
                      <span className="text-text-secondary">Estimated Value</span>
                      <p className="text-text-dark font-medium">
                        ${detailOpp.estimatedValue.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {detailOpp.postedDate && (
                    <div>
                      <span className="text-text-secondary">Posted</span>
                      <p className="text-text-dark font-medium">
                        {formatDate(detailOpp.postedDate)}
                      </p>
                    </div>
                  )}
                  {detailOpp.responseDeadline && (
                    <div>
                      <span className="text-text-secondary">Response Deadline</span>
                      <p className="text-text-dark font-medium">
                        {formatDate(detailOpp.responseDeadline)}
                        {new Date(detailOpp.responseDeadline) < new Date() && (
                          <span className="ml-2 text-destructive">
                            <AlertCircle className="mr-0.5 inline size-3" />
                            Passed
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  {detailOpp.placeOfPerformance && (
                    <div>
                      <span className="text-text-secondary">Place of Performance</span>
                      <p className="text-text-dark font-medium">{detailOpp.placeOfPerformance}</p>
                    </div>
                  )}
                </div>

                {(detailOpp.awardeeName || detailOpp.awardDate || detailOpp.awardNumber) && (
                  <div className="rounded-lg border border-border p-4">
                    <div className="text-text-dark mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Award className="text-primary size-4" />
                      Award Information
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {detailOpp.awardeeName && (
                        <div>
                          <span className="text-text-secondary">Awardee</span>
                          <p className="text-text-dark font-medium">
                            <Link
                              href={`/dashboard/sam-gov/competitors/${encodeURIComponent(detailOpp.awardeeName)}`}
                              className="text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {detailOpp.awardeeName}
                            </Link>
                          </p>
                          {detailOpp.awardeeUei && (
                            <p className="text-xs text-text-secondary">UEI: {detailOpp.awardeeUei}</p>
                          )}
                        </div>
                      )}
                      {detailOpp.awardDate && (
                        <div>
                          <span className="text-text-secondary">Award Date</span>
                          <p className="text-text-dark font-medium">
                            {formatDate(detailOpp.awardDate)}
                          </p>
                        </div>
                      )}
                      {detailOpp.awardNumber && (
                        <div>
                          <span className="text-text-secondary">Award Number</span>
                          <p className="text-text-dark font-medium">{detailOpp.awardNumber}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {detailOpp.type === "Award Notice" &&
                  detailOpp.solicitationNumber &&
                  (() => {
                    const original = solicitationMap.get(detailOpp.solicitationNumber!);
                    if (!original || original.noticeId === detailOpp.noticeId) return null;
                    return (
                      <div className="rounded-lg border border-border bg-background-secondary/20 p-4">
                        <div className="text-text-dark mb-2 flex items-center gap-2 text-sm font-semibold">
                          <FileText className="text-primary size-4" />
                          Original Solicitation
                        </div>
                        <p className="text-text-dark text-sm font-medium">{original.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                          {original.type && (
                            <Badge variant="outline" className="text-xs">
                              {SAM_GOV_OPPORTUNITY_TYPES[original.type] || original.type}
                            </Badge>
                          )}
                          {original.postedDate && (
                            <span>Posted: {formatDate(original.postedDate)}</span>
                          )}
                          {original.responseDeadline && (
                            <span>Deadline: {formatDate(original.responseDeadline)}</span>
                          )}
                        </div>
                        {original.samGovUrl && (
                          <a
                            href={original.samGovUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary mt-2 inline-flex items-center gap-1 text-xs hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="size-3" />
                            View original on SAM.gov
                          </a>
                        )}
                      </div>
                    );
                  })()}

                {(detailOpp.contactName || detailOpp.contactEmail || detailOpp.contactPhone) && (
                  <div className="rounded-lg border border-border p-4">
                    <div className="text-text-dark mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Briefcase className="text-primary size-4" />
                      Point of Contact
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {detailOpp.contactName && (
                        <div className="flex items-start gap-2">
                          <User className="mt-0.5 size-3.5 text-text-secondary" />
                          <div>
                            <p className="text-text-dark font-medium">{detailOpp.contactName}</p>
                            {detailOpp.contactTitle && (
                              <p className="text-xs text-text-secondary">{detailOpp.contactTitle}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {detailOpp.contactEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="size-3.5 text-text-secondary" />
                          <a
                            href={`mailto:${detailOpp.contactEmail}`}
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {detailOpp.contactEmail}
                          </a>
                        </div>
                      )}
                      {detailOpp.contactPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="size-3.5 text-text-secondary" />
                          <a
                            href={`tel:${detailOpp.contactPhone}`}
                            className="text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {detailOpp.contactPhone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Analysis Section */}
                <div className="rounded-lg border border-border">
                  <button
                    className="flex w-full items-center justify-between p-4"
                    onClick={() => setAnalysisExpanded(!analysisExpanded)}
                  >
                    <div className="text-text-dark flex items-center gap-2 text-sm font-semibold">
                      <Brain className="text-primary size-4" />
                      AI Analysis
                      {detailOpp.analysis && (
                        <Badge variant="secondary" className={`ml-1 text-xs ${getScoreTier(detailOpp.analysis.overallScore).color}`}>
                          {detailOpp.analysis.overallScore}/100 - {detailOpp.analysis.recommendation}
                        </Badge>
                      )}
                    </div>
                    {analysisExpanded ? (
                      <ChevronDown className="size-4 text-text-secondary" />
                    ) : (
                      <ChevronRight className="size-4 text-text-secondary" />
                    )}
                  </button>
                  {analysisExpanded && (
                    <div className="flex flex-col gap-4 border-t border-border p-4">
                      {detailOpp.analysis ? (
                        <>
                          <p className="text-text-dark text-sm">{detailOpp.analysis.summary}</p>

                          <div className="flex flex-col gap-3">
                            {Object.entries(CRITERIA_LABELS).map(([key, { label, weight }]) => {
                              const scoreKey = `${key}Score` as keyof GovOpportunityAnalysis;
                              const reasoningKey = `${key}Reasoning` as keyof GovOpportunityAnalysis;
                              const score = detailOpp.analysis![scoreKey] as number;
                              const reasoning = detailOpp.analysis![reasoningKey] as string;
                              return (
                                <div key={key}>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-text-dark font-medium">{label}</span>
                                    <span className="text-xs text-text-secondary">
                                      {score}/5 (weight: {weight})
                                    </span>
                                  </div>
                                  <div className="mt-1 flex gap-1">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <div
                                        key={i}
                                        className={`h-1.5 flex-1 rounded-full ${
                                          i < score ? "bg-primary" : "bg-border"
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <p className="mt-1 text-xs text-text-secondary">{reasoning}</p>
                                </div>
                              );
                            })}
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-text-dark text-sm font-medium">Key Risks</span>
                              <ul className="mt-1 flex flex-col gap-1">
                                {(JSON.parse(detailOpp.analysis.keyRisks) as string[]).map(
                                  (risk, i) => (
                                    <li key={i} className="text-xs text-text-secondary">
                                      - {risk}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                            <div>
                              <span className="text-text-dark text-sm font-medium">Key Advantages</span>
                              <ul className="mt-1 flex flex-col gap-1">
                                {(JSON.parse(detailOpp.analysis.keyAdvantages) as string[]).map(
                                  (adv, i) => (
                                    <li key={i} className="text-xs text-text-secondary">
                                      - {adv}
                                    </li>
                                  )
                                )}
                              </ul>
                            </div>
                          </div>

                          <div>
                            <span className="text-text-dark text-sm font-medium">Final Verdict</span>
                            <p className="mt-1 text-sm text-text-secondary">{detailOpp.analysis.finalVerdict}</p>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-text-secondary">
                              Analyzed {formatDate(detailOpp.analysis.analyzedAt)}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReanalyze(detailOpp.id)}
                              disabled={reanalyzingId === detailOpp.id}
                            >
                              {reanalyzingId === detailOpp.id ? (
                                <Loader2 className="mr-1 size-3 animate-spin" />
                              ) : (
                                <RotateCw className="mr-1 size-3" />
                              )}
                              Re-analyze
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-2 py-4 text-center">
                          <Brain className="size-8 text-text-secondary" />
                          <p className="text-sm text-text-secondary">
                            No AI analysis yet. Analysis runs automatically via cron or can be triggered manually.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReanalyze(detailOpp.id)}
                            disabled={reanalyzingId === detailOpp.id}
                          >
                            {reanalyzingId === detailOpp.id ? (
                              <Loader2 className="mr-1 size-3 animate-spin" />
                            ) : (
                              <Brain className="mr-1 size-3" />
                            )}
                            Analyze Now
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {detailOpp.description && (
                  <div>
                    <span className="text-sm text-text-secondary">Description</span>
                    <p className="text-text-dark mt-1 whitespace-pre-wrap rounded-lg border border-border bg-background-secondary/30 p-3 text-sm">
                      {cleanDescription(detailOpp.description)}
                    </p>
                  </div>
                )}

                {detailOpp.resourceLinks && detailOpp.resourceLinks.length > 0 && (
                  <div>
                    <span className="text-sm text-text-secondary">Additional Resources</span>
                    <div className="mt-1 flex flex-col gap-1">
                      {detailOpp.resourceLinks.map((link, i) => (
                        <a
                          key={i}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary flex items-center gap-1 text-sm hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="size-3" />
                          {link.length > 60 ? link.slice(0, 58) + "..." : link}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                {!detailOpp.isImported && detailOpp.isActive && (
                  <Button
                    onClick={() => {
                      handleImport(detailOpp.id);
                      setDetailOpp(null);
                    }}
                  >
                    <Import className="mr-2 size-4" />
                    Import to Pipeline
                  </Button>
                )}
                {detailOpp.samGovUrl && (
                  <a href={detailOpp.samGovUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline">
                      <ExternalLink className="mr-2 size-4" />
                      View on SAM.gov
                    </Button>
                  </a>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <SyncModal
        open={syncModalOpen}
        onOpenChange={setSyncModalOpen}
        title="Sync SAM.gov Opportunities"
        description="Choose how to sync opportunities from SAM.gov for software development NAICS codes."
        onSync={handleSync}
      />
    </div>
  );
}
