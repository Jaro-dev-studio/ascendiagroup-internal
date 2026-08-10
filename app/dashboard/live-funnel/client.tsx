"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  MousePointerClick,
  Phone,
  Eye,
  Users,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  ChevronDown,
  X,
  Gauge,
  UserCheck,
} from "lucide-react";
import { getTimePeriodLabel, type TimePeriod, type MetaAdMetrics, type CampaignBreakdown, type AdSetBreakdown, type MetaAd } from "@/lib/integrations/meta";

interface FunnelMetrics {
  meta: MetaAdMetrics | null;
  leads: number;
  scheduleCalls: number;
  metaError: string | null;
  callsError: string | null;
  campaignBreakdown: CampaignBreakdown[];
  adsetBreakdown: AdSetBreakdown[];
}

// ============================================================================
// Ads Cache (per time period)
// ============================================================================

const ADS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

interface AdsCache {
  data: MetaAd[];
  timestamp: number;
  period: TimePeriod;
}

function getAdsCacheKey(period: TimePeriod): string {
  return `meta_ads_cache_${period}`;
}

function getCachedAds(period: TimePeriod): AdsCache | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(getAdsCacheKey(period));
    if (!cached) return null;
    const parsed = JSON.parse(cached) as AdsCache;
    // Validate the cache is for the right period
    if (parsed.period !== period) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setCachedAds(data: MetaAd[], period: TimePeriod): void {
  if (typeof window === "undefined") return;
  try {
    const cache: AdsCache = { data, timestamp: Date.now(), period };
    localStorage.setItem(getAdsCacheKey(period), JSON.stringify(cache));
  } catch {
    // Ignore
  }
}

function isCacheValid(cache: AdsCache): boolean {
  return Date.now() - cache.timestamp < ADS_CACHE_TTL;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
}

function MetricCard({ title, value, subValue, icon, isLoading, error }: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-32" />
            {subValue && <Skeleton className="mt-1 h-4 w-20" />}
          </div>
          <Skeleton className="size-10 rounded-lg" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-secondary-500">{title}</p>
            <p className="mt-1 text-sm text-danger-600">{error}</p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-lg bg-danger-50">
            <AlertCircle className="size-5 text-danger-600" />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-secondary-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-secondary-900">{value}</p>
          {subValue && (
            <p className="mt-1 text-sm text-secondary-500">{subValue}</p>
          )}
        </div>
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary-50">
          {icon}
        </div>
      </div>
    </Card>
  );
}

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

// Benchmark conversion rates
const BENCHMARK_RATES = {
  clickRate: 1.5,      // 1.5% impression to click
  leadRate: 3,         // 3% click to lead
  scheduleRate: 75,    // 75% lead to schedule
  attendanceRate: 75,  // 75% scheduled to attended
};

interface FunnelStage {
  label: string;
  value: number;
  gradient: string;
  shadowColor: string;
  rate: number | null;
  rateLabel: string;
  benchmarkRate?: number | null;
}

interface FunnelChartProps {
  stages: FunnelStage[];
  title: string;
  animationDelay?: number;
  showComparison?: boolean;
}

