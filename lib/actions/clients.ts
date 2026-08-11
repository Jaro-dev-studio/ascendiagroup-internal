"use server";

import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ClientStatus, ServiceLine } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";
import { slugify } from "@/lib/utils";

const clientSchema = z.object({
  name: z.string().min(2, "Enter the practice name"),
  practiceType: z.string().optional(),
  website: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Enter a valid email").or(z.literal("")).optional(),
  contactPhone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  addressLine: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  packageTier: z.string().optional(),
  status: z.string(),
  monthlyRetainer: z.string().optional(),
  startDate: z.string().optional(),
  notes: z.string().optional(),
  accountManagerId: z.string().optional(),
  services: z.array(z.string()).default([]),
});

export type ClientFormInput = z.input<typeof clientSchema>;

function toNumber(value?: string) {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDate(value?: string) {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function uniqueSlug(name: string) {
  const base = slugify(name) || "client";
  let candidate = base;
  let suffix = 1;

  while (await prisma.client.findUnique({ where: { slug: candidate } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }

  return candidate;
}

export async function createClient(
  input: ClientFormInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[Clients] creating client "${input.name}"...`);

    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues[0].message };
    }

    const values = parsed.data;
    const client = await prisma.client.create({
      data: {
        name: values.name.trim(),
        slug: await uniqueSlug(values.name),
        portalToken: createId(),
        practiceType: values.practiceType || null,
        website: values.website || null,
        contactName: values.contactName || null,
        contactEmail: values.contactEmail || null,
        contactPhone: values.contactPhone || null,
        whatsappNumber: values.whatsappNumber || null,
        addressLine: values.addressLine || null,
        city: values.city || null,
        country: values.country || null,
        packageTier: values.packageTier || null,
        status: values.status as ClientStatus,
        monthlyRetainer: toNumber(values.monthlyRetainer),
        startDate: toDate(values.startDate),
        notes: values.notes || null,
        accountManagerId: values.accountManagerId || null,
        services: {
          create: values.services.map((service) => ({
            service: service as ServiceLine,
          })),
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        clientId: client.id,
        actorId: user.id,
        type: "CLIENT_CREATED",
        title: `${client.name} added`,
        description: values.packageTier ? `Package: ${values.packageTier}` : null,
        link: `/dashboard/clients/${client.id}`,
      },
    });

    console.log(`[Clients] created ${client.name} (${client.id})`);
    revalidatePath("/dashboard/clients");
    return { data: { id: client.id }, error: null };
  } catch (error) {
    console.error("[Clients] failed to create client", error);
    return { data: null, error: "Could not create the client." };
  }
}

export async function updateClient(
  id: string,
  input: ClientFormInput
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log(`[Clients] updating client ${id}...`);

    const parsed = clientSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues[0].message };
    }

    const values = parsed.data;
    await prisma.$transaction([
      prisma.clientService.deleteMany({ where: { clientId: id } }),
      prisma.client.update({
        where: { id },
        data: {
          name: values.name.trim(),
          practiceType: values.practiceType || null,
          website: values.website || null,
          contactName: values.contactName || null,
          contactEmail: values.contactEmail || null,
          contactPhone: values.contactPhone || null,
          whatsappNumber: values.whatsappNumber || null,
          addressLine: values.addressLine || null,
          city: values.city || null,
          country: values.country || null,
          packageTier: values.packageTier || null,
          status: values.status as ClientStatus,
          monthlyRetainer: toNumber(values.monthlyRetainer),
          startDate: toDate(values.startDate),
          notes: values.notes || null,
          accountManagerId: values.accountManagerId || null,
          services: {
            create: values.services.map((service) => ({
              service: service as ServiceLine,
            })),
          },
        },
      }),
    ]);

    revalidatePath("/dashboard/clients");
    revalidatePath(`/dashboard/clients/${id}`);
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Clients] failed to update client", error);
    return { data: null, error: "Could not update the client." };
  }
}

export async function deleteClient(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log(`[Clients] deleting client ${id}...`);

    await prisma.client.delete({ where: { id } });
    revalidatePath("/dashboard/clients");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Clients] failed to delete client", error);
    return { data: null, error: "Could not delete the client." };
  }
}

export async function setClientIntegrationLink(input: {
  clientId: string;
  provider: string;
  externalId: string;
  label?: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log(
      `[Clients] linking ${input.provider} account for client ${input.clientId}...`
    );

    const provider = input.provider as never;

    if (!input.externalId.trim()) {
      await prisma.clientIntegrationLink.deleteMany({
        where: { clientId: input.clientId, provider },
      });
      revalidatePath(`/dashboard/clients/${input.clientId}`);
      return { data: { id: input.clientId }, error: null };
    }

    const link = await prisma.clientIntegrationLink.upsert({
      where: {
        clientId_provider: { clientId: input.clientId, provider },
      },
      create: {
        clientId: input.clientId,
        provider,
        externalId: input.externalId.trim(),
        label: input.label || null,
      },
      update: {
        externalId: input.externalId.trim(),
        label: input.label || null,
      },
    });

    revalidatePath(`/dashboard/clients/${input.clientId}`);
    return { data: { id: link.id }, error: null };
  } catch (error) {
    console.error("[Clients] failed to link integration account", error);
    return { data: null, error: "Could not save the integration link." };
  }
}
