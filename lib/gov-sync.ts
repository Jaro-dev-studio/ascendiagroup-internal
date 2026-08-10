import prisma from "@/lib/prisma";
import {
  NAICS_CODE_LIST,
  SOFTWARE_NAICS_CODES,
  USASPENDING_CONTRACT_AWARD_TYPES,
  FISCAL_YEARS_TO_FETCH,
  CURRENT_FISCAL_YEAR,
  getFiscalYearRange,
} from "@/constants/gov-market-research";

// ============================================
// Shared helpers
// ============================================

export async function getLastSuccessfulSync(
  source: "SAM_GOV" | "USASPENDING"
): Promise<Date | null> {
  const last = await prisma.govSyncLog.findFirst({
    where: { source, status: "SUCCESS" },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });
  return last?.completedAt ?? null;
}

// ============================================
// SAM.gov Sync
// ============================================

const SAM_API_BASE = "https://api.sam.gov/opportunities/v2/search";

interface SamOpportunity {
  noticeId: string;
  title: string;
  solicitationNumber?: string;
  fullParentPathName?: string;
  fullParentPathCode?: string;
  department?: string;
  subTier?: string;
  office?: string;
  naicsCode?: string;
  classificationCode?: string;
  type?: string;
  baseType?: string;
  archiveType?: string;
  typeOfSetAsideDescription?: string;
  typeOfSetAside?: string;
  active?: string;
  postedDate?: string;
  responseDeadLine?: string;
  archiveDate?: string;
  description?: string;
  uiLink?: string;
  organizationType?: string;
  officeAddress?: {
    zipcode?: string;
    city?: string;
    countryCode?: string;
    state?: string;
  };
  placeOfPerformance?: {
    streetAddress?: string;
    city?: { code?: string; name?: string };
    state?: { code?: string };
    zip?: string;
    country?: { code?: string };
  };
  award?: {
    date?: string;
    number?: string;
    amount?: string;
    awardee?: {
      name?: string;
      ueiSAM?: string;
      location?: {
        city?: { name?: string };
        state?: { code?: string };
      };
    };
  };
  pointOfContact?: Array<{
    type?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    title?: string;
    fax?: string;
  }>;
  additionalInfoLink?: string;
  resourceLinks?: string[];
  links?: Array<{ rel?: string; href?: string }>;
}

interface SamApiResponse {
  totalRecords: number;
  limit: number;
  offset: number;
  opportunitiesData: SamOpportunity[];
}

