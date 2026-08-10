"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  RefreshCw,
  AlertCircle,
  DollarSign,
  MousePointerClick,
  Users,
  Phone,
  Eye,
  TrendingUp,
  Image as ImageIcon,
  Video,
  ArrowUpDown,
  Calendar,
  Loader2,
  ExternalLink,
  Microscope,
  ChevronLeft,
  Bookmark,
  Save,
  Trash2,
  X,
  Pause,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MetaAd, MetaAdStatus, AdSetBudgetType } from "@/lib/integrations/meta";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

// ============================================================================
// Diagnostic Types
// ============================================================================

interface DiagnosticResult {
  id: string;
  adAnalysis: string;
  landingPageAnalysis: string;
  landingPageScreenshot: string;
  landingPageContent: string;
}

// ============================================================================
// Types
// ============================================================================

type SortOption = 
  | "created_desc" 
  | "created_asc" 
  | "spend_desc" 
  | "spend_asc" 
  | "cpl_asc" 
  | "cpl_desc" 
  | "cpc_asc" 
  | "cpc_desc"
  | "calls_desc"
  | "leads_desc";

type StatusEntityType = "ad" | "adset" | "campaign";

type DateFilter = "all" | "7d" | "30d" | "90d" | "1y";

type ComparisonOperator = "gt" | "lt" | "gte" | "lte";

interface NumericFilter {
  operator: ComparisonOperator;
  value: number;
}

interface FilterState {
  searchQuery: string;
  statusFilter: string;
  campaignFilter: string;
  sortBy: SortOption;
  dateFilter: DateFilter;
  spendFilter: NumericFilter | null;
  leadsFilter: NumericFilter | null;
  callsFilter: NumericFilter | null;
  aiAnalysisFilter: string;
}

interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: number;
}

// ============================================================================
// Numeric Filter Component
// ============================================================================

interface NumericFilterInputProps {
  label: string;
  value: NumericFilter | null;
  onChange: (filter: NumericFilter | null) => void;
  prefix?: string;
}

function NumericFilterInput({ label, value, onChange, prefix }: NumericFilterInputProps) {
  const [operator, setOperator] = useState<ComparisonOperator>(value?.operator || "gte");
  const [inputValue, setInputValue] = useState<string>(value?.value?.toString() || "");

  const handleApply = () => {
    const numValue = parseFloat(inputValue);
    if (!isNaN(numValue) && inputValue.trim() !== "") {
      onChange({ operator, value: numValue });
    } else {
      onChange(null);
    }
  };

  const handleClear = () => {
    setInputValue("");
    onChange(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApply();
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Select value={operator} onValueChange={(v) => setOperator(v as ComparisonOperator)}>
        <SelectTrigger className="h-9 w-16 px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="gte">&ge;</SelectItem>
          <SelectItem value="lte">&le;</SelectItem>
          <SelectItem value="gt">&gt;</SelectItem>
          <SelectItem value="lt">&lt;</SelectItem>
        </SelectContent>
      </Select>
      <div className="relative">
        {prefix && (
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-secondary-400">
            {prefix}
          </span>
        )}
        <Input
          type="number"
          placeholder={label}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleApply}
          onKeyDown={handleKeyDown}
          className={`h-9 w-24 text-xs ${prefix ? "pl-5" : ""}`}
        />
      </div>
      {value && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="size-7"
        >
          <span className="text-xs text-secondary-400">x</span>
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

function getStatusColor(status: MetaAdStatus): string {
  switch (status) {
    case "ACTIVE":
      return "bg-success-100 text-success-700 border-success-200";
    case "PAUSED":
    case "CAMPAIGN_PAUSED":
    case "ADSET_PAUSED":
      return "bg-warning-100 text-warning-700 border-warning-200";
    case "DELETED":
    case "ARCHIVED":
      return "bg-secondary-100 text-secondary-600 border-secondary-200";
    case "DISAPPROVED":
    case "WITH_ISSUES":
      return "bg-danger-100 text-danger-700 border-danger-200";
    case "PENDING_REVIEW":
    case "PENDING_BILLING_INFO":
    case "IN_PROCESS":
      return "bg-primary-100 text-primary-700 border-primary-200";
    default:
      return "bg-secondary-100 text-secondary-600 border-secondary-200";
  }
}

function getAspectRatioClass(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "1:1":
      return "aspect-square";
    case "9:16":
      return "aspect-[9/16]";
    case "4:5":
      return "aspect-[4/5]";
    case "16:9":
      return "aspect-video";
    case "90:160":
      return "aspect-[9/16]";
    case "100:100":
      return "aspect-square";
    default:
      return "aspect-auto";
  }
}

function getStatusLabel(status: MetaAdStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "PAUSED":
      return "Paused";
    case "CAMPAIGN_PAUSED":
      return "Campaign Paused";
    case "ADSET_PAUSED":
      return "Ad Set Paused";
    case "DELETED":
      return "Deleted";
    case "ARCHIVED":
      return "Archived";
    case "DISAPPROVED":
      return "Disapproved";
    case "WITH_ISSUES":
      return "With Issues";
    case "PENDING_REVIEW":
      return "Pending Review";
    case "PENDING_BILLING_INFO":
      return "Pending Billing";
    case "IN_PROCESS":
      return "In Process";
    case "PREAPPROVED":
      return "Preapproved";
    default:
      return status;
  }
}

function isConfiguredActive(status: MetaAdStatus): boolean {
  return status === "ACTIVE";
}

function computeEffectiveStatus(ad: MetaAd): MetaAdStatus {
  if (ad.campaign.status === "PAUSED") return "CAMPAIGN_PAUSED";
  if (ad.adset.status === "PAUSED") return "ADSET_PAUSED";
  if (ad.status === "PAUSED") return "PAUSED";
  if (ad.status === "ACTIVE") return "ACTIVE";
  return ad.effectiveStatus;
}

function applyStatusToAd(
  ad: MetaAd,
  entityType: StatusEntityType,
  entityId: string,
  status: "ACTIVE" | "PAUSED"
): MetaAd {
  let updated = ad;

  if (entityType === "campaign" && ad.campaign.id === entityId) {
    updated = { ...ad, campaign: { ...ad.campaign, status } };
  } else if (entityType === "adset" && ad.adset.id === entityId) {
    updated = { ...ad, adset: { ...ad.adset, status } };
  } else if (entityType === "ad" && ad.id === entityId) {
    updated = { ...ad, status };
  } else {
    return ad;
  }

  return { ...updated, effectiveStatus: computeEffectiveStatus(updated) };
}

// ============================================================================
// Components
// ============================================================================

interface AdStatusControlsProps {
  ad: MetaAd;
  compact?: boolean;
  pendingKeys: Set<string>;
  onToggle: (
    entityType: StatusEntityType,
    entityId: string,
    nextStatus: "ACTIVE" | "PAUSED"
  ) => void;
  onBudgetUpdate?: (
    adSetId: string,
    budgetType: AdSetBudgetType,
    amount: number
  ) => Promise<void> | void;
  isBudgetUpdating?: boolean;
}

function AdSetBudgetEditor({
  ad,
  compact,
  onBudgetUpdate,
  isBudgetUpdating,
}: {
  ad: MetaAd;
  compact?: boolean;
  onBudgetUpdate?: (
    adSetId: string,
    budgetType: AdSetBudgetType,
    amount: number
  ) => Promise<void> | void;
  isBudgetUpdating?: boolean;
}) {
  const hasDaily = ad.adset.dailyBudget != null;
  const hasLifetime = ad.adset.lifetimeBudget != null;
  const defaultType: AdSetBudgetType = hasLifetime && !hasDaily ? "lifetime" : "daily";
  const currentAmount =
    defaultType === "lifetime" ? ad.adset.lifetimeBudget : ad.adset.dailyBudget;

  const [budgetType, setBudgetType] = useState<AdSetBudgetType>(defaultType);
  const [value, setValue] = useState(
    currentAmount != null ? String(currentAmount) : ""
  );

  useEffect(() => {
    const nextType: AdSetBudgetType =
      ad.adset.lifetimeBudget != null && ad.adset.dailyBudget == null
        ? "lifetime"
        : "daily";
    const nextAmount =
      nextType === "lifetime" ? ad.adset.lifetimeBudget : ad.adset.dailyBudget;
    setBudgetType(nextType);
    setValue(nextAmount != null ? String(nextAmount) : "");
  }, [ad.adset.id, ad.adset.dailyBudget, ad.adset.lifetimeBudget]);

  if (!ad.adset.id || !onBudgetUpdate) return null;

  // CBO / campaign-budget ad sets have neither budget on the ad set
  if (!hasDaily && !hasLifetime) {
    return (
      <div
        className={
          compact
            ? "rounded bg-secondary-50 px-2 py-1.5"
            : "rounded border border-secondary-200 px-3 py-2"
        }
      >
        <p className={compact ? "text-[10px] text-secondary-500" : "text-xs text-secondary-500"}>
          Ad Set Budget
        </p>
        <p className={compact ? "text-xs text-secondary-600" : "text-sm text-secondary-600"}>
          Uses campaign budget
        </p>
      </div>
    );
  }

  const handleSave = () => {
    const amount = parseFloat(value);
    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      toast.error("Enter a valid budget greater than 0");
      return;
    }
    const existing =
      budgetType === "daily" ? ad.adset.dailyBudget : ad.adset.lifetimeBudget;
    if (existing != null && Math.abs(existing - amount) < 0.005) {
      return;
    }
    onBudgetUpdate(ad.adset.id, budgetType, amount);
  };

  return (
    <div
      className={
        compact
          ? "flex flex-col gap-1.5 rounded bg-secondary-50 px-2 py-1.5"
          : "flex flex-col gap-2 rounded border border-secondary-200 px-3 py-2"
      }
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={compact ? "text-[10px] text-secondary-500" : "text-xs text-secondary-500"}>
          Ad Set {budgetType === "daily" ? "Daily" : "Lifetime"} Budget
        </p>
        {hasDaily && hasLifetime && (
          <button
            type="button"
            className="text-[10px] text-primary-600 hover:underline"
            onClick={() => {
              const next = budgetType === "daily" ? "lifetime" : "daily";
              setBudgetType(next);
              const nextAmount =
                next === "daily" ? ad.adset.dailyBudget : ad.adset.lifetimeBudget;
              setValue(nextAmount != null ? String(nextAmount) : "");
            }}
          >
            Switch to {budgetType === "daily" ? "lifetime" : "daily"}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-secondary-500">$</span>
        <Input
          type="number"
          min="0.01"
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          }}
          disabled={isBudgetUpdating}
          className={compact ? "h-7 text-xs" : "h-8 text-sm"}
          aria-label="Ad set budget amount"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isBudgetUpdating}
          onClick={handleSave}
          className={compact ? "h-7 px-2 text-xs" : "h-8"}
        >
          {isBudgetUpdating ? <Loader2 className="size-3 animate-spin" /> : "Save"}
        </Button>
      </div>
    </div>
  );
}

