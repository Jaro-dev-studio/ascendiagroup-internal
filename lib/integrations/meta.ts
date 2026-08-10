/**
 * Meta (Facebook) Ads API Integration
 * 
 * This integration fetches ad metrics from the Meta Marketing API
 * 
 * Required environment variables:
 * - META_APP_SECRET: The Meta App Secret (used to generate appsecret_proof for secure API calls)
 * - META_ACCESS_TOKEN: Long-lived or System User access token (get from Business Manager → System Users)
 * - META_AD_ACCOUNT_ID: The ad account ID (format: act_XXXXXXXXX)
 */

import crypto from "crypto";

export interface MetaAdMetrics {
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  cpc: number;
  cpm: number;
  ctr: number;
  leads: number;
  scheduleCalls: number;
  dateStart: string;
  dateEnd: string;
}

interface MetaAction {
  action_type: string;
  value: string;
}

interface MetaAdSetInsight {
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  clicks?: string;
  impressions?: string;
  reach?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: MetaAction[];
  conversions?: MetaAction[];
  date_start?: string;
  date_stop?: string;
}

/**
 * Generate appsecret_proof for secure API calls
 * This is an HMAC SHA-256 hash of the access token using the app secret
 */
function generateAppSecretProof(accessToken: string, appSecret: string): string {
  return crypto
    .createHmac("sha256", appSecret)
    .update(accessToken)
    .digest("hex");
}

export interface MetaApiResponse {
  data: MetaAdMetrics | null;
  error: string | null;
}

export interface InsightsFilterOptions {
  campaignId?: string;
  adsetId?: string;
}

export interface CampaignBreakdown {
  campaignId: string;
  campaignName: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  leads: number;
  scheduleCalls: number;
  ctr: number;
  costPerLead: number;
  costPerCall: number;
}

export interface AdSetBreakdown {
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  leads: number;
  scheduleCalls: number;
  ctr: number;
  costPerLead: number;
  costPerCall: number;
}

export interface MetaInsightsWithBreakdown {
  metrics: MetaAdMetrics;
  campaignBreakdown: CampaignBreakdown[];
  adsetBreakdown: AdSetBreakdown[];
}

export interface MetaApiResponseWithBreakdown {
  data: MetaInsightsWithBreakdown | null;
  error: string | null;
}

export type TimePeriod = "24h" | "7d" | "30d" | "3m" | "1y";

const META_API_VERSION = "v21.0";
const META_GRAPH_URL = `https://graph.facebook.com/${META_API_VERSION}`;

/**
 * Calculate date range based on time period
 */
function getDateRange(period: TimePeriod): { since: string; until: string } {
  const now = new Date();
  const until = now.toISOString().split("T")[0];
  
  let since: Date;
  
  switch (period) {
    case "24h":
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "3m":
      since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "1y":
      since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  return {
    since: since.toISOString().split("T")[0],
    until,
  };
}

/**
 * Get time period label for display
 */
export function getTimePeriodLabel(period: TimePeriod): string {
  switch (period) {
    case "24h":
      return "Last 24 Hours";
    case "7d":
      return "Last 7 Days";
    case "30d":
      return "Last 30 Days";
    case "3m":
      return "Last 3 Months";
    case "1y":
      return "Last Year";
    default:
      return "Last 7 Days";
  }
}

/**
 * Fetch ad insights from Meta API with optional filtering
 */
export async function fetchMetaAdInsights(period: TimePeriod, filters?: InsightsFilterOptions): Promise<MetaApiResponse> {
  const result = await fetchMetaAdInsightsWithBreakdown(period, filters);
  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }
  return { data: result.data.metrics, error: null };
}

/**
 * Fetch ad insights from Meta API with breakdown by campaign and adset
 */
export async function fetchMetaAdInsightsWithBreakdown(period: TimePeriod, filters?: InsightsFilterOptions): Promise<MetaApiResponseWithBreakdown> {
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const rawAdAccountId = process.env.META_AD_ACCOUNT_ID;
    
    // Ensure ad account ID has the required act_ prefix
    const adAccountId = rawAdAccountId?.startsWith("act_") 
      ? rawAdAccountId 
      : `act_${rawAdAccountId}`;

    if (!appSecret || !accessToken || !rawAdAccountId) {
      return {
        data: null,
        error: "Meta API credentials not configured. Please set META_APP_SECRET, META_ACCESS_TOKEN, and META_AD_ACCOUNT_ID environment variables.",
      };
    }
    
    const { since, until } = getDateRange(period);
    
    // Build the API URL for insights - fetch all available data
    const fields = [
      "adset_id",
      "adset_name",
      "campaign_id",
      "campaign_name",
      "spend",
      "clicks",
      "impressions",
      "reach",
      "cpc",
      "cpm",
      "ctr",
      "actions",
      "action_values",
      "conversions",
      "conversion_values",
      "cost_per_action_type",
      "cost_per_conversion",
      "website_ctr",
      "outbound_clicks",
      "outbound_clicks_ctr",
    ].join(",");
    
    // Generate appsecret_proof for secure API calls
    const appSecretProof = generateAppSecretProof(accessToken, appSecret);
    
    // Determine API endpoint based on filters
    let apiEndpoint: string;
    if (filters?.adsetId) {
      // Fetch insights for specific adset
      apiEndpoint = `${META_GRAPH_URL}/${filters.adsetId}/insights`;
    } else if (filters?.campaignId) {
      // Fetch insights for specific campaign
      apiEndpoint = `${META_GRAPH_URL}/${filters.campaignId}/insights`;
    } else {
      // Fetch insights for entire account
      apiEndpoint = `${META_GRAPH_URL}/${adAccountId}/insights`;
    }
    
    const url = new URL(apiEndpoint);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("appsecret_proof", appSecretProof);
    url.searchParams.set("fields", fields);
    url.searchParams.set("time_range", JSON.stringify({ since, until }));
    url.searchParams.set("level", "adset");
    url.searchParams.set("limit", "500"); // Get more results

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("[Meta API] Error response:", errorData);
      return {
        data: null,
        error: errorData.error?.message || `Meta API error: ${response.status}`,
      };
    }
    
    const data = await response.json();

    // Meta returns data in an array - aggregate across all ad sets
    if (!data.data || data.data.length === 0) {
      // No data for the period - return zeros
      return {
        data: {
          metrics: {
            spend: 0,
            clicks: 0,
            impressions: 0,
            reach: 0,
            cpc: 0,
            cpm: 0,
            ctr: 0,
            leads: 0,
            scheduleCalls: 0,
            dateStart: since,
            dateEnd: until,
          },
          campaignBreakdown: [],
          adsetBreakdown: [],
        },
        error: null,
      };
    }
    
    // Aggregate metrics across all ad sets
    let totalSpend = 0;
    let totalClicks = 0;
    let totalImpressions = 0;
    let totalReach = 0;
    let totalLeads = 0;
    let totalScheduleCalls = 0;
    
    // Breakdown maps
    const campaignMap = new Map<string, CampaignBreakdown>();
    const adsetMap = new Map<string, AdSetBreakdown>();
    
    const adsets: MetaAdSetInsight[] = data.data;
    
    for (const adset of adsets) {
      const spend = parseFloat(adset.spend || "0");
      const clicks = parseInt(adset.clicks || "0", 10);
      const impressions = parseInt(adset.impressions || "0", 10);
      const reach = parseInt(adset.reach || "0", 10);
      
      // Parse leads from actions
      let leads = 0;
      const actions: MetaAction[] = adset.actions || [];
      for (const action of actions) {
        if (action.action_type === "lead") {
          leads += parseInt(action.value, 10);
        }
      }
      
      // Parse schedule calls from conversions
      let scheduleCalls = 0;
      const conversions: MetaAction[] = adset.conversions || [];
      for (const conversion of conversions) {
        if (conversion.action_type === "schedule_total" || conversion.action_type === "schedule_website") {
          scheduleCalls += parseInt(conversion.value, 10);
          break;
        }
      }
      
      // Aggregate totals
      totalSpend += spend;
      totalClicks += clicks;
      totalImpressions += impressions;
      totalReach += reach;
      totalLeads += leads;
      totalScheduleCalls += scheduleCalls;
      
      // Campaign breakdown
      const campaignId = adset.campaign_id || "unknown";
      const campaignName = adset.campaign_name || "Unknown Campaign";
      const existingCampaign = campaignMap.get(campaignId);
      if (existingCampaign) {
        existingCampaign.spend += spend;
        existingCampaign.clicks += clicks;
        existingCampaign.impressions += impressions;
        existingCampaign.reach += reach;
        existingCampaign.leads += leads;
        existingCampaign.scheduleCalls += scheduleCalls;
      } else {
        campaignMap.set(campaignId, {
          campaignId,
          campaignName,
          spend,
          clicks,
          impressions,
          reach,
          leads,
          scheduleCalls,
          ctr: 0,
          costPerLead: 0,
          costPerCall: 0,
        });
      }
      
      // Adset breakdown
      const adsetId = adset.adset_id || "unknown";
      const adsetName = adset.adset_name || "Unknown Ad Set";
      adsetMap.set(adsetId, {
        adsetId,
        adsetName,
        campaignId,
        campaignName,
        spend,
        clicks,
        impressions,
        reach,
        leads,
        scheduleCalls,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        costPerLead: leads > 0 ? spend / leads : 0,
        costPerCall: scheduleCalls > 0 ? spend / scheduleCalls : 0,
      });
    }
    
    // Calculate derived metrics for campaign breakdown
    const campaignBreakdown = Array.from(campaignMap.values()).map((campaign) => ({
      ...campaign,
      ctr: campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0,
      costPerLead: campaign.leads > 0 ? campaign.spend / campaign.leads : 0,
      costPerCall: campaign.scheduleCalls > 0 ? campaign.spend / campaign.scheduleCalls : 0,
    })).sort((a, b) => b.spend - a.spend);
    
    const adsetBreakdown = Array.from(adsetMap.values()).sort((a, b) => b.spend - a.spend);
    
    // Calculate averages for rate metrics
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
    const avgCpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return {
      data: {
        metrics: {
          spend: totalSpend,
          clicks: totalClicks,
          impressions: totalImpressions,
          reach: totalReach,
          cpc: avgCpc,
          cpm: avgCpm,
          ctr: avgCtr,
          leads: totalLeads,
          scheduleCalls: totalScheduleCalls,
          dateStart: since,
          dateEnd: until,
        },
        campaignBreakdown,
        adsetBreakdown,
      },
      error: null,
    };
  } catch (error) {
    console.error("[Meta API] Failed to fetch insights:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch Meta ad insights",
    };
  }
}