function formatPlaceOfPerformance(
  pop?: SamOpportunity["placeOfPerformance"]
): string | null {
  if (!pop) return null;
  const parts = [
    pop.streetAddress,
    pop.city?.name,
    pop.state?.code,
    pop.zip,
    pop.country?.code !== "USA" ? pop.country?.code : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function sanitizeNullString(
  value: string | null | undefined
): string | null {
  if (!value || value === "null" || value === "undefined") return null;
  return value;
}

function parseAwardAmount(
  amount: string | number | null | undefined
): number | null {
  if (amount === null || amount === undefined) return null;
  const parsed = typeof amount === "string" ? parseFloat(amount) : amount;
  return isNaN(parsed) ? null : parsed;
}

function cleanHtmlText(raw: string): string {
  const HTML_ENTITIES: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&apos;": "'",
    "&rsquo;": "\u2019",
    "&lsquo;": "\u2018",
    "&rdquo;": "\u201D",
    "&ldquo;": "\u201C",
    "&ndash;": "\u2013",
    "&mdash;": "\u2014",
    "&hellip;": "\u2026",
    "&bull;": "\u2022",
    "&copy;": "\u00A9",
    "&reg;": "\u00AE",
    "&trade;": "\u2122",
  };

  let text = raw.replace(/<[^>]*>/g, " ");
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    text = text.replaceAll(entity, char);
  }
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

async function fetchDescriptionText(
  descriptionUrl: string,
  apiKey: string
): Promise<string | null> {
  try {
    if (!descriptionUrl.startsWith("http")) return cleanHtmlText(descriptionUrl);
    const separator = descriptionUrl.includes("?") ? "&" : "?";
    const url = `${descriptionUrl}${separator}api_key=${apiKey}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    const text = await resp.text();
    const cleaned = cleanHtmlText(text);
    return cleaned.length > 0 ? cleaned.slice(0, 5000) : null;
  } catch {
    return null;
  }
}

const COMPANY_SUFFIXES = /\b(inc\.?|incorporated|llc|l\.l\.c\.?|corp\.?|corporation|co\.?|company|ltd\.?|limited|lp|l\.p\.?|pllc|pc|p\.c\.?|group|holdings|enterprises|solutions|services|technologies|technology|consulting|systems|international|intl|global|associates|partners|of america|usa|us)\b/gi;

export function normalizeCompanyName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,\-\/\\'"()&]/g, " ")
    .replace(COMPANY_SUFFIXES, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateForSam(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

export async function runSamGovSync(options?: {
  sinceDate?: Date;
}): Promise<{
  success: boolean;
  recordsProcessed: number;
  error?: string;
}> {
  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    return { success: false, recordsProcessed: 0, error: "SAM_GOV_API_KEY not configured" };
  }

  const syncLog = await prisma.govSyncLog.create({
    data: { source: "SAM_GOV", status: "RUNNING" },
  });

  try {
    console.log("[SAM.gov Sync] Starting sync for NAICS codes:", NAICS_CODE_LIST.join(", "));

    let totalProcessed = 0;

    const today = new Date();
    const fromDate = options?.sinceDate ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() - 364);
      return d;
    })();

    // SAM.gov rejects ranges >= 1 year, so each window is at most 364 days
    const MAX_WINDOW_DAYS = 364;
    const dateWindows: Array<{ from: Date; to: Date }> = [];
    let windowStart = new Date(fromDate);
    while (windowStart < today) {
      const windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + MAX_WINDOW_DAYS);
      if (windowEnd > today) {
        dateWindows.push({ from: new Date(windowStart), to: new Date(today) });
      } else {
        dateWindows.push({ from: new Date(windowStart), to: new Date(windowEnd) });
      }
      windowStart = new Date(windowEnd);
    }

    console.log(`[SAM.gov Sync] Fetching opportunities from ${formatDateForSam(fromDate)} to ${formatDateForSam(today)} in ${dateWindows.length} window(s)`);

    for (const naicsCode of NAICS_CODE_LIST) {
      console.log(`[SAM.gov Sync] Fetching opportunities for NAICS ${naicsCode}...`);

      for (const window of dateWindows) {
        console.log(`[SAM.gov Sync] Date window: ${formatDateForSam(window.from)} - ${formatDateForSam(window.to)}`);

        let offset = 0;
        const limit = 100;
        let hasMore = true;

        while (hasMore) {
          const params = new URLSearchParams({
            api_key: apiKey,
            ncode: naicsCode,
            postedFrom: formatDateForSam(window.from),
            postedTo: formatDateForSam(window.to),
            limit: limit.toString(),
            offset: offset.toString(),
          });

          const url = `${SAM_API_BASE}?${params.toString()}`;

          console.log(`[SAM.gov Sync] Fetching page at offset ${offset} for NAICS ${naicsCode}...`);

          const response = await fetch(url);
          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[SAM.gov Sync] API error: ${response.status} - ${errorText}`);
            if (response.status === 429) {
              console.log("[SAM.gov Sync] Rate limited, waiting 60s before retry...");
              await new Promise((r) => setTimeout(r, 60000));
              continue;
            }
            throw new Error(`SAM.gov API returned ${response.status}: ${errorText}`);
          }

          const data: SamApiResponse = await response.json();

          if (!data.opportunitiesData || data.opportunitiesData.length === 0) {
            console.log(`[SAM.gov Sync] No more results for NAICS ${naicsCode} at offset ${offset}`);
            hasMore = false;
            break;
          }

          console.log(
            `[SAM.gov Sync] Processing ${data.opportunitiesData.length} of ${data.totalRecords} total opportunities...`
          );

          for (const opp of data.opportunitiesData) {
            if (!opp.noticeId || !opp.title) continue;

            const isActive = opp.active === "Yes";

            const agency =
            opp.department ||
            opp.fullParentPathName?.split(".")?.[0]?.trim() ||
            "Unknown";

            const subAgency =
            opp.subTier ||
            opp.fullParentPathName?.split(".")?.[1]?.trim() ||
            null;

            const uiLink =
            sanitizeNullString(opp.uiLink) ||
            `https://sam.gov/opp/${opp.noticeId}/view`;

            let description: string | null = null;
            const rawDesc = sanitizeNullString(opp.description);
            if (rawDesc) {
              if (rawDesc.startsWith("https://api.sam.gov")) {
                description = await fetchDescriptionText(rawDesc, apiKey);
              } else {
                description = rawDesc;
              }
            }

            const estimatedValue = parseAwardAmount(opp.award?.amount);

            const primaryContact = opp.pointOfContact?.find(
              (c) => c.type === "primary"
            ) || opp.pointOfContact?.[0];

            const resourceLinks = (opp.resourceLinks || []).filter(Boolean);
            if (opp.additionalInfoLink && !resourceLinks.includes(opp.additionalInfoLink)) {
              resourceLinks.unshift(opp.additionalInfoLink);
            }

            const oppData = {
              title: opp.title,
              solicitationNumber: opp.solicitationNumber?.trim() || null,
              agency,
              subAgency,
              office: sanitizeNullString(opp.office) || null,
              naicsCode: opp.naicsCode || naicsCode,
              pscCode: sanitizeNullString(opp.classificationCode) || null,
              classificationCode: opp.classificationCode || null,
              type: opp.type || null,
              setAsideType: opp.typeOfSetAsideDescription || null,
              postedDate: opp.postedDate ? new Date(opp.postedDate) : null,
              responseDeadline: opp.responseDeadLine
                ? new Date(opp.responseDeadLine)
                : null,
              archiveDate: opp.archiveDate ? new Date(opp.archiveDate) : null,
              description,
              samGovUrl: uiLink,
              placeOfPerformance: formatPlaceOfPerformance(opp.placeOfPerformance),
              estimatedValue,
              awardeeName: sanitizeNullString(opp.award?.awardee?.name) || null,
              awardeeNameNormalized: opp.award?.awardee?.name
                ? normalizeCompanyName(opp.award.awardee.name)
                : null,
              awardeeUei: sanitizeNullString(opp.award?.awardee?.ueiSAM) || null,
              awardDate: opp.award?.date ? new Date(opp.award.date) : null,
              awardNumber: sanitizeNullString(opp.award?.number) || null,
              contactName: sanitizeNullString(primaryContact?.fullName) || null,
              contactEmail: sanitizeNullString(primaryContact?.email) || null,
              contactPhone: sanitizeNullString(primaryContact?.phone) || null,
              contactTitle: sanitizeNullString(primaryContact?.title) || null,
              additionalInfoLink: sanitizeNullString(opp.additionalInfoLink) || null,
              resourceLinks,
              isActive,
            };

            await prisma.govOpportunity.upsert({
              where: { noticeId: opp.noticeId },
              create: { noticeId: opp.noticeId, ...oppData },
              update: oppData,
            });

            totalProcessed++;
          }

          offset += limit;
          hasMore = offset < data.totalRecords;

          if (hasMore) {
            console.log("[SAM.gov Sync] Waiting briefly to respect rate limits...");
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      }
    }

    console.log(`[SAM.gov Sync] Completed. Processed ${totalProcessed} opportunities.`);

    await prisma.govSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "SUCCESS",
        recordsProcessed: totalProcessed,
        completedAt: new Date(),
      },
    });

    return { success: true, recordsProcessed: totalProcessed };
  } catch (error) {
    console.error("[SAM.gov Sync] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    await prisma.govSyncLog.updateMany({
      where: { source: "SAM_GOV", status: "RUNNING" },
      data: { status: "FAILED", error: message, completedAt: new Date() },
    });

    return { success: false, recordsProcessed: 0, error: message };
  }
}

