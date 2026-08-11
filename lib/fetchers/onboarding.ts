import "server-only";

import prisma from "@/lib/prisma";

export async function listOnboardingForms() {
  try {
    console.log("[Onboarding] listing intake forms...");

    const forms = await prisma.onboardingForm.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { fields: true, submissions: true } },
      },
    });

    return { data: forms, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to list forms", error);
    return { data: null, error: "Could not load intake forms." };
  }
}

export async function getOnboardingForm(id: string) {
  try {
    const form = await prisma.onboardingForm.findUnique({
      where: { id },
      include: {
        fields: { orderBy: { order: "asc" } },
        _count: { select: { submissions: true } },
      },
    });

    if (!form) return { data: null, error: "Form not found." };
    return { data: form, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to load form", error);
    return { data: null, error: "Could not load this form." };
  }
}

export async function getPublicForm(token: string) {
  try {
    console.log("[Onboarding] loading public intake form...");

    const submission = await prisma.onboardingSubmission.findUnique({
      where: { token },
      include: {
        form: { include: { fields: { orderBy: { order: "asc" } } } },
        client: { select: { name: true } },
      },
    });

    if (!submission) return { data: null, error: "This link is not valid." };
    return { data: submission, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to load public form", error);
    return { data: null, error: "Could not load this form." };
  }
}

export async function listSubmissions(filters?: {
  status?: string;
  clientId?: string;
}) {
  try {
    console.log("[Onboarding] listing submissions...");

    const submissions = await prisma.onboardingSubmission.findMany({
      where: {
        status: filters?.status ? (filters.status as never) : undefined,
        clientId: filters?.clientId || undefined,
      },
      orderBy: [{ submittedAt: "desc" }, { invitedAt: "desc" }],
      include: {
        form: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        _count: { select: { answers: true } },
      },
    });

    return { data: submissions, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to list submissions", error);
    return { data: null, error: "Could not load submissions." };
  }
}

export async function getSubmission(id: string) {
  try {
    const submission = await prisma.onboardingSubmission.findUnique({
      where: { id },
      include: {
        form: { select: { id: true, name: true } },
        client: { select: { id: true, name: true } },
        answers: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!submission) return { data: null, error: "Submission not found." };
    return { data: submission, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to load submission", error);
    return { data: null, error: "Could not load this submission." };
  }
}