// ============================================================================
// Individual Ads API
// ============================================================================

export type MetaAdStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED" | "PENDING_REVIEW" | "DISAPPROVED" | "PREAPPROVED" | "PENDING_BILLING_INFO" | "CAMPAIGN_PAUSED" | "ADSET_PAUSED" | "IN_PROCESS" | "WITH_ISSUES";

export interface MetaAdCreativeAsset {
  url: string;
  type: "image" | "video";
  thumbnailUrl?: string;
  aspectRatio?: string; // e.g., "1:1", "9:16", "4:5"
}

export interface MetaAdCreative {
  id: string;
  name?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  videoId?: string;
  body?: string;
  title?: string;
  callToActionType?: string;
  linkUrl?: string;
  assets: Record<string, MetaAdCreativeAsset>; // keyed by placement
}

export interface MetaAd {
  id: string;
  name: string;
  status: MetaAdStatus;
  effectiveStatus: MetaAdStatus;
  createdTime: string;
  campaign: {
    id: string;
    name: string;
    status: MetaAdStatus;
  };
  adset: {
    id: string;
    name: string;
    status: MetaAdStatus;
    /** Daily budget in account currency major units (e.g. dollars), null if not set */
    dailyBudget: number | null;
    /** Lifetime budget in account currency major units, null if not set */
    lifetimeBudget: number | null;
  };
  creative: MetaAdCreative;
  metrics: {
    spend: number;
    clicks: number;
    impressions: number;
    reach: number;
    cpc: number;
    cpm: number;
    ctr: number;
    leads: number;
    scheduleCalls: number;
    costPerLead: number;
    costPerCall: number;
  };
}

export interface MetaAllAdsApiResponse {
  data: MetaAd[] | null;
  error: string | null;
}

interface MetaAdApiCreative {
  id: string;
  name?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  body?: string;
  title?: string;
  call_to_action_type?: string;
  object_story_spec?: {
    link_data?: {
      image_hash?: string;
      link?: string;
      message?: string;
      name?: string;
      call_to_action?: {
        type?: string;
      };
    };
    video_data?: {
      video_id?: string;
      image_url?: string;
      title?: string;
      message?: string;
      call_to_action?: {
        type?: string;
      };
    };
  };
  asset_feed_spec?: {
    images?: Array<{
      hash?: string;
      url?: string;
      image_crops?: Record<string, [[number, number], [number, number]]>; // e.g., "100x100": [[0, 19], [1080, 1099]]
    }>;
    videos?: Array<{
      video_id?: string;
      thumbnail_url?: string;
    }>;
    bodies?: Array<{
      text?: string;
    }>;
    titles?: Array<{
      text?: string;
    }>;
    call_to_action_types?: string[];
    link_urls?: Array<{
      website_url?: string;
    }>;
  };
}

interface MetaAdApiInsight {
  spend?: string;
  clicks?: string;
  impressions?: string;
  reach?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: MetaAction[];
  conversions?: MetaAction[];
}

interface MetaAdApiResponse {
  id: string;
  name: string;
  status: MetaAdStatus;
  effective_status: MetaAdStatus;
  created_time?: string;
  campaign?: {
    id: string;
    name: string;
    status?: MetaAdStatus;
  };
  adset?: {
    id: string;
    name: string;
    status?: MetaAdStatus;
    daily_budget?: string;
    lifetime_budget?: string;
  };
  creative?: MetaAdApiCreative;
  insights?: {
    data?: MetaAdApiInsight[];
  };
}

interface MetaPaginatedResponse {
  data: MetaAdApiResponse[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
  };
}

// Store for image URLs fetched by hash
const imageHashCache: Map<string, string> = new Map();

/**
 * Fetch actual image URLs from Meta API using image hashes
 * Handles pagination and batching to get all images
 */
export async function fetchImagesByHash(hashes: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (hashes.length === 0) return result;
  
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const rawAdAccountId = process.env.META_AD_ACCOUNT_ID;
    
    if (!appSecret || !accessToken || !rawAdAccountId) return result;
    
    const adAccountId = rawAdAccountId?.startsWith("act_") 
      ? rawAdAccountId 
      : `act_${rawAdAccountId}`;
    
    const appSecretProof = generateAppSecretProof(accessToken, appSecret);
    
    // Process images from API response
    const processImageData = (data: { data?: Array<{ hash?: string; url?: string; permalink_url?: string }> }) => {
      if (!data.data) return;
      if (Array.isArray(data.data)) {
        for (const imgData of data.data) {
          const hash = imgData.hash;
          const imageUrl = imgData.url || imgData.permalink_url;
          if (hash && imageUrl) {
            result.set(hash, imageUrl);
            imageHashCache.set(hash, imageUrl);
          }
        }
      }
    };
    
    // Batch hashes into chunks of 50 to avoid URL length limits
    const BATCH_SIZE = 50;
    const hashBatches: string[][] = [];
    for (let i = 0; i < hashes.length; i += BATCH_SIZE) {
      hashBatches.push(hashes.slice(i, i + BATCH_SIZE));
    }
    
    // Fetch each batch
    for (const hashBatch of hashBatches) {
      // Initial URL for this batch
      const initialUrl = new URL(`${META_GRAPH_URL}/${adAccountId}/adimages`);
      initialUrl.searchParams.set("access_token", accessToken);
      initialUrl.searchParams.set("appsecret_proof", appSecretProof);
      initialUrl.searchParams.set("fields", "hash,url,permalink_url");
      initialUrl.searchParams.set("hashes", JSON.stringify(hashBatch));
      initialUrl.searchParams.set("limit", "100"); // Request more results per page
      
      let nextPageUrl: string | null = initialUrl.toString();
      
      // Handle pagination for this batch
      while (nextPageUrl) {
        const fetchUrl = nextPageUrl;
        const response: Response = await fetch(fetchUrl, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          next: { revalidate: 3600 },
        });
        
        const data = await response.json();
        
        if (response.ok) {
          processImageData(data);
          // Check for next page
          const pagingNext = data.paging?.next as string | undefined;
          if (pagingNext) {
            // Add appsecret_proof to next URL
            const nextUrlObj = new URL(pagingNext);
            nextUrlObj.searchParams.set("appsecret_proof", appSecretProof);
            nextPageUrl = nextUrlObj.toString();
          } else {
            nextPageUrl = null;
          }
        } else {
          nextPageUrl = null;
        }
      }
    }
    
  } catch (error) {
    console.error("[Meta API] Failed to fetch images by hash:", error);
  }
  
  return result;
}