function FunnelChart({ stages, title, animationDelay = 0, showComparison = false }: FunnelChartProps) {
  // Calculate logarithmic widths for visibility
  const logValues = stages.map(d => Math.log10(d.value + 1));
  const maxLog = Math.max(...logValues, 1);
  const widths = logValues.map(log => {
    const proportion = maxLog > 0 ? (log / maxLog) : 0;
    return Math.max(35, proportion * 100);
  });

  return (
    <div className="flex flex-1 flex-col items-center">
      <motion.h3 
        className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-secondary-700"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: animationDelay }}
      >
        {title}
      </motion.h3>
      
      <div className="flex w-full flex-col items-center">
        {stages.map((stage, index) => {
          const width = widths[index];
          const isFirst = index === 0;
          const isLast = index === stages.length - 1;
          
          // Clip paths:
          // - First (top): trapezoid narrowing at bottom
          // - Middle: rectangle
          // - Last (bottom): trapezoid narrowing at bottom
          let clipPath: string;
          if (isFirst) {
            clipPath = "polygon(5% 100%, 95% 100%, 100% 0%, 0% 0%)";
          } else if (isLast) {
            clipPath = "polygon(15% 100%, 85% 100%, 100% 0%, 0% 0%)";
          } else {
            clipPath = "polygon(0% 100%, 100% 100%, 100% 0%, 0% 0%)"; // Rectangle
          }
          
          return (
            <div key={stage.label} className="flex w-full flex-col items-center">
              <motion.div 
                className="relative flex items-center justify-center"
                style={{ 
                  width: `${width}%`,
                  minWidth: "180px",
                  maxWidth: "400px",
                }}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ 
                  delay: animationDelay + index * 0.12,
                  duration: 0.4,
                  ease: [0.25, 0.46, 0.45, 0.94]
                }}
              >
                <motion.div
                  className={`bg-gradient-to-r ${stage.gradient} w-full cursor-default shadow-lg ${stage.shadowColor}`}
                  style={{
                    clipPath,
                    paddingTop: "1.25rem",
                    paddingBottom: "1.25rem",
                  }}
                  whileHover={{ 
                    scale: 1.02,
                    transition: { type: "spring", stiffness: 400, damping: 25 }
                  }}
                >
                  <div className="flex flex-col items-center gap-0.5 text-white">
                    <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
                      {stage.label}
                    </span>
                    
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold drop-shadow-sm">
                        {formatNumber(stage.value)}
                      </span>
                      
                      {stage.rate !== null && (() => {
                        // Determine badge color based on comparison
                        let badgeClass = "bg-white/20 backdrop-blur-sm";
                        if (showComparison && stage.benchmarkRate !== null && stage.benchmarkRate !== undefined) {
                          if (stage.rate >= stage.benchmarkRate) {
                            badgeClass = "bg-success-500 shadow-success-500/50 shadow-sm";
                          } else {
                            badgeClass = "bg-danger-500 shadow-danger-500/50 shadow-sm";
                          }
                        }
                        return (
                          <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${badgeClass}`}>
                            {formatPercentage(stage.rate)}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
              
              {/* Connector */}
              {index < stages.length - 1 && (
                <motion.div 
                  className="flex items-center justify-center py-1"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: animationDelay + index * 0.12 + 0.1 }}
                >
                  <motion.div
                    animate={{ y: [0, 3, 0] }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 1.5,
                      ease: "easeInOut",
                      delay: index * 0.2
                    }}
                  >
                    <ChevronDown className="size-4 text-secondary-300" />
                  </motion.div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ALL_PERIODS: TimePeriod[] = ["24h", "7d", "30d", "3m", "1y"];

const PERIOD_LABELS: Record<TimePeriod, string> = {
  "24h": "24h",
  "7d": "7 Days",
  "30d": "30 Days",
  "3m": "3 Months",
  "1y": "1 Year",
};

// Number of days for each time period (used for velocity calculation)
const PERIOD_DAYS: Record<TimePeriod, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "3m": 90,
  "1y": 365,
};

// ============================================================================
// Breakdown Table Component
// ============================================================================

interface BreakdownTableProps {
  title: string;
  data: CampaignBreakdown[] | AdSetBreakdown[];
  type: "campaign" | "adset";
  isLoading?: boolean;
}

function formatCompactNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US").format(value);
}

function BreakdownTable({ title, data, type, isLoading }: BreakdownTableProps) {
  if (isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="mb-4 h-6 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-secondary-200 bg-secondary-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-secondary-900">{title}</h3>
      </div>
      <div className="max-h-80 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky top-0 bg-white">Name</TableHead>
              <TableHead className="sticky top-0 bg-white text-right">Spend</TableHead>
              <TableHead className="sticky top-0 bg-white text-right">Impressions</TableHead>
              <TableHead className="sticky top-0 bg-white text-right">Clicks</TableHead>
              <TableHead className="sticky top-0 bg-white text-right">CTR</TableHead>
              <TableHead className="sticky top-0 bg-white text-right">Leads</TableHead>
              <TableHead className="sticky top-0 bg-white text-right">CPL</TableHead>
              <TableHead className="sticky top-0 bg-white text-right">Calls</TableHead>
              <TableHead className="sticky top-0 bg-white text-right">CPC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-secondary-500">
                  No data available
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => {
                const name = type === "campaign" 
                  ? (row as CampaignBreakdown).campaignName 
                  : (row as AdSetBreakdown).adsetName;
                const id = type === "campaign"
                  ? (row as CampaignBreakdown).campaignId
                  : (row as AdSetBreakdown).adsetId;
                return (
                  <TableRow key={id}>
                    <TableCell className="max-w-48 truncate font-medium" title={name}>
                      {name}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.spend)}</TableCell>
                    <TableCell className="text-right">{formatCompactNumber(row.impressions)}</TableCell>
                    <TableCell className="text-right">{formatCompactNumber(row.clicks)}</TableCell>
                    <TableCell className="text-right">{formatPercentage(row.ctr)}</TableCell>
                    <TableCell className="text-right">{row.leads}</TableCell>
                    <TableCell className="text-right">
                      {row.costPerLead > 0 ? formatCurrency(row.costPerLead) : "-"}
                    </TableCell>
                    <TableCell className="text-right">{row.scheduleCalls}</TableCell>
                    <TableCell className="text-right">
                      {row.costPerCall > 0 ? formatCurrency(row.costPerCall) : "-"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

interface AttendedClient {
  id: string;
  createdAt: Date;
}

interface FormSubmission {
  id: string;
  email: string;
  createdAt: Date;
}

interface ScheduledSalesCall {
  id: string;
  eventName: string;
  startTime: Date;
  endTime: Date;
  status: string;
  inviteeEmail: string | null;
}

interface LiveFunnelClientProps {
  attendedSalesCallClients: AttendedClient[];
  formSubmissions: FormSubmission[];
  scheduledSalesCalls: ScheduledSalesCall[];
}

// Helper to check if a date is within a time period
function isWithinTimePeriod(date: Date, period: TimePeriod): boolean {
  const now = new Date();
  const dateObj = new Date(date);
  
  switch (period) {
    case "24h":
      return dateObj >= new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case "7d":
      return dateObj >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return dateObj >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "3m":
      return dateObj >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "1y":
      return dateObj >= new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return true;
  }
}

export function LiveFunnelClient({ attendedSalesCallClients, formSubmissions, scheduledSalesCalls }: LiveFunnelClientProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("30d");
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [comparisonPeriods, setComparisonPeriods] = useState<TimePeriod[]>([]);
  const [loadingComparisons, setLoadingComparisons] = useState<TimePeriod[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [adsetFilter, setAdsetFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [destinationUrlFilter, setDestinationUrlFilter] = useState<string>("all");
  
  // Ads data per time period
  const [adsData, setAdsData] = useState<Partial<Record<TimePeriod, MetaAd[]>>>({});
  
  // Current period's ads
  const ads = adsData[timePeriod] || [];
  
  // Fetch ads for a specific time period
  const fetchAdsForPeriod = useCallback(async (period: TimePeriod, forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh) {
      const cached = getCachedAds(period);
      if (cached && isCacheValid(cached)) {
        setAdsData(prev => ({ ...prev, [period]: cached.data }));
        return cached.data;
      }
    }
    
    const response = await fetch(`/api/ads?period=${period}`);
    const data = await response.json();
    if (response.ok && data.data) {
      setAdsData(prev => ({ ...prev, [period]: data.data }));
      setCachedAds(data.data, period);
      return data.data as MetaAd[];
    }
    throw new Error(data.error || "Failed to fetch ads");
  }, []);
  
  // Fetch ads when time period changes
  const fetchAds = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      await fetchAdsForPeriod(timePeriod, forceRefresh);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch ads");
    } finally {
      setIsLoading(false);
    }
  }, [timePeriod, fetchAdsForPeriod]);
  
  useEffect(() => {
    fetchAds();
  }, [fetchAds]);
  
  // Get unique campaigns from ads
  const campaigns = useMemo(() => {
    const uniqueCampaigns = new Map<string, string>();
    ads.forEach((ad) => {
      if (ad.campaign.id && ad.campaign.name) {
        uniqueCampaigns.set(ad.campaign.id, ad.campaign.name);
      }
    });
    return Array.from(uniqueCampaigns.entries()).map(([id, name]) => ({ id, name }));
  }, [ads]);
  
  // Get unique ad sets (filtered by campaign if selected)
  const adsets = useMemo(() => {
    const uniqueAdsets = new Map<string, string>();
    ads.forEach((ad) => {
      if (campaignFilter !== "all" && ad.campaign.id !== campaignFilter) return;
      if (ad.adset.id && ad.adset.name) {
        uniqueAdsets.set(ad.adset.id, ad.adset.name);
      }
    });
    return Array.from(uniqueAdsets.entries()).map(([id, name]) => ({ id, name }));
  }, [ads, campaignFilter]);
  
  // Get unique destination URLs
  const destinationUrls = useMemo(() => {
    const uniqueUrls = new Set<string>();
    ads.forEach((ad) => {
      if (ad.creative.linkUrl) {
        // Extract domain for cleaner display
        try {
          const url = new URL(ad.creative.linkUrl);
          uniqueUrls.add(url.origin + url.pathname);
        } catch {
          uniqueUrls.add(ad.creative.linkUrl);
        }
      }
    });
    return Array.from(uniqueUrls).sort();
  }, [ads]);
  
  // Helper function to aggregate ads into metrics
  const aggregateAdsToMetrics = useCallback((adsToAggregate: MetaAd[]): FunnelMetrics => {
    let totalSpend = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalReach = 0;
    let totalLeads = 0;
    let totalScheduleCalls = 0;
    
    const campaignMap = new Map<string, CampaignBreakdown>();
    const adsetMap = new Map<string, AdSetBreakdown>();
    
    for (const ad of adsToAggregate) {
      totalSpend += ad.metrics.spend;
      totalClicks += ad.metrics.clicks;
      totalImpressions += ad.metrics.impressions;
      totalReach += ad.metrics.reach;
      totalLeads += ad.metrics.leads;
      totalScheduleCalls += ad.metrics.scheduleCalls;
      
      // Campaign breakdown
      const existingCampaign = campaignMap.get(ad.campaign.id);
      if (existingCampaign) {
        existingCampaign.spend += ad.metrics.spend;
        existingCampaign.clicks += ad.metrics.clicks;
        existingCampaign.impressions += ad.metrics.impressions;
        existingCampaign.reach += ad.metrics.reach;
        existingCampaign.leads += ad.metrics.leads;
        existingCampaign.scheduleCalls += ad.metrics.scheduleCalls;
      } else {
        campaignMap.set(ad.campaign.id, {
          campaignId: ad.campaign.id,
          campaignName: ad.campaign.name,
          spend: ad.metrics.spend,
          clicks: ad.metrics.clicks,
          impressions: ad.metrics.impressions,
          reach: ad.metrics.reach,
          leads: ad.metrics.leads,
          scheduleCalls: ad.metrics.scheduleCalls,
          ctr: 0,
          costPerLead: 0,
          costPerCall: 0,
        });
      }
      
      // Adset breakdown
      const existingAdset = adsetMap.get(ad.adset.id);
      if (existingAdset) {
        existingAdset.spend += ad.metrics.spend;
        existingAdset.clicks += ad.metrics.clicks;
        existingAdset.impressions += ad.metrics.impressions;
        existingAdset.reach += ad.metrics.reach;
        existingAdset.leads += ad.metrics.leads;
        existingAdset.scheduleCalls += ad.metrics.scheduleCalls;
      } else {
        adsetMap.set(ad.adset.id, {
          adsetId: ad.adset.id,
          adsetName: ad.adset.name,
          campaignId: ad.campaign.id,
          campaignName: ad.campaign.name,
          spend: ad.metrics.spend,
          clicks: ad.metrics.clicks,
          impressions: ad.metrics.impressions,
          reach: ad.metrics.reach,
          leads: ad.metrics.leads,
          scheduleCalls: ad.metrics.scheduleCalls,
          ctr: 0,
          costPerLead: 0,
          costPerCall: 0,
        });
      }
    }
    
    // Calculate derived metrics for breakdowns
    const campaignBreakdown = Array.from(campaignMap.values()).map((c) => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      costPerLead: c.leads > 0 ? c.spend / c.leads : 0,
      costPerCall: c.scheduleCalls > 0 ? c.spend / c.scheduleCalls : 0,
    })).sort((a, b) => b.spend - a.spend);
    
    const adsetBreakdown = Array.from(adsetMap.values()).map((a) => ({
      ...a,
      ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      costPerLead: a.leads > 0 ? a.spend / a.leads : 0,
      costPerCall: a.scheduleCalls > 0 ? a.spend / a.scheduleCalls : 0,
    })).sort((a, b) => b.spend - a.spend);
    
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    
    return {
      meta: {
        spend: totalSpend,
        clicks: totalClicks,
        impressions: totalImpressions,
        reach: totalReach,
        cpc: avgCpc,
        cpm: avgCpm,
        ctr: avgCtr,
        leads: totalLeads,
        scheduleCalls: totalScheduleCalls,
        dateStart: "",
        dateEnd: "",
      },
      leads: totalLeads,
      scheduleCalls: totalScheduleCalls,
      metaError: null,
      callsError: null,
      campaignBreakdown,
      adsetBreakdown,
    };
  }, []);
  
  // Filter ads based on all filters and calculate metrics from them
  const displayMetrics = useMemo((): FunnelMetrics | null => {
    if (ads.length === 0) {
      if (error) {
        return {
          meta: null,
          leads: 0,
          scheduleCalls: 0,
          metaError: error,
          callsError: null,
          campaignBreakdown: [],
          adsetBreakdown: [],
        };
      }
      return null;
    }
    
    // Filter ads based on all active filters
    const filteredAds = ads.filter((ad) => {
      // Campaign filter
      if (campaignFilter !== "all" && ad.campaign.id !== campaignFilter) return false;
      
      // Ad set filter
      if (adsetFilter !== "all" && ad.adset.id !== adsetFilter) return false;
      
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "active" && ad.effectiveStatus !== "ACTIVE") return false;
        if (statusFilter === "paused" && !["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"].includes(ad.effectiveStatus)) return false;
      }
      
      // Destination URL filter
      if (destinationUrlFilter !== "all") {
        const linkUrl = ad.creative.linkUrl || "";
        try {
          const url = new URL(linkUrl);
          const normalizedUrl = url.origin + url.pathname;
          if (normalizedUrl !== destinationUrlFilter) return false;
        } catch {
          if (linkUrl !== destinationUrlFilter) return false;
        }
      }
      
      return true;
    });
    
    return aggregateAdsToMetrics(filteredAds);
  }, [ads, campaignFilter, adsetFilter, statusFilter, destinationUrlFilter, error, aggregateAdsToMetrics]);
  
  // Comparison metrics computed from cached ads data
  const comparisonMetrics = useMemo(() => {
    const result: Partial<Record<TimePeriod, FunnelMetrics | null>> = {};
    
    for (const period of comparisonPeriods) {
      const periodAds = adsData[period];
      if (!periodAds || periodAds.length === 0) {
        result[period] = null;
        continue;
      }
      
      // Apply same filters to comparison period data
      const filteredAds = periodAds.filter((ad) => {
        if (campaignFilter !== "all" && ad.campaign.id !== campaignFilter) return false;
        if (adsetFilter !== "all" && ad.adset.id !== adsetFilter) return false;
        if (statusFilter !== "all") {
          if (statusFilter === "active" && ad.effectiveStatus !== "ACTIVE") return false;
          if (statusFilter === "paused" && !["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"].includes(ad.effectiveStatus)) return false;
        }
        if (destinationUrlFilter !== "all") {
          const linkUrl = ad.creative.linkUrl || "";
          try {
            const url = new URL(linkUrl);
            const normalizedUrl = url.origin + url.pathname;
            if (normalizedUrl !== destinationUrlFilter) return false;
          } catch {
            if (linkUrl !== destinationUrlFilter) return false;
          }
        }
        return true;
      });
      
      result[period] = aggregateAdsToMetrics(filteredAds);
    }
    
    return result;
  }, [adsData, comparisonPeriods, campaignFilter, adsetFilter, statusFilter, destinationUrlFilter, aggregateAdsToMetrics]);
  
  // Reset adset filter when campaign changes
  useEffect(() => {
    setAdsetFilter("all");
  }, [campaignFilter]);

  // Fetch comparison period data
  const fetchComparisonData = useCallback(async (period: TimePeriod) => {
    setLoadingComparisons(prev => [...prev, period]);
    try {
      await fetchAdsForPeriod(period);
    } finally {
      setLoadingComparisons(prev => prev.filter(p => p !== period));
    }
  }, [fetchAdsForPeriod]);

  const toggleComparisonPeriod = useCallback((period: TimePeriod) => {
    setComparisonPeriods(prev => {
      if (prev.includes(period)) {
        return prev.filter(p => p !== period);
      } else {
        // Fetch data for new period if not already cached
        if (!adsData[period]) {
          fetchComparisonData(period);
        }
        return [...prev, period];
      }
    });
  }, [adsData, fetchComparisonData]);

  // Clear comparison periods when main period changes
  useEffect(() => {
    setComparisonPeriods(prev => prev.filter(p => p !== timePeriod));
  }, [timePeriod]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchAds(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAds]);

  const costPerLead = displayMetrics?.meta && displayMetrics.leads > 0
    ? displayMetrics.meta.spend / displayMetrics.leads
    : 0;
    
  const costPerScheduleCall = displayMetrics?.meta && displayMetrics.scheduleCalls > 0
    ? displayMetrics.meta.spend / displayMetrics.scheduleCalls
    : 0;

  // Calls attended (client companies with ATTENDED_SALES_CALL status created in this period)
  const callsAttended = useMemo(() => {
    return attendedSalesCallClients.filter((c) => isWithinTimePeriod(c.createdAt, timePeriod)).length;
  }, [attendedSalesCallClients, timePeriod]);

  const costPerAttendedCall = displayMetrics?.meta && callsAttended > 0
    ? displayMetrics.meta.spend / callsAttended
    : 0;

  // Call booking velocity: (calls / days in period) * 7
  const daysInPeriod = PERIOD_DAYS[timePeriod];
  const callVelocity = displayMetrics
    ? (displayMetrics.scheduleCalls / daysInPeriod) * 7
    : 0;
  const dailyAverage = displayMetrics
    ? displayMetrics.scheduleCalls / daysInPeriod
    : 0;

  // Check if any filters are active
  const hasActiveFilters = campaignFilter !== "all" || adsetFilter !== "all" || statusFilter !== "all" || destinationUrlFilter !== "all";
  
  const clearFilters = () => {
    setCampaignFilter("all");
    setAdsetFilter("all");
    setStatusFilter("all");
    setDestinationUrlFilter("all");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Live Funnel</h1>
          <p className="text-secondary-600">Real-time ad performance metrics from Meta</p>
        </div>

        <div className="flex items-center gap-3">
          <Select value={timePeriod} onValueChange={(v) => setTimePeriod(v as TimePeriod)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="3m">Last 3 Months</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchAds(true)}
            disabled={isLoading}
            title="Refresh metrics"
          >
            <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-secondary-900">Filters</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                <X className="mr-1 size-3" />
                Clear all
              </Button>
            )}
          </div>
          
          <div className="flex flex-wrap gap-3">
            <Select value={campaignFilter} onValueChange={setCampaignFilter}>
              <SelectTrigger className="w-full sm:w-52">
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

            <Select value={adsetFilter} onValueChange={setAdsetFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Ad Set" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ad Sets</SelectItem>
                {adsets.map((adset) => (
                  <SelectItem key={adset.id} value={adset.id}>
                    {adset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>

            <Select value={destinationUrlFilter} onValueChange={setDestinationUrlFilter}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Destination URL" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Destinations</SelectItem>
                {destinationUrls.map((url) => (
                  <SelectItem key={url} value={url}>
                    {url.length > 50 ? url.substring(0, 50) + "..." : url}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Last updated */}
      {lastUpdated && (
        <p className="text-xs text-secondary-500">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* Time period indicator */}
      <div className="rounded-lg bg-primary-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-primary-700">
            Showing data for: {getTimePeriodLabel(timePeriod)}
          </p>
          {hasActiveFilters && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
              Filters applied
            </span>
          )}
        </div>
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
        <MetricCard
          title="Ad Spend"
          value={displayMetrics?.meta ? formatCurrency(displayMetrics.meta.spend) : "$0.00"}
          icon={<DollarSign className="size-5 text-primary-600" />}
          isLoading={isLoading}
          error={displayMetrics?.metaError}
        />
        <MetricCard
          title="Clicks"
          value={displayMetrics?.meta ? formatNumber(displayMetrics.meta.clicks) : "0"}
          subValue={displayMetrics?.meta ? `CPC: ${formatCurrency(displayMetrics.meta.cpc)}` : undefined}
          icon={<MousePointerClick className="size-5 text-primary-600" />}
          isLoading={isLoading}
          error={displayMetrics?.metaError}
        />
        <MetricCard
          title="Leads"
          value={displayMetrics ? formatNumber(displayMetrics.leads) : "0"}
          subValue={costPerLead > 0 ? `Cost per lead: ${formatCurrency(costPerLead)}` : undefined}
          icon={<Users className="size-5 text-primary-600" />}
          isLoading={isLoading}
          error={displayMetrics?.metaError}
        />
        <MetricCard
          title="Calls Scheduled"
          value={displayMetrics ? formatNumber(displayMetrics.scheduleCalls) : "0"}
          subValue={costPerScheduleCall > 0 ? `Cost per call: ${formatCurrency(costPerScheduleCall)}` : undefined}
          icon={<Phone className="size-5 text-primary-600" />}
          isLoading={isLoading}
          error={displayMetrics?.metaError}
        />
        <MetricCard
          title="Calls Attended"
          value={formatNumber(callsAttended)}
          subValue={costPerAttendedCall > 0 ? `Cost per attended: ${formatCurrency(costPerAttendedCall)}` : undefined}
          icon={<UserCheck className="size-5 text-primary-600" />}
          isLoading={isLoading}
          error={displayMetrics?.metaError}
        />
        <MetricCard
          title="Call Booking Velocity"
          value={`${callVelocity > 0 ? callVelocity.toFixed(1) : "0"} / week`}
          subValue={`${dailyAverage.toFixed(2)} calls/day avg`}
          icon={<Gauge className="size-5 text-primary-600" />}
          isLoading={isLoading}
          error={displayMetrics?.metaError}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Impressions"
          value={displayMetrics?.meta ? formatNumber(displayMetrics.meta.impressions) : "0"}
          subValue={displayMetrics?.meta ? `CPM: ${formatCurrency(displayMetrics.meta.cpm)}` : undefined}
          icon={<Eye className="size-5 text-primary-600" />}
          isLoading={isLoading}
          error={displayMetrics?.metaError}
        />
        <MetricCard
          title="Reach"
          value={displayMetrics?.meta ? formatNumber(displayMetrics.meta.reach) : "0"}
          icon={<Users className="size-5 text-primary-600" />}
          isLoading={isLoading}
          error={displayMetrics?.metaError}
        />
        <MetricCard
          title="CTR"
          value={displayMetrics?.meta ? formatPercentage(displayMetrics.meta.ctr) : "0.00%"}
          icon={<TrendingUp className="size-5 text-primary-600" />}
          isLoading={isLoading}
          error={displayMetrics?.metaError}
        />
        <MetricCard
          title="Click to Schedule Rate"
          value={
            displayMetrics?.meta && displayMetrics.meta.clicks > 0
              ? formatPercentage((displayMetrics.scheduleCalls / displayMetrics.meta.clicks) * 100)
              : "0.00%"
          }
          icon={<TrendingUp className="size-5 text-primary-600" />}
          isLoading={isLoading}
          error={displayMetrics?.metaError}
        />
      </div>

      {/* Animated Funnel Visualization */}
      <AnimatePresence mode="wait">
        {!isLoading && displayMetrics?.meta && !displayMetrics.metaError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Card className="overflow-hidden p-6">
              {/* Header with Toggle Options */}
              <div className="mb-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <motion.h2 
                    className="text-lg font-semibold text-secondary-900"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    Funnel Overview
                  </motion.h2>
                  
                  <motion.label 
                    className="flex cursor-pointer items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                  >
                    <input
                      type="checkbox"
                      checked={showBenchmark}
                      onChange={(e) => setShowBenchmark(e.target.checked)}
                      className="size-4 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-secondary-600">Show Benchmark</span>
                  </motion.label>
                </div>
                
                {/* Period Comparison Checkboxes */}
                <motion.div 
                  className="flex flex-wrap items-center gap-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35 }}
                >
                  <span className="text-sm font-medium text-secondary-500">Compare with:</span>
                  {ALL_PERIODS.filter(p => p !== timePeriod).map(period => (
                    <label key={period} className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={comparisonPeriods.includes(period)}
                        onChange={() => toggleComparisonPeriod(period)}
                        disabled={loadingComparisons.includes(period)}
                        className="size-3.5 rounded border-secondary-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className={`text-sm ${comparisonPeriods.includes(period) ? "font-medium text-secondary-900" : "text-secondary-600"}`}>
                        {PERIOD_LABELS[period]}
                        {loadingComparisons.includes(period) && " ..."}
                      </span>
                    </label>
                  ))}
                </motion.div>
              </div>
              
              {/* Funnel Comparison - Horizontally Scrollable */}
              <div className="flex gap-8 overflow-x-auto pb-4">
                {(() => {
                  // Actual funnel data with benchmark rates for comparison
                  const actualStages: FunnelStage[] = [
                    { 
                      label: "Impressions", 
                      value: displayMetrics!.meta!.impressions, 
                      gradient: "from-primary-600 to-primary-500",
                      shadowColor: "shadow-primary-500/30",
                      rate: null,
                      rateLabel: "",
                      benchmarkRate: null,
                    },
                    { 
                      label: "Clicks", 
                      value: displayMetrics!.meta!.clicks, 
                      gradient: "from-primary-500 to-primary-400",
                      shadowColor: "shadow-primary-400/30",
                      rate: displayMetrics!.meta!.impressions > 0 
                        ? (displayMetrics!.meta!.clicks / displayMetrics!.meta!.impressions) * 100 
                        : 0,
                      rateLabel: "of impressions",
                      benchmarkRate: BENCHMARK_RATES.clickRate,
                    },
                    { 
                      label: "Leads", 
                      value: displayMetrics!.leads, 
                      gradient: "from-primary-400 to-primary-300",
                      shadowColor: "shadow-primary-300/30",
                      rate: displayMetrics!.meta!.clicks > 0 
                        ? (displayMetrics!.leads / displayMetrics!.meta!.clicks) * 100 
                        : 0,
                      rateLabel: "of clicks",
                      benchmarkRate: BENCHMARK_RATES.leadRate,
                    },
                    { 
                      label: "Calls Scheduled", 
                      value: displayMetrics!.scheduleCalls, 
                      gradient: "from-primary-300 to-primary-200",
                      shadowColor: "shadow-primary-200/30",
                      rate: displayMetrics!.leads > 0 
                        ? (displayMetrics!.scheduleCalls / displayMetrics!.leads) * 100 
                        : 0,
                      rateLabel: "of leads",
                      benchmarkRate: BENCHMARK_RATES.scheduleRate,
                    },
                    { 
                      label: "Calls Attended", 
                      value: callsAttended, 
                      gradient: "from-success-500 to-success-400",
                      shadowColor: "shadow-success-500/30",
                      rate: displayMetrics!.scheduleCalls > 0 
                        ? (callsAttended / displayMetrics!.scheduleCalls) * 100 
                        : 0,
                      rateLabel: "of scheduled",
                      benchmarkRate: BENCHMARK_RATES.attendanceRate,
                    },
                  ];

                  // Benchmark funnel data (using same impression count)
                  const benchmarkImpressions = displayMetrics!.meta!.impressions;
                  const benchmarkClicks = Math.round(benchmarkImpressions * (BENCHMARK_RATES.clickRate / 100));
                  const benchmarkLeads = Math.round(benchmarkClicks * (BENCHMARK_RATES.leadRate / 100));
                  const benchmarkScheduled = Math.round(benchmarkLeads * (BENCHMARK_RATES.scheduleRate / 100));
                  const benchmarkAttended = Math.round(benchmarkScheduled * (BENCHMARK_RATES.attendanceRate / 100));

                  const benchmarkStages: FunnelStage[] = [
                    { 
                      label: "Impressions", 
                      value: benchmarkImpressions, 
                      gradient: "from-primary-600 to-primary-500",
                      shadowColor: "shadow-primary-500/30",
                      rate: null,
                      rateLabel: "",
                    },
                    { 
                      label: "Clicks", 
                      value: benchmarkClicks, 
                      gradient: "from-primary-500 to-primary-400",
                      shadowColor: "shadow-primary-400/30",
                      rate: BENCHMARK_RATES.clickRate,
                      rateLabel: "benchmark"
                    },
                    { 
                      label: "Leads", 
                      value: benchmarkLeads, 
                      gradient: "from-primary-400 to-primary-300",
                      shadowColor: "shadow-primary-300/30",
                      rate: BENCHMARK_RATES.leadRate,
                      rateLabel: "benchmark"
                    },
                    { 
                      label: "Calls Scheduled", 
                      value: benchmarkScheduled, 
                      gradient: "from-primary-300 to-primary-200",
                      shadowColor: "shadow-primary-200/30",
                      rate: BENCHMARK_RATES.scheduleRate,
                      rateLabel: "benchmark"
                    },
                    { 
                      label: "Calls Attended", 
                      value: benchmarkAttended, 
                      gradient: "from-success-500 to-success-400",
                      shadowColor: "shadow-success-500/30",
                      rate: BENCHMARK_RATES.attendanceRate,
                      rateLabel: "benchmark"
                    },
                  ];

                  // Calculate benchmark cost per attended call (same spend, more calls)
                  const benchmarkCostPerCall = displayMetrics!.meta!.spend > 0 && benchmarkAttended > 0
                    ? displayMetrics!.meta!.spend / benchmarkAttended
                    : 0;

                  return (
                    <>
                      {/* Your Performance Column */}
                      <div className="flex min-w-[280px] flex-1 flex-col">
                        <FunnelChart 
                          stages={actualStages} 
                          title="Your Performance" 
                          animationDelay={0.1}
                          showComparison={showBenchmark}
                        />
                        
                        {/* Your Summary */}
                        <motion.div 
                          className="mx-auto mt-4 w-full max-w-[400px] rounded-lg border border-secondary-100 bg-secondary-50 p-3"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.6, duration: 0.3 }}
                        >
                          <p className="text-center text-xs text-secondary-700">
                            For every{" "}
                            <span className="font-bold text-secondary-900">
                              {displayMetrics!.scheduleCalls > 0
                                ? formatNumber(Math.round(displayMetrics!.meta!.impressions / displayMetrics!.scheduleCalls))
                                : "∞"}
                            </span>{" "}
                            impressions, you get{" "}
                            <span className="font-bold text-success-600">1 call</span>{" "}
                            at{" "}
                            <span className="font-bold text-secondary-900">{formatCurrency(costPerScheduleCall)}</span>
                          </p>
                        </motion.div>
                      </div>
                      
                      {/* Comparison Period Funnels */}
                      {comparisonPeriods.map((period, idx) => {
                        const compData = comparisonMetrics[period];
                        if (!compData?.meta) return null;
                        
                        // Calculate calls attended for this comparison period
                        const compCallsAttended = attendedSalesCallClients.filter(
                          (c) => isWithinTimePeriod(c.createdAt, period)
                        ).length;
                        
                        const compStages: FunnelStage[] = [
                          { 
                            label: "Impressions", 
                            value: compData.meta.impressions, 
                            gradient: "from-primary-600 to-primary-500",
                            shadowColor: "shadow-primary-500/30",
                            rate: null,
                            rateLabel: "",
                          },
                          { 
                            label: "Clicks", 
                            value: compData.meta.clicks, 
                            gradient: "from-primary-500 to-primary-400",
                            shadowColor: "shadow-primary-400/30",
                            rate: compData.meta.impressions > 0 
                              ? (compData.meta.clicks / compData.meta.impressions) * 100 
                              : 0,
                            rateLabel: "of impressions"
                          },
                          { 
                            label: "Leads", 
                            value: compData.leads, 
                            gradient: "from-primary-400 to-primary-300",
                            shadowColor: "shadow-primary-300/30",
                            rate: compData.meta.clicks > 0 
                              ? (compData.leads / compData.meta.clicks) * 100 
                              : 0,
                            rateLabel: "of clicks"
                          },
                          { 
                            label: "Calls Scheduled", 
                            value: compData.scheduleCalls, 
                            gradient: "from-primary-300 to-primary-200",
                            shadowColor: "shadow-primary-200/30",
                            rate: compData.leads > 0 
                              ? (compData.scheduleCalls / compData.leads) * 100 
                              : 0,
                            rateLabel: "of leads"
                          },
                          { 
                            label: "Calls Attended", 
                            value: compCallsAttended, 
                            gradient: "from-success-500 to-success-400",
                            shadowColor: "shadow-success-500/30",
                            rate: compData.scheduleCalls > 0 
                              ? (compCallsAttended / compData.scheduleCalls) * 100 
                              : 0,
                            rateLabel: "of scheduled"
                          },
                        ];
                        
                        const compCostPerCall = compData.meta.spend > 0 && compCallsAttended > 0
                          ? compData.meta.spend / compCallsAttended
                          : 0;
                        
                        return (
                          <React.Fragment key={period}>
                            {/* Divider */}
                            <motion.div 
                              className="flex items-center"
                              initial={{ opacity: 0, scaleY: 0 }}
                              animate={{ opacity: 1, scaleY: 1 }}
                              transition={{ delay: 0.15 + idx * 0.1 }}
                            >
                              <div className="h-full w-px bg-secondary-200" />
                            </motion.div>
                            
                            {/* Comparison Column */}
                            <div className="flex min-w-[280px] flex-1 flex-col">
                              <FunnelChart 
                                stages={compStages} 
                                title={PERIOD_LABELS[period]} 
                                animationDelay={0.2 + idx * 0.1}
                              />
                              
                              {/* Comparison Summary */}
                              <motion.div 
                                className="mx-auto mt-4 w-full max-w-[400px] rounded-lg border border-secondary-200 bg-secondary-50 p-3"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 + idx * 0.1, duration: 0.3 }}
                              >
                                <p className="text-center text-xs text-secondary-700">
                                  <span className="font-bold text-secondary-900">
                                    {formatNumber(compData.scheduleCalls)} calls
                                  </span>{" "}
                                  at{" "}
                                  <span className="font-bold text-secondary-900">
                                    {formatCurrency(compCostPerCall)}
                                  </span>{" "}
                                  each
                                </p>
                              </motion.div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                      
                      {showBenchmark && (
                        <>
                          {/* Divider */}
                          <motion.div 
                            className="flex items-center"
                            initial={{ opacity: 0, scaleY: 0 }}
                            animate={{ opacity: 1, scaleY: 1 }}
                            exit={{ opacity: 0, scaleY: 0 }}
                            transition={{ delay: 0.2 }}
                          >
                            <div className="h-full w-px bg-secondary-200" />
                          </motion.div>
                          
                          {/* Benchmark Column */}
                          <div className="flex min-w-[280px] flex-1 flex-col">
                            <FunnelChart 
                              stages={benchmarkStages} 
                              title="Industry Benchmark" 
                              animationDelay={0.3}
                            />
                            
                            {/* Benchmark Summary */}
                            <motion.div 
                              className="mx-auto mt-4 w-full max-w-[400px] rounded-lg border border-primary-100 bg-primary-50 p-3"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.8, duration: 0.3 }}
                            >
                              {(() => {
                                const improvement = displayMetrics!.scheduleCalls > 0
                                  ? ((benchmarkScheduled - displayMetrics!.scheduleCalls) / displayMetrics!.scheduleCalls) * 100
                                  : benchmarkScheduled > 0 ? 100 : 0;
                                return (
                                  <p className="text-center text-xs text-primary-700">
                                    With benchmark rates you could get{" "}
                                    <span className="font-bold text-primary-900">
                                      {formatNumber(benchmarkScheduled)} calls
                                    </span>{" "}
                                    at{" "}
                                    <span className="font-bold text-primary-900">
                                      {formatCurrency(benchmarkCostPerCall)}
                                    </span>{" "}
                                    each{" "}
                                    {improvement > 0 && (
                                      <span className="font-bold text-success-600">
                                        (+{improvement.toFixed(0)}%)
                                      </span>
                                    )}
                                    {improvement < 0 && (
                                      <span className="font-bold text-success-600">
                                        (you&apos;re {Math.abs(improvement).toFixed(0)}% ahead!)
                                      </span>
                                    )}
                                  </p>
                                );
                              })()}
                            </motion.div>
                          </div>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diagnostic Section */}
      {!isLoading && displayMetrics?.meta && !displayMetrics.metaError && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold text-secondary-900">
              Funnel Diagnostics
            </h2>
            
            {(() => {
              // Calculate actual rates
              const clickRate = displayMetrics!.meta!.impressions > 0 
                ? (displayMetrics!.meta!.clicks / displayMetrics!.meta!.impressions) * 100 
                : 0;
              const leadRate = displayMetrics!.meta!.clicks > 0 
                ? (displayMetrics!.leads / displayMetrics!.meta!.clicks) * 100 
                : 0;
              const scheduleRate = displayMetrics!.leads > 0 
                ? (displayMetrics!.scheduleCalls / displayMetrics!.leads) * 100 
                : 0;
              const attendanceRate = displayMetrics!.scheduleCalls > 0 
                ? (callsAttended / displayMetrics!.scheduleCalls) * 100 
                : 0;
              
              // Define bottleneck diagnostics for software agency
              interface Bottleneck {
                stage: string;
                actualRate: number;
                benchmarkRate: number;
                gap: number;
                impactCalls: number;
                impactPercent: number;
                causes: string[];
                solutions: string[];
              }
              
              const bottlenecks: Bottleneck[] = [];
              
              // Check Click Rate
              if (clickRate < BENCHMARK_RATES.clickRate) {
                // Calculate impact: if we hit benchmark, how many more calls?
                const improvedClicks = displayMetrics!.meta!.impressions * (BENCHMARK_RATES.clickRate / 100);
                const improvedLeads = improvedClicks * (leadRate / 100);
                const improvedCalls = improvedLeads * (scheduleRate / 100);
                const callsGain = improvedCalls - displayMetrics!.scheduleCalls;
                const percentGain = displayMetrics!.scheduleCalls > 0 
                  ? (callsGain / displayMetrics!.scheduleCalls) * 100 
                  : improvedCalls > 0 ? 100 : 0;
                
                bottlenecks.push({
                  stage: "Click Rate",
                  actualRate: clickRate,
                  benchmarkRate: BENCHMARK_RATES.clickRate,
                  gap: BENCHMARK_RATES.clickRate - clickRate,
                  impactCalls: callsGain,
                  impactPercent: percentGain,
                  causes: [
                    "Ad creative not resonating with target audience",
                    "Weak value proposition in ad copy",
                    "Targeting too broad or misaligned with ICP",
                    "Ad fatigue from running same creatives too long",
                    "Poor thumbnail/image quality or relevance",
                  ],
                  solutions: [
                    "Test new hooks: pain points, case studies, or founder stories",
                    "Lead with specific outcomes: '3-week MVP delivery' or 'CTO-level code quality'",
                    "Narrow targeting to startup founders, funded companies, or specific industries",
                    "Refresh creatives every 2-3 weeks with new angles",
                    "Use screenshots of actual products built or testimonial videos",
                  ],
                });
              }
              
              // Check Lead Rate (click to lead)
              if (leadRate < BENCHMARK_RATES.leadRate) {
                const improvedLeads = displayMetrics!.meta!.clicks * (BENCHMARK_RATES.leadRate / 100);
                const improvedCalls = improvedLeads * (scheduleRate / 100);
                const callsGain = improvedCalls - displayMetrics!.scheduleCalls;
                const percentGain = displayMetrics!.scheduleCalls > 0 
                  ? (callsGain / displayMetrics!.scheduleCalls) * 100 
                  : improvedCalls > 0 ? 100 : 0;
                
                bottlenecks.push({
                  stage: "Lead Capture Rate",
                  actualRate: leadRate,
                  benchmarkRate: BENCHMARK_RATES.leadRate,
                  gap: BENCHMARK_RATES.leadRate - leadRate,
                  impactCalls: callsGain,
                  impactPercent: percentGain,
                  causes: [
                    "Landing page doesn't match ad promise",
                    "Form asking for too much information upfront",
                    "Weak or unclear call-to-action",
                    "No social proof (testimonials, logos, case studies)",
                    "Page load speed issues or mobile UX problems",
                  ],
                  solutions: [
                    "Ensure landing page headline mirrors the ad copy exactly",
                    "Reduce form fields to just name, email, and project type",
                    "Use action-oriented CTAs: 'Get Your Free Estimate' vs 'Submit'",
                    "Add client logos, testimonial quotes, and portfolio previews above the fold",
                    "Optimize for mobile and aim for <2s load time",
                  ],
                });
              }
              
              // Check Schedule Rate (lead to call)
              if (scheduleRate < BENCHMARK_RATES.scheduleRate) {
                const improvedCalls = displayMetrics!.leads * (BENCHMARK_RATES.scheduleRate / 100);
                const callsGain = improvedCalls - displayMetrics!.scheduleCalls;
                const percentGain = displayMetrics!.scheduleCalls > 0 
                  ? (callsGain / displayMetrics!.scheduleCalls) * 100 
                  : improvedCalls > 0 ? 100 : 0;
                
                bottlenecks.push({
                  stage: "Lead to Call Rate",
                  actualRate: scheduleRate,
                  benchmarkRate: BENCHMARK_RATES.scheduleRate,
                  gap: BENCHMARK_RATES.scheduleRate - scheduleRate,
                  impactCalls: callsGain,
                  impactPercent: percentGain,
                  causes: [
                    "No immediate follow-up after form submission",
                    "Calendar booking friction (too many steps, timezone issues)",
                    "Leads going cold before scheduling",
                    "Unclear next steps or value of the discovery call",
                    "Attracting tire-kickers instead of serious buyers",
                  ],
                  solutions: [
                    "Send automated email + SMS within 5 minutes of submission",
                    "Embed Calendly directly on thank-you page with pre-filled info",
                    "Add urgency: 'Limited spots this week' or 'Schedule within 24hrs for priority'",
                    "Clearly communicate call agenda and what they'll get (free roadmap, estimate, etc.)",
                    "Add qualifying questions to form: budget range, timeline, project stage",
                  ],
                });
              }
              
              // Check Attendance Rate (scheduled to attended)
              if (attendanceRate < BENCHMARK_RATES.attendanceRate) {
                const improvedAttended = displayMetrics!.scheduleCalls * (BENCHMARK_RATES.attendanceRate / 100);
                const attendedGain = improvedAttended - callsAttended;
                const percentGain = callsAttended > 0 
                  ? (attendedGain / callsAttended) * 100 
                  : improvedAttended > 0 ? 100 : 0;
                
                bottlenecks.push({
                  stage: "Call Attendance Rate",
                  actualRate: attendanceRate,
                  benchmarkRate: BENCHMARK_RATES.attendanceRate,
                  gap: BENCHMARK_RATES.attendanceRate - attendanceRate,
                  impactCalls: attendedGain,
                  impactPercent: percentGain,
                  causes: [
                    "No-shows due to lack of reminder system",
                    "Poor lead quality - unqualified prospects booking calls",
                    "Too long between booking and call date",
                    "Unclear value proposition for the discovery call",
                    "Prospect found alternative solution or lost interest",
                  ],
                  solutions: [
                    "Send automated reminders: 24h before, 1h before, and 10min before the call",
                    "Add SMS reminders in addition to email reminders",
                    "Reduce time between booking and call (offer same-day or next-day slots)",
                    "Send a pre-call video or case study to build excitement",
                    "Add stronger qualification in the booking form to filter out tire-kickers",
                  ],
                });
              }
              
              // Sort by impact (highest first)
              bottlenecks.sort((a, b) => b.impactPercent - a.impactPercent);
              
              if (bottlenecks.length === 0) {
                return (
                  <div className="rounded-lg bg-success-50 p-4">
                    <p className="text-center text-sm font-medium text-success-700">
                      🎉 All funnel stages are at or above benchmark! Keep up the great work.
                    </p>
                  </div>
                );
              }
              
              return (
                <div className="space-y-4">
                  <p className="text-sm text-secondary-600">
                    Found <span className="font-semibold text-danger-600">{bottlenecks.length} bottleneck{bottlenecks.length > 1 ? "s" : ""}</span> in your funnel. 
                    Sorted by potential impact on scheduled calls.
                  </p>
                  
                  {bottlenecks.map((bottleneck, idx) => (
                    <motion.div
                      key={bottleneck.stage}
                      className="overflow-hidden rounded-lg border border-secondary-200"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 * idx }}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between bg-secondary-50 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex size-6 items-center justify-center rounded-full bg-danger-100 text-xs font-bold text-danger-700">
                            {idx + 1}
                          </span>
                          <div>
                            <h3 className="font-semibold text-secondary-900">{bottleneck.stage}</h3>
                            <p className="text-xs text-secondary-500">
                              <span className="text-danger-600">{bottleneck.actualRate.toFixed(2)}%</span>
                              {" → "}
                              <span className="text-success-600">{bottleneck.benchmarkRate.toFixed(2)}%</span>
                              {" benchmark"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-success-600">
                            +{bottleneck.impactPercent.toFixed(0)}%
                          </p>
                          <p className="text-xs text-secondary-500">
                            +{Math.round(bottleneck.impactCalls)} calls in {PERIOD_LABELS[timePeriod]}
                          </p>
                        </div>
                      </div>
                      
                      {/* Content */}
                      <div className="grid gap-4 p-4 md:grid-cols-2">
                        {/* Potential Causes */}
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary-500">
                            Potential Causes
                          </h4>
                          <ul className="space-y-1.5">
                            {bottleneck.causes.map((cause, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-secondary-700">
                                <span className="mt-1 text-danger-400">•</span>
                                {cause}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        {/* Solutions */}
                        <div>
                          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-secondary-500">
                            Recommended Actions
                          </h4>
                          <ul className="space-y-1.5">
                            {bottleneck.solutions.map((solution, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-secondary-700">
                                <span className="mt-1 text-success-500">✓</span>
                                {solution}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  
                  {/* Total Impact Summary */}
                  <motion.div 
                    className="rounded-lg bg-primary-50 p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                  >
                    <p className="text-center text-sm text-primary-700">
                      <span className="font-medium">Combined potential:</span> Fixing all bottlenecks to benchmark could result in{" "}
                      <span className="font-bold text-primary-900">
                        {(() => {
                          const benchClicks = displayMetrics!.meta!.impressions * (BENCHMARK_RATES.clickRate / 100);
                          const benchLeads = benchClicks * (BENCHMARK_RATES.leadRate / 100);
                          const benchScheduled = benchLeads * (BENCHMARK_RATES.scheduleRate / 100);
                          const benchAttended = benchScheduled * (BENCHMARK_RATES.attendanceRate / 100);
                          return formatNumber(Math.round(benchAttended));
                        })()}
                      </span>{" "}
                      attended calls{" "}
                      <span className="font-bold text-success-600">
                        (+{(() => {
                          const benchClicks = displayMetrics!.meta!.impressions * (BENCHMARK_RATES.clickRate / 100);
                          const benchLeads = benchClicks * (BENCHMARK_RATES.leadRate / 100);
                          const benchScheduled = benchLeads * (BENCHMARK_RATES.scheduleRate / 100);
                          const benchAttended = benchScheduled * (BENCHMARK_RATES.attendanceRate / 100);
                          const gain = callsAttended > 0 
                            ? ((benchAttended - callsAttended) / callsAttended) * 100 
                            : 100;
                          return gain.toFixed(0);
                        })()}%)
                      </span>
                    </p>
                  </motion.div>
                </div>
              );
            })()}
          </Card>
        </motion.div>
      )}

      {/* Breakdown Tables */}
      {!isLoading && displayMetrics && !displayMetrics.metaError && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="flex flex-col gap-6"
        >
          <BreakdownTable
            title="Performance by Campaign"
            data={displayMetrics.campaignBreakdown || []}
            type="campaign"
            isLoading={isLoading}
          />
          <BreakdownTable
            title="Performance by Ad Set"
            data={displayMetrics.adsetBreakdown || []}
            type="adset"
            isLoading={isLoading}
          />
        </motion.div>
      )}
    </div>
  );
}
