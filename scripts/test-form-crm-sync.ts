/**
 * Exercises the form-submission -> CRM contact path: contact upsert, timeline
 * entry, auto-enrollment lookup and the submission back-link. Creates a
 * throwaway submission and removes everything it wrote before exiting.
 *
 * Run with: pnpm tsx --env-file=.env scripts/test-form-crm-sync.ts
 */
import prisma from "../lib/prisma";
import { upsertPersonByEmail } from "../lib/crm/people";
import { logCrmActivity } from "../lib/crm/activity";
import { autoEnrollPerson } from "../lib/crm/sequences/entry-criteria";

const TEST_EMAIL = `crm-sync-test-${Date.now()}@example-test-domain.com`;

async function main() {
  console.log("[FormCrmTest] creating a throwaway BusinessOS submission...");
  const submission = await prisma.embedFormSubmission.create({
    data: {
      type: "BUSINESSOS",
      name: "Sync Test Lead",
      email: TEST_EMAIL,
      firstName: "Sync",
      lastName: "Test",
      utmSource: "test-suite",
      companyHeadcount: "51-200",
      errors: [],
    },
    select: { id: true, type: true },
  });

  console.log("[FormCrmTest] upserting the CRM contact...");
  const upsert = await upsertPersonByEmail({
    email: TEST_EMAIL,
    firstName: "Sync",
    lastName: "Test",
    source: `embed-form:${submission.type.toLowerCase()}`,
    customFields: { utmSource: "test-suite" },
  });

  if (!upsert.data) {
    throw new Error(`Contact upsert failed: ${upsert.error}`);
  }

  const person = upsert.data;
  console.log(
    `[FormCrmTest] contact ${person.id}: ${person.fullName} <${person.email}> company=${person.companyId}`
  );

  console.log("[FormCrmTest] logging the timeline entry...");
  const activity = await logCrmActivity({
    type: "FORM_SUBMITTED",
    title: "Submitted the BusinessOS form",
    personId: person.id,
    companyId: person.companyId,
    payload: { submissionId: submission.id, utmSource: "test-suite" },
    externalId: `form-submission:${submission.id}`,
  });

  if (!activity.data) {
    throw new Error(`Timeline write failed: ${activity.error}`);
  }

  console.log("[FormCrmTest] replaying the timeline write to check idempotency...");
  const replay = await logCrmActivity({
    type: "FORM_SUBMITTED",
    title: "Submitted the BusinessOS form",
    personId: person.id,
    externalId: `form-submission:${submission.id}`,
  });

  if (replay.data?.id !== activity.data.id) {
    throw new Error("Replay created a duplicate timeline entry");
  }
  console.log("[FormCrmTest] replay reused activity", activity.data.id);

  // Linked first, because entry criteria can ask about form submissions
  console.log("[FormCrmTest] linking the submission to the contact...");
  const linked = await prisma.embedFormSubmission.update({
    where: { id: submission.id },
    data: { personId: person.id, companyId: person.companyId },
    select: { personId: true, companyId: true },
  });

  if (linked.personId !== person.id) {
    throw new Error("Submission was not linked to the contact");
  }
  console.log("[FormCrmTest] submission linked to", linked.personId);

  console.log("[FormCrmTest] running entry-criteria auto-enrollment...");
  const enrollment = await autoEnrollPerson(person.id);
  if (enrollment.error) {
    throw new Error(`Auto-enrollment failed: ${enrollment.error}`);
  }
  console.log(
    `[FormCrmTest] auto-enrollment enrolled the contact in ${enrollment.data?.enrolled} sequence(s)`
  );

  console.log("[FormCrmTest] cleaning up...");
  await prisma.embedFormSubmission.delete({ where: { id: submission.id } });
  await prisma.sequenceEnrollment.deleteMany({ where: { personId: person.id } });
  await prisma.crmActivity.deleteMany({ where: { personId: person.id } });
  await prisma.person.delete({ where: { id: person.id } });
  if (person.companyId) {
    const remaining = await prisma.person.count({
      where: { companyId: person.companyId },
    });
    if (remaining === 0) {
      await prisma.company.delete({ where: { id: person.companyId } });
      console.log(`[FormCrmTest] removed the test company ${person.companyId}`);
    }
  }

  console.log("[FormCrmTest] PASS");
}

main()
  .catch((error) => {
    console.error("[FormCrmTest] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