// ============================================
// USASpending Sync
// ============================================

const USASPENDING_BASE = "https://api.usaspending.gov/api/v2";

interface SpendingByCategoryResult {
  id: number;
  name: string;
  code: string;
  amount: number;
  count?: number;
}

interface SpendingByCategoryResponse {
  category: string;
  results: SpendingByCategoryResult[];
  limit: number;
  page_metadata: { page: number; hasNext: boolean };
  messages?: string[];
}

export async function runUsaSpendingSync(options?: {
  currentFiscalYearOnly?: boolean;
}): Promise<{
  success: boolean;
  recordsProcessed: number;
  error?: string;
}> {
  const syncLog = await prisma.govSyncLog.create({
    data: { source: "USASPENDING", status: "RUNNING" },
  });

  try {
    const fiscalYears = options?.currentFiscalYearOnly
      ? [CURRENT_FISCAL_YEAR]
      : FISCAL_YEARS_TO_FETCH;

    console.log("[USASpending Sync] Starting sync for fiscal years:", fiscalYears.join(", "));

    let totalProcessed = 0;

    for (const fy of fiscalYears) {
      const { start_date, end_date } = getFiscalYearRange(fy);

      console.log(`[USASpending Sync] Fetching spending by agency for FY${fy}...`);

      for (const naicsCode of NAICS_CODE_LIST) {
        console.log(`[USASpending Sync] Querying NAICS ${naicsCode} for FY${fy}...`);

        try {
          const agencyResponse = await fetch(
            `${USASPENDING_BASE}/search/spending_by_category/awarding_agency/`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filters: {
                  time_period: [{ start_date, end_date }],
                  award_type_codes: Object.keys(USASPENDING_CONTRACT_AWARD_TYPES),
                  naics_codes: { require: [naicsCode] },
                },
                category: "awarding_agency",
                limit: 50,
                page: 1,
              }),
            }
          );

          if (!agencyResponse.ok) {
            const errorText = await agencyResponse.text();
            console.error(
              `[USASpending Sync] Agency spending API error: ${agencyResponse.status} - ${errorText}`
            );
            continue;
          }

          const agencyData: SpendingByCategoryResponse =
            await agencyResponse.json();

          console.log(
            `[USASpending Sync] Got ${agencyData.results?.length || 0} agency results for NAICS ${naicsCode} FY${fy}`
          );

          if (!agencyData.results) continue;

          for (const agency of agencyData.results) {
            if (!agency.name || agency.amount === 0) continue;

            await prisma.govSpendingRecord.upsert({
              where: {
                fiscalYear_agencyName_naicsCode: {
                  fiscalYear: fy,
                  agencyName: agency.name,
                  naicsCode: naicsCode,
                },
              },
              create: {
                fiscalYear: fy,
                agencyName: agency.name,
                agencyCode: agency.code || null,
                naicsCode: naicsCode,
                naicsDescription: SOFTWARE_NAICS_CODES[naicsCode] || null,
                totalObligated: agency.amount,
                contractCount: agency.count || 0,
                avgContractValue:
                  agency.count && agency.count > 0
                    ? agency.amount / agency.count
                    : null,
              },
              update: {
                agencyCode: agency.code || null,
                naicsDescription: SOFTWARE_NAICS_CODES[naicsCode] || null,
                totalObligated: agency.amount,
                contractCount: agency.count || 0,
                avgContractValue:
                  agency.count && agency.count > 0
                    ? agency.amount / agency.count
                    : null,
              },
            });

            totalProcessed++;
          }
        } catch (fetchError) {
          console.error(
            `[USASpending Sync] Error fetching NAICS ${naicsCode} FY${fy}:`,
            fetchError
          );
          continue;
        }
      }
    }

    console.log("[USASpending Sync] Aggregated records done. Now fetching individual awarded contracts...");

    const awardsProcessed = await syncIndividualAwards(fiscalYears);
    totalProcessed += awardsProcessed;

    console.log(`[USASpending Sync] Completed. Processed ${totalProcessed} total records (${awardsProcessed} individual awards).`);

    await prisma.govSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "SUCCESS",
        recordsProcessed: totalProcessed,
        completedAt: new Date(),
      },
    });

    return { success: true, recordsProcessed: totalProcessed };
  } catch (error) {
    console.error("[USASpending Sync] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    await prisma.govSyncLog.updateMany({
      where: { source: "USASPENDING", status: "RUNNING" },
      data: { status: "FAILED", error: message, completedAt: new Date() },
    });

    return { success: false, recordsProcessed: 0, error: message };
  }
}

