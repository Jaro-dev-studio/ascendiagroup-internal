import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notifyFormSubmission } from "@/lib/slack-notifications";
import { upsertPersonByEmail } from "@/lib/crm/people";
import { logCrmActivity } from "@/lib/crm/activity";
import { autoEnrollPerson } from "@/lib/crm/sequences/entry-criteria";
import { runCompanyResearch } from "@/lib/research/run";
import { reportOpsFailure } from "@/lib/ops-alerts";
import type { CompanyResearch } from "@/lib/research/company-research";
import type { FormType } from "@prisma/client";

// The company research step scrapes their site and researches them on the web
// before Slack fires, so the alert carries the brief.
export const maxDuration = 300;

interface ProcessResult {
  success: boolean;
  emailValidation?: string;
  firstName?: string;
  lastName?: string;
  personId?: string;
  companyId?: string;
  sequencesEnrolled?: number;
  researchStatus?: string;
  errors: string[];
}

async function verifyEmailWithNeverBounce(email: string): Promise<{ result: string; error?: string }> {
  console.log(`[NeverBounce] Verifying email: ${email}`);
  const apiKey = process.env.NEVERBOUNCE_API_KEY;
  
  if (!apiKey) {
    console.log("[NeverBounce] ERROR: API key not configured");
    return { result: "unknown", error: "NEVERBOUNCE_API_KEY not configured" };
  }

  try {
    const response = await fetch(
      `https://api.neverbounce.com/v4/single/check?key=${apiKey}&email=${encodeURIComponent(email)}`,
      { method: "GET" }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[NeverBounce] ERROR: API returned ${response.status} - ${errorText}`);
      return { result: "unknown", error: `NeverBounce API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    console.log(`[NeverBounce] Result for ${email}: ${data.result}`);
    
    // NeverBounce returns: valid, invalid, disposable, catchall, unknown
    return { result: data.result };
  } catch (error) {
    console.log(`[NeverBounce] ERROR: Request failed - ${error instanceof Error ? error.message : "Unknown error"}`);
    return { 
      result: "unknown", 
      error: `NeverBounce request failed: ${error instanceof Error ? error.message : "Unknown error"}` 
    };
  }
}

/**
 * Creates or updates the CRM contact for a submission and logs it on the
 * timeline.
 */
async function createOrUpdateCrmPerson(submission: {
  submissionId: string;
  firstName: string;
  lastName: string;
  email: string;
  formType: FormType;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  servicesInterestedIn?: string;
}): Promise<{
  personId?: string;
  companyId?: string;
  error?: string;
}> {
  console.log(`[CRM] Upserting contact for ${submission.email}...`);

  const utm = {
    utmSource: submission.utmSource ?? null,
    utmMedium: submission.utmMedium ?? null,
    utmCampaign: submission.utmCampaign ?? null,
    utmTerm: submission.utmTerm ?? null,
    utmContent: submission.utmContent ?? null,
  };

  const result = await upsertPersonByEmail({
    email: submission.email,
    firstName: submission.firstName || null,
    lastName: submission.lastName || null,
    source: `embed-form:${submission.formType.toLowerCase()}`,
    customFields: {
      ...utm,
      ...(submission.servicesInterestedIn
        ? { servicesInterestedIn: [submission.servicesInterestedIn] }
        : {}),
    },
  });

  if (!result.data) {
    return { error: result.error ?? "Failed to upsert CRM contact" };
  }

  const person = result.data;
  console.log(`[CRM] Contact ${person.id} ready (company=${person.companyId})`);

  console.log("[CRM] Logging the submission on the contact timeline...");
  await logCrmActivity({
    type: "FORM_SUBMITTED",
    title:
      submission.formType === "BUSINESSOS"
        ? "Submitted the BusinessOS form"
        : "Submitted the enquiry form",
    personId: person.id,
    companyId: person.companyId,
    payload: { submissionId: submission.submissionId, ...utm },
    externalId: `form-submission:${submission.submissionId}`,
  });

  return {
    personId: person.id,
    companyId: person.companyId ?? undefined,
  };
}

export async function POST(request: NextRequest) {
  let submissionId: string | undefined;

  try {
    ({ submissionId } = await request.json());
    console.log(`\n[FormProcess] ========== Starting processing for submission: ${submissionId} ==========`);

    if (!submissionId) {
      console.log("[FormProcess] ERROR: No submissionId provided");
      return NextResponse.json({
        data: null,
        error: "submissionId is required",
      }, { status: 400 });
    }

    // Fetch the submission
    console.log("[FormProcess] Step 0: Fetching submission from database...");
    const submission = await prisma.embedFormSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      console.log("[FormProcess] ERROR: Submission not found");
      return NextResponse.json({
        data: null,
        error: "Submission not found",
      }, { status: 404 });
    }

    console.log(`[FormProcess] Found submission: ${submission.name} <${submission.email}>`);

    const result: ProcessResult = {
      success: false,
      errors: [],
    };

    // Step 1: Verify email with NeverBounce
    console.log("[FormProcess] Step 1: Verifying email with NeverBounce...");
    const emailVerification = await verifyEmailWithNeverBounce(submission.email);
    result.emailValidation = emailVerification.result;

    if (emailVerification.error) {
      console.log(`[FormProcess] Step 1 FAILED: ${emailVerification.error}`);
      result.errors.push(emailVerification.error);

      // Every lead stops here while NeverBounce is down, so this is reported to
      // operations as well as the lead itself going to the sales channel.
      await reportOpsFailure({
        source: "Form processing",
        summary: "NeverBounce verification failed; the lead was not enriched or added to the CRM",
        error: emailVerification.error,
        context: { submissionId, email: submission.email },
        dedupeKey: "neverbounce unavailable",
        url: "/dashboard/submissions",
      });

      // Save the error and exit
      const updatedSubmission = await prisma.embedFormSubmission.update({
        where: { id: submissionId },
        data: {
          emailValidation: emailVerification.result,
          errors: result.errors,
        },
      });
      // Send Slack notification
      await notifyFormSubmission(updatedSubmission);
      console.log("[FormProcess] ========== Processing ended (NeverBounce error) ==========\n");
      return NextResponse.json({ data: result, error: null });
    }

    // Check if email is valid, catchall, or unknown (unknown still allows account creation)
    const validEmailResults = ["valid", "catchall", "unknown"];
    if (!validEmailResults.includes(emailVerification.result)) {
      console.log(`[FormProcess] Step 1 FAILED: Email is ${emailVerification.result} (not valid/catchall/unknown)`);
      result.errors.push(`Email validation failed: ${emailVerification.result}`);
      // Save validation result and exit (don't create a CRM contact)
      const updatedSubmission = await prisma.embedFormSubmission.update({
        where: { id: submissionId },
        data: {
          emailValidation: emailVerification.result,
          errors: result.errors,
        },
      });
      // Send Slack notification
      await notifyFormSubmission(updatedSubmission);
      console.log("[FormProcess] ========== Processing ended (invalid email) ==========\n");
      return NextResponse.json({ data: result, error: null });
    }

    console.log(`[FormProcess] Step 1 PASSED: Email is ${emailVerification.result}`);

    // Step 2: Extract first and last name
    console.log("[FormProcess] Step 2: Extracting first and last name...");
    const nameSplit = submission.name.split(" ");
    const firstName = nameSplit[0];
    const lastName = nameSplit[1] ?? "";
    
    result.firstName = firstName;
    result.lastName = lastName;
    console.log(`[FormProcess] Step 2 DONE: firstName="${firstName}", lastName="${lastName}"`);

    // Step 3: Create or update the CRM contact
    console.log("[FormProcess] Step 3: Creating/updating the CRM contact...");
    const crmResult = await createOrUpdateCrmPerson({
      submissionId,
      firstName,
      lastName,
      email: submission.email,
      formType: submission.type,
      utmSource: submission.utmSource,
      utmMedium: submission.utmMedium,
      utmCampaign: submission.utmCampaign,
      utmTerm: submission.utmTerm,
      utmContent: submission.utmContent,
      // Set "Services Interested In" to "BusinessOS" for BusinessOS form submissions
      servicesInterestedIn: submission.type === "BUSINESSOS" ? "BusinessOS" : undefined,
    });

    if (crmResult.error) {
      console.log(`[FormProcess] Step 3 FAILED: ${crmResult.error}`);
      result.errors.push(crmResult.error);

      await reportOpsFailure({
        source: "Form processing",
        summary: "CRM contact could not be created for a new lead",
        error: crmResult.error,
        context: { submissionId, email: submission.email, name: submission.name },
        url: "/dashboard/submissions",
      });
    } else {
      console.log(`[FormProcess] Step 3 PASSED: CRM contact = ${crmResult.personId}`);
      result.personId = crmResult.personId;
      result.companyId = crmResult.companyId;
      result.success = true;

      // Linked before enrollment so sequence entry criteria that ask about
      // form submissions can already see this one.
      await prisma.embedFormSubmission.update({
        where: { id: submissionId },
        data: {
          personId: crmResult.personId ?? null,
          companyId: crmResult.companyId ?? null,
        },
      });
    }

    // Step 4: Auto-enroll into every sequence whose entry criteria they match
    if (result.personId) {
      console.log("[FormProcess] Step 4: Checking auto-enroll sequences...");
      const enrollment = await autoEnrollPerson(result.personId);

      if (enrollment.error) {
        console.log(`[FormProcess] Step 4 FAILED: ${enrollment.error}`);
        result.errors.push(enrollment.error);

        await reportOpsFailure({
          source: "Form processing",
          severity: "WARNING",
          summary: "Sequence auto-enrollment failed for a new lead",
          error: enrollment.error,
          context: { submissionId, personId: result.personId },
          url: "/dashboard/crm/sequences",
        });
      } else {
        result.sequencesEnrolled = enrollment.data?.enrolled ?? 0;
        console.log(
          `[FormProcess] Step 4 DONE: enrolled in ${result.sequencesEnrolled} sequence(s)`
        );
      }
    }

    // Step 5: Research the company so the brief is ready before anyone replies
    const companyId = result.companyId ?? submission.companyId;
    let research: CompanyResearch | undefined;

    if (companyId) {
      console.log("[FormProcess] Step 5: Researching the company...");
      const researched = await runCompanyResearch({
        companyId,
        submissionId: submission.id,
      });

      if (researched.error) {
        console.log(`[FormProcess] Step 5 FAILED: ${researched.error}`);
        result.errors.push(researched.error);
        result.researchStatus = "failed";

        // Sales still gets the lead, just without the research brief attached.
        await reportOpsFailure({
          source: "Form processing",
          severity: "WARNING",
          summary: "Company research failed; the lead alert has no brief",
          error: researched.error,
          context: { submissionId, companyId },
          url: "/dashboard/submissions",
        });
      } else {
        result.researchStatus = researched.data?.status;
        research = researched.data?.research;
        console.log(
          `[FormProcess] Step 5 DONE: research ${researched.data?.status}${researched.data?.reason ? ` (${researched.data.reason})` : ""}`
        );
      }
    } else {
      console.log("[FormProcess] Step 5: Skipping research, no company linked to this submission");
      result.researchStatus = "skipped";
    }

    // Step 6: Update submission with all results
    console.log("[FormProcess] Step 6: Saving results to database...");
    const updateData = {
      emailValidation: result.emailValidation,
      firstName: result.firstName,
      lastName: result.lastName,
      personId: result.personId ?? null,
      companyId: result.companyId ?? null,
      errors: result.errors,
    };
    console.log("[FormProcess] Step 6: Update data:", JSON.stringify(updateData, null, 2));
    
    const updatedSubmission = await prisma.embedFormSubmission.update({
      where: { id: submissionId },
      data: updateData,
    });

    console.log("[FormProcess] Step 6 DONE: Results saved");

    // Step 7: Send Slack notification
    console.log("[FormProcess] Step 7: Sending Slack notification...");
    await notifyFormSubmission(updatedSubmission, research);
    console.log("[FormProcess] Step 7 DONE: Slack notification sent");

    console.log(`[FormProcess] ========== Processing ${result.success ? "SUCCEEDED" : "COMPLETED WITH ERRORS"} ==========\n`);

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error("[FormProcess] FATAL ERROR:", error);

    await reportOpsFailure({
      source: "Form processing",
      summary: "Lead processing failed; the lead may never have reached the sales channel",
      error,
      context: { submissionId: submissionId ?? "unknown" },
      url: "/dashboard/submissions",
    });

    return NextResponse.json({
      data: null,
      error: `Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    }, { status: 500 });
  }
}
