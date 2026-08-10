"use server";

import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import type {
  ConditionOperator,
  FieldType,
  ServiceLine,
} from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";
import { addDays, slugify } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Form templates
// ---------------------------------------------------------------------------

async function uniqueFormSlug(name: string) {
  const base = slugify(name) || "onboarding-form";
  let candidate = base;
  let suffix = 1;

  while (await prisma.onboardingForm.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

export async function createOnboardingForm(input: {
  name: string;
  description?: string;
  intro?: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[Onboarding] creating form "${input.name}"...`);

    if (input.name.trim().length < 2) {
      return { data: null, error: "Give the form a name." };
    }

    const form = await prisma.onboardingForm.create({
      data: {
        name: input.name.trim(),
        slug: await uniqueFormSlug(input.name),
        description: input.description || null,
        intro: input.intro || null,
        createdById: user.id,
      },
    });

    revalidatePath("/dashboard/onboarding");
    return { data: { id: form.id }, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to create form", error);
    return { data: null, error: "Could not create the form." };
  }
}

export async function updateOnboardingForm(
  id: string,
  input: {
    name: string;
    description?: string;
    intro?: string;
    isActive: boolean;
    isDefault: boolean;
  }
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log(`[Onboarding] updating form ${id}...`);

    if (input.isDefault) {
      await prisma.onboardingForm.updateMany({
        where: { id: { not: id } },
        data: { isDefault: false },
      });
    }

    await prisma.onboardingForm.update({
      where: { id },
      data: {
        name: input.name.trim(),
        description: input.description || null,
        intro: input.intro || null,
        isActive: input.isActive,
        isDefault: input.isDefault,
      },
    });

    revalidatePath("/dashboard/onboarding");
    revalidatePath(`/dashboard/onboarding/forms/${id}`);
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to update form", error);
    return { data: null, error: "Could not update the form." };
  }
}

export async function deleteOnboardingForm(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    await prisma.onboardingForm.delete({ where: { id } });
    revalidatePath("/dashboard/onboarding");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to delete form", error);
    return { data: null, error: "Could not delete the form." };
  }
}

// ---------------------------------------------------------------------------
// Fields (including the conditional split logic)
// ---------------------------------------------------------------------------

export interface FieldInput {
  section: string;
  label: string;
  helpText?: string;
  type: FieldType;
  options: string[];
  isRequired: boolean;
  isCredential: boolean;
  conditionalFieldId?: string | null;
  conditionOperator?: ConditionOperator | null;
  conditionValues: string[];
}

export async function saveFormField(input: {
  formId: string;
  fieldId?: string;
  field: FieldInput;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log(
      `[Onboarding] saving field "${input.field.label}" on form ${input.formId}...`
    );

    if (!input.field.label.trim()) {
      return { data: null, error: "Give the question a label." };
    }

    const needsOptions = ["SELECT", "MULTI_SELECT", "SERVICE_SELECT"].includes(
      input.field.type
    );
    if (needsOptions && input.field.options.filter(Boolean).length === 0) {
      return { data: null, error: "Add at least one option for this question type." };
    }

    if (input.field.conditionalFieldId && !input.field.conditionOperator) {
      return { data: null, error: "Choose how the condition should be evaluated." };
    }
    if (
      input.field.conditionalFieldId &&
      input.field.conditionValues.filter(Boolean).length === 0
    ) {
      return { data: null, error: "Add at least one value the condition matches on." };
    }
    if (input.fieldId && input.field.conditionalFieldId === input.fieldId) {
      return { data: null, error: "A question cannot depend on itself." };
    }

    const data = {
      section: input.field.section.trim() || "General",
      label: input.field.label.trim(),
      helpText: input.field.helpText?.trim() || null,
      type: input.field.type,
      options: input.field.options.map((option) => option.trim()).filter(Boolean),
      isRequired: input.field.isRequired,
      isCredential: input.field.isCredential,
      conditionalFieldId: input.field.conditionalFieldId || null,
      conditionOperator: input.field.conditionalFieldId
        ? input.field.conditionOperator
        : null,
      conditionValues: input.field.conditionalFieldId
        ? input.field.conditionValues.filter(Boolean)
        : [],
    };

    let fieldId = input.fieldId;

    if (fieldId) {
      await prisma.onboardingFormField.update({ where: { id: fieldId }, data });
    } else {
      const count = await prisma.onboardingFormField.count({
        where: { formId: input.formId },
      });
      const created = await prisma.onboardingFormField.create({
        data: { ...data, formId: input.formId, order: count },
      });
      fieldId = created.id;
    }

    revalidatePath(`/dashboard/onboarding/forms/${input.formId}`);
    return { data: { id: fieldId }, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to save field", error);
    return { data: null, error: "Could not save the question." };
  }
}

export async function deleteFormField(
  formId: string,
  fieldId: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();

    const dependents = await prisma.onboardingFormField.count({
      where: { conditionalFieldId: fieldId },
    });
    if (dependents > 0) {
      return {
        data: null,
        error: `${dependents} other question(s) branch off this one. Update them first.`,
      };
    }

    await prisma.onboardingFormField.delete({ where: { id: fieldId } });
    revalidatePath(`/dashboard/onboarding/forms/${formId}`);
    return { data: { id: fieldId }, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to delete field", error);
    return { data: null, error: "Could not delete the question." };
  }
}

export async function moveFormField(
  formId: string,
  fieldId: string,
  direction: "up" | "down"
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();

    const fields = await prisma.onboardingFormField.findMany({
      where: { formId },
      orderBy: { order: "asc" },
    });

    const index = fields.findIndex((field) => field.id === fieldId);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || target < 0 || target >= fields.length) {
      return { data: { id: fieldId }, error: null };
    }

    await prisma.$transaction([
      prisma.onboardingFormField.update({
        where: { id: fields[index].id },
        data: { order: target },
      }),
      prisma.onboardingFormField.update({
        where: { id: fields[target].id },
        data: { order: index },
      }),
    ]);

    revalidatePath(`/dashboard/onboarding/forms/${formId}`);
    return { data: { id: fieldId }, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to reorder fields", error);
    return { data: null, error: "Could not reorder the questions." };
  }
}

// ---------------------------------------------------------------------------
// Submissions
// ---------------------------------------------------------------------------

export async function createSubmissionInvite(input: {
  formId: string;
  clientId?: string;
  practiceName?: string;
  contactName?: string;
  contactEmail?: string;
}): Promise<{ data: { id: string; token: string } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[Onboarding] creating intake invite for form ${input.formId}...`);

    const fieldCount = await prisma.onboardingFormField.count({
      where: { formId: input.formId },
    });
    if (fieldCount === 0) {
      return {
        data: null,
        error: "Add at least one question to this form before sending it.",
      };
    }

    const submission = await prisma.onboardingSubmission.create({
      data: {
        formId: input.formId,
        clientId: input.clientId || null,
        token: createId(),
        practiceName: input.practiceName || null,
        contactName: input.contactName || null,
        contactEmail: input.contactEmail || null,
      },
    });

    if (input.clientId) {
      await prisma.activityLog.create({
        data: {
          clientId: input.clientId,
          actorId: user.id,
          type: "ONBOARDING_INVITED",
          title: "Onboarding form sent",
          link: `/dashboard/onboarding/submissions/${submission.id}`,
        },
      });
    }

    revalidatePath("/dashboard/onboarding/submissions");
    return { data: { id: submission.id, token: submission.token }, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to create invite", error);
    return { data: null, error: "Could not create the intake link." };
  }
}

export async function submitOnboardingForm(input: {
  token: string;
  practiceName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  answers: { fieldId: string; value?: string; values?: string[] }[];
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    console.log("[Onboarding] receiving public form submission...");

    const submission = await prisma.onboardingSubmission.findUnique({
      where: { token: input.token },
      include: { form: { include: { fields: true } } },
    });

    if (!submission) return { data: null, error: "This link is not valid." };
    if (submission.status !== "INVITED") {
      return { data: null, error: "This form has already been submitted." };
    }

    const fieldsById = new Map(
      submission.form.fields.map((field) => [field.id, field])
    );

    const answerData = input.answers
      .map((answer) => {
        const field = fieldsById.get(answer.fieldId);
        if (!field) return null;

        return {
          fieldId: field.id,
          label: field.label,
          section: field.section,
          value: answer.value?.trim() || null,
          values: answer.values ?? [],
          isCredential: field.isCredential,
        };
      })
      .filter((answer): answer is NonNullable<typeof answer> => answer !== null)
      .filter((answer) => Boolean(answer.value) || answer.values.length > 0);

    await prisma.onboardingSubmission.update({
      where: { id: submission.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        practiceName: input.practiceName.trim(),
        contactName: input.contactName.trim(),
        contactEmail: input.contactEmail.trim(),
        contactPhone: input.contactPhone?.trim() || null,
        answers: { deleteMany: {}, create: answerData },
      },
    });

    if (submission.clientId) {
      await prisma.activityLog.create({
        data: {
          clientId: submission.clientId,
          type: "ONBOARDING_SUBMITTED",
          title: "Onboarding form submitted",
          description: `${answerData.length} answers received`,
          link: `/dashboard/onboarding/submissions/${submission.id}`,
        },
      });
    }

    console.log(
      `[Onboarding] stored ${answerData.length} answers for submission ${submission.id}`
    );

    revalidatePath("/dashboard/onboarding/submissions");
    return { data: { id: submission.id }, error: null };
  } catch (error) {
    console.error("[Onboarding] failed to store submission", error);
    return { data: null, error: "Could not submit the form. Try again." };
  }
}

/**
 * Turns a submitted intake form into a delivery project: creates or links the
 * client, seeds the knowledge base, applies onboarding automation templates and
 * mirrors the board to Trello when connected.
 */
export async function processSubmission(input: {
  submissionId: string;
  clientId?: string;
  projectName?: string;
}): Promise<{
  data: { projectId: string; clientId: string; taskCount: number; notes: string[] } | null;
  error: string | null;
}> {
  try {
    const user = await requireStaff();
    console.log(`[Onboarding] processing submission ${input.submissionId}...`);

    const submission = await prisma.onboardingSubmission.findUnique({
      where: { id: input.submissionId },
      include: { answers: true, form: true },
    });

    if (!submission) return { data: null, error: "Submission not found." };
    if (submission.status === "INVITED") {
      return { data: null, error: "This form has not been submitted yet." };
    }

    const notes: string[] = [];
    let clientId = input.clientId || submission.clientId;

    if (!clientId) {
      const name = submission.practiceName || submission.contactName || "New client";
      console.log(`[Onboarding] creating client record for ${name}...`);

      let slug = slugify(name) || "client";
      let suffix = 1;
      while (await prisma.client.findUnique({ where: { slug } })) {
        suffix += 1;
        slug = `${slugify(name)}-${suffix}`;
      }

      const created = await prisma.client.create({
        data: {
          name,
          slug,
          portalToken: createId(),
          contactName: submission.contactName,
          contactEmail: submission.contactEmail,
          contactPhone: submission.contactPhone,
          status: "ONBOARDING",
          accountManagerId: user.id,
        },
      });
      clientId = created.id;
      notes.push(`Created client record for ${name}.`);
    }

    // Service selections captured in the form drive the delivery pathway.
    const serviceValues = new Set<string>();
    const serviceFields = await prisma.onboardingFormField.findMany({
      where: { formId: submission.formId, type: "SERVICE_SELECT" },
      select: { id: true },
    });
    const serviceFieldIds = new Set(serviceFields.map((field) => field.id));

    for (const answer of submission.answers) {
      if (!serviceFieldIds.has(answer.fieldId)) continue;
      for (const value of answer.values.length ? answer.values : [answer.value ?? ""]) {
        if (value) serviceValues.add(value);
      }
    }

    for (const service of serviceValues) {
      await prisma.clientService
        .create({ data: { clientId, service: service as ServiceLine } })
        .catch(() => undefined);
    }
    if (serviceValues.size > 0) {
      notes.push(`Applied ${serviceValues.size} contracted service(s) to the client.`);
    }

    const project = await prisma.project.create({
      data: {
        clientId,
        name:
          input.projectName?.trim() ||
          `${submission.practiceName ?? "Client"} onboarding`,
        description: `Created from the "${submission.form.name}" intake form.`,
        status: "ACTIVE",
        startDate: new Date(),
        dueDate: addDays(new Date(), 30),
        ownerId: user.id,
        sourceSubmissionId: submission.id,
      },
    });

    // Seed the knowledge base with the non-credential answers.
    const knowledgeBody = submission.answers
      .filter((answer) => !answer.isCredential)
      .map((answer) => {
        const value = answer.values.length
          ? answer.values.join(", ")
          : answer.value ?? "";
        return `${answer.section} — ${answer.label}: ${value}`;
      })
      .join("\n");

    if (knowledgeBody) {
      await prisma.knowledgeDocument.create({
        data: {
          clientId,
          title: `Onboarding answers — ${submission.form.name}`,
          source: "ONBOARDING",
          sourceRef: submission.id,
          content: knowledgeBody,
          createdById: user.id,
        },
      });
      notes.push("Seeded the knowledge base with the intake answers.");
    }

    // Apply automation rules that fire on intake.
    const rules = await prisma.automationRule.findMany({
      where: { trigger: "ONBOARDING_SUBMITTED", isActive: true },
      include: { template: { include: { items: { orderBy: { order: "asc" } } } } },
    });

    let taskCount = 0;
    for (const rule of rules) {
      if (!rule.template) continue;
      if (
        rule.template.service &&
        serviceValues.size > 0 &&
        !serviceValues.has(rule.template.service)
      ) {
        continue;
      }

      for (const item of rule.template.items) {
        await prisma.task.create({
          data: {
            projectId: project.id,
            clientId,
            title: item.title,
            description: item.description,
            priority: item.priority,
            dueDate: addDays(new Date(), item.offsetDays),
            position: taskCount,
            source: "ONBOARDING",
            sourceRef: rule.id,
          },
        });
        taskCount += 1;
      }

      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date(), runCount: { increment: 1 } },
      });
    }

    if (taskCount > 0) {
      notes.push(`Created ${taskCount} onboarding tasks from your templates.`);
    } else {
      notes.push(
        "No onboarding automation matched, so the board was created empty. Add a task template under Automations to populate it next time."
      );
    }

    await prisma.onboardingSubmission.update({
      where: { id: submission.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        clientId,
        projectId: project.id,
      },
    });

    await prisma.activityLog.create({
      data: {
        clientId,
        projectId: project.id,
        actorId: user.id,
        type: "PROJECT_CREATED",
        title: `Project created from intake`,
        description: project.name,
        link: `/dashboard/projects/${project.id}`,
      },
    });

    revalidatePath("/dashboard/onboarding/submissions");
    revalidatePath(`/dashboard/clients/${clientId}`);
    revalidatePath("/dashboard/projects");

    console.log(
      `[Onboarding] submission processed into project ${project.id} with ${taskCount} tasks`
    );

    return {
      data: { projectId: project.id, clientId, taskCount, notes },
      error: null,
    };
  } catch (error) {
    console.error("[Onboarding] failed to process submission", error);
    return { data: null, error: "Could not process this submission." };
  }
}
