"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { EmbedFormSubmission } from "@prisma/client";
import { FileSpreadsheet, Download, ChevronDown, ChevronUp, ExternalLink, Trash2, AlertCircle, ArrowUpRight, Copy, Check, Facebook, Globe, RefreshCw, Eye, Filter, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import type { MetaAd } from "@/lib/integrations/meta";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { deleteFormSubmission } from "@/lib/actions";

interface SubmissionsClientProps {
  submissions: EmbedFormSubmission[];
}

const budgetLabels: Record<string, string> = {
  "0-10k": "$0 - $10k",
  "11k-30k": "$11k - $30k",
  "31k-100k": "$31k - $100k",
  "101k-500k": "$101k - $500k",
  "501k-2M": "$501k - $2M",
  "2M+": "$2M+",
};

const revenueLabels: Record<string, string> = {
  "under-20k": "Under $20k/mo",
  "21-70k": "$21-70k/mo",
  "71-150k": "$71-150k/mo",
  "150-300k": "$150-300k/mo",
  "301-600k": "$301-600k/mo",
  "601k+": "$601k+/mo",
};

const serviceLabels: Record<string, string> = {
  "custom-software-autopilot": "Custom Software (Autopilot)",
  "ai-automation": "AI & Automation",
  "high-volume-scraping": "High Volume Scraping",
  "web-to-native-mobile": "Web to Native Mobile",
  "new-web-app": "New Web App",
  "fix-rebuild": "Fix/Rebuild",
  other: "Other",
};

const formTypeLabels: Record<string, string> = {
  REGULAR: "Regular",
  BUSINESSOS: "Business OS",
};

type SortField = "createdAt" | "name" | "email";
type SortDirection = "asc" | "desc";

// Cache key must match the one used in my-ads page
const ADS_CACHE_KEY = "meta_ads_cache";

interface AdsCache {
  data: MetaAd[];
  timestamp: number;
}

export function SubmissionsClient({ submissions: initialSubmissions }: SubmissionsClientProps) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorModalData, setErrorModalData] = useState<{ email: string; errors: string[] } | null>(null);
  const [formUrl, setFormUrl] = useState("https://studio.jaro.dev/embed/form");
  const [copied, setCopied] = useState(false);
  const [cachedAds, setCachedAds] = useState<MetaAd[]>([]);
  const [redirectFilter, setRedirectFilter] = useState<"all" | "book-call" | "low-budget" | "mobile">("all");
  const [formTypeFilter, setFormTypeFilter] = useState<"all" | "REGULAR" | "BUSINESSOS">("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "facebook" | "website">("all");

  // Load cached ads from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem(ADS_CACHE_KEY);
      if (cached) {
        const parsed: AdsCache = JSON.parse(cached);
        setCachedAds(parsed.data || []);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Find matching ad by utm_content (which contains ad.name)
  const findMatchingAd = (utmContent: string | null): MetaAd | null => {
    if (!utmContent || cachedAds.length === 0) return null;
    return cachedAds.find((ad) => ad.name === utmContent) || null;
  };

  // Set form URL based on current hostname (client-side only)
  useEffect(() => {
    if (window.location.hostname === "localhost") {
      setFormUrl("http://localhost:3000/embed/form");
    }
  }, []);

  const copyEmbedScript = async () => {
    const embedScript = `<div style="position:fixed;top:0;left:0;right:0;bottom:0;">
  <iframe 
    id="jaro-embed-form"
    style="width:100%;height:100%;border:none;"
    allow="microphone; camera; geolocation"
  ></iframe>
  <script>
    (function() {
      var iframe = document.getElementById('jaro-embed-form');
      var baseUrl = 'https://studio.jaro.dev/embed/form';
      var url = new URL(baseUrl);
      
      // Get UTM params from localStorage (set by Framer/website)
      var utmParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
      utmParams.forEach(function(param) {
        var value = localStorage.getItem(param);
        if (value) url.searchParams.set(param, value);
      });
      
      // Also inherit any URL parameters from the current page
      var pageParams = new URL(window.location.href).searchParams;
      pageParams.forEach(function(value, key) {
        if (!url.searchParams.has(key)) {
          url.searchParams.set(key, value);
        }
      });
      
      iframe.src = url.toString();
    })();
  </script>
</div>`;

    try {
      await navigator.clipboard.writeText(embedScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to delete the submission from "${email}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await deleteFormSubmission(id);
      if (result.error) {
        console.error(result.error);
        alert("Failed to delete submission");
        return;
      }
      setSubmissions(submissions.filter((s) => s.id !== id));
    } catch (error) {
      console.error("Error deleting submission:", error);
      alert("Failed to delete submission");
    } finally {
      setDeletingId(null);
    }
  };

  const handleProcess = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await fetch("/api/form-submission/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ submissionId: id }),
      });

      const result = await response.json();
      
      if (result.error) {
        console.error(result.error);
        alert(`Processing failed: ${result.error}`);
        return;
      }

      // Update the submission in state with the new data
      setSubmissions(submissions.map((s) => {
        if (s.id === id) {
          return {
            ...s,
            emailValidation: result.data?.emailValidation || s.emailValidation,
            firstName: result.data?.firstName || s.firstName,
            lastName: result.data?.lastName || s.lastName,
            personId: result.data?.personId || s.personId,
            errors: result.data?.errors || s.errors,
          };
        }
        return s;
      }));

      alert("Processing completed successfully!");
    } catch (error) {
      console.error("Error processing submission:", error);
      alert("Failed to process submission");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const hasActiveFilters = redirectFilter !== "all" || formTypeFilter !== "all" || sourceFilter !== "all";

  const filteredSubmissions = submissions.filter((s) => {
    if (redirectFilter !== "all") {
      if (redirectFilter === "book-call") {
        const isBookCall = s.redirectedTo && s.redirectedTo !== "low_budget_message" && s.redirectedTo !== "mobile_message";
        if (!isBookCall) return false;
      } else if (redirectFilter === "low-budget") {
        if (s.redirectedTo !== "low_budget_message") return false;
      } else if (redirectFilter === "mobile") {
        if (s.redirectedTo !== "mobile_message") return false;
      }
    }
    if (formTypeFilter !== "all" && s.type !== formTypeFilter) return false;
    if (sourceFilter !== "all") {
      if (sourceFilter === "facebook" && !s.facebookLeadId) return false;
      if (sourceFilter === "website" && s.facebookLeadId) return false;
    }
    return true;
  });

  const sortedSubmissions = [...filteredSubmissions].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case "createdAt":
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "email":
        comparison = a.email.localeCompare(b.email);
        break;
    }
    
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const exportToCsv = () => {
    const headers = [
      "Date",
      "Name",
      "Source",
      "Form Type",
      "Facebook Lead ID",
      "Email",
      "Email Validation",
      "Monthly Revenue",
      "Budget",
      "Timeline",
      "Platform",
      "Product Type",
      "Existing Codebase",
      "Services Needed",
      "Other Description",
      "Company Headcount",
      "Manual Processes",
      "UTM Source",
      "UTM Medium",
      "UTM Campaign",
      "UTM Term",
      "UTM Content",
      "Redirected To",
      "CRM Contact ID",
      "IP Address",
      "User Agent",
      "Referrer",
      "Errors",
    ];

    const rows = filteredSubmissions.map((s) => [
      new Date(s.createdAt).toISOString(),
      s.name,
      s.facebookLeadId ? "Facebook" : "Website",
      formTypeLabels[s.type] || s.type,
      s.facebookLeadId || "",
      s.email,
      s.emailValidation || "",
      s.monthlyRevenue ? (revenueLabels[s.monthlyRevenue] || s.monthlyRevenue) : "",
      s.budget ? (budgetLabels[s.budget] || s.budget) : "",
      s.timeline || "",
      s.platform || "",
      s.productType || "",
      s.hasExistingCodebase === null ? "" : s.hasExistingCodebase ? "Yes" : "No",
      s.servicesNeeded.join("; "),
      s.otherServiceDescription || "",
      s.companyHeadcount || "",
      s.manualProcesses || "",
      s.utmSource || "",
      s.utmMedium || "",
      s.utmCampaign || "",
      s.utmTerm || "",
      s.utmContent || "",
      s.redirectedTo || "",
      s.personId || "",
      s.ipAddress || "",
      s.userAgent || "",
      s.referrer || "",
      s.errors?.join("; ") || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, "\"\"")}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `form-submissions-${new Date().toISOString().split("T")[0]}.csv`);
    link.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 inline size-4" />
    ) : (
      <ChevronDown className="ml-1 inline size-4" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Form Submissions</h1>
          <p className="text-secondary-600">
            {hasActiveFilters
              ? `${filteredSubmissions.length} of ${submissions.length} submission${submissions.length !== 1 ? "s" : ""}`
              : `${submissions.length} submission${submissions.length !== 1 ? "s" : ""} received`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={copyEmbedScript} variant="outline" size="sm" className="lg:size-default">
            {copied ? (
              <Check className="text-green-600 mr-2 size-4" />
            ) : (
              <Copy className="mr-2 size-4" />
            )}
            <span className="hidden sm:inline">{copied ? "Copied!" : "Copy Embed Script"}</span>
            <span className="sm:hidden">{copied ? "Copied!" : "Embed"}</span>
          </Button>
          <a
            href={formUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="lg:size-default">
              <ExternalLink className="mr-2 size-4" />
              <span className="hidden sm:inline">Open Form</span>
              <span className="sm:hidden">Form</span>
            </Button>
          </a>
          <Button onClick={exportToCsv} variant="outline" size="sm" className="lg:size-default">
            <Download className="mr-2 size-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-secondary-200 bg-secondary-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-secondary-700">
          <Filter className="size-4" />
          Filters
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-secondary-500">Redirect:</span>
            <div className="flex items-center gap-1">
              {([
                { value: "all", label: "All" },
                { value: "book-call", label: "Book Call" },
                { value: "low-budget", label: "Low Budget" },
                { value: "mobile", label: "Mobile" },
              ] as const).map((option) => (
                <Button
                  key={option.value}
                  variant={redirectFilter === option.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setRedirectFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="h-5 w-px bg-secondary-300" />
          <div className="flex items-center gap-1">
            <span className="text-xs text-secondary-500">Form:</span>
            <div className="flex items-center gap-1">
              {([
                { value: "all", label: "All" },
                { value: "REGULAR", label: "Regular" },
                { value: "BUSINESSOS", label: "Business OS" },
              ] as const).map((option) => (
                <Button
                  key={option.value}
                  variant={formTypeFilter === option.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFormTypeFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="h-5 w-px bg-secondary-300" />
          <div className="flex items-center gap-1">
            <span className="text-xs text-secondary-500">Source:</span>
            <div className="flex items-center gap-1">
              {([
                { value: "all", label: "All" },
                { value: "website", label: "Website" },
                { value: "facebook", label: "Facebook" },
              ] as const).map((option) => (
                <Button
                  key={option.value}
                  variant={sourceFilter === option.value ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSourceFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1 text-xs text-secondary-500 hover:text-secondary-700"
            onClick={() => {
              setRedirectFilter("all");
              setFormTypeFilter("all");
              setSourceFilter("all");
            }}
          >
            <X className="size-3" />
            Clear filters
          </Button>
        )}
      </div>

      {submissions.length === 0 ? (
        <Card className="p-8 text-center">
          <FileSpreadsheet className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">No submissions yet</h3>
          <p className="mt-2 text-secondary-600">Form submissions will appear here</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="table-auto">
              <TableHeader>
                <TableRow className="bg-secondary-50">
                  <TableHead
                    className="cursor-pointer hover:bg-secondary-100"
                    onClick={() => handleSort("createdAt")}
                  >
                    Date
                    <SortIcon field="createdAt" />
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-secondary-100"
                    onClick={() => handleSort("name")}
                  >
                    Name
                    <SortIcon field="name" />
                  </TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Form Type</TableHead>
                  <TableHead>Ad</TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-secondary-100"
                    onClick={() => handleSort("email")}
                  >
                    Email
                    <SortIcon field="email" />
                  </TableHead>
                  <TableHead>Email Valid</TableHead>
                  <TableHead>Monthly Revenue</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Timeline</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Product Type</TableHead>
                  <TableHead>Codebase</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Headcount</TableHead>
                  <TableHead>Manual Processes</TableHead>
                  <TableHead>Redirected To</TableHead>
                  <TableHead>CRM Contact</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>User Agent</TableHead>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>UTM Source</TableHead>
                  <TableHead>UTM Medium</TableHead>
                  <TableHead>UTM Campaign</TableHead>
                  <TableHead>UTM Term</TableHead>
                  <TableHead>UTM Content</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSubmissions.map((submission) => (
                  <TableRow key={submission.id} className="hover:bg-secondary-50">
                    <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                      {new Date(submission.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium text-secondary-900">
                      {submission.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {submission.facebookLeadId ? (
                        <Badge variant="outline" className="gap-1 border-primary-300 bg-primary-50 text-primary-700">
                          <Facebook className="size-3" />
                          Facebook Lead Form
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <Globe className="size-3" />
                          jaro.dev
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge
                        variant={submission.type === "BUSINESSOS" ? "default" : "secondary"}
                      >
                        {formTypeLabels[submission.type] || submission.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {(() => {
                        const matchedAd = findMatchingAd(submission.utmContent);
                        if (matchedAd) {
                          return (
                            <Tooltip content={matchedAd.name} side="top">
                              <Link
                                href={`/dashboard/ads/my-ads?ad=${encodeURIComponent(matchedAd.name)}`}
                              >
                                <Badge
                                  variant="outline"
                                  className="cursor-pointer gap-1 border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100"
                                >
                                  <Eye className="size-3" />
                                  View Ad
                                </Badge>
                              </Link>
                            </Tooltip>
                          );
                        }
                        return "-";
                      })()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {submission.email}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {submission.emailValidation ? (
                        <Badge
                          variant="outline"
                          className={
                            submission.emailValidation === "valid"
                              ? "border-success-500 bg-success-50 text-success-700"
                              : submission.emailValidation === "catchall" || submission.emailValidation === "unknown"
                                ? "border-warning-500 bg-warning-50 text-warning-700"
                                : submission.emailValidation === "invalid" || submission.emailValidation === "disposable"
                                  ? "border-danger-500 bg-danger-50 text-danger-700"
                                  : ""
                          }
                        >
                          {submission.emailValidation}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {submission.monthlyRevenue ? (
                        <Badge
                          variant={
                            submission.monthlyRevenue === "under-20k"
                              ? "secondary"
                              : submission.monthlyRevenue === "601k+" || submission.monthlyRevenue === "301-600k"
                                ? "default"
                                : "outline"
                          }
                        >
                          {revenueLabels[submission.monthlyRevenue] || submission.monthlyRevenue}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {submission.budget ? (
                        <Badge
                          variant={
                            submission.budget === "0-10k"
                              ? "secondary"
                              : submission.budget === "2M+" || submission.budget === "501k-2M"
                                ? "default"
                                : "outline"
                          }
                        >
                          {budgetLabels[submission.budget] || submission.budget}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                      {submission.timeline || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                      {submission.platform || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                      {submission.productType || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                      {submission.hasExistingCodebase === null ? "-" : submission.hasExistingCodebase ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {submission.servicesNeeded.length > 0 ? submission.servicesNeeded.map((service) => {
                          if (service === "other" && submission.otherServiceDescription) {
                            return (
                              <Tooltip key={service} content={submission.otherServiceDescription} side="top">
                                <Badge variant="secondary" className="cursor-default text-xs">
                                  Other
                                </Badge>
                              </Tooltip>
                            );
                          }
                          return (
                            <Badge key={service} variant="secondary" className="text-xs">
                              {serviceLabels[service] || service}
                            </Badge>
                          );
                        }) : "-"}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                      {submission.companyHeadcount || "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] whitespace-nowrap text-sm text-secondary-600">
                      {submission.manualProcesses ? (
                        <Tooltip content={submission.manualProcesses} side="top">
                          <span className="block cursor-default truncate">{submission.manualProcesses}</span>
                        </Tooltip>
                      ) : "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {submission.redirectedTo ? (
                        submission.redirectedTo === "mobile_message" ? (
                          <Badge variant="secondary">Mobile</Badge>
                        ) : submission.redirectedTo === "low_budget_message" ? (
                          <Badge variant="secondary">Low Budget</Badge>
                        ) : (
                          <a
                            href={submission.redirectedTo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
                          >
                            Book Call
                            <ExternalLink className="size-3" />
                          </a>
                        )
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {submission.personId ? (
                        <Link href={`/dashboard/crm/people/${submission.personId}`}>
                          <Badge variant="outline" className="cursor-pointer gap-1 hover:bg-secondary-100">
                            {submission.firstName || submission.name.split(" ")[0]}
                            <ArrowUpRight className="size-3" />
                          </Badge>
                        </Link>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                      {submission.ipAddress || "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate whitespace-nowrap text-sm text-secondary-600" title={submission.userAgent || undefined}>
                      {submission.userAgent || "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate whitespace-nowrap text-sm text-secondary-600" title={submission.referrer || undefined}>
                      {submission.referrer || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {submission.errors && submission.errors.length > 0 ? (
                        <Badge
                          variant="secondary"
                          className="cursor-pointer bg-danger-100 text-danger-700 hover:bg-danger-200"
                          onClick={() => setErrorModalData({ email: submission.email, errors: submission.errors })}
                        >
                          {submission.errors.length} error{submission.errors.length !== 1 ? "s" : ""}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                      {submission.utmSource || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                      {submission.utmMedium || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                      {submission.utmCampaign || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                      {submission.utmTerm || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-secondary-600">
                      {submission.utmContent || "-"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {/* Show process button if not yet processed */}
                        {(!submission.emailValidation || !submission.personId) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-secondary-400 hover:text-primary-600"
                            onClick={() => handleProcess(submission.id)}
                            disabled={processingId === submission.id}
                            title="Process submission (email verification + CRM contact)"
                          >
                            <RefreshCw className={`size-4 ${processingId === submission.id ? "animate-spin" : ""}`} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-secondary-400 hover:text-danger-600"
                          onClick={() => handleDelete(submission.id, submission.email)}
                          disabled={deletingId === submission.id}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={!!errorModalData} onOpenChange={(open) => !open && setErrorModalData(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="size-5 text-danger-600" />
              Processing Errors
            </DialogTitle>
            <DialogDescription>
              Errors encountered while processing submission from {errorModalData?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {errorModalData?.errors.map((error, index) => (
              <div
                key={index}
                className="break-all rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-800"
              >
                {error}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