function AdStatusControls({
  ad,
  compact = false,
  pendingKeys,
  onToggle,
  onBudgetUpdate,
  isBudgetUpdating,
}: AdStatusControlsProps) {
  const rows: Array<{
    entityType: StatusEntityType;
    entityId: string;
    label: string;
    name: string;
    status: MetaAdStatus;
  }> = [
    {
      entityType: "campaign",
      entityId: ad.campaign.id,
      label: "Campaign",
      name: ad.campaign.name,
      status: ad.campaign.status,
    },
    {
      entityType: "adset",
      entityId: ad.adset.id,
      label: "Ad Set",
      name: ad.adset.name,
      status: ad.adset.status,
    },
    {
      entityType: "ad",
      entityId: ad.id,
      label: "Ad",
      name: ad.name,
      status: ad.status,
    },
  ];

  return (
    <div
      className={compact ? "mt-3 flex flex-col gap-1.5" : "flex flex-col gap-2"}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {rows.map((row) => {
        const pendingKey = `${row.entityType}:${row.entityId}`;
        const isPending = pendingKeys.has(pendingKey);
        const checked = isConfiguredActive(row.status);
        const canToggle = row.status === "ACTIVE" || row.status === "PAUSED";

        return (
          <div
            key={pendingKey}
            className={
              compact
                ? "flex items-center justify-between gap-2 rounded bg-secondary-50 px-2 py-1.5"
                : "flex items-center justify-between gap-3 rounded border border-secondary-200 px-3 py-2"
            }
          >
            <div className="min-w-0 flex-1">
              <p className={compact ? "text-[10px] text-secondary-500" : "text-xs text-secondary-500"}>
                {row.label}
              </p>
              {!compact && (
                <p className="truncate text-sm font-medium text-secondary-900">{row.name}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isPending && <Loader2 className="size-3 animate-spin text-secondary-400" />}
              <Switch
                checked={checked}
                disabled={isPending || !canToggle || !row.entityId}
                onCheckedChange={(nextChecked) => {
                  onToggle(row.entityType, row.entityId, nextChecked ? "ACTIVE" : "PAUSED");
                }}
                aria-label={`Toggle ${row.label} ${checked ? "off" : "on"}`}
              />
            </div>
          </div>
        );
      })}
      <AdSetBudgetEditor
        ad={ad}
        compact={compact}
        onBudgetUpdate={onBudgetUpdate}
        isBudgetUpdating={isBudgetUpdating}
      />
    </div>
  );
}

interface MetricItemProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
}

function MetricItem({ label, value, subValue, icon }: MetricItemProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-secondary-50 p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-100">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-secondary-500">{label}</p>
        <p className="text-lg font-bold text-secondary-900">{value}</p>
        {subValue && (
          <p className="text-xs text-secondary-500">{subValue}</p>
        )}
      </div>
    </div>
  );
}

interface AdCardProps {
  ad: MetaAd;
  onClick: () => void;
  isAnalyzed?: boolean;
  isSelected: boolean;
  onSelectChange: (adId: string, selected: boolean) => void;
  pendingKeys: Set<string>;
  onStatusToggle: (
    entityType: StatusEntityType,
    entityId: string,
    nextStatus: "ACTIVE" | "PAUSED"
  ) => void;
  onBudgetUpdate: (
    adSetId: string,
    budgetType: AdSetBudgetType,
    amount: number
  ) => void;
  isBudgetUpdating: boolean;
}

function AdCard({
  ad,
  onClick,
  isAnalyzed,
  isSelected,
  onSelectChange,
  pendingKeys,
  onStatusToggle,
  onBudgetUpdate,
  isBudgetUpdating,
}: AdCardProps) {
  const thumbnailUrl = ad.creative.imageUrl || ad.creative.thumbnailUrl || Object.values(ad.creative.assets)[0]?.url;
  const isVideo = ad.creative.videoId || Object.values(ad.creative.assets)[0]?.type === "video";

  return (
    <Card
      className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <div className="relative aspect-[9/16] bg-secondary-100">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={ad.name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <ImageIcon className="size-16 text-secondary-300" />
          </div>
        )}
        {isVideo && (
          <div className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5">
            <Video className="size-4 text-white" />
          </div>
        )}
        <div
          className="absolute bottom-2 right-2 z-10"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelectChange(ad.id, checked === true)}
            aria-label={`Select ${ad.name}`}
            className="size-5 border-white bg-background data-[state=checked]:border-primary-500"
          />
        </div>
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          <Badge className={getStatusColor(ad.effectiveStatus)}>
            {getStatusLabel(ad.effectiveStatus)}
          </Badge>
          {isAnalyzed && (
            <Badge className="border-primary-200 bg-primary-100 text-primary-700">
              <Microscope className="mr-1 size-3" />
              AI Analyzed
            </Badge>
          )}
        </div>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 text-sm font-semibold text-secondary-900">
          {ad.name}
        </h3>
        <p className="mt-1 text-xs text-secondary-500">
          {ad.campaign.name}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <div className="rounded bg-secondary-50 px-2 py-1">
            <p className="text-[10px] text-secondary-500">Spend</p>
            <p className="text-xs font-semibold text-secondary-900">
              {formatCurrency(ad.metrics.spend)}
            </p>
          </div>
          <div className="rounded bg-secondary-50 px-2 py-1">
            <p className="text-[10px] text-secondary-500">Views</p>
            <p className="text-xs font-semibold text-secondary-900">
              {formatNumber(ad.metrics.impressions)}
            </p>
          </div>
          <div className="rounded bg-secondary-50 px-2 py-1">
            <p className="text-[10px] text-secondary-500">Leads</p>
            <p className="text-xs font-semibold text-secondary-900">
              {formatNumber(ad.metrics.leads)}
            </p>
          </div>
          <div className="rounded bg-secondary-50 px-2 py-1">
            <p className="text-[10px] text-secondary-500">Calls</p>
            <p className="text-xs font-semibold text-secondary-900">
              {formatNumber(ad.metrics.scheduleCalls)}
            </p>
          </div>
          <div className="rounded bg-secondary-50 px-2 py-1">
            <p className="text-[10px] text-secondary-500">CPL</p>
            <p className="text-xs font-semibold text-secondary-900">
              {ad.metrics.costPerLead > 0 ? formatCurrency(ad.metrics.costPerLead) : "-"}
            </p>
          </div>
          <div className="rounded bg-secondary-50 px-2 py-1">
            <p className="text-[10px] text-secondary-500">Cost/Call</p>
            <p className="text-xs font-semibold text-secondary-900">
              {ad.metrics.costPerCall > 0 ? formatCurrency(ad.metrics.costPerCall) : "-"}
            </p>
          </div>
        </div>

        <AdStatusControls
          ad={ad}
          compact
          pendingKeys={pendingKeys}
          onToggle={onStatusToggle}
          onBudgetUpdate={onBudgetUpdate}
          isBudgetUpdating={isBudgetUpdating}
        />
      </div>
    </Card>
  );
}