/**
 * Get image URL from cache by hash
 */
function getImageFromCache(hash: string): string | undefined {
  return imageHashCache.get(hash);
}

/**
 * Parse creative data from Meta API response into our format
 * Uses image hash cache for high-quality images
 */
function parseCreative(creative: MetaAdApiCreative | undefined): MetaAdCreative {
  const assets: Record<string, MetaAdCreativeAsset> = {};
  
  // Try to get image from hash cache first (high quality)
  let bestUrl = "";
  const firstImageHash = creative?.asset_feed_spec?.images?.[0]?.hash;
  if (firstImageHash) {
    const cachedUrl = getImageFromCache(firstImageHash);
    if (cachedUrl) {
      bestUrl = cachedUrl;
    }
  }
  
  // Fallback to thumbnail_url if no cached image
  if (!bestUrl) {
    bestUrl = creative?.image_url || creative?.thumbnail_url || "";
  }
  
  // Default placeholder asset
  const defaultAsset: MetaAdCreativeAsset = {
    url: bestUrl,
    type: creative?.video_id ? "video" : "image",
    thumbnailUrl: bestUrl,
  };
  
  // Add default asset as "default" placement
  if (defaultAsset.url) {
    assets["default"] = defaultAsset;
  }
  
  // Parse object_story_spec for additional assets
  if (creative?.object_story_spec) {
    const spec = creative.object_story_spec;
    
    if (spec.link_data) {
      if (!assets["facebook_feed"]) {
        assets["facebook_feed"] = {
          url: bestUrl || creative.image_url || creative.thumbnail_url || "",
          type: "image",
        };
      }
    }
    
    if (spec.video_data) {
      const videoThumb = spec.video_data.image_url || creative.image_url || creative.thumbnail_url || "";
      assets["facebook_feed"] = {
        url: videoThumb,
        type: "video",
        thumbnailUrl: videoThumb,
      };
    }
  }
  
  // Parse asset_feed_spec for multiple placements - use hash cache for high quality
  if (creative?.asset_feed_spec) {
    const feedSpec = creative.asset_feed_spec;
    
    // Images - try to get from hash cache first, and extract aspect ratio from crops
    if (feedSpec.images && feedSpec.images.length > 0) {
      feedSpec.images.forEach((img, idx) => {
        const placementKey = idx === 0 ? "facebook_feed" : `placement_${idx}`;
        // Try hash cache first, then url, then skip
        const cachedUrl = img.hash ? getImageFromCache(img.hash) : undefined;
        const imageUrl = cachedUrl || img.url;
        
        // Determine aspect ratio from image_crops
        let aspectRatio: string | undefined;
        if (img.image_crops) {
          const cropKeys = Object.keys(img.image_crops);
          if (cropKeys.length > 0) {
            // Use the first crop specification (e.g., "100x100", "90x160")
            const cropKey = cropKeys[0];
            const [w, h] = cropKey.split("x").map(Number);
            if (w && h) {
              // Simplify common aspect ratios
              if (w === h) aspectRatio = "1:1";
              else if (w === 90 && h === 160) aspectRatio = "9:16";
              else if (w === 100 && h === 100) aspectRatio = "1:1";
              else if (w === 4 && h === 5) aspectRatio = "4:5";
              else aspectRatio = `${w}:${h}`;
            }
          }
        }
        
        if (imageUrl) {
          assets[placementKey] = {
            url: imageUrl,
            type: "image",
            aspectRatio,
          };
        }
      });
    }
    
    // Videos
    if (feedSpec.videos && feedSpec.videos.length > 0) {
      feedSpec.videos.forEach((vid, idx) => {
        if (vid.thumbnail_url) {
          const placementKey = idx === 0 ? "facebook_feed" : `video_placement_${idx}`;
          assets[placementKey] = {
            url: vid.thumbnail_url,
            type: "video",
            thumbnailUrl: vid.thumbnail_url,
            aspectRatio: "9:16", // Videos are typically 9:16 for stories/reels
          };
        }
      });
    }
  }
  
  // Ensure we have at least one asset entry
  if (Object.keys(assets).length === 0) {
    assets["default"] = {
      url: "",
      type: "image",
    };
  }
  
  const result = {
    id: creative?.id || "",
    name: creative?.name,
    thumbnailUrl: bestUrl || creative?.thumbnail_url,
    imageUrl: bestUrl || creative?.image_url || creative?.thumbnail_url,
    videoId: creative?.video_id,
    body: creative?.body || creative?.asset_feed_spec?.bodies?.[0]?.text || creative?.object_story_spec?.link_data?.message || creative?.object_story_spec?.video_data?.message,
    title: creative?.title || creative?.asset_feed_spec?.titles?.[0]?.text || creative?.object_story_spec?.link_data?.name || creative?.object_story_spec?.video_data?.title,
    callToActionType: creative?.call_to_action_type || creative?.asset_feed_spec?.call_to_action_types?.[0] || creative?.object_story_spec?.link_data?.call_to_action?.type || creative?.object_story_spec?.video_data?.call_to_action?.type,
    linkUrl: creative?.asset_feed_spec?.link_urls?.[0]?.website_url || creative?.object_story_spec?.link_data?.link,
    assets,
  };
  
  return result;
}

/**
 * Parse Meta budget string (cents) to major currency units
 */
function parseMetaBudgetCents(value?: string): number | null {
  if (!value) return null;
  const cents = parseInt(value, 10);
  if (Number.isNaN(cents)) return null;
  return cents / 100;
}

/**
 * Convert major currency units to Meta budget cents string
 */
function toMetaBudgetCents(amount: number): string {
  return Math.round(amount * 100).toString();
}

/**
 * Parse insights data from Meta API response
 */
function parseInsights(insights: MetaAdApiInsight | undefined): MetaAd["metrics"] {
  if (!insights) {
    return {
      spend: 0,
      clicks: 0,
      impressions: 0,
      reach: 0,
      cpc: 0,
      cpm: 0,
      ctr: 0,
      leads: 0,
      scheduleCalls: 0,
      costPerLead: 0,
      costPerCall: 0,
    };
  }
  
  const spend = parseFloat(insights.spend || "0");
  const clicks = parseInt(insights.clicks || "0", 10);
  const impressions = parseInt(insights.impressions || "0", 10);
  const reach = parseInt(insights.reach || "0", 10);
  
  // Parse leads from actions
  let leads = 0;
  let scheduleCalls = 0;
  
  if (insights.actions) {
    for (const action of insights.actions) {
      if (action.action_type === "lead") {
        leads += parseInt(action.value, 10);
      }
    }
  }
  
  // Parse schedule calls from conversions
  if (insights.conversions) {
    for (const conversion of insights.conversions) {
      if (conversion.action_type === "schedule_total" || conversion.action_type === "schedule_website") {
        scheduleCalls += parseInt(conversion.value, 10);
        break;
      }
    }
  }
  
  // Calculate derived metrics
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const costPerLead = leads > 0 ? spend / leads : 0;
  const costPerCall = scheduleCalls > 0 ? spend / scheduleCalls : 0;
  
  return {
    spend,
    clicks,
    impressions,
    reach,
    cpc,
    cpm,
    ctr,
    leads,
    scheduleCalls,
    costPerLead,
    costPerCall,
  };
}

/**
 * Fetch all ads with their creatives and insights (all-time data)
 */
