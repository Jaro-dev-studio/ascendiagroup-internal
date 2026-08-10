"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Phone,
  FileSpreadsheet,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ChevronRight,
  Building2,
  ListTodo,
  MessageSquarePlus,
  ArrowRight,
  Target,
  ChevronDown,
  CircleDollarSign,
  PhoneCall,
  UserX,
  FileText,
  Calendar,
  CalendarClock,
} from "lucide-react";
import type { CompanyStatus, TaskStatus, TaskPriority, RequestType } from "@prisma/client";
import type { TimePeriod, MetaAd } from "@/lib/integrations/meta";
import type { UpcomingCallsSummary } from "@/lib/fetchers";

// ============================================================================
// Types
// ============================================================================

interface CompanyData {
  id: string;
  name: string;
  status: CompanyStatus;
  createdAt: Date;
}

interface TaskData {
  id: string;
  name: string;
  status: TaskStatus;
  priority: TaskPriority;
  updatedAt: Date;
  clientCompany: {
    id: string;
    name: string;
  };
}

interface ActionItemData {
  id: string;
  name: string;
  status: TaskStatus;
  priority: TaskPriority;
  clientCompany: {
    id: string;
    name: string;
  };
}

interface RequestData {
  id: string;
  title: string;
  status: string;
  type: RequestType;
  priority: TaskPriority;
  clientCompany: {
    id: string;
    name: string;
  };
}

interface FormSubmissionData {
  id: string;
  createdAt: Date;
  name: string;
  email: string;
  type: string;
  utmSource: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
}

interface OverviewClientProps {
  clientCompanies: CompanyData[];
  tasks: TaskData[];
  actionItems: ActionItemData[];
  requests: RequestData[];
  formSubmissions: FormSubmissionData[];
  upcomingCalls: UpcomingCallsSummary | null;
}

interface FunnelMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  scheduleCalls: number;
  costPerCall: number;
  ctr: number;
  clickToLeadRate: number;
  leadToCallRate: number;
}

// ============================================================================
// Constants
// ============================================================================

type OverviewTimePeriod = "7d" | "30d" | "90d" | "1y";

const PERIOD_LABELS: Record<OverviewTimePeriod, string> = {
  "7d": "Last 7 Days",
  "30d": "Last 30 Days",
  "90d": "Last 90 Days",
  "1y": "Last Year",
};

const PERIOD_DAYS: Record<OverviewTimePeriod, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

// Map to Meta API time periods
const META_PERIOD_MAP: Record<OverviewTimePeriod, TimePeriod> = {
  "7d": "7d",
  "30d": "30d",
  "90d": "3m",
  "1y": "1y",
};

// Benchmark conversion rates
const BENCHMARK_RATES = {
  clickRate: 1.5,
  leadRate: 3,
  scheduleRate: 75,
};

const clientStatusConfig: Record<CompanyStatus, { label: string; className: string; icon: typeof CircleDollarSign }> = {
  FORM_SUBMITTED: { label: "Form Submitted", className: "bg-secondary-100 text-secondary-700", icon: FileText },
  CALL_BOOKED: { label: "Call Booked", className: "bg-primary-100 text-primary-700", icon: Calendar },
  NO_SHOW: { label: "No Show", className: "bg-destructive-100 text-destructive-700", icon: XCircle },
  ATTENDED_SALES_CALL: { label: "Sales Call", className: "bg-warning-100 text-warning-700", icon: PhoneCall },
  PURCHASED: { label: "Active", className: "bg-success-100 text-success-700", icon: CircleDollarSign },
  LOST: { label: "Lost", className: "bg-secondary-100 text-secondary-600", icon: XCircle },
  CHURNED: { label: "Churned", className: "bg-secondary-100 text-secondary-600", icon: UserX },
};

// ============================================================================
// Helper Functions
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

function formatCompactNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return formatNumber(value);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getDateRange(period: OverviewTimePeriod): { since: Date; until: Date } {
  const now = new Date();
  const daysAgo = PERIOD_DAYS[period];
  const since = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  return { since, until: now };
}

function isWithinPeriod(date: Date, period: OverviewTimePeriod): boolean {
  const { since } = getDateRange(period);
  return new Date(date) >= since;
}

function getDaysSince(date: Date): number {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatCallTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatNextCallLabel(date: Date): string {
  const startTime = new Date(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (startTime.toDateString() === tomorrow.toDateString()) {
    return `Next tomorrow at ${formatCallTime(startTime)}`;
  }

  const dayLabel = startTime.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `Next ${dayLabel} at ${formatCallTime(startTime)}`;
}

// ============================================================================
// Components
// ============================================================================

interface KPICardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  isLoading?: boolean;
  href?: string;
}

function KPICard({ title, value, subValue, icon, trend, isLoading, href }: KPICardProps) {
  const content = (
    <Card className={`p-6 ${href ? "cursor-pointer transition-shadow hover:shadow-md" : ""}`}>
      {isLoading ? (
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-32" />
            {subValue && <Skeleton className="mt-1 h-4 w-20" />}
          </div>
          <Skeleton className="size-12 rounded-lg" />
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-secondary-500">{title}</p>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-3xl font-bold text-secondary-900">{value}</p>
              {trend && trend !== "neutral" && (
                <span className={`flex items-center text-sm font-medium ${
                  trend === "up" ? "text-success-600" : "text-danger-600"
                }`}>
                  {trend === "up" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                </span>
              )}
            </div>
            {subValue && (
              <p className="mt-1 text-sm text-secondary-500">{subValue}</p>
            )}
          </div>
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary-50">
            {icon}
          </div>
        </div>
      )}
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

interface AlertCardProps {
  title: string;
  count: number;
  description: string;
  icon: React.ReactNode;
  variant: "danger" | "warning" | "info";
  href?: string;
  items?: Array<{ id: string; name: string; meta?: string }>;
}

function AlertCard({ title, count, description, icon, variant, href, items }: AlertCardProps) {
  const variantStyles = {
    danger: "border-danger-200 bg-danger-50",
    warning: "border-warning-200 bg-warning-50",
    info: "border-primary-200 bg-primary-50",
  };

  const iconStyles = {
    danger: "bg-danger-100 text-danger-600",
    warning: "bg-warning-100 text-warning-600",
    info: "bg-primary-100 text-primary-600",
  };

  const content = (
    <Card className={`border ${variantStyles[variant]} p-4 ${href ? "cursor-pointer transition-shadow hover:shadow-md" : ""}`}>
      <div className="flex items-start gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconStyles[variant]}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-secondary-900">{title}</h3>
            <Badge variant="secondary" className="font-bold">
              {count}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-secondary-600">{description}</p>
          {items && items.length > 0 && (
            <div className="mt-2 space-y-1">
              {items.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center gap-1 text-xs text-secondary-600">
                  <ChevronRight className="size-3" />
                  <span className="truncate">{item.name}</span>
                  {item.meta && <span className="text-secondary-400">({item.meta})</span>}
                </div>
              ))}
              {items.length > 3 && (
                <p className="text-xs text-secondary-400">+{items.length - 3} more</p>
              )}
            </div>
          )}
        </div>
        {href && <ChevronRight className="size-5 shrink-0 text-secondary-400" />}
      </div>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

interface FunnelStageProps {
  label: string;
  value: number;
  rate: number | null;
  gradient: string;
  benchmarkRate?: number;
  isLast?: boolean;
}

function FunnelStage({ label, value, rate, gradient, benchmarkRate, isLast }: FunnelStageProps) {
  const isAboveBenchmark = benchmarkRate !== undefined && rate !== null && rate >= benchmarkRate;
  const isBelowBenchmark = benchmarkRate !== undefined && rate !== null && rate < benchmarkRate;

  return (
    <div className="flex flex-col items-center">
      <motion.div
        className={`flex w-full flex-col items-center justify-center rounded-lg bg-gradient-to-r ${gradient} px-4 py-3 text-white shadow-md`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</span>
        <span className="text-xl font-bold">{formatCompactNumber(value)}</span>
        {rate !== null && (
          <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
            isAboveBenchmark ? "bg-success-500" :
              isBelowBenchmark ? "bg-danger-500" :
                "bg-white/20"
          }`}>
            {formatPercentage(rate)}
          </span>
        )}
      </motion.div>
      {!isLast && (
        <motion.div
          className="py-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <ChevronDown className="size-4 text-secondary-300" />
        </motion.div>
      )}
    </div>
  );
}

interface AdPerformanceCardProps {
  title: string;
  ad: MetaAd | null;
  isLoading: boolean;
  variant: "best" | "worst";
}

function AdPerformanceCard({ title, ad, isLoading, variant }: AdPerformanceCardProps) {
  const variantStyles = {
    best: "border-success-200 bg-success-50",
    worst: "border-danger-200 bg-danger-50",
  };

  if (isLoading) {
    return (
      <Card className={`border ${variantStyles[variant]} p-4`}>
        <Skeleton className="mb-2 h-4 w-32" />
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  if (!ad) {
    return (
      <Card className={`border ${variantStyles[variant]} p-4`}>
        <p className="text-sm font-medium text-secondary-500">{title}</p>
        <p className="mt-2 text-sm text-secondary-400">No ads with data</p>
      </Card>
    );
  }

  return (
    <Card className={`border ${variantStyles[variant]} p-4`}>
      <p className="text-sm font-medium text-secondary-500">{title}</p>
      <div className="mt-2 flex gap-3">
        {ad.creative.imageUrl && (
          <img
            src={ad.creative.imageUrl}
            alt={ad.name}
            className="size-16 rounded-md object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-secondary-900">{ad.name}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-secondary-600">
            <span>{formatCurrency(ad.metrics.spend)} spent</span>
            <span>{ad.metrics.scheduleCalls} calls</span>
            {ad.metrics.costPerCall > 0 && (
              <span className="font-medium">{formatCurrency(ad.metrics.costPerCall)}/call</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function OverviewClient({
  clientCompanies,
  tasks,
  actionItems,
  requests,
  formSubmissions,
  upcomingCalls,
}: OverviewClientProps) {
  const [timePeriod, setTimePeriod] = useState<OverviewTimePeriod>("30d");
  const [isLoadingAds, setIsLoadingAds] = useState(true);
  const [adsData, setAdsData] = useState<MetaAd[]>([]);
  const [adsError, setAdsError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch ads data from API
  const fetchAds = useCallback(async (_forceRefresh = false) => {
    setIsLoadingAds(true);
    setAdsError(null);
    try {
      const metaPeriod = META_PERIOD_MAP[timePeriod];
      const response = await fetch(`/api/ads?period=${metaPeriod}`);
      const data = await response.json();
      if (response.ok && data.data) {
        setAdsData(data.data);
        setLastUpdated(new Date());
      } else {
        setAdsError(data.error || "Failed to fetch ads");
      }
    } catch (error) {
      console.error("Error fetching ads:", error);
      setAdsError("Failed to fetch ads");
    } finally {
      setIsLoadingAds(false);
    }
  }, [timePeriod]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  // Calculate funnel metrics from ads data
  const funnelMetrics = useMemo((): FunnelMetrics | null => {
    if (adsData.length === 0) return null;

    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalLeads = 0;
    let totalScheduleCalls = 0;

    for (const ad of adsData) {
      totalSpend += ad.metrics.spend;
      totalImpressions += ad.metrics.impressions;
      totalClicks += ad.metrics.clicks;
      totalLeads += ad.metrics.leads;
      totalScheduleCalls += ad.metrics.scheduleCalls;
    }

    return {
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      leads: totalLeads,
      scheduleCalls: totalScheduleCalls,
      costPerCall: totalScheduleCalls > 0 ? totalSpend / totalScheduleCalls : 0,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      clickToLeadRate: totalClicks > 0 ? (totalLeads / totalClicks) * 100 : 0,
      leadToCallRate: totalLeads > 0 ? (totalScheduleCalls / totalLeads) * 100 : 0,
    };
  }, [adsData]);

  // Calculate form submissions for period
  const formSubmissionsInPeriod = useMemo(() => {
    return formSubmissions.filter((s) => isWithinPeriod(s.createdAt, timePeriod));
  }, [formSubmissions, timePeriod]);

  // Client counts by status
  const clientCounts = useMemo(() => {
    const counts: Record<CompanyStatus, number> = {
      FORM_SUBMITTED: 0,
      CALL_BOOKED: 0,
      NO_SHOW: 0,
      ATTENDED_SALES_CALL: 0,
      PURCHASED: 0,
      LOST: 0,
      CHURNED: 0,
    };
    for (const client of clientCompanies) {
      counts[client.status]++;
    }
    return counts;
  }, [clientCompanies]);

  // Blocked tasks
  const blockedTasks = useMemo(() => {
    return tasks.filter((t) => t.status === "BLOCKED");
  }, [tasks]);

  const blockedTasksOver3Days = useMemo(() => {
    return blockedTasks.filter((t) => getDaysSince(t.updatedAt) > 3);
  }, [blockedTasks]);

  // Pending action items (not DONE, not TODO yet started)
  const pendingActionItems = useMemo(() => {
    return actionItems.filter((a) => a.status !== "DONE" && a.status !== "TODO");
  }, [actionItems]);

  // Pending requests (SUBMITTED status)
  const pendingRequests = requests;

  // Identify funnel bottlenecks
  const funnelBottlenecks = useMemo(() => {
    if (!funnelMetrics) return [];

    const bottlenecks: Array<{ stage: string; rate: number; benchmark: number; gap: number }> = [];

    if (funnelMetrics.ctr < BENCHMARK_RATES.clickRate) {
      bottlenecks.push({
        stage: "Click Rate",
        rate: funnelMetrics.ctr,
        benchmark: BENCHMARK_RATES.clickRate,
        gap: BENCHMARK_RATES.clickRate - funnelMetrics.ctr,
      });
    }

    if (funnelMetrics.clickToLeadRate < BENCHMARK_RATES.leadRate) {
      bottlenecks.push({
        stage: "Lead Rate",
        rate: funnelMetrics.clickToLeadRate,
        benchmark: BENCHMARK_RATES.leadRate,
        gap: BENCHMARK_RATES.leadRate - funnelMetrics.clickToLeadRate,
      });
    }

    if (funnelMetrics.leadToCallRate < BENCHMARK_RATES.scheduleRate) {
      bottlenecks.push({
        stage: "Schedule Rate",
        rate: funnelMetrics.leadToCallRate,
        benchmark: BENCHMARK_RATES.scheduleRate,
        gap: BENCHMARK_RATES.scheduleRate - funnelMetrics.leadToCallRate,
      });
    }

    return bottlenecks.sort((a, b) => b.gap - a.gap);
  }, [funnelMetrics]);

  // Best and worst performing ads (by cost per call, minimum 1 call)
  const { bestAd, worstAd } = useMemo(() => {
    const adsWithCalls = adsData.filter((ad) => ad.metrics.scheduleCalls > 0);
    if (adsWithCalls.length === 0) return { bestAd: null, worstAd: null };

    const sorted = [...adsWithCalls].sort((a, b) => a.metrics.costPerCall - b.metrics.costPerCall);
    return {
      bestAd: sorted[0] || null,
      worstAd: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    };
  }, [adsData]);

  // Upcoming calls context line: today's load when relevant, otherwise the next call
  const upcomingCallsSubValue = useMemo(() => {
    if (!upcomingCalls?.nextCallStartTime || upcomingCalls.totalCount === 0) {
      return "None scheduled";
    }
    if (upcomingCalls.todayCount > 0) {
      return `${upcomingCalls.todayCount} today · next at ${formatCallTime(upcomingCalls.nextCallStartTime)}`;
    }
    return formatNextCallLabel(upcomingCalls.nextCallStartTime);
  }, [upcomingCalls]);

  // Sales calls attended (client companies with ATTENDED_SALES_CALL status created in this period)
  const salesCallsAttended = useMemo(() => {
    return clientCompanies.filter((c) => {
      if (c.status !== "ATTENDED_SALES_CALL") return false;
      return isWithinPeriod(c.createdAt, timePeriod);
    }).length;
  }, [clientCompanies, timePeriod]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Overview</h1>
          <p className="text-secondary-600">CEO-level business summary</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as OverviewTimePeriod)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchAds(true)}
            disabled={isLoadingAds}
            title="Refresh data"
          >
            <RefreshCw className={`size-4 ${isLoadingAds ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs text-secondary-500">
          Ad data updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* Primary KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Upcoming Calls"
          value={upcomingCalls?.totalCount ?? 0}
          subValue={upcomingCallsSubValue}
          icon={<CalendarClock className="size-6 text-primary-600" />}
          href="/dashboard/upcoming-calls"
        />
        <KPICard
          title="Cost per Call"
          value={isLoadingAds ? "-" : funnelMetrics ? formatCurrency(funnelMetrics.costPerCall) : "$0.00"}
          subValue={funnelMetrics ? `${formatCurrency(funnelMetrics.spend)} total spend` : undefined}
          icon={<Phone className="size-6 text-primary-600" />}
          isLoading={isLoadingAds}
          href="/dashboard/live-funnel"
        />
        <KPICard
          title="Form Submissions"
          value={formSubmissionsInPeriod.length}
          subValue={`${PERIOD_LABELS[timePeriod]}`}
          icon={<FileSpreadsheet className="size-6 text-primary-600" />}
          href="/dashboard/submissions"
        />
        <KPICard
          title="Active Clients"
          value={clientCounts.PURCHASED}
          subValue={`${clientCounts.ATTENDED_SALES_CALL} in pipeline`}
          icon={<Building2 className="size-6 text-primary-600" />}
          href="/dashboard/clients"
        />
      </div>

      {/* Alerts Section */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-secondary-900">Needs Attention</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {blockedTasksOver3Days.length > 0 && (
            <AlertCard
              title="Blocked Tasks > 3 Days"
              count={blockedTasksOver3Days.length}
              description="Tasks stuck and need immediate action"
              icon={<AlertTriangle className="size-5" />}
              variant="danger"
              href="/dashboard/tasks?status=BLOCKED"
              items={blockedTasksOver3Days.map((t) => ({
                id: t.id,
                name: t.name,
                meta: `${getDaysSince(t.updatedAt)}d`,
              }))}
            />
          )}
          {blockedTasks.length > 0 && (
            <AlertCard
              title="Total Blocked Tasks"
              count={blockedTasks.length}
              description="All currently blocked tasks"
              icon={<Clock className="size-5" />}
              variant="warning"
              href="/dashboard/tasks?status=BLOCKED"
              items={blockedTasks.slice(0, 5).map((t) => ({
                id: t.id,
                name: t.name,
                meta: t.clientCompany.name,
              }))}
            />
          )}
          {pendingActionItems.length > 0 && (
            <AlertCard
              title="Pending Action Items"
              count={pendingActionItems.length}
              description="Waiting on client action"
              icon={<ListTodo className="size-5" />}
              variant="warning"
              href="/dashboard/action-items"
              items={pendingActionItems.slice(0, 5).map((a) => ({
                id: a.id,
                name: a.name,
                meta: a.clientCompany.name,
              }))}
            />
          )}
          {pendingRequests.length > 0 && (
            <AlertCard
              title="Pending Requests"
              count={pendingRequests.length}
              description="Awaiting review"
              icon={<MessageSquarePlus className="size-5" />}
              variant="info"
              href="/dashboard/feature-requests"
              items={pendingRequests.slice(0, 5).map((r) => ({
                id: r.id,
                name: r.title,
                meta: r.clientCompany.name,
              }))}
            />
          )}
          {funnelBottlenecks.length > 0 && (
            <AlertCard
              title="Funnel Bottlenecks"
              count={funnelBottlenecks.length}
              description="Below benchmark conversion rates"
              icon={<TrendingDown className="size-5" />}
              variant="warning"
              href="/dashboard/live-funnel"
              items={funnelBottlenecks.map((b, idx) => ({
                id: `bottleneck-${idx}`,
                name: b.stage,
                meta: `${formatPercentage(b.rate)} vs ${formatPercentage(b.benchmark)}`,
              }))}
            />
          )}
          {blockedTasksOver3Days.length === 0 && blockedTasks.length === 0 && pendingActionItems.length === 0 && pendingRequests.length === 0 && funnelBottlenecks.length === 0 && (
            <Card className="col-span-full border-success-200 bg-success-50 p-6 text-center">
              <CheckCircle2 className="mx-auto size-8 text-success-600" />
              <p className="mt-2 font-medium text-success-700">All clear! No items need attention.</p>
            </Card>
          )}
        </div>
      </div>

      {/* Funnel Visualization */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-secondary-900">Sales Funnel</h2>
        <Card className="p-6">
          {isLoadingAds ? (
            <div className="flex justify-center py-8">
              <div className="flex flex-col items-center gap-4">
                <RefreshCw className="size-8 animate-spin text-primary-500" />
                <p className="text-sm text-secondary-500">Loading funnel data...</p>
              </div>
            </div>
          ) : adsError ? (
            <div className="py-8 text-center">
              <XCircle className="mx-auto size-8 text-danger-500" />
              <p className="mt-2 text-sm text-danger-600">{adsError}</p>
            </div>
          ) : funnelMetrics ? (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
              {/* Funnel visualization */}
              <div className="flex flex-1 flex-col items-center gap-1">
                <FunnelStage
                  label="Impressions"
                  value={funnelMetrics.impressions}
                  rate={null}
                  gradient="from-primary-600 to-primary-500"
                />
                <FunnelStage
                  label="Clicks"
                  value={funnelMetrics.clicks}
                  rate={funnelMetrics.ctr}
                  gradient="from-primary-500 to-primary-400"
                  benchmarkRate={BENCHMARK_RATES.clickRate}
                />
                <FunnelStage
                  label="Leads"
                  value={funnelMetrics.leads}
                  rate={funnelMetrics.clickToLeadRate}
                  gradient="from-primary-400 to-primary-300"
                  benchmarkRate={BENCHMARK_RATES.leadRate}
                />
                <FunnelStage
                  label="Calls Scheduled"
                  value={funnelMetrics.scheduleCalls}
                  rate={funnelMetrics.leadToCallRate}
                  gradient="from-success-500 to-success-400"
                  benchmarkRate={BENCHMARK_RATES.scheduleRate}
                />
                <FunnelStage
                  label="Calls Attended"
                  value={salesCallsAttended}
                  rate={funnelMetrics.scheduleCalls > 0 ? (salesCallsAttended / funnelMetrics.scheduleCalls) * 100 : null}
                  gradient="from-success-600 to-success-500"
                  isLast
                />
              </div>

              {/* Key metrics sidebar */}
              <div className="flex flex-col gap-4 lg:w-64">
                <div className="rounded-lg bg-secondary-50 p-4">
                  <p className="text-sm font-medium text-secondary-500">Total Spend</p>
                  <p className="text-2xl font-bold text-secondary-900">
                    {formatCurrency(funnelMetrics.spend)}
                  </p>
                </div>
                <div className="rounded-lg bg-primary-50 p-4">
                  <p className="text-sm font-medium text-primary-600">Cost per Call</p>
                  <p className="text-2xl font-bold text-primary-700">
                    {funnelMetrics.costPerCall > 0 ? formatCurrency(funnelMetrics.costPerCall) : "N/A"}
                  </p>
                </div>
                <div className="rounded-lg bg-success-50 p-4">
                  <p className="text-sm font-medium text-success-600">Sales Calls Attended</p>
                  <p className="text-2xl font-bold text-success-700">{salesCallsAttended}</p>
                  <p className="text-xs text-success-600">{PERIOD_LABELS[timePeriod]}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Target className="mx-auto size-8 text-secondary-400" />
              <p className="mt-2 text-sm text-secondary-500">No funnel data available</p>
            </div>
          )}
        </Card>
      </div>

      {/* Ad Performance */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-secondary-900">Ad Performance</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <AdPerformanceCard
            title="Best Performing Ad"
            ad={bestAd}
            isLoading={isLoadingAds}
            variant="best"
          />
          <AdPerformanceCard
            title="Worst Performing Ad"
            ad={worstAd}
            isLoading={isLoadingAds}
            variant="worst"
          />
        </div>
      </div>

      {/* Client Breakdown */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-secondary-900">Client Pipeline</h2>
          <Link href="/dashboard/clients">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="ml-1 size-4" />
            </Button>
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {(["ATTENDED_SALES_CALL", "PURCHASED", "CHURNED"] as CompanyStatus[]).map((status) => {
            const config = clientStatusConfig[status];
            const Icon = config.icon;
            const count = clientCounts[status];
            const statusClients = clientCompanies.filter((c) => c.status === status);

            return (
              <Link key={status} href={`/dashboard/clients?status=${status}`}>
                <Card className="cursor-pointer p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-10 items-center justify-center rounded-lg ${config.className}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-secondary-900">{count}</p>
                      <p className="text-sm text-secondary-500">{config.label}</p>
                    </div>
                    <ChevronRight className="size-5 text-secondary-300" />
                  </div>
                  {statusClients.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-secondary-100 pt-3">
                      {statusClients.slice(0, 3).map((client) => (
                        <p key={client.id} className="truncate text-xs text-secondary-500">
                          {client.name}
                        </p>
                      ))}
                      {statusClients.length > 3 && (
                        <p className="text-xs text-secondary-400">+{statusClients.length - 3} more</p>
                      )}
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Form Submissions */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-secondary-900">Recent Submissions</h2>
          <Link href="/dashboard/submissions">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="ml-1 size-4" />
            </Button>
          </Link>
        </div>
        <Card>
          {formSubmissionsInPeriod.length === 0 ? (
            <div className="p-6 text-center">
              <FileSpreadsheet className="mx-auto size-8 text-secondary-400" />
              <p className="mt-2 text-sm text-secondary-500">No submissions in this period</p>
            </div>
          ) : (
            <div className="divide-y divide-secondary-100">
              {formSubmissionsInPeriod.slice(0, 5).map((submission) => (
                <div key={submission.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary-100">
                    <span className="text-sm font-medium text-primary-600">
                      {submission.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-secondary-900">{submission.name}</p>
                    <p className="truncate text-sm text-secondary-500">{submission.email}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={submission.type === "BUSINESSOS" ? "default" : "secondary"}>
                      {submission.type === "BUSINESSOS" ? "Business OS" : "Regular"}
                    </Badge>
                    <p className="mt-1 text-xs text-secondary-400">
                      {new Date(submission.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
