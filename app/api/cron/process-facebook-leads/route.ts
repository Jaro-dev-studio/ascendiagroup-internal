import prisma from "@/lib/prisma";
import { createCronRoute } from "@/lib/cron/route-handler";
import { reportOpsFailure } from "@/lib/ops-alerts";

// Vercel cron: max 300 seconds execution time
export const maxDuration = 300;

const GOOGLE_SHEET_ID = "1rlefBQT2vmAI3_aP3r1rqyIse8h1V2jcDQouYgrhkB8";
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=csv`;

// ============================================
// VALUE MAPPINGS (Facebook → Form Schema)
// ============================================

const budgetMapping: Record<string, string> = {
  // Format: $X-$Yk (two dollar signs)
  "$0-$10k": "0-10k",
  "$11-$30k": "11k-30k",
  "$31-$100k": "31k-100k",
  "$101-$500k": "101k-500k",
  "$501k-$2M": "501k-2M",
  "$2M+": "2M+",
};

const timelineMapping: Record<string, string> = {
  asap: "asap",
  within_2_weeks: "2-weeks",
  within_4_weeks: "4-weeks",
  "4+_weeks": "4-plus-weeks",
};

const servicesMapping: Record<string, string> = {
  build_new_web_application: "new-web-app",
  "fix_existing_product_/_rebuild": "fix-rebuild",
  "high_volume_scraping_/_data_collection": "high-volume-scraping",
  "ai_/_automation_integrations": "ai-automation",
  other: "other",
};

// ============================================
// CSV PARSING
// ============================================

interface FacebookLead {
  id: string;
  created_time: string;
  ad_id: string;
  ad_name: string;
  adset_id: string;
  adset_name: string;
  campaign_id: string;
  campaign_name: string;
  form_id: string;
  form_name: string;
  is_organic: string;
  platform: string;
  hasExistingCodebase: string;
  budget: string;
  productType: string;
  timeline: string;
  webOrMobile: string;
  servicesNeeded: string;
  email: string;
  fullName: string;
  leadStatus: string;
}

function parseCSV(csvText: string): FacebookLead[] {
  const lines = csvText.split("\n");
  if (lines.length < 2) return [];

  // Parse header row
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const leads: FacebookLead[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    if (values.length !== headers.length) {
      console.log(`[CronFB] Skipping malformed row ${i}: expected ${headers.length} columns, got ${values.length}`);
      continue;
    }

    leads.push({
      id: values[0],
      created_time: values[1],
      ad_id: values[2],
      ad_name: values[3],
      adset_id: values[4],
      adset_name: values[5],
      campaign_id: values[6],
      campaign_name: values[7],
      form_id: values[8],
      form_name: values[9],
      is_organic: values[10],
      platform: values[11],
      hasExistingCodebase: values[12],
      budget: values[13],
      productType: values[14],
      timeline: values[15],
      webOrMobile: values[16],
      servicesNeeded: values[17],
      email: values[18],
      fullName: values[19],
      leadStatus: values[20],
    });
  }

  return leads;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (inQuotes) {
      if (char === "\"" && nextChar === "\"") {
        current += "\"";
        i++; // Skip next quote
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === "\"") {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);

  return result;
}

// ============================================
// VALUE TRANSFORMATION
// ============================================

function mapBudget(fbBudget: string): string | null {
  const mapped = budgetMapping[fbBudget] || null;
  console.log(`[CronFB] mapBudget: "${fbBudget}" -> "${mapped}" (bytes: ${Buffer.from(fbBudget).toString("hex")})`);
  return mapped;
}

function mapTimeline(fbTimeline: string): string {
  return timelineMapping[fbTimeline] || "4-plus-weeks";
}

function mapServices(fbServices: string): string[] {
  // Services can be comma-separated
  const services = fbServices.split(",").map((s) => s.trim());
  const mapped = services
    .map((s) => servicesMapping[s])
    .filter((s): s is string => s !== undefined);
  
  // Default to "other" if no valid services found
  return mapped.length > 0 ? mapped : ["other"];
}

function mapProductType(fbProductType: string): string {
  if (fbProductType.toLowerCase().includes("external")) {
    return "external";
  }
  return "internal";
}

function mapHasExistingCodebase(fbValue: string): boolean {
  return fbValue.toLowerCase() === "yes";
}

function mapPlatform(fbPlatform: string): string {
  const lower = fbPlatform.toLowerCase();
  if (lower === "web") return "web";
  if (lower === "mobile") return "mobile";
  if (lower === "both") return "both";
  return "web"; // Default
}

// ============================================
// LEAD QUALIFICATION
// ============================================

function isQualifiedLead(lead: FacebookLead): boolean {
  console.log(`[CronFB] Checking lead: ${lead.id}`);
  console.log(`[CronFB]   - email: "${lead.email}"`);
  console.log(`[CronFB]   - fullName: "${lead.fullName}"`);
  console.log(`[CronFB]   - budget: "${lead.budget}"`);
  console.log(`[CronFB]   - platform: "${lead.webOrMobile}"`);

  // Skip test leads first
  if (lead.email === "test@fb.com" || lead.fullName.includes("<test lead:")) {
    console.log("[CronFB]   -> REJECTED: test lead");
    return false;
  }

  // Must have valid email
  if (!lead.email || !lead.email.includes("@")) {
    console.log("[CronFB]   -> REJECTED: invalid email");
    return false;
  }

  // Must have a name
  if (!lead.fullName || lead.fullName.trim() === "") {
    console.log("[CronFB]   -> REJECTED: no name");
    return false;
  }

  // Budget must be above 10k (not "$0-$10k")
  const budget = mapBudget(lead.budget);
  if (!budget) {
    console.log("[CronFB]   -> REJECTED: budget not in mapping");
    return false;
  }
  if (budget === "0-10k") {
    console.log("[CronFB]   -> REJECTED: budget too low (0-10k)");
    return false;
  }

  // Platform must NOT be mobile-only
  const platform = mapPlatform(lead.webOrMobile);
  if (platform === "mobile") {
    console.log("[CronFB]   -> REJECTED: mobile-only platform");
    return false;
  }

  console.log("[CronFB]   -> QUALIFIED");
  return true;
}

// ============================================
// MAIN HANDLER
// ============================================

export const GET = createCronRoute("process-facebook-leads", async () => {
  // Step 1: Fetch Google Sheet CSV (no cache)
  console.log("[CronFB] Step 1: Fetching Google Sheet...");
  const response = await fetch(GOOGLE_SHEET_CSV_URL, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    return {
      data: null,
      error: `Failed to fetch the Google Sheet of Facebook leads: ${response.status} ${response.statusText}`,
    };
  }

  const csvText = await response.text();
  console.log(`[CronFB] Step 1: Fetched ${csvText.length} bytes`);

  // Step 2: Parse CSV
  console.log("[CronFB] Step 2: Parsing CSV...");
  const leads = parseCSV(csvText);
  console.log(`[CronFB] Step 2: Parsed ${leads.length} leads`);

  // Step 3: Filter qualified leads
  console.log("[CronFB] Step 3: Filtering qualified leads...");
  const qualifiedLeads = leads.filter(isQualifiedLead);
  console.log(`[CronFB] Step 3: ${qualifiedLeads.length} qualified leads (budget > 10k, not mobile-only)`);

  // Step 4: Get existing Facebook lead IDs to avoid duplicates
  console.log("[CronFB] Step 4: Checking for existing leads...");
  const existingLeadIds = await prisma.embedFormSubmission.findMany({
    where: {
      facebookLeadId: {
        in: qualifiedLeads.map((l) => l.id),
      },
    },
    select: {
      facebookLeadId: true,
    },
  });
  const existingIdSet = new Set(existingLeadIds.map((l) => l.facebookLeadId));
  console.log(`[CronFB] Step 4: Found ${existingIdSet.size} already processed leads`);

  // Step 5: Process new leads
  const newLeads = qualifiedLeads.filter((l) => !existingIdSet.has(l.id));
  console.log(`[CronFB] Step 5: Processing ${newLeads.length} new leads...`);

  const results = {
    total: leads.length,
    qualified: qualifiedLeads.length,
    alreadyProcessed: existingIdSet.size,
    newlyProcessed: 0,
    errors: [] as string[],
  };

  const baseUrl = process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://studio.jaro.dev";

  for (const lead of newLeads) {
    try {
      console.log(`[CronFB] Processing lead: ${lead.id} - ${lead.email}`);

      // Map values to form schema
      const budget = mapBudget(lead.budget);
      if (!budget) {
        console.log(`[CronFB] Skipping lead ${lead.id}: Invalid budget "${lead.budget}"`);
        results.errors.push(`Lead ${lead.id}: Invalid budget "${lead.budget}"`);
        continue;
      }

      // Create form submission
      const submission = await prisma.embedFormSubmission.create({
        data: {
          name: lead.fullName,
          email: lead.email,
          hasExistingCodebase: mapHasExistingCodebase(lead.hasExistingCodebase),
          budget: budget,
          productType: mapProductType(lead.productType),
          timeline: mapTimeline(lead.timeline),
          platform: mapPlatform(lead.webOrMobile),
          servicesNeeded: mapServices(lead.servicesNeeded),
          facebookLeadId: lead.id,
          // UTM parameters from Facebook ad data
          utmSource: "facebook",
          utmMedium: "paid",
          utmCampaign: lead.campaign_name || undefined,
          utmContent: lead.ad_name || undefined,
          redirectedTo: "facebook_lead_cron",
        },
      });

      console.log(`[CronFB] Created submission ${submission.id} for lead ${lead.id}`);

      // Trigger async processing (email verification + CRM contact). Reported
      // rather than only logged: a lead that never gets processed also never
      // reaches the sales channel.
      fetch(`${baseUrl}/api/form-submission/process`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ submissionId: submission.id }),
      }).catch((error) => {
        void reportOpsFailure({
          source: "Facebook leads",
          summary: `Could not start processing for submission ${submission.id}`,
          error,
          context: { leadId: lead.id, email: lead.email },
          url: "/dashboard/submissions",
        });
      });

      results.newlyProcessed++;
    } catch (error) {
      const errorMsg = `Lead ${lead.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
      console.error(`[CronFB] ERROR: ${errorMsg}`);
      results.errors.push(errorMsg);
    }
  }

  console.log(
    `[CronFB] Summary: ${results.newlyProcessed} new, ${results.alreadyProcessed} skipped, ${results.errors.length} errors`
  );

  return { data: results, error: null, failures: results.errors };
});