export async function fetchAllAds(): Promise<MetaAllAdsApiResponse> {
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const rawAdAccountId = process.env.META_AD_ACCOUNT_ID;
    
    // Ensure ad account ID has the required act_ prefix
    const adAccountId = rawAdAccountId?.startsWith("act_") 
      ? rawAdAccountId 
      : `act_${rawAdAccountId}`;

    if (!appSecret || !accessToken || !rawAdAccountId) {
      return {
        data: null,
        error: "Meta API credentials not configured. Please set META_APP_SECRET, META_ACCESS_TOKEN, and META_AD_ACCOUNT_ID environment variables.",
      };
    }
    
    // Generate appsecret_proof for secure API calls
    const appSecretProof = generateAppSecretProof(accessToken, appSecret);
    
    // Fields to fetch for each ad - request high quality image sources
    const fields = [
      "id",
      "name",
      "status",
      "effective_status",
      "created_time",
      "campaign{id,name,status}",
      "adset{id,name,status,daily_budget,lifetime_budget}",
      "creative{id,name,thumbnail_url,image_url,video_id,body,title,call_to_action_type,object_story_spec,asset_feed_spec,image_crops,source_instagram_media_id}",
      "insights.date_preset(maximum){spend,clicks,impressions,reach,cpc,cpm,ctr,actions,conversions}",
    ].join(",");
    
    const allAds: MetaAd[] = [];
    let nextUrl: string | null = null;
    
    // Initial URL
    const initialUrl = new URL(`${META_GRAPH_URL}/${adAccountId}/ads`);
    initialUrl.searchParams.set("access_token", accessToken);
    initialUrl.searchParams.set("appsecret_proof", appSecretProof);
    initialUrl.searchParams.set("fields", fields);
    initialUrl.searchParams.set("limit", "100");
    
    let currentUrl: string = initialUrl.toString();
    
    // First pass: collect all raw ad data and image hashes
    const rawAdsData: MetaAdApiResponse[] = [];
    const imageHashes = new Set<string>();
    
    // Paginate through all results
    do {
      const response = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Meta API] Error fetching ads:", errorData);
        return {
          data: null,
          error: errorData.error?.message || `Meta API error: ${response.status}`,
        };
      }
      
      const data: MetaPaginatedResponse = await response.json();
      
      // Collect raw ad data and extract image hashes
      for (const adData of data.data) {
        rawAdsData.push(adData);
        
        // Extract image hashes from asset_feed_spec
        if (adData.creative?.asset_feed_spec?.images) {
          for (const img of adData.creative.asset_feed_spec.images) {
            if (img.hash) {
              imageHashes.add(img.hash);
            }
          }
        }
      }
      
      // Check for next page
      nextUrl = data.paging?.next || null;
      if (nextUrl) {
        const nextUrlObj = new URL(nextUrl);
        nextUrlObj.searchParams.set("appsecret_proof", appSecretProof);
        currentUrl = nextUrlObj.toString();
      }
    } while (nextUrl);
    
    // Fetch all images by hash in batch (if we have hashes)
    if (imageHashes.size > 0) {
      await fetchImagesByHash(Array.from(imageHashes));
    }
    
    // Second pass: process ads with cached image URLs
    for (const adData of rawAdsData) {
      const insightData = adData.insights?.data?.[0];
      
      const ad: MetaAd = {
        id: adData.id,
        name: adData.name,
        status: adData.status,
        effectiveStatus: adData.effective_status,
        createdTime: adData.created_time || new Date().toISOString(),
        campaign: {
          id: adData.campaign?.id || "",
          name: adData.campaign?.name || "Unknown Campaign",
          status: adData.campaign?.status || "PAUSED",
        },
        adset: {
          id: adData.adset?.id || "",
          name: adData.adset?.name || "Unknown Ad Set",
          status: adData.adset?.status || "PAUSED",
          dailyBudget: parseMetaBudgetCents(adData.adset?.daily_budget),
          lifetimeBudget: parseMetaBudgetCents(adData.adset?.lifetime_budget),
        },
        creative: parseCreative(adData.creative),
        metrics: parseInsights(insightData),
      };
      
      allAds.push(ad);
    }
    
    return {
      data: allAds,
      error: null,
    };
  } catch (error) {
    console.error("[Meta API] Failed to fetch all ads:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch Meta ads",
    };
  }
}

/**
 * Map our TimePeriod to Meta's date_preset format
 */
function getMetaDatePreset(period: TimePeriod): string {
  switch (period) {
    case "24h":
      return "yesterday"; // Meta doesn't have "last_24h", use yesterday for closest approximation
    case "7d":
      return "last_7d";
    case "30d":
      return "last_30d";
    case "3m":
      return "last_90d";
    case "1y":
      return "last_year";
    default:
      return "last_7d";
  }
}

/**
 * Fetch all ads with their creatives and time-period-specific insights
 */
export async function fetchAllAdsWithPeriod(period: TimePeriod): Promise<MetaAllAdsApiResponse> {
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const rawAdAccountId = process.env.META_AD_ACCOUNT_ID;
    
    // Ensure ad account ID has the required act_ prefix
    const adAccountId = rawAdAccountId?.startsWith("act_") 
      ? rawAdAccountId 
      : `act_${rawAdAccountId}`;

    if (!appSecret || !accessToken || !rawAdAccountId) {
      return {
        data: null,
        error: "Meta API credentials not configured. Please set META_APP_SECRET, META_ACCESS_TOKEN, and META_AD_ACCOUNT_ID environment variables.",
      };
    }
    
    // Generate appsecret_proof for secure API calls
    const appSecretProof = generateAppSecretProof(accessToken, appSecret);
    
    // Get the Meta date preset for this period
    const datePreset = getMetaDatePreset(period);
    
    // Fields to fetch for each ad - use time-period-specific insights
    const fields = [
      "id",
      "name",
      "status",
      "effective_status",
      "created_time",
      "campaign{id,name,status}",
      "adset{id,name,status,daily_budget,lifetime_budget}",
      "creative{id,name,thumbnail_url,image_url,video_id,body,title,call_to_action_type,object_story_spec,asset_feed_spec,image_crops,source_instagram_media_id}",
      `insights.date_preset(${datePreset}){spend,clicks,impressions,reach,cpc,cpm,ctr,actions,conversions}`,
    ].join(",");
    
    const allAds: MetaAd[] = [];
    let nextUrl: string | null = null;
    
    // Initial URL
    const initialUrl = new URL(`${META_GRAPH_URL}/${adAccountId}/ads`);
    initialUrl.searchParams.set("access_token", accessToken);
    initialUrl.searchParams.set("appsecret_proof", appSecretProof);
    initialUrl.searchParams.set("fields", fields);
    initialUrl.searchParams.set("limit", "100");
    
    let currentUrl: string = initialUrl.toString();
    
    // First pass: collect all raw ad data and image hashes
    const rawAdsData: MetaAdApiResponse[] = [];
    const imageHashes = new Set<string>();
    
    // Paginate through all results
    do {
      const response = await fetch(currentUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("[Meta API] Error fetching ads with period:", errorData);
        return {
          data: null,
          error: errorData.error?.message || `Meta API error: ${response.status}`,
        };
      }
      
      const data: MetaPaginatedResponse = await response.json();
      
      // Collect raw ad data and extract image hashes
      for (const adData of data.data) {
        rawAdsData.push(adData);
        
        // Extract image hashes from asset_feed_spec
        if (adData.creative?.asset_feed_spec?.images) {
          for (const img of adData.creative.asset_feed_spec.images) {
            if (img.hash) {
              imageHashes.add(img.hash);
            }
          }
        }
      }
      
      // Check for next page
      nextUrl = data.paging?.next || null;
      if (nextUrl) {
        const nextUrlObj = new URL(nextUrl);
        nextUrlObj.searchParams.set("appsecret_proof", appSecretProof);
        currentUrl = nextUrlObj.toString();
      }
    } while (nextUrl);
    
    // Fetch all images by hash in batch (if we have hashes)
    if (imageHashes.size > 0) {
      await fetchImagesByHash(Array.from(imageHashes));
    }
    
    // Second pass: process ads with cached image URLs
    for (const adData of rawAdsData) {
      const insightData = adData.insights?.data?.[0];
      
      const ad: MetaAd = {
        id: adData.id,
        name: adData.name,
        status: adData.status,
        effectiveStatus: adData.effective_status,
        createdTime: adData.created_time || new Date().toISOString(),
        campaign: {
          id: adData.campaign?.id || "",
          name: adData.campaign?.name || "Unknown Campaign",
          status: adData.campaign?.status || "PAUSED",
        },
        adset: {
          id: adData.adset?.id || "",
          name: adData.adset?.name || "Unknown Ad Set",
          status: adData.adset?.status || "PAUSED",
          dailyBudget: parseMetaBudgetCents(adData.adset?.daily_budget),
          lifetimeBudget: parseMetaBudgetCents(adData.adset?.lifetime_budget),
        },
        creative: parseCreative(adData.creative),
        metrics: parseInsights(insightData),
      };
      
      allAds.push(ad);
    }
    
    return {
      data: allAds,
      error: null,
    };
  } catch (error) {
    console.error("[Meta API] Failed to fetch all ads with period:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch Meta ads",
    };
  }
}