// ============================================
// Individual Awarded Contracts from USASpending
// ============================================

interface SpendingByAwardResult {
  "Award ID": string;
  "Recipient Name": string;
  "recipient_id"?: string;
  "Award Amount": number;
  "Total Obligated Amount"?: number;
  "Awarding Agency": string;
  "Awarding Sub Agency": string;
  "Funding Agency"?: string;
  "Funding Sub Agency"?: string;
  "Award Type"?: string;
  "NAICS Code"?: string;
  "NAICS Description"?: string;
  "PSC Code"?: string;
  "Start Date": string;
  "End Date": string;
  "Last Modified Date"?: string;
  "Description"?: string;
  "Place of Performance State Code"?: string;
  "Place of Performance Country Code"?: string;
  "Type of Set Aside"?: string;
  "Recipient UEI"?: string;
  "generated_internal_id"?: string;
}

interface SpendingByAwardResponse {
  results: SpendingByAwardResult[];
  limit: number;
  page_metadata: {
    page: number;
    hasNext: boolean;
    last_record_unique_id?: number;
    last_record_sort_value?: string;
  };
}

async function syncIndividualAwards(
  fiscalYears: number[] = FISCAL_YEARS_TO_FETCH
): Promise<number> {
  let totalAwards = 0;

  for (const fy of fiscalYears) {
    const { start_date, end_date } = getFiscalYearRange(fy);

    for (const naicsCode of NAICS_CODE_LIST) {
      console.log(`[USASpending Awards] Fetching individual awards for NAICS ${naicsCode} FY${fy}...`);

      let page = 1;
      let hasNext = true;

      while (hasNext) {
        try {
          const response = await fetch(
            `${USASPENDING_BASE}/search/spending_by_award/`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                filters: {
                  time_period: [{ start_date, end_date }],
                  award_type_codes: Object.keys(USASPENDING_CONTRACT_AWARD_TYPES),
                  naics_codes: { require: [naicsCode] },
                },
                fields: [
                  "Award ID",
                  "Recipient Name",
                  "Award Amount",
                  "Total Obligated Amount",
                  "Awarding Agency",
                  "Awarding Sub Agency",
                  "Funding Agency",
                  "Funding Sub Agency",
                  "Award Type",
                  "NAICS Code",
                  "NAICS Description",
                  "PSC Code",
                  "Start Date",
                  "End Date",
                  "Last Modified Date",
                  "Description",
                  "Place of Performance State Code",
                  "Place of Performance Country Code",
                  "Type of Set Aside",
                  "Recipient UEI",
                ],
                limit: 100,
                page,
                sort: "Award Amount",
                order: "desc",
              }),
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`[USASpending Awards] API error: ${response.status} - ${errorText}`);
            break;
          }

          const data: SpendingByAwardResponse = await response.json();

          if (!data.results || data.results.length === 0) {
            hasNext = false;
            break;
          }

          console.log(
            `[USASpending Awards] Processing page ${page} with ${data.results.length} awards for NAICS ${naicsCode} FY${fy}...`
          );

          for (const award of data.results) {
            const awardId = award["Award ID"];
            if (!awardId || !award["Recipient Name"]) continue;

            const pop = [
              award["Place of Performance State Code"],
              award["Place of Performance Country Code"],
            ]
              .filter(Boolean)
              .join(", ");

            const recipientName = award["Recipient Name"];
            const awardData = {
              recipientName,
              recipientNameNormalized: normalizeCompanyName(recipientName),
              recipientUei: award["Recipient UEI"] || null,
              awardAmount: award["Award Amount"] || 0,
              totalObligated: award["Total Obligated Amount"] ?? null,
              awardingAgency: award["Awarding Agency"] || "Unknown",
              awardingSubAgency: award["Awarding Sub Agency"] || null,
              fundingAgency: award["Funding Agency"] || null,
              fundingSubAgency: award["Funding Sub Agency"] || null,
              naicsCode: award["NAICS Code"] || naicsCode,
              naicsDescription:
                award["NAICS Description"] ||
                SOFTWARE_NAICS_CODES[naicsCode] ||
                null,
              pscCode: award["PSC Code"] || null,
              awardType: award["Award Type"] || null,
              setAsideType: award["Type of Set Aside"] || null,
              startDate: award["Start Date"]
                ? new Date(award["Start Date"])
                : null,
              endDate: award["End Date"]
                ? new Date(award["End Date"])
                : null,
              lastModifiedDate: award["Last Modified Date"]
                ? new Date(award["Last Modified Date"])
                : null,
              description: award["Description"] || null,
              placeOfPerformance: pop || null,
            };

            await prisma.govAwardedContract.upsert({
              where: { awardId },
              create: { awardId, ...awardData },
              update: awardData,
            });

            totalAwards++;
          }

          hasNext = data.page_metadata?.hasNext ?? false;
          page++;

          if (hasNext) {
            await new Promise((r) => setTimeout(r, 300));
          }
        } catch (fetchError) {
          console.error(
            `[USASpending Awards] Error on page ${page} for NAICS ${naicsCode} FY${fy}:`,
            fetchError
          );
          break;
        }
      }
    }
  }

  console.log(`[USASpending Awards] Done. Synced ${totalAwards} individual awards.`);
  return totalAwards;
}