interface AdDetailModalProps {
  ad: MetaAd | null;
  isOpen: boolean;
  onClose: () => void;
  onDiagnosticComplete?: () => void;
  pendingKeys: Set<string>;
  onStatusToggle: (
    entityType: StatusEntityType,
    entityId: string,
    nextStatus: "ACTIVE" | "PAUSED"
  ) => void;
  onBudgetUpdate: (
    adSetId: string,
    budgetType: AdSetBudgetType,
    amount: number
  ) => void;
  isBudgetUpdating: boolean;
}

function AdDetailModal({
  ad,
  isOpen,
  onClose,
  onDiagnosticComplete,
  pendingKeys,
  onStatusToggle,
  onBudgetUpdate,
  isBudgetUpdating,
}: AdDetailModalProps) {
  const [selectedPlacement, setSelectedPlacement] = useState<string>("default");
  const [activeTab, setActiveTab] = useState<"metrics" | "diagnostics">("metrics");
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [isLoadingDiagnostic, setIsLoadingDiagnostic] = useState(false);

  useEffect(() => {
    if (ad) {
      const placements = Object.keys(ad.creative.assets);
      setSelectedPlacement(placements[0] || "default");
      // Reset diagnostic state when ad changes
      setDiagnosticResult(null);
      setActiveTab("metrics");
      
      // Fetch existing diagnostic for this ad
      const fetchExistingDiagnostic = async () => {
        setIsLoadingDiagnostic(true);
        try {
          const response = await fetch(`/api/funnel-diagnostics?metaAdId=${ad.id}`);
          const data = await response.json();
          if (data.data) {
            setDiagnosticResult(data.data);
          }
        } catch {
          // Silently fail - just means no existing diagnostic
        } finally {
          setIsLoadingDiagnostic(false);
        }
      };
      
      fetchExistingDiagnostic();
    }
  }, [ad]);

  const runDiagnostic = async () => {
    if (!ad || !ad.creative.linkUrl) {
      toast.error("This ad does not have a landing page URL configured");
      return;
    }

    setIsRunningDiagnostic(true);
    setDiagnosticResult(null);

    try {
      const adImageUrl =
        ad.creative.imageUrl ||
        ad.creative.thumbnailUrl ||
        Object.values(ad.creative.assets)[0]?.url;

      const response = await fetch("/api/funnel-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metaAdId: ad.id,
          metaAdName: ad.name,
          adImageUrl,
          adBody: ad.creative.body,
          adHeadline: ad.creative.title,
          landingPageUrl: ad.creative.linkUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Failed to run diagnostic");
      }

      setDiagnosticResult(data.data);
      setActiveTab("diagnostics");
      toast.success("AI Diagnostic completed");
      onDiagnosticComplete?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run diagnostic");
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  if (!ad) return null;

  const placements = Object.keys(ad.creative.assets);
  const currentAsset = ad.creative.assets[selectedPlacement] || Object.values(ad.creative.assets)[0];
  const isVideo = currentAsset?.type === "video" || ad.creative.videoId;
  const hasLandingPage = !!ad.creative.linkUrl;

  const placementLabels: Record<string, string> = {
    default: "Default",
    facebook_feed: "Facebook Feed",
    instagram_feed: "Instagram Feed",
    instagram_stories: "Instagram Stories",
    facebook_stories: "Facebook Stories",
    audience_network: "Audience Network",
    messenger: "Messenger",
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-8">{ad.name}</DialogTitle>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-secondary-200 pb-2">
          <Button
            variant={activeTab === "metrics" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("metrics")}
          >
            Performance Metrics
          </Button>
          <Button
            variant={activeTab === "diagnostics" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("diagnostics")}
            disabled={!hasLandingPage && !diagnosticResult && !isLoadingDiagnostic}
          >
            <Microscope className="mr-2 size-4" />
            AI Diagnostics
            {diagnosticResult && (
              <Badge variant="secondary" className="ml-2">
                Saved
              </Badge>
            )}
          </Button>
          {hasLandingPage && (
            <Button
              variant="outline"
              size="sm"
              onClick={runDiagnostic}
              disabled={isRunningDiagnostic || isLoadingDiagnostic}
              className="ml-auto"
            >
              {isRunningDiagnostic ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Running...
                </>
              ) : isLoadingDiagnostic ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Loading...
                </>
              ) : diagnosticResult ? (
                <>
                  <RefreshCw className="mr-2 size-4" />
                  Re-run Diagnostic
                </>
              ) : (
                <>
                  <Microscope className="mr-2 size-4" />
                  Run AI Diagnostic
                </>
              )}
            </Button>
          )}
        </div>

        {/* Loading State */}
        {isRunningDiagnostic && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <Loader2 className="size-12 animate-spin text-primary-500" />
            <div className="text-center">
              <p className="font-medium text-secondary-900">Running AI Funnel Diagnostic...</p>
              <p className="text-sm text-secondary-500">This may take 30-60 seconds</p>
            </div>
            <div className="mt-2 space-y-1 text-center text-xs text-secondary-400">
              <p>1. Analyzing ad creative with AI Vision...</p>
              <p>2. Scraping landing page...</p>
              <p>3. Analyzing landing page experience...</p>
            </div>
          </div>
        )}

        {/* Metrics Tab */}
        {activeTab === "metrics" && !isRunningDiagnostic && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              {placements.length > 1 && (
                <Select value={selectedPlacement} onValueChange={setSelectedPlacement}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select placement" />
                  </SelectTrigger>
                  <SelectContent>
                    {placements.map((placement) => (
                      <SelectItem key={placement} value={placement}>
                        {placementLabels[placement] || placement.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-secondary-100">
                {currentAsset?.url ? (
                  <div className={`relative max-h-[500px] w-full ${getAspectRatioClass(currentAsset.aspectRatio)}`}>
                    <img
                      src={currentAsset.url}
                      alt={ad.name}
                      className="size-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center">
                    <ImageIcon className="size-16 text-secondary-300" />
                  </div>
                )}
                {isVideo && (
                  <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded bg-black/70 px-2 py-1">
                    <Video className="size-4 text-white" />
                    <span className="text-xs font-medium text-white">Video</span>
                  </div>
                )}
                {currentAsset?.aspectRatio && (
                  <div className="absolute bottom-3 left-3 rounded bg-black/70 px-2 py-1">
                    <span className="text-xs font-medium text-white">{currentAsset.aspectRatio}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(ad.effectiveStatus)}>
                    {getStatusLabel(ad.effectiveStatus)}
                  </Badge>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-secondary-500">
                    Delivery Controls
                  </p>
                  <AdStatusControls
                    ad={ad}
                    pendingKeys={pendingKeys}
                    onToggle={onStatusToggle}
                    onBudgetUpdate={onBudgetUpdate}
                    isBudgetUpdating={isBudgetUpdating}
                  />
                </div>
                {ad.creative.title && (
                  <div>
                    <p className="text-xs text-secondary-500">Headline</p>
                    <p className="text-sm font-medium text-secondary-900">{ad.creative.title}</p>
                  </div>
                )}
                {ad.creative.body && (
                  <div>
                    <p className="text-xs text-secondary-500">Body</p>
                    <p className="text-sm text-secondary-700">{ad.creative.body}</p>
                  </div>
                )}
                {ad.creative.linkUrl && (
                  <div>
                    <p className="text-xs text-secondary-500">Landing Page</p>
                    <a
                      href={ad.creative.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
                    >
                      {ad.creative.linkUrl.substring(0, 40)}...
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary-500">
                Performance Metrics
              </h3>
              
              <div className="grid gap-3">
                <MetricItem
                  label="Ad Spend"
                  value={formatCurrency(ad.metrics.spend)}
                  icon={<DollarSign className="size-4 text-primary-600" />}
                />
                <MetricItem
                  label="Clicks"
                  value={formatNumber(ad.metrics.clicks)}
                  subValue={`CPC: ${formatCurrency(ad.metrics.cpc)}`}
                  icon={<MousePointerClick className="size-4 text-primary-600" />}
                />
                <MetricItem
                  label="Leads"
                  value={formatNumber(ad.metrics.leads)}
                  subValue={ad.metrics.costPerLead > 0 ? `Cost per lead: ${formatCurrency(ad.metrics.costPerLead)}` : undefined}
                  icon={<Users className="size-4 text-primary-600" />}
                />
                <MetricItem
                  label="Calls Scheduled"
                  value={formatNumber(ad.metrics.scheduleCalls)}
                  subValue={ad.metrics.costPerCall > 0 ? `Cost per call: ${formatCurrency(ad.metrics.costPerCall)}` : undefined}
                  icon={<Phone className="size-4 text-primary-600" />}
                />
                <MetricItem
                  label="Impressions"
                  value={formatNumber(ad.metrics.impressions)}
                  subValue={`CPM: ${formatCurrency(ad.metrics.cpm)}`}
                  icon={<Eye className="size-4 text-primary-600" />}
                />
                <MetricItem
                  label="Reach"
                  value={formatNumber(ad.metrics.reach)}
                  icon={<Users className="size-4 text-primary-600" />}
                />
                <MetricItem
                  label="CTR"
                  value={formatPercentage(ad.metrics.ctr)}
                  icon={<TrendingUp className="size-4 text-primary-600" />}
                />
              </div>
            </div>
          </div>
        )}

        {/* Diagnostics Tab */}
        {activeTab === "diagnostics" && !isRunningDiagnostic && (
          <div className="space-y-6">
            {isLoadingDiagnostic ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="size-12 animate-spin text-primary-500" />
                <p className="mt-4 text-sm text-secondary-500">Loading existing diagnostic...</p>
              </div>
            ) : !diagnosticResult ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Microscope className="size-12 text-secondary-300" />
                <h3 className="mt-4 font-semibold text-secondary-900">No Diagnostic Run Yet</h3>
                <p className="mt-2 max-w-md text-sm text-secondary-500">
                  Run an AI diagnostic to analyze this ad from a customer&apos;s perspective. 
                  The AI will review the ad creative and landing page experience.
                </p>
                {hasLandingPage ? (
                  <Button className="mt-4" onClick={runDiagnostic} disabled={isRunningDiagnostic}>
                    <Microscope className="mr-2 size-4" />
                    Run AI Diagnostic
                  </Button>
                ) : (
                  <p className="mt-4 text-sm text-warning-600">
                    This ad does not have a landing page URL configured.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("metrics")}>
                    <ChevronLeft className="mr-1 size-4" />
                    Back to Metrics
                  </Button>
                  <Button variant="outline" size="sm" onClick={runDiagnostic} disabled={isRunningDiagnostic}>
                    {isRunningDiagnostic ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 size-4" />
                    )}
                    Re-run Diagnostic
                  </Button>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Ad Analysis */}
                  <Card className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100">
                        <ImageIcon className="size-4 text-primary-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-secondary-900">Ad Analysis</h4>
                        <p className="text-xs text-secondary-500">First impressions as a customer</p>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none text-secondary-700">
                      <ReactMarkdown>{diagnosticResult.adAnalysis}</ReactMarkdown>
                    </div>
                  </Card>

                  {/* Landing Page Analysis */}
                  <Card className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100">
                        <ExternalLink className="size-4 text-primary-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-secondary-900">Landing Page Analysis</h4>
                        <p className="text-xs text-secondary-500">Experience after clicking</p>
                      </div>
                    </div>
                    {diagnosticResult.landingPageScreenshot && (
                      <div className="mb-3 overflow-hidden rounded-lg border bg-secondary-50">
                        <img
                          src={diagnosticResult.landingPageScreenshot}
                          alt="Landing page"
                          className="w-full object-cover object-top"
                          style={{ maxHeight: "200px" }}
                        />
                      </div>
                    )}
                    <div className="prose prose-sm max-w-none text-secondary-700">
                      <ReactMarkdown>{diagnosticResult.landingPageAnalysis}</ReactMarkdown>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AdCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[9/16] w-full" />
      <div className="p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-1 h-4 w-1/2" />
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded bg-secondary-50 px-2 py-1">
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="mt-1 h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Cache Configuration
// ============================================================================

const ADS_CACHE_KEY = "meta_ads_cache";
const ADS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface AdsCache {
  data: MetaAd[];
  timestamp: number;
}

function getCachedAds(): AdsCache | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(ADS_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached) as AdsCache;
  } catch {
    return null;
  }
}

function setCachedAds(data: MetaAd[]): void {
  if (typeof window === "undefined") return;
  try {
    const cache: AdsCache = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(ADS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

function isCacheValid(cache: AdsCache): boolean {
  return Date.now() - cache.timestamp < ADS_CACHE_TTL;
}

function normalizeCachedAd(ad: MetaAd): MetaAd {
  return {
    ...ad,
    campaign: {
      ...ad.campaign,
      status: ad.campaign?.status || "PAUSED",
    },
    adset: {
      ...ad.adset,
      status: ad.adset?.status || "PAUSED",
      dailyBudget: ad.adset?.dailyBudget ?? null,
      lifetimeBudget: ad.adset?.lifetimeBudget ?? null,
    },
  };
}

// ============================================================================
// Filter Persistence
// ============================================================================

const FILTERS_CACHE_KEY = "meta_ads_filters";
const SAVED_VIEWS_KEY = "meta_ads_saved_views";

const DEFAULT_FILTERS: FilterState = {
  searchQuery: "",
  statusFilter: "all",
  campaignFilter: "all",
  sortBy: "created_desc",
  dateFilter: "all",
  spendFilter: null,
  leadsFilter: null,
  callsFilter: null,
  aiAnalysisFilter: "all",
};

function getCachedFilters(): FilterState | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(FILTERS_CACHE_KEY);
    if (!cached) return null;
    return JSON.parse(cached) as FilterState;
  } catch {
    return null;
  }
}

function setCachedFilters(filters: FilterState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FILTERS_CACHE_KEY, JSON.stringify(filters));
  } catch {
    // Ignore storage errors
  }
}

function getSavedViews(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem(SAVED_VIEWS_KEY);
    if (!saved) return [];
    return JSON.parse(saved) as SavedView[];
  } catch {
    return [];
  }
}

function setSavedViews(views: SavedView[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function MyAdsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const adParam = searchParams?.get("ad") ?? null;
  const hasOpenedFromParam = useRef(false);
  const filtersInitialized = useRef(false);

  const [ads, setAds] = useState<MetaAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("created_desc");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectedAd, setSelectedAd] = useState<MetaAd | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [pendingStatusKeys, setPendingStatusKeys] = useState<Set<string>>(new Set());
  const pendingStatusKeysRef = useRef<Set<string>>(new Set());
  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [budgetUpdatingAdSetIds, setBudgetUpdatingAdSetIds] = useState<Set<string>>(new Set());
  const [bulkBudgetAmount, setBulkBudgetAmount] = useState("");
  const [bulkBudgetType, setBulkBudgetType] = useState<AdSetBudgetType>("daily");
  
  // Numeric filters
  const [spendFilter, setSpendFilter] = useState<NumericFilter | null>(null);
  const [leadsFilter, setLeadsFilter] = useState<NumericFilter | null>(null);
  const [callsFilter, setCallsFilter] = useState<NumericFilter | null>(null);
  
  // AI Analysis filter
  const [analyzedAdIds, setAnalyzedAdIds] = useState<Set<string>>(new Set());
  const [aiAnalysisFilter, setAiAnalysisFilter] = useState<string>("all");
  
  // Saved views
  const [savedViews, setSavedViewsState] = useState<SavedView[]>([]);
  const [saveViewName, setSaveViewName] = useState("");
  const [isSaveViewOpen, setIsSaveViewOpen] = useState(false);

  // Load filters and saved views from localStorage on mount
  useEffect(() => {
    if (filtersInitialized.current) return;
    filtersInitialized.current = true;
    
    const cachedFilters = getCachedFilters();
    if (cachedFilters) {
      setSearchQuery(cachedFilters.searchQuery);
      setStatusFilter(cachedFilters.statusFilter);
      setCampaignFilter(cachedFilters.campaignFilter);
      setSortBy(cachedFilters.sortBy);
      setDateFilter(cachedFilters.dateFilter);
      setSpendFilter(cachedFilters.spendFilter);
      setLeadsFilter(cachedFilters.leadsFilter);
      setCallsFilter(cachedFilters.callsFilter);
      setAiAnalysisFilter(cachedFilters.aiAnalysisFilter);
    }
    
    setSavedViewsState(getSavedViews());
  }, []);

  // Save filters to localStorage when they change
  useEffect(() => {
    if (!filtersInitialized.current) return;
    
    const currentFilters: FilterState = {
      searchQuery,
      statusFilter,
      campaignFilter,
      sortBy,
      dateFilter,
      spendFilter,
      leadsFilter,
      callsFilter,
      aiAnalysisFilter,
    };
    setCachedFilters(currentFilters);
  }, [searchQuery, statusFilter, campaignFilter, sortBy, dateFilter, spendFilter, leadsFilter, callsFilter, aiAnalysisFilter]);

  // Auto-open modal when ad param is present
  useEffect(() => {
    if (adParam && ads.length > 0 && !hasOpenedFromParam.current) {
      const matchedAd = ads.find((ad) => ad.name === adParam);
      if (matchedAd) {
        setSelectedAd(matchedAd);
        setIsModalOpen(true);
        hasOpenedFromParam.current = true;
      }
    }
  }, [adParam, ads]);

  const fetchAds = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getCachedAds();
      if (cached && isCacheValid(cached)) {
        setAds(cached.data.map(normalizeCachedAd));
        setLastFetched(new Date(cached.timestamp));
        setIsLoading(false);
        return;
      }
    }

    // Fetch from API
    try {
      const response = await fetch("/api/ads");
      const data = await response.json();

      if (!response.ok || data.error) {
        setError(data.error || "Failed to fetch ads");
        setAds([]);
      } else {
        const adsData = data.data || [];
        setAds(adsData);
        setCachedAds(adsData);
        setLastFetched(new Date());
      }
    } catch {
      setError("Failed to fetch ads. Please try again.");
      setAds([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAnalyzedAdIds = useCallback(async () => {
    try {
      const response = await fetch("/api/funnel-diagnostics?listAnalyzedIds=true");
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        setAnalyzedAdIds(new Set(data.data));
      }
    } catch {
      // Silently fail - just means we won't show analyzed badges
    }
  }, []);

  useEffect(() => {
    fetchAds(false);
    fetchAnalyzedAdIds();
  }, [fetchAds, fetchAnalyzedAdIds]);

  const campaigns = useMemo(() => {
    const uniqueCampaigns = new Map<string, string>();
    ads.forEach((ad) => {
      if (ad.campaign.id && ad.campaign.name) {
        uniqueCampaigns.set(ad.campaign.id, ad.campaign.name);
      }
    });
    return Array.from(uniqueCampaigns.entries()).map(([id, name]) => ({ id, name }));
  }, [ads]);

  // Get date cutoff based on filter
  const getDateCutoff = useCallback((filter: DateFilter): Date | null => {
    if (filter === "all") return null;
    const now = new Date();
    switch (filter) {
      case "7d":
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d":
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "90d":
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case "1y":
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  }, []);

  // Helper function to check numeric filter
  const checkNumericFilter = useCallback((value: number, filter: NumericFilter | null): boolean => {
    if (!filter) return true;
    switch (filter.operator) {
      case "gt":
        return value > filter.value;
      case "lt":
        return value < filter.value;
      case "gte":
        return value >= filter.value;
      case "lte":
        return value <= filter.value;
      default:
        return true;
    }
  }, []);

  const filteredAndSortedAds = useMemo(() => {
    const dateCutoff = getDateCutoff(dateFilter);
    
    // Filter
    const result = ads.filter((ad) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          ad.name.toLowerCase().includes(query) ||
          ad.campaign.name.toLowerCase().includes(query) ||
          ad.adset.name.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "active" && ad.effectiveStatus !== "ACTIVE") return false;
        if (statusFilter === "paused" && !["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"].includes(ad.effectiveStatus)) return false;
        if (statusFilter === "inactive" && ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"].includes(ad.effectiveStatus)) return false;
      }

      // Campaign filter
      if (campaignFilter !== "all" && ad.campaign.id !== campaignFilter) {
        return false;
      }

      // Date filter
      if (dateCutoff) {
        const adDate = new Date(ad.createdTime);
        if (adDate < dateCutoff) return false;
      }

      // Spend filter
      if (!checkNumericFilter(ad.metrics.spend, spendFilter)) return false;

      // Leads filter
      if (!checkNumericFilter(ad.metrics.leads, leadsFilter)) return false;

      // Calls filter
      if (!checkNumericFilter(ad.metrics.scheduleCalls, callsFilter)) return false;

      // AI Analysis filter
      if (aiAnalysisFilter !== "all") {
        const isAnalyzed = analyzedAdIds.has(ad.id);
        if (aiAnalysisFilter === "analyzed" && !isAnalyzed) return false;
        if (aiAnalysisFilter === "not_analyzed" && isAnalyzed) return false;
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "created_desc":
          return new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime();
        case "created_asc":
          return new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime();
        case "spend_desc":
          return b.metrics.spend - a.metrics.spend;
        case "spend_asc":
          return a.metrics.spend - b.metrics.spend;
        case "cpl_asc":
          // Ads with no leads go to the end
          if (a.metrics.costPerLead === 0 && b.metrics.costPerLead === 0) return 0;
          if (a.metrics.costPerLead === 0) return 1;
          if (b.metrics.costPerLead === 0) return -1;
          return a.metrics.costPerLead - b.metrics.costPerLead;
        case "cpl_desc":
          return b.metrics.costPerLead - a.metrics.costPerLead;
        case "cpc_asc":
          // Ads with no calls go to the end
          if (a.metrics.costPerCall === 0 && b.metrics.costPerCall === 0) return 0;
          if (a.metrics.costPerCall === 0) return 1;
          if (b.metrics.costPerCall === 0) return -1;
          return a.metrics.costPerCall - b.metrics.costPerCall;
        case "cpc_desc":
          return b.metrics.costPerCall - a.metrics.costPerCall;
        case "calls_desc":
          return b.metrics.scheduleCalls - a.metrics.scheduleCalls;
        case "leads_desc":
          return b.metrics.leads - a.metrics.leads;
        default:
          return 0;
      }
    });

    return result;
  }, [ads, searchQuery, statusFilter, campaignFilter, sortBy, dateFilter, getDateCutoff, spendFilter, leadsFilter, callsFilter, checkNumericFilter, aiAnalysisFilter, analyzedAdIds]);

  const handleAdClick = (ad: MetaAd) => {
    setSelectedAd(ad);
    setIsModalOpen(true);
  };

  const handleStatusToggle = useCallback(
    async (
      entityType: StatusEntityType,
      entityId: string,
      nextStatus: "ACTIVE" | "PAUSED"
    ) => {
      const pendingKey = `${entityType}:${entityId}`;
      if (pendingStatusKeysRef.current.has(pendingKey)) return;

      pendingStatusKeysRef.current.add(pendingKey);
      setPendingStatusKeys(new Set(pendingStatusKeysRef.current));

      let previousAds: MetaAd[] = [];
      setAds((prev) => {
        previousAds = prev;
        return prev.map((ad) => applyStatusToAd(ad, entityType, entityId, nextStatus));
      });
      setSelectedAd((prev) =>
        prev ? applyStatusToAd(prev, entityType, entityId, nextStatus) : prev
      );

      try {
        console.log("[My Ads] updating entity status…", { entityType, entityId, nextStatus });
        const response = await fetch("/api/ads/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType, entityId, status: nextStatus }),
        });
        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(data.error || "Failed to update status");
        }

        setAds((current) => {
          setCachedAds(current);
          return current;
        });

        toast.success(
          `${entityType === "adset" ? "Ad set" : entityType === "campaign" ? "Campaign" : "Ad"} ${nextStatus === "ACTIVE" ? "turned on" : "paused"}`
        );
      } catch (err) {
        setAds(previousAds);
        setSelectedAd((prev) => {
          if (!prev) return prev;
          const restored = previousAds.find((ad) => ad.id === prev.id);
          return restored || prev;
        });
        toast.error(err instanceof Error ? err.message : "Failed to update status");
      } finally {
        pendingStatusKeysRef.current.delete(pendingKey);
        setPendingStatusKeys(new Set(pendingStatusKeysRef.current));
      }
    },
    []
  );

  const handleSelectAd = useCallback((adId: string, selected: boolean) => {
    setSelectedAdIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(adId);
      } else {
        next.delete(adId);
      }
      return next;
    });
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedAdIds(new Set(filteredAndSortedAds.map((ad) => ad.id)));
  }, [filteredAndSortedAds]);

  const handleClearSelection = useCallback(() => {
    setSelectedAdIds(new Set());
  }, []);

  const handleBulkPause = useCallback(
    async (entityType: StatusEntityType) => {
      const targetAds =
        selectedAdIds.size > 0
          ? ads.filter((ad) => selectedAdIds.has(ad.id))
          : filteredAndSortedAds;

      if (targetAds.length === 0) {
        toast.error("No ads to pause");
        return;
      }

      const entitiesMap = new Map<string, { entityType: StatusEntityType; entityId: string }>();
      for (const ad of targetAds) {
        if (entityType === "ad" && ad.id) {
          entitiesMap.set(`ad:${ad.id}`, { entityType: "ad", entityId: ad.id });
        } else if (entityType === "adset" && ad.adset.id) {
          entitiesMap.set(`adset:${ad.adset.id}`, {
            entityType: "adset",
            entityId: ad.adset.id,
          });
        } else if (entityType === "campaign" && ad.campaign.id) {
          entitiesMap.set(`campaign:${ad.campaign.id}`, {
            entityType: "campaign",
            entityId: ad.campaign.id,
          });
        }
      }

      const entities = Array.from(entitiesMap.values());
      if (entities.length === 0) {
        toast.error("No entities found to pause");
        return;
      }

      const label =
        entityType === "adset" ? "ad sets" : entityType === "campaign" ? "campaigns" : "ads";
      const BATCH_SIZE = 50;

      setIsBulkUpdating(true);
      const previousAds = ads;

      for (const entity of entities) {
        pendingStatusKeysRef.current.add(`${entity.entityType}:${entity.entityId}`);
      }
      setPendingStatusKeys(new Set(pendingStatusKeysRef.current));

      setAds((prev) =>
        prev.map((ad) => {
          let updated = ad;
          for (const entity of entities) {
            updated = applyStatusToAd(updated, entity.entityType, entity.entityId, "PAUSED");
          }
          return updated;
        })
      );
      setSelectedAd((prev) => {
        if (!prev) return prev;
        let updated = prev;
        for (const entity of entities) {
          updated = applyStatusToAd(updated, entity.entityType, entity.entityId, "PAUSED");
        }
        return updated;
      });

      try {
        console.log("[My Ads] bulk pausing…", { entityType, count: entities.length });

        const succeeded: string[] = [];
        const failed: Array<{ entityId: string; entityType: string; error: string }> = [];

        for (let i = 0; i < entities.length; i += BATCH_SIZE) {
          const batch = entities.slice(i, i + BATCH_SIZE);
          console.log("[My Ads] pausing batch…", {
            batch: Math.floor(i / BATCH_SIZE) + 1,
            size: batch.length,
            total: entities.length,
          });

          const response = await fetch("/api/ads/status/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ entities: batch, status: "PAUSED" }),
          });
          const data = await response.json();

          if (!response.ok || data.error) {
            throw new Error(data.error || "Failed to bulk pause");
          }

          succeeded.push(...(data.data?.succeeded || []));
          failed.push(...(data.data?.failed || []));
        }

        if (failed.length > 0) {
          const failedIds = new Set(failed.map((f) => f.entityId));
          setAds((prev) =>
            prev.map((ad) => {
              const original = previousAds.find((a) => a.id === ad.id);
              if (!original) return ad;

              let updated = ad;
              if (entityType === "ad" && failedIds.has(ad.id)) {
                updated = { ...updated, status: original.status };
              }
              if (entityType === "adset" && failedIds.has(ad.adset.id)) {
                updated = {
                  ...updated,
                  adset: { ...updated.adset, status: original.adset.status },
                };
              }
              if (entityType === "campaign" && failedIds.has(ad.campaign.id)) {
                updated = {
                  ...updated,
                  campaign: { ...updated.campaign, status: original.campaign.status },
                };
              }
              return { ...updated, effectiveStatus: computeEffectiveStatus(updated) };
            })
          );
          setSelectedAd((prev) => {
            if (!prev) return prev;
            const original = previousAds.find((a) => a.id === prev.id);
            if (!original) return prev;
            let updated = prev;
            if (entityType === "ad" && failedIds.has(prev.id)) {
              updated = { ...updated, status: original.status };
            }
            if (entityType === "adset" && failedIds.has(prev.adset.id)) {
              updated = {
                ...updated,
                adset: { ...updated.adset, status: original.adset.status },
              };
            }
            if (entityType === "campaign" && failedIds.has(prev.campaign.id)) {
              updated = {
                ...updated,
                campaign: { ...updated.campaign, status: original.campaign.status },
              };
            }
            return { ...updated, effectiveStatus: computeEffectiveStatus(updated) };
          });
        }

        setAds((current) => {
          setCachedAds(current);
          return current;
        });

        if (failed.length === 0) {
          toast.success(`Paused ${succeeded.length} ${label}`);
        } else if (succeeded.length === 0) {
          toast.error(`Failed to pause ${label}`);
        } else {
          toast.warning(`Paused ${succeeded.length} ${label}, ${failed.length} failed`);
        }
      } catch (err) {
        setAds(previousAds);
        setSelectedAd((prev) => {
          if (!prev) return prev;
          return previousAds.find((ad) => ad.id === prev.id) || prev;
        });
        toast.error(err instanceof Error ? err.message : "Failed to bulk pause");
      } finally {
        for (const entity of entities) {
          pendingStatusKeysRef.current.delete(`${entity.entityType}:${entity.entityId}`);
        }
        setPendingStatusKeys(new Set(pendingStatusKeysRef.current));
        setIsBulkUpdating(false);
      }
    },
    [ads, filteredAndSortedAds, selectedAdIds]
  );

  const applyBudgetToAds = useCallback(
    (
      prev: MetaAd[],
      adSetId: string,
      budgetType: AdSetBudgetType,
      amount: number
    ): MetaAd[] =>
      prev.map((ad) => {
        if (ad.adset.id !== adSetId) return ad;
        return {
          ...ad,
          adset: {
            ...ad.adset,
            dailyBudget: budgetType === "daily" ? amount : ad.adset.dailyBudget,
            lifetimeBudget: budgetType === "lifetime" ? amount : ad.adset.lifetimeBudget,
          },
        };
      }),
    []
  );

  const handleBudgetUpdate = useCallback(
    async (adSetId: string, budgetType: AdSetBudgetType, amount: number) => {
      if (!adSetId || amount <= 0) return;
      if (budgetUpdatingAdSetIds.has(adSetId)) return;

      setBudgetUpdatingAdSetIds((prev) => new Set(prev).add(adSetId));
      let previousAds: MetaAd[] = [];
      setAds((prev) => {
        previousAds = prev;
        return applyBudgetToAds(prev, adSetId, budgetType, amount);
      });
      setSelectedAd((prev) => {
        if (!prev || prev.adset.id !== adSetId) return prev;
        return {
          ...prev,
          adset: {
            ...prev.adset,
            dailyBudget: budgetType === "daily" ? amount : prev.adset.dailyBudget,
            lifetimeBudget: budgetType === "lifetime" ? amount : prev.adset.lifetimeBudget,
          },
        };
      });

      try {
        console.log("[My Ads] updating ad set budget…", { adSetId, budgetType, amount });
        const response = await fetch("/api/ads/adsets/budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adSetId, budgetType, amount }),
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || "Failed to update budget");
        }
        setAds((current) => {
          setCachedAds(current);
          return current;
        });
        toast.success(
          `Updated ${budgetType} budget to $${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        );
      } catch (err) {
        setAds(previousAds);
        setSelectedAd((prev) => {
          if (!prev) return prev;
          return previousAds.find((ad) => ad.id === prev.id) || prev;
        });
        toast.error(err instanceof Error ? err.message : "Failed to update budget");
      } finally {
        setBudgetUpdatingAdSetIds((prev) => {
          const next = new Set(prev);
          next.delete(adSetId);
          return next;
        });
      }
    },
    [applyBudgetToAds, budgetUpdatingAdSetIds]
  );

  const handleBulkBudgetUpdate = useCallback(async () => {
    const amount = parseFloat(bulkBudgetAmount);
    if (!amount || amount <= 0 || Number.isNaN(amount)) {
      toast.error("Enter a valid budget greater than 0");
      return;
    }

    const targetAds =
      selectedAdIds.size > 0
        ? ads.filter((ad) => selectedAdIds.has(ad.id))
        : filteredAndSortedAds;

    const editableAdSetIds = Array.from(
      new Set(
        targetAds
          .filter(
            (ad) =>
              ad.adset.id &&
              (ad.adset.dailyBudget != null || ad.adset.lifetimeBudget != null)
          )
          .map((ad) => ad.adset.id)
      )
    );

    if (editableAdSetIds.length === 0) {
      toast.error("No ad sets with their own budget in the current selection");
      return;
    }

    // Prefer matching budget type; fall back to all editable
    const typedIds = editableAdSetIds.filter((id) => {
      const sample = targetAds.find((ad) => ad.adset.id === id);
      if (!sample) return false;
      return bulkBudgetType === "daily"
        ? sample.adset.dailyBudget != null
        : sample.adset.lifetimeBudget != null;
    });
    const idsToUpdate = typedIds.length > 0 ? typedIds : editableAdSetIds;

    setIsBulkUpdating(true);
    const previousAds = ads;
    setBudgetUpdatingAdSetIds((prev) => {
      const next = new Set(prev);
      idsToUpdate.forEach((id) => next.add(id));
      return next;
    });

    setAds((prev) => {
      let updated = prev;
      for (const adSetId of idsToUpdate) {
        updated = applyBudgetToAds(updated, adSetId, bulkBudgetType, amount);
      }
      return updated;
    });

    try {
      console.log("[My Ads] bulk updating ad set budgets…", {
        count: idsToUpdate.length,
        budgetType: bulkBudgetType,
        amount,
      });

      const BATCH_SIZE = 50;
      const succeeded: string[] = [];
      const failed: Array<{ adSetId: string; error: string }> = [];

      for (let i = 0; i < idsToUpdate.length; i += BATCH_SIZE) {
        const batch = idsToUpdate.slice(i, i + BATCH_SIZE);
        const response = await fetch("/api/ads/adsets/budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adSetIds: batch,
            budgetType: bulkBudgetType,
            amount,
          }),
        });
        const data = await response.json();
        if (!response.ok || data.error) {
          throw new Error(data.error || "Failed to update budgets");
        }
        succeeded.push(...(data.data?.succeeded || []));
        failed.push(...(data.data?.failed || []));
      }

      if (failed.length > 0) {
        const failedIds = new Set(failed.map((f) => f.adSetId));
        setAds((prev) =>
          prev.map((ad) => {
            if (!failedIds.has(ad.adset.id)) return ad;
            const original = previousAds.find((a) => a.id === ad.id);
            return original || ad;
          })
        );
      }

      setAds((current) => {
        setCachedAds(current);
        return current;
      });

      if (failed.length === 0) {
        toast.success(
          `Updated ${succeeded.length} ad set ${bulkBudgetType} budgets to $${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
        );
      } else if (succeeded.length === 0) {
        toast.error("Failed to update ad set budgets");
      } else {
        toast.warning(`Updated ${succeeded.length} budgets, ${failed.length} failed`);
      }
    } catch (err) {
      setAds(previousAds);
      toast.error(err instanceof Error ? err.message : "Failed to update budgets");
    } finally {
      setBudgetUpdatingAdSetIds((prev) => {
        const next = new Set(prev);
        idsToUpdate.forEach((id) => next.delete(id));
        return next;
      });
      setIsBulkUpdating(false);
    }
  }, [
    ads,
    applyBudgetToAds,
    bulkBudgetAmount,
    bulkBudgetType,
    filteredAndSortedAds,
    selectedAdIds,
  ]);

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAd(null);
    // Clear the ad param from URL if present
    if (adParam) {
      router.replace("/dashboard/ads/my-ads", { scroll: false });
    }
  };

  // View management functions
  const getCurrentFilters = useCallback((): FilterState => ({
    searchQuery,
    statusFilter,
    campaignFilter,
    sortBy,
    dateFilter,
    spendFilter,
    leadsFilter,
    callsFilter,
    aiAnalysisFilter,
  }), [searchQuery, statusFilter, campaignFilter, sortBy, dateFilter, spendFilter, leadsFilter, callsFilter, aiAnalysisFilter]);

  const applyFilters = useCallback((filters: FilterState) => {
    setSearchQuery(filters.searchQuery);
    setStatusFilter(filters.statusFilter);
    setCampaignFilter(filters.campaignFilter);
    setSortBy(filters.sortBy);
    setDateFilter(filters.dateFilter);
    setSpendFilter(filters.spendFilter);
    setLeadsFilter(filters.leadsFilter);
    setCallsFilter(filters.callsFilter);
    setAiAnalysisFilter(filters.aiAnalysisFilter);
  }, []);

  const handleSaveView = () => {
    if (!saveViewName.trim()) {
      toast.error("Please enter a name for this view");
      return;
    }
    
    const newView: SavedView = {
      id: Date.now().toString(),
      name: saveViewName.trim(),
      filters: getCurrentFilters(),
      createdAt: Date.now(),
    };
    
    const updatedViews = [...savedViews, newView];
    setSavedViewsState(updatedViews);
    setSavedViews(updatedViews);
    setSaveViewName("");
    setIsSaveViewOpen(false);
    toast.success(`View "${newView.name}" saved`);
  };

  const handleLoadView = (view: SavedView) => {
    applyFilters(view.filters);
    toast.success(`View "${view.name}" loaded`);
  };

  const handleDeleteView = (viewId: string) => {
    const view = savedViews.find(v => v.id === viewId);
    const updatedViews = savedViews.filter(v => v.id !== viewId);
    setSavedViewsState(updatedViews);
    setSavedViews(updatedViews);
    if (view) {
      toast.success(`View "${view.name}" deleted`);
    }
  };

  const handleClearFilters = () => {
    applyFilters(DEFAULT_FILTERS);
    toast.success("Filters cleared");
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || campaignFilter !== "all" || dateFilter !== "all" || sortBy !== "created_desc" || spendFilter !== null || leadsFilter !== null || callsFilter !== null || aiAnalysisFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          {/* Row 1: Search, Views, and Refresh */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary-400" />
              <Input
                placeholder="Search ads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Saved Views Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Bookmark className="size-4" />
                  <span className="hidden sm:inline">Views</span>
                  {savedViews.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0">
                      {savedViews.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {savedViews.length > 0 ? (
                  <>
                    {savedViews.map((view) => (
                      <DropdownMenuItem
                        key={view.id}
                        className="flex items-center justify-between"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <button
                          className="flex-1 text-left"
                          onClick={() => handleLoadView(view)}
                        >
                          {view.name}
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteView(view.id);
                          }}
                        >
                          <Trash2 className="size-3 text-secondary-400 hover:text-danger-500" />
                        </Button>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                ) : (
                  <div className="px-2 py-3 text-center text-sm text-secondary-500">
                    No saved views yet
                  </div>
                )}
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  {isSaveViewOpen ? (
                    <div className="flex w-full items-center gap-2">
                      <Input
                        placeholder="View name..."
                        value={saveViewName}
                        onChange={(e) => setSaveViewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSaveView();
                          }
                          if (e.key === "Escape") {
                            setIsSaveViewOpen(false);
                            setSaveViewName("");
                          }
                        }}
                        className="h-8 flex-1"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={handleSaveView}
                        disabled={!saveViewName.trim()}
                      >
                        <Save className="size-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2"
                        onClick={() => {
                          setIsSaveViewOpen(false);
                          setSaveViewName("");
                        }}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      className="flex w-full items-center gap-2 text-primary-600"
                      onClick={() => setIsSaveViewOpen(true)}
                    >
                      <Save className="size-4" />
                      Save current view
                    </button>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchAds(true)}
              disabled={isLoading}
              title="Refresh ads (bypass cache)"
            >
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Row 2: Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Campaign" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger className="w-full sm:w-40">
                <Calendar className="mr-2 size-4" />
                <SelectValue placeholder="Date Created" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
                <SelectItem value="1y">Last Year</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-full sm:w-48">
                <ArrowUpDown className="mr-2 size-4" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_desc">Newest First</SelectItem>
                <SelectItem value="created_asc">Oldest First</SelectItem>
                <SelectItem value="calls_desc">Most Calls</SelectItem>
                <SelectItem value="leads_desc">Most Leads</SelectItem>
                <SelectItem value="spend_desc">Spend: High to Low</SelectItem>
                <SelectItem value="spend_asc">Spend: Low to High</SelectItem>
                <SelectItem value="cpl_asc">CPL: Low to High</SelectItem>
                <SelectItem value="cpl_desc">CPL: High to Low</SelectItem>
                <SelectItem value="cpc_asc">Cost/Call: Low to High</SelectItem>
                <SelectItem value="cpc_desc">Cost/Call: High to Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={aiAnalysisFilter} onValueChange={setAiAnalysisFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <Microscope className="mr-2 size-4" />
                <SelectValue placeholder="AI Analysis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ads</SelectItem>
                <SelectItem value="analyzed">AI Analyzed</SelectItem>
                <SelectItem value="not_analyzed">Not Analyzed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row 3: Numeric Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-secondary-500">Spend</span>
              <NumericFilterInput
                label="Amount"
                value={spendFilter}
                onChange={setSpendFilter}
                prefix="$"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-secondary-500">Leads</span>
              <NumericFilterInput
                label="Count"
                value={leadsFilter}
                onChange={setLeadsFilter}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-secondary-500">Calls</span>
              <NumericFilterInput
                label="Count"
                value={callsFilter}
                onChange={setCallsFilter}
              />
            </div>
          </div>
        </div>

        {/* Results count and clear filters */}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!isLoading && !error && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-secondary-500">
                Showing {filteredAndSortedAds.length} of {ads.length} ads
              </p>
              {lastFetched && (
                <p className="text-xs text-secondary-400">
                  Last updated: {lastFetched.toLocaleString()}
                </p>
              )}
            </div>
          )}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-xs"
            >
              Clear all filters
            </Button>
          )}
        </div>

        {!isLoading && !error && filteredAndSortedAds.length > 0 && (
          <div className="mt-3 flex flex-col gap-3 rounded border border-secondary-200 bg-secondary-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    filteredAndSortedAds.length > 0 &&
                    filteredAndSortedAds.every((ad) => selectedAdIds.has(ad.id))
                  }
                  onCheckedChange={(checked) => {
                    if (checked === true) {
                      handleSelectAllFiltered();
                    } else {
                      handleClearSelection();
                    }
                  }}
                  aria-label="Select all visible ads"
                />
                <span className="text-sm text-secondary-700">
                  {selectedAdIds.size > 0
                    ? `${selectedAdIds.size} selected`
                    : "Select ads"}
                </span>
              </div>
              {selectedAdIds.size > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                  Clear
                </Button>
              )}
              <p className="text-xs text-secondary-500">
                {selectedAdIds.size > 0
                  ? "Bulk actions apply to selected ads"
                  : "Bulk actions apply to all filtered ads"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={isBulkUpdating}
                onClick={() => handleBulkPause("ad")}
              >
                {isBulkUpdating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Pause className="mr-2 size-4" />
                )}
                Pause Ads
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isBulkUpdating}
                onClick={() => handleBulkPause("adset")}
              >
                {isBulkUpdating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Pause className="mr-2 size-4" />
                )}
                Pause Ad Sets
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isBulkUpdating}
                onClick={() => handleBulkPause("campaign")}
              >
                {isBulkUpdating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Pause className="mr-2 size-4" />
                )}
                Pause Campaigns
              </Button>
              <div className="flex items-center gap-1.5 border-l border-secondary-200 pl-2">
                <Select
                  value={bulkBudgetType}
                  onValueChange={(v) => setBulkBudgetType(v as AdSetBudgetType)}
                  disabled={isBulkUpdating}
                >
                  <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="lifetime">Lifetime</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-secondary-500">$</span>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="Budget"
                    value={bulkBudgetAmount}
                    onChange={(e) => setBulkBudgetAmount(e.target.value)}
                    disabled={isBulkUpdating}
                    className="h-8 w-24 text-sm"
                    aria-label="Bulk ad set budget"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isBulkUpdating}
                  onClick={handleBulkBudgetUpdate}
                >
                  {isBulkUpdating ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <DollarSign className="mr-2 size-4" />
                  )}
                  Set Ad Set Budget
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {error && (
        <Card className="p-6">
          <div className="flex items-center gap-3 text-danger-600">
            <AlertCircle className="size-5" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <AdCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!isLoading && !error && filteredAndSortedAds.length === 0 && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <ImageIcon className="size-12 text-secondary-300" />
            <h3 className="mt-4 text-lg font-semibold text-secondary-900">No ads found</h3>
            <p className="mt-2 text-secondary-500">
              {ads.length === 0
                ? "No ads have been created yet."
                : "Try adjusting your filters to see more results."}
            </p>
          </div>
        </Card>
      )}

      {!isLoading && !error && filteredAndSortedAds.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedAds.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              onClick={() => handleAdClick(ad)}
              isAnalyzed={analyzedAdIds.has(ad.id)}
              isSelected={selectedAdIds.has(ad.id)}
              onSelectChange={handleSelectAd}
              pendingKeys={pendingStatusKeys}
              onStatusToggle={handleStatusToggle}
              onBudgetUpdate={handleBudgetUpdate}
              isBudgetUpdating={budgetUpdatingAdSetIds.has(ad.adset.id)}
            />
          ))}
        </div>
      )}

      <AdDetailModal
        ad={selectedAd}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onDiagnosticComplete={fetchAnalyzedAdIds}
        pendingKeys={pendingStatusKeys}
        onStatusToggle={handleStatusToggle}
        onBudgetUpdate={handleBudgetUpdate}
        isBudgetUpdating={
          selectedAd ? budgetUpdatingAdSetIds.has(selectedAd.adset.id) : false
        }
      />
    </div>
  );
}