// ============================================================================
// Campaigns and Ad Sets API
// ============================================================================

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: string;
  campaignId: string;
}

export interface MetaCampaignsResponse {
  data: MetaCampaign[] | null;
  error: string | null;
}

export interface MetaAdSetsResponse {
  data: MetaAdSet[] | null;
  error: string | null;
}

/**
 * Fetch all campaigns from the ad account
 */
export async function fetchCampaigns(): Promise<MetaCampaignsResponse> {
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const rawAdAccountId = process.env.META_AD_ACCOUNT_ID;
    
    const adAccountId = rawAdAccountId?.startsWith("act_") 
      ? rawAdAccountId 
      : `act_${rawAdAccountId}`;

    if (!appSecret || !accessToken || !rawAdAccountId) {
      return {
        data: null,
        error: "Meta API credentials not configured",
      };
    }
    
    const appSecretProof = generateAppSecretProof(accessToken, appSecret);
    
    const url = new URL(`${META_GRAPH_URL}/${adAccountId}/campaigns`);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("appsecret_proof", appSecretProof);
    url.searchParams.set("fields", "id,name,status,objective");
    url.searchParams.set("limit", "500");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return {
        data: null,
        error: errorData.error?.message || `Meta API error: ${response.status}`,
      };
    }
    
    const data = await response.json();
    
    const campaigns: MetaCampaign[] = (data.data || []).map((c: { id: string; name: string; status: string; objective: string }) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      objective: c.objective,
    }));
    
    return { data: campaigns, error: null };
  } catch (error) {
    console.error("[Meta API] Failed to fetch campaigns:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch campaigns",
    };
  }
}

/**
 * Fetch all ad sets for a specific campaign
 */
export async function fetchAdSets(campaignId: string): Promise<MetaAdSetsResponse> {
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!appSecret || !accessToken) {
      return {
        data: null,
        error: "Meta API credentials not configured",
      };
    }
    
    const appSecretProof = generateAppSecretProof(accessToken, appSecret);
    
    const url = new URL(`${META_GRAPH_URL}/${campaignId}/adsets`);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("appsecret_proof", appSecretProof);
    url.searchParams.set("fields", "id,name,status");
    url.searchParams.set("limit", "500");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return {
        data: null,
        error: errorData.error?.message || `Meta API error: ${response.status}`,
      };
    }
    
    const data = await response.json();
    
    const adSets: MetaAdSet[] = (data.data || []).map((a: { id: string; name: string; status: string }) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      campaignId,
    }));
    
    return { data: adSets, error: null };
  } catch (error) {
    console.error("[Meta API] Failed to fetch ad sets:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch ad sets",
    };
  }
}

/**
 * Get the count of ads in an ad set (excluding deleted ads)
 * This is useful for determining how many more ads can be added before hitting the 50 ad limit
 */
export async function fetchAdSetAdCount(adSetId: string): Promise<{ data: number | null; error: string | null }> {
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!appSecret || !accessToken) {
      return {
        data: null,
        error: "Meta API credentials not configured",
      };
    }
    
    const appSecretProof = generateAppSecretProof(accessToken, appSecret);
    
    // Fetch ads for this ad set with minimal fields, filtering out deleted ads
    const url = new URL(`${META_GRAPH_URL}/${adSetId}/ads`);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("appsecret_proof", appSecretProof);
    url.searchParams.set("fields", "id");
    url.searchParams.set("limit", "100");
    // Filter to exclude deleted ads
    url.searchParams.set("filtering", JSON.stringify([
      { field: "effective_status", operator: "NOT_IN", value: ["DELETED", "ARCHIVED"] }
    ]));

    let totalCount = 0;
    let currentUrl: string = url.toString();
    let hasMore = true;

    // Paginate through all results to get accurate count
    while (hasMore) {
      const response: Response = await fetch(currentUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        return {
          data: null,
          error: errorData.error?.message || `Meta API error: ${response.status}`,
        };
      }
      
      const data = await response.json();
      totalCount += (data.data || []).length;
      
      // Check for next page
      if (data.paging?.next) {
        const nextUrlObj = new URL(data.paging.next);
        nextUrlObj.searchParams.set("appsecret_proof", appSecretProof);
        currentUrl = nextUrlObj.toString();
      } else {
        hasMore = false;
      }
    }
    
    console.log(`[Meta API] Ad set ${adSetId} has ${totalCount} active ads`);
    return { data: totalCount, error: null };
  } catch (error) {
    console.error("[Meta API] Failed to fetch ad set ad count:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch ad set ad count",
    };
  }
}

// ============================================================================
// Create Ad API
// ============================================================================

export interface CreateAdParams {
  campaignId: string;
  adSetId: string;
  name: string;
  imageUrl: string; // URL of the image to upload (1080x1080 for feed)
  storyImageUrl?: string; // URL of the story image (1080x1920 for stories)
  primaryText: string;
  headline: string;
  description?: string;
  linkUrl: string;
  urlParams?: string; // URL parameters for tracking (goes in url_tags, not the URL itself)
  callToAction?: string;
}

export interface CreateAdResponse {
  data: {
    adId: string;
    adUrl: string;
  } | null;
  error: string | null;
}

/**
 * Upload an image to the Meta ad account and return the hash
 * Uses multipart/form-data with actual image bytes (required by Meta API)
 */
