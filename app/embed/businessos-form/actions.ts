"use server";

import prisma from "@/lib/prisma";
import { z } from "zod";
import { advanceCompanyDeal } from "@/lib/crm/pipeline";
import { notifyFormSubmission } from "@/lib/slack-notifications";
import { reportOpsFailure } from "@/lib/ops-alerts";
import { businessOSFormSchema, type BusinessOSFormData } from "./schema";

// Generic email domains that should not be used to create companies
const GENERIC_EMAIL_DOMAINS = [
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "live.com",
  "msn.com",
  "aol.com",
  "protonmail.com",
  "mail.com",
];

/**
 * Extract domain from email address
 */
function extractDomainFromEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) {
    return "";
  }
  return parts[1].toLowerCase();
}

/**
 * Extract a readable company name from a domain
 */
function extractCompanyNameFromDomain(domain: string): string {
  const parts = domain.split(".");
  if (parts.length > 0) {
    const name = parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return domain;
}

/**
 * Find or create a company by email domain and link form submissions
 */
async function findOrCreateCompanyByEmail(
  email: string,
  submissionId: string
): Promise<{ companyId: string | null; isNew: boolean }> {
  const domain = extractDomainFromEmail(email);

  // Skip generic email domains
  if (!domain || GENERIC_EMAIL_DOMAINS.includes(domain)) {
    console.log(`[Company] Skipping company creation for generic domain: ${domain}`);
    return { companyId: null, isNew: false };
  }

  try {
    // Check if company already exists by domain (stored in website field)
    let company = await prisma.company.findFirst({
      where: {
        website: {
          equals: domain,
          mode: "insensitive",
        },
      },
    });

    let isNew = false;

    if (!company) {
      const companyName = extractCompanyNameFromDomain(domain);
      company = await prisma.company.create({
        data: {
          name: companyName,
          website: domain,
        },
      });
      isNew = true;
      console.log(`[Company] Created new company: ${companyName} (${company.id}) for domain: ${domain}`);
    } else {
      console.log(`[Company] Found existing company: ${company.name} (${company.id}) for domain: ${domain}`);
    }

    console.log(`[Company] Advancing deal to Form Submitted for ${company.name}...`);
    await advanceCompanyDeal(company.id, "Form Submitted");

    // Link the current submission to the company
    await prisma.embedFormSubmission.update({
      where: { id: submissionId },
      data: { companyId: company.id },
    });

    // Link all other unlinked submissions with matching email domain
    const matchingSubmissions = await prisma.embedFormSubmission.updateMany({
      where: {
        email: {
          endsWith: `@${domain}`,
          mode: "insensitive",
        },
        companyId: null,
        id: { not: submissionId }, // Exclude current submission (already linked)
      },
      data: { companyId: company.id },
    });

    if (matchingSubmissions.count > 0) {
      console.log(`[Company] Linked ${matchingSubmissions.count} existing submissions to company ${company.name}`);
    }

    return { companyId: company.id, isNew };
  } catch (error) {
    console.error("[Company] Error finding/creating company:", error);
    return { companyId: null, isNew: false };
  }
}

// Email validation result type
export type ValidateEmailResult = {
  data: {
    isValid: boolean;
    result: string;
  } | null;
  error: string | null;
};

async function verifyEmailWithNeverBounce(email: string): Promise<{ result: string; error?: string }> {
  console.log(`[NeverBounce] Verifying email: ${email}`);
  const apiKey = process.env.NEVERBOUNCE_API_KEY;
  
  if (!apiKey) {
    console.log("[NeverBounce] ERROR: API key not configured");
    // If API key is not configured, allow the email to pass
    return { result: "unknown" };
  }

  try {
    const response = await fetch(
      `https://api.neverbounce.com/v4/single/check?key=${apiKey}&email=${encodeURIComponent(email)}`,
      { method: "GET" }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[NeverBounce] ERROR: API returned ${response.status} - ${errorText}`);
      // On API error, allow the email to pass
      return { result: "unknown" };
    }

    const data = await response.json();
    console.log(`[NeverBounce] Result for ${email}: ${data.result}`);
    
    // NeverBounce returns: valid, invalid, disposable, catchall, unknown
    return { result: data.result };
  } catch (error) {
    console.log(`[NeverBounce] ERROR: Request failed - ${error instanceof Error ? error.message : "Unknown error"}`);
    // On request failure, allow the email to pass
    return { result: "unknown" };
  }
}

export async function validateEmail(email: string): Promise<ValidateEmailResult> {
  try {
    const verification = await verifyEmailWithNeverBounce(email);
    
    // Valid results: valid, catchall, unknown (we allow these)
    const validResults = ["valid", "catchall", "unknown"];
    const isValid = validResults.includes(verification.result);
    
    if (!isValid) {
      console.log(`[EmailValidation] Email ${email} failed validation: ${verification.result}`);
    }
    
    return {
      data: {
        isValid,
        result: verification.result,
      },
      error: null,
    };
  } catch (error) {
    console.error("[EmailValidation] Error:", error);
    // On error, allow the email to pass
    return {
      data: {
        isValid: true,
        result: "unknown",
      },
      error: null,
    };
  }
}

interface SubmitFormParams {
  formData: BusinessOSFormData;
  utmParams: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
  };
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
  };
}

export type SubmitFormResult = {
  data: {
    redirectUrl: string;
    showLowBudgetMessage: boolean;
  } | null;
  error: string | null;
};

export async function submitBusinessOSForm({
  formData,
  utmParams,
  metadata,
}: SubmitFormParams): Promise<SubmitFormResult> {
  try {
    // Validate form data
    const validatedData = businessOSFormSchema.parse(formData);

    // Determine redirect URL and low budget status
    let redirectUrl = "";
    let showLowBudgetMessage = false;

    if (validatedData.monthlyRevenue === "under-20k") {
      showLowBudgetMessage = true;
      redirectUrl = "https://realgreatdevs.com";
    } else {
      const params = new URLSearchParams({
        name: validatedData.name,
        email: validatedData.email,
        revenue: validatedData.monthlyRevenue,
      });
      if (utmParams.utmSource) params.set("utm_source", utmParams.utmSource);
      if (utmParams.utmMedium) params.set("utm_medium", utmParams.utmMedium);
      if (utmParams.utmCampaign) params.set("utm_campaign", utmParams.utmCampaign);
      if (utmParams.utmTerm) params.set("utm_term", utmParams.utmTerm);
      if (utmParams.utmContent) params.set("utm_content", utmParams.utmContent);
      redirectUrl = `https://www.jaro.dev/book-call?${params.toString()}`;
    }

    // Determine if submission is qualified (not low budget)
    const isQualified = !showLowBudgetMessage;

    const submission = await prisma.embedFormSubmission.create({
      data: {
        type: "BUSINESSOS",
        name: validatedData.name,
        email: validatedData.email,
        monthlyRevenue: validatedData.monthlyRevenue,
        servicesNeeded: validatedData.servicesNeeded,
        otherServiceDescription: validatedData.otherServiceDescription,
        utmSource: utmParams.utmSource,
        utmMedium: utmParams.utmMedium,
        utmCampaign: utmParams.utmCampaign,
        utmTerm: utmParams.utmTerm,
        utmContent: utmParams.utmContent,
        redirectedTo: showLowBudgetMessage ? "low_budget_message" : redirectUrl,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        referrer: metadata?.referrer,
      },
    });

    // Find or create company by email domain and link form submission
    await findOrCreateCompanyByEmail(validatedData.email, submission.id);

    // Only process submission (email verification + CRM contact) for qualified leads
    // Skip CRM contact creation for low budget submissions
    if (isQualified) {
      const baseUrl = process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://studio.jaro.dev";
      console.log(`[BusinessOSForm] Triggering async processing for qualified submission ${submission.id}`);
      
      try {
        const processingPromise = fetch(`${baseUrl}/api/form-submission/process`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ submissionId: submission.id }),
        });
        
        // Wait a short time to ensure the request is actually sent
        await Promise.race([
          processingPromise,
          new Promise((resolve) => setTimeout(resolve, 1000)),
        ]);
        
        console.log(`[BusinessOSForm] Processing request sent for submission ${submission.id}`);
      } catch (error) {
        // The form still succeeds for the visitor, but nobody would otherwise
        // learn that this lead never reached the CRM or the sales channel.
        await reportOpsFailure({
          source: "Form processing",
          summary: "Could not start processing for a qualified Business OS lead",
          error,
          context: { submissionId: submission.id, email: validatedData.email },
          url: "/dashboard/submissions",
        });
      }
    } else {
      // Unqualified leads skip enrichment, but they still go to the sales
      // channel rather than only the submissions table.
      console.log(`[BusinessOSForm] Skipping CRM processing for unqualified submission ${submission.id} (lowBudget: ${showLowBudgetMessage})`);
      await notifyFormSubmission(submission);
    }

    return {
      data: {
        redirectUrl,
        showLowBudgetMessage,
      },
      error: null,
    };
  } catch (error) {
    console.error("BusinessOS form submission error:", error);

    if (error instanceof z.ZodError) {
      return {
        data: null,
        error: error.errors[0]?.message || "Validation failed",
      };
    }

    return {
      data: null,
      error: "Something went wrong. Please try again.",
    };
  }
}