async function uploadImageToMeta(imageUrl: string): Promise<{ hash: string } | { error: string }> {
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const rawAdAccountId = process.env.META_AD_ACCOUNT_ID;
    
    const adAccountId = rawAdAccountId?.startsWith("act_") 
      ? rawAdAccountId 
      : `act_${rawAdAccountId}`;

    if (!appSecret || !accessToken || !rawAdAccountId) {
      return { error: "Meta API credentials not configured" };
    }
    
    const appSecretProof = generateAppSecretProof(accessToken, appSecret);

    console.log("[Meta API] Step 1: Fetching image from", imageUrl);

    // First, fetch the image bytes from the URL
    const imgResponse = await fetch(imageUrl);
    if (!imgResponse.ok) {
      return { error: `Failed to fetch image from URL: ${imgResponse.status}` };
    }
    
    const imgBuffer = await imgResponse.arrayBuffer();
    const imgBytes = Buffer.from(imgBuffer);
    const contentType = imgResponse.headers.get("content-type") || "image/png";
    
    // Determine file extension from content type
    let extension = "png";
    if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      extension = "jpg";
    } else if (contentType.includes("gif")) {
      extension = "gif";
    } else if (contentType.includes("webp")) {
      extension = "webp";
    }
    
    const filename = `ad_image.${extension}`;

    console.log("[Meta API] Step 1b: Uploading image bytes to Meta", `(${imgBytes.length} bytes, ${contentType})`);

    // Create multipart/form-data with actual bytes
    const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
    
    const bodyParts: Buffer[] = [];
    
    // Add access_token
    bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="access_token"\r\n\r\n${accessToken}\r\n`));
    
    // Add appsecret_proof
    bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="appsecret_proof"\r\n\r\n${appSecretProof}\r\n`));
    
    // Add the image bytes
    bodyParts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="filename"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`));
    bodyParts.push(imgBytes);
    bodyParts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    
    const fullBody = Buffer.concat(bodyParts);
    
    const uploadUrl = `${META_GRAPH_URL}/${adAccountId}/adimages`;
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: fullBody,
    });
    
    const responseText = await response.text();
    console.log("[Meta API] Upload image response status:", response.status);
    console.log("[Meta API] Upload image response:", responseText);
    
    if (!response.ok) {
      const errorData = JSON.parse(responseText);
      return { error: `Image upload failed: ${errorData.error?.message || response.status}` };
    }
    
    const data = JSON.parse(responseText);
    
    // The response contains images keyed by filename
    const images = data.images;
    if (images) {
      const firstImage = Object.values(images)[0] as { hash: string };
      if (firstImage?.hash) {
        console.log("[Meta API] Image hash obtained:", firstImage.hash);
        return { hash: firstImage.hash };
      }
    }
    
    return { error: "No image hash returned" };
  } catch (error) {
    console.error("[Meta API] Failed to upload image:", error);
    return { error: error instanceof Error ? error.message : "Failed to upload image" };
  }
}

/**
 * Create an ad creative with multiple image formats for different placements
 * Uses asset_feed_spec with asset_customization_rules to assign different images to different placements
 */
async function createAdCreative(params: {
  name: string;
  imageHash: string; // 1080x1080 for feed placements
  storyImageHash?: string; // 1080x1920 for story placements
  primaryText: string;
  headline: string;
  description?: string;
  linkUrl: string;
  urlParams?: string; // URL parameters for tracking (goes in url_tags)
  callToAction: string;
  pageId: string;
}): Promise<{ creativeId: string } | { error: string }> {
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const rawAdAccountId = process.env.META_AD_ACCOUNT_ID;
    
    const adAccountId = rawAdAccountId?.startsWith("act_") 
      ? rawAdAccountId 
      : `act_${rawAdAccountId}`;

    if (!appSecret || !accessToken || !rawAdAccountId) {
      return { error: "Meta API credentials not configured" };
    }
    
    const appSecretProof = generateAppSecretProof(accessToken, appSecret);
    
    const url = new URL(`${META_GRAPH_URL}/${adAccountId}/adcreatives`);

    console.log("[Meta API] Step 2: Creating ad creative at", `${META_GRAPH_URL}/${adAccountId}/adcreatives`);

    // Use form-urlencoded format
    const formData = new URLSearchParams();
    formData.append("access_token", accessToken);
    formData.append("appsecret_proof", appSecretProof);
    formData.append("name", params.name);

    // If we have both feed and story images, use asset_feed_spec with customization rules
    if (params.storyImageHash && params.storyImageHash !== params.imageHash) {
      // Build asset_feed_spec with labeled images for different placements
      const assetFeedSpec = {
        images: [
          {
            hash: params.imageHash,
            adlabels: [{ name: "feed_image" }],
          },
          {
            hash: params.storyImageHash,
            adlabels: [{ name: "story_image" }],
          },
        ],
        bodies: [{ text: params.primaryText }],
        titles: [{ text: params.headline }],
        descriptions: params.description ? [{ text: params.description }] : [],
        call_to_action_types: [params.callToAction],
        link_urls: [{ website_url: params.linkUrl }],
        ad_formats: ["SINGLE_IMAGE"],
        asset_customization_rules: [
          // Rule 1: Use feed image (1:1) for feed-type placements
          {
            customization_spec: {
              publisher_platforms: ["facebook", "instagram"],
              facebook_positions: ["feed", "marketplace", "video_feeds", "search", "profile_feed"],
              instagram_positions: ["stream", "explore", "explore_home", "profile_feed", "ig_search"],
            },
            image_label: { name: "feed_image" },
          },
          // Rule 2: Use story image (9:16) for story/reels placements
          {
            customization_spec: {
              publisher_platforms: ["facebook", "instagram"],
              facebook_positions: ["story", "facebook_reels"],
              instagram_positions: ["story", "reels"],
            },
            image_label: { name: "story_image" },
          },
        ],
      };

      console.log("[Meta API] Using asset_feed_spec with customization rules:");
      console.log("[Meta API] Feed image hash:", params.imageHash);
      console.log("[Meta API] Story image hash:", params.storyImageHash);
      console.log("[Meta API] asset_feed_spec:", JSON.stringify(assetFeedSpec, null, 2));

      formData.append("object_type", "SHARE");
      formData.append("asset_feed_spec", JSON.stringify(assetFeedSpec));
      formData.append("object_story_spec", JSON.stringify({
        page_id: params.pageId,
        instagram_user_id: "17841468133424678",
      }));
    } else {
      // Fallback to simple object_story_spec for single image
      const objectStorySpec = {
        page_id: params.pageId,
        instagram_user_id: "17841468133424678",
        link_data: {
          image_hash: params.imageHash,
          link: params.linkUrl,
          message: params.primaryText,
          name: params.headline,
          description: params.description || "",
          call_to_action: {
            type: params.callToAction,
          },
        },
      };

      console.log("[Meta API] Using simple object_story_spec (single image):");
      console.log("[Meta API] object_story_spec:", JSON.stringify(objectStorySpec, null, 2));

      formData.append("object_story_spec", JSON.stringify(objectStorySpec));
    }

    // Add URL tracking parameters at creative level (per Meta API docs)
    if (params.urlParams) {
      formData.append("url_tags", params.urlParams);
      console.log("[Meta API] Adding url_tags to creative:", params.urlParams);
    }

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    
    const responseText = await response.text();
    console.log("[Meta API] Create creative response status:", response.status);
    console.log("[Meta API] Create creative response:", responseText);
    
    if (!response.ok) {
      const errorData = JSON.parse(responseText);
      return { error: `Creative creation failed: ${errorData.error?.message || response.status}` };
    }
    
    const data = JSON.parse(responseText);
    console.log("[Meta API] Creative ID obtained:", data.id);
    return { creativeId: data.id };
  } catch (error) {
    console.error("[Meta API] Failed to create ad creative:", error);
    return { error: error instanceof Error ? error.message : "Failed to create ad creative" };
  }
}

/**
 * Create a new ad on Meta
 */
export async function createMetaAd(params: CreateAdParams): Promise<CreateAdResponse> {
  console.log("[Meta API] ========== Starting Ad Creation ==========");
  console.log("[Meta API] Params:", JSON.stringify({
    adSetId: params.adSetId,
    name: params.name,
    imageUrl: params.imageUrl,
    storyImageUrl: params.storyImageUrl,
    headline: params.headline,
    linkUrl: params.linkUrl,
    callToAction: params.callToAction,
    primaryTextLength: params.primaryText?.length,
  }, null, 2));
  
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const rawAdAccountId = process.env.META_AD_ACCOUNT_ID;
    const pageId = "401128813091067";
    
    const adAccountId = rawAdAccountId?.startsWith("act_") 
      ? rawAdAccountId 
      : `act_${rawAdAccountId}`;

    console.log("[Meta API] Ad Account ID:", adAccountId);
    console.log("[Meta API] Page ID:", pageId);

    if (!appSecret || !accessToken || !rawAdAccountId) {
      console.log("[Meta API] ERROR: Missing credentials");
      return {
        data: null,
        error: "Meta API credentials not configured",
      };
    }
    
    const appSecretProof = generateAppSecretProof(accessToken, appSecret);

    // Step 1: Upload the feed image (1080x1080)
    console.log("[Meta API] Uploading feed image (1080x1080)...");
    const imageResult = await uploadImageToMeta(params.imageUrl);
    if ("error" in imageResult) {
      return { data: null, error: imageResult.error };
    }

    // Step 1b: Upload the story image (1080x1920) if provided
    let storyImageHash: string | undefined;
    if (params.storyImageUrl) {
      console.log("[Meta API] Uploading story image (1080x1920)...");
      const storyImageResult = await uploadImageToMeta(params.storyImageUrl);
      if ("error" in storyImageResult) {
        console.log("[Meta API] Story image upload failed, continuing with feed image only");
      } else {
        storyImageHash = storyImageResult.hash;
      }
    }

    // Step 2: Create the ad creative with both images
    const creativeResult = await createAdCreative({
      name: `${params.name} - Creative`,
      imageHash: imageResult.hash,
      storyImageHash,
      primaryText: params.primaryText,
      headline: params.headline,
      description: params.description,
      linkUrl: params.linkUrl,
      urlParams: params.urlParams,
      callToAction: params.callToAction || "LEARN_MORE",
      pageId,
    });
    if ("error" in creativeResult) {
      return { data: null, error: creativeResult.error };
    }

    // Step 3: Create the ad
    const url = new URL(`${META_GRAPH_URL}/${adAccountId}/ads`);

    console.log("[Meta API] Step 3: Creating ad at", `${META_GRAPH_URL}/${adAccountId}/ads`);
    console.log("[Meta API] Ad params - name:", params.name, "adset_id:", params.adSetId, "creative_id:", creativeResult.creativeId);

    // Use form-urlencoded format
    const formData = new URLSearchParams();
    formData.append("access_token", accessToken);
    formData.append("appsecret_proof", appSecretProof);
    formData.append("name", params.name);
    formData.append("adset_id", params.adSetId);
    formData.append("creative", JSON.stringify({ creative_id: creativeResult.creativeId }));
    formData.append("status", "ACTIVE");
    // Disable multi-advertiser ads
    formData.append("multi_advertiser_ads_opt_in_status", "OPT_OUT");

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    
    const responseText = await response.text();
    console.log("[Meta API] Create ad response status:", response.status);
    console.log("[Meta API] Create ad response:", responseText);
    
    if (!response.ok) {
      const errorData = JSON.parse(responseText);
      const metaError = errorData.error;
      const errorMsg = metaError?.error_user_msg || metaError?.message || `Status ${response.status}`;
      const isAdSetFull = metaError?.error_subcode === 1487809;
      return {
        data: null,
        error: isAdSetFull
          ? `AD_SET_FULL: ${errorMsg}`
          : `Ad creation failed: ${errorMsg}`,
      };
    }
    
    const data = JSON.parse(responseText);
    const adId = data.id;
    const businessId = process.env.META_BUSINESS_ID || "564348312593561";
    const adUrl = `https://adsmanager.facebook.com/adsmanager/manage/ads/edit/standalone?act=${rawAdAccountId}&ads_manager_write_regions=true&business_id=${businessId}&selected_campaign_ids=${params.campaignId}&selected_adset_ids=${params.adSetId}&selected_ad_ids=${adId}&nav_source=no_referrer`;
    
    console.log("[Meta API] Ad created successfully! ID:", adId);
    
    return {
      data: {
        adId,
        adUrl,
      },
      error: null,
    };
  } catch (error) {
    console.error("[Meta API] Failed to create ad:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to create ad",
    };
  }
}

// ============================================================================
// Delete Ad API
// ============================================================================

export interface DeleteAdResponse {
  data: { success: boolean } | null;
  error: string | null;
}

export interface UpdateEntityStatusResponse {
  data: { success: boolean; status: "ACTIVE" | "PAUSED" } | null;
  error: string | null;
}

// ============================================================================
// Create Ad Set API
// ============================================================================

export interface CreateAdSetParams {
  campaignId: string;
  name: string;
  sourceAdSetId: string; // Ad set to clone settings from
}

export interface CreateAdSetResponse {
  data: {
    adSetId: string;
    name: string;
  } | null;
  error: string | null;
}

interface AdSetDetails {
  id: string;
  name: string;
  status: string;
  targeting: Record<string, unknown>;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_amount?: string;
  bid_strategy?: string;
  billing_event: string;
  optimization_goal: string;
  promoted_object?: {
    page_id?: string;
    pixel_id?: string;
    custom_event_type?: string;
    application_id?: string;
    object_store_url?: string;
  };
  destination_type?: string;
  start_time?: string;
  end_time?: string;
  attribution_spec?: Array<{
    event_type: string;
    window_days: number;
  }>;
}

/**
 * Fetch ad set details to clone settings from
 */
async function fetchAdSetDetails(adSetId: string): Promise<{ data: AdSetDetails | null; error: string | null }> {
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!appSecret || !accessToken) {
      return { data: null, error: "Meta API credentials not configured" };
    }

    const appSecretProof = generateAppSecretProof(accessToken, appSecret);

    const fields = [
      "id",
      "name",
      "status",
      "targeting",
      "daily_budget",
      "lifetime_budget",
      "bid_amount",
      "bid_strategy",
      "billing_event",
      "optimization_goal",
      "promoted_object",
      "destination_type",
      "start_time",
      "end_time",
      "attribution_spec",
    ].join(",");

    const url = new URL(`${META_GRAPH_URL}/${adSetId}`);
    url.searchParams.set("access_token", accessToken);
    url.searchParams.set("appsecret_proof", appSecretProof);
    url.searchParams.set("fields", fields);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        data: null,
        error: errorData.error?.message || `Meta API error: ${response.status}`,
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    console.error("[Meta API] Failed to fetch ad set details:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch ad set details",
    };
  }
}

/**
 * Create a new ad set by cloning settings from an existing one
 * This is useful when you need to split ads across multiple ad sets (e.g., 50 ad limit per ad set)
 */
export async function createAdSet(params: CreateAdSetParams): Promise<CreateAdSetResponse> {
  console.log("[Meta API] ========== Starting Ad Set Creation ==========");
  console.log("[Meta API] Params:", JSON.stringify(params, null, 2));

  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;
    const rawAdAccountId = process.env.META_AD_ACCOUNT_ID;

    const adAccountId = rawAdAccountId?.startsWith("act_")
      ? rawAdAccountId
      : `act_${rawAdAccountId}`;

    if (!appSecret || !accessToken || !rawAdAccountId) {
      console.log("[Meta API] ERROR: Missing credentials");
      return {
        data: null,
        error: "Meta API credentials not configured",
      };
    }

    // Step 1: Fetch the source ad set to get its settings
    console.log("[Meta API] Fetching source ad set details:", params.sourceAdSetId);
    const sourceResult = await fetchAdSetDetails(params.sourceAdSetId);
    if (sourceResult.error || !sourceResult.data) {
      return { data: null, error: sourceResult.error || "Failed to fetch source ad set" };
    }

    const source = sourceResult.data;
    console.log("[Meta API] Source ad set fetched:", source.name);

    const appSecretProof = generateAppSecretProof(accessToken, appSecret);

    // Step 2: Create the new ad set with cloned settings
    const url = new URL(`${META_GRAPH_URL}/${adAccountId}/adsets`);

    const formData = new URLSearchParams();
    formData.append("access_token", accessToken);
    formData.append("appsecret_proof", appSecretProof);
    formData.append("name", params.name);
    formData.append("campaign_id", params.campaignId);
    formData.append("status", "ACTIVE");
    formData.append("billing_event", source.billing_event);
    formData.append("optimization_goal", source.optimization_goal);
    formData.append("targeting", JSON.stringify(source.targeting));

    // Copy budget settings
    if (source.daily_budget) {
      formData.append("daily_budget", source.daily_budget);
    }
    if (source.lifetime_budget) {
      formData.append("lifetime_budget", source.lifetime_budget);
    }

    // Copy bid settings
    if (source.bid_amount) {
      formData.append("bid_amount", source.bid_amount);
    }
    if (source.bid_strategy) {
      formData.append("bid_strategy", source.bid_strategy);
    }

    // Copy promoted object (page, pixel, etc.)
    if (source.promoted_object) {
      formData.append("promoted_object", JSON.stringify(source.promoted_object));
    }

    // Copy destination type
    if (source.destination_type) {
      formData.append("destination_type", source.destination_type);
    }

    // Copy attribution settings
    if (source.attribution_spec) {
      formData.append("attribution_spec", JSON.stringify(source.attribution_spec));
    }

    console.log("[Meta API] Creating ad set at:", `${META_GRAPH_URL}/${adAccountId}/adsets`);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const responseText = await response.text();
    console.log("[Meta API] Create ad set response status:", response.status);
    console.log("[Meta API] Create ad set response:", responseText);

    if (!response.ok) {
      const errorData = JSON.parse(responseText);
      return {
        data: null,
        error: `Ad set creation failed: ${errorData.error?.message || response.status}`,
      };
    }

    const data = JSON.parse(responseText);
    console.log("[Meta API] Ad set created successfully! ID:", data.id);

    return {
      data: {
        adSetId: data.id,
        name: params.name,
      },
      error: null,
    };
  } catch (error) {
    console.error("[Meta API] Failed to create ad set:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to create ad set",
    };
  }
}

/**
 * Delete an ad from Meta
 * This sets the ad status to DELETED
 */
export async function deleteMetaAd(adId: string): Promise<DeleteAdResponse> {
  console.log("[Meta API] ========== Starting Ad Deletion ==========");
  console.log("[Meta API] Ad ID:", adId);
  
  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!appSecret || !accessToken) {
      console.log("[Meta API] ERROR: Missing credentials");
      return {
        data: null,
        error: "Meta API credentials not configured",
      };
    }
    
    const appSecretProof = generateAppSecretProof(accessToken, appSecret);
    
    const url = new URL(`${META_GRAPH_URL}/${adId}`);
    
    // Use form-urlencoded format to update status to DELETED
    const formData = new URLSearchParams();
    formData.append("access_token", accessToken);
    formData.append("appsecret_proof", appSecretProof);
    formData.append("status", "DELETED");

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
    
    const responseText = await response.text();
    console.log("[Meta API] Delete ad response status:", response.status);
    console.log("[Meta API] Delete ad response:", responseText);
    
    if (!response.ok) {
      const errorData = JSON.parse(responseText);
      return {
        data: null,
        error: `Ad deletion failed: ${errorData.error?.message || response.status}`,
      };
    }
    
    console.log("[Meta API] Ad deleted successfully!");
    
    return {
      data: { success: true },
      error: null,
    };
  } catch (error) {
    console.error("[Meta API] Failed to delete ad:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to delete ad",
    };
  }
}

/**
 * Update status (ACTIVE / PAUSED) for a Meta campaign, ad set, or ad
 */
export async function updateMetaEntityStatus(
  entityId: string,
  status: "ACTIVE" | "PAUSED"
): Promise<UpdateEntityStatusResponse> {
  console.log("[Meta API] updating status…");
  console.log("[Meta API] Entity ID:", entityId, "→", status);

  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!appSecret || !accessToken) {
      console.log("[Meta API] ERROR: Missing credentials");
      return {
        data: null,
        error: "Meta API credentials not configured",
      };
    }

    const appSecretProof = generateAppSecretProof(accessToken, appSecret);
    const url = new URL(`${META_GRAPH_URL}/${entityId}`);

    const formData = new URLSearchParams();
    formData.append("access_token", accessToken);
    formData.append("appsecret_proof", appSecretProof);
    formData.append("status", status);

    console.log("[Meta API] posting status update to Meta Graph…");
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const responseText = await response.text();
    console.log("[Meta API] Update status response:", response.status, responseText);

    if (!response.ok) {
      const errorData = JSON.parse(responseText);
      return {
        data: null,
        error: `Status update failed: ${errorData.error?.message || response.status}`,
      };
    }

    console.log("[Meta API] Status updated successfully");
    return {
      data: { success: true, status },
      error: null,
    };
  } catch (error) {
    console.error("[Meta API] Failed to update entity status:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to update status",
    };
  }
}

export interface BulkStatusEntity {
  entityType: "ad" | "adset" | "campaign";
  entityId: string;
}

export interface BulkUpdateEntityStatusResponse {
  data: {
    succeeded: string[];
    failed: Array<{ entityId: string; entityType: string; error: string }>;
  } | null;
  error: string | null;
}

/**
 * Bulk update status for multiple Meta campaigns, ad sets, or ads
 */
export async function updateMetaEntitiesStatus(
  entities: BulkStatusEntity[],
  status: "ACTIVE" | "PAUSED"
): Promise<BulkUpdateEntityStatusResponse> {
  console.log("[Meta API] bulk updating status…", { count: entities.length, status });

  const succeeded: string[] = [];
  const failed: Array<{ entityId: string; entityType: string; error: string }> = [];

  // Deduplicate by entityId (same campaign shared across ads)
  const seen = new Set<string>();
  const uniqueEntities = entities.filter((entity) => {
    const key = `${entity.entityType}:${entity.entityId}`;
    if (!entity.entityId || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const entity of uniqueEntities) {
    console.log("[Meta API] bulk updating entity…", entity.entityType, entity.entityId);
    const result = await updateMetaEntityStatus(entity.entityId, status);
    if (result.error) {
      failed.push({
        entityId: entity.entityId,
        entityType: entity.entityType,
        error: result.error,
      });
    } else {
      succeeded.push(entity.entityId);
    }
  }

  console.log("[Meta API] bulk status update finished", {
    succeeded: succeeded.length,
    failed: failed.length,
  });

  return {
    data: { succeeded, failed },
    error: null,
  };
}

export type AdSetBudgetType = "daily" | "lifetime";

export interface UpdateAdSetBudgetResponse {
  data: {
    adSetId: string;
    budgetType: AdSetBudgetType;
    amount: number;
  } | null;
  error: string | null;
}

/**
 * Update daily or lifetime budget for a Meta ad set.
 * `amount` is in major currency units (e.g. dollars).
 */
export async function updateMetaAdSetBudget(
  adSetId: string,
  budgetType: AdSetBudgetType,
  amount: number
): Promise<UpdateAdSetBudgetResponse> {
  console.log("[Meta API] updating ad set budget…", { adSetId, budgetType, amount });

  try {
    const appSecret = process.env.META_APP_SECRET;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!appSecret || !accessToken) {
      console.log("[Meta API] ERROR: Missing credentials");
      return {
        data: null,
        error: "Meta API credentials not configured",
      };
    }

    if (!adSetId || amount <= 0 || Number.isNaN(amount)) {
      return {
        data: null,
        error: "Invalid ad set id or budget amount",
      };
    }

    const appSecretProof = generateAppSecretProof(accessToken, appSecret);
    const url = new URL(`${META_GRAPH_URL}/${adSetId}`);
    const cents = toMetaBudgetCents(amount);

    const formData = new URLSearchParams();
    formData.append("access_token", accessToken);
    formData.append("appsecret_proof", appSecretProof);
    if (budgetType === "daily") {
      formData.append("daily_budget", cents);
    } else {
      formData.append("lifetime_budget", cents);
    }

    console.log("[Meta API] posting ad set budget update…");
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const responseText = await response.text();
    console.log("[Meta API] Update ad set budget response:", response.status, responseText);

    if (!response.ok) {
      const errorData = JSON.parse(responseText);
      return {
        data: null,
        error: `Budget update failed: ${errorData.error?.error_user_msg || errorData.error?.message || response.status}`,
      };
    }

    console.log("[Meta API] Ad set budget updated successfully");
    return {
      data: { adSetId, budgetType, amount },
      error: null,
    };
  } catch (error) {
    console.error("[Meta API] Failed to update ad set budget:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to update ad set budget",
    };
  }
}

export interface BulkUpdateAdSetBudgetResponse {
  data: {
    succeeded: string[];
    failed: Array<{ adSetId: string; error: string }>;
  } | null;
  error: string | null;
}

/**
 * Bulk update budgets for multiple Meta ad sets
 */
export async function updateMetaAdSetBudgets(
  adSetIds: string[],
  budgetType: AdSetBudgetType,
  amount: number
): Promise<BulkUpdateAdSetBudgetResponse> {
  console.log("[Meta API] bulk updating ad set budgets…", {
    count: adSetIds.length,
    budgetType,
    amount,
  });

  const succeeded: string[] = [];
  const failed: Array<{ adSetId: string; error: string }> = [];
  const uniqueIds = Array.from(new Set(adSetIds.filter(Boolean)));

  for (const adSetId of uniqueIds) {
    console.log("[Meta API] bulk updating ad set budget…", adSetId);
    const result = await updateMetaAdSetBudget(adSetId, budgetType, amount);
    if (result.error) {
      failed.push({ adSetId, error: result.error });
    } else {
      succeeded.push(adSetId);
    }
  }

  console.log("[Meta API] bulk ad set budget update finished", {
    succeeded: succeeded.length,
    failed: failed.length,
  });

  return {
    data: { succeeded, failed },
    error: null,
  };
}
