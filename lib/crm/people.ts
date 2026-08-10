import prisma from "@/lib/prisma";
import type { Company, Person, Prisma } from "@prisma/client";
import { isJaroDevTeamEmail } from "@/lib/constants";

// Domains that never identify a prospect's company
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "msn.com",
  "comcast.net",
]);

export function getEmailDomain(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return domain || null;
}

export function isGenericEmailDomain(domain: string): boolean {
  return GENERIC_EMAIL_DOMAINS.has(domain.toLowerCase());
}

export function splitFullName(fullName: string): {
  firstName: string | null;
  lastName: string | null;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Finds a company by its email/web domain, creating one when it does not exist.
 * Returns null for generic mailbox providers and internal Jaro.dev addresses,
 * since neither identifies a real prospect company.
 */
export async function findOrCreateCompanyByDomain(
  email: string
): Promise<Company | null> {
  if (isJaroDevTeamEmail(email)) return null;

  const domain = getEmailDomain(email);
  if (!domain || isGenericEmailDomain(domain)) return null;

  const existing = await prisma.company.findFirst({
    where: {
      OR: [
        { domain: { equals: domain, mode: "insensitive" } },
        { website: { equals: domain, mode: "insensitive" } },
        { domains: { has: domain } },
      ],
    },
  });

  if (existing) {
    // Backfill the CRM domain columns on companies created before they existed
    if (!existing.domain || !existing.domains.includes(domain)) {
      return prisma.company.update({
        where: { id: existing.id },
        data: {
          domain: existing.domain ?? domain,
          domains: Array.from(new Set([...existing.domains, domain])),
        },
      });
    }
    return existing;
  }

  const derivedName = titleCase(domain.split(".")[0]);
  console.log(
    `[CRM People] Creating company "${derivedName}" for domain ${domain}`
  );

  return prisma.company.create({
    data: {
      name: derivedName,
      domain,
      domains: [domain],
      website: domain,
    },
  });
}

interface UpsertPersonInput {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  source?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
  customFields?: Prisma.InputJsonValue;
}

/**
 * Upserts a contact by email. Existing values are never overwritten with empty
 * ones, so a sparse inbound payload cannot erase richer data already on record.
 */
export async function upsertPersonByEmail(
  input: UpsertPersonInput
): Promise<{ data: Person | null; error: string | null }> {
  try {
    const email = input.email.toLowerCase().trim();
    if (!email) return { data: null, error: "Email is required" };

    const derivedNames = input.fullName
      ? splitFullName(input.fullName)
      : { firstName: null, lastName: null };

    const firstName = input.firstName ?? derivedNames.firstName;
    const lastName = input.lastName ?? derivedNames.lastName;
    const fullName =
      input.fullName ??
      [firstName, lastName].filter(Boolean).join(" ") ??
      null;

    const companyId =
      input.companyId ?? (await findOrCreateCompanyByDomain(email))?.id ?? null;

    const existing = await prisma.person.findUnique({ where: { email } });

    if (existing) {
      const person = await prisma.person.update({
        where: { id: existing.id },
        data: {
          firstName: firstName ?? existing.firstName,
          lastName: lastName ?? existing.lastName,
          fullName: fullName || existing.fullName,
          jobTitle: input.jobTitle ?? existing.jobTitle,
          phone: input.phone ?? existing.phone,
          linkedinUrl: input.linkedinUrl ?? existing.linkedinUrl,
          companyId: companyId ?? existing.companyId,
          ownerId: input.ownerId ?? existing.ownerId,
          customFields: input.customFields ?? existing.customFields ?? undefined,
        },
      });
      return { data: person, error: null };
    }

    const person = await prisma.person.create({
      data: {
        email,
        firstName,
        lastName,
        fullName: fullName || null,
        jobTitle: input.jobTitle ?? null,
        phone: input.phone ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        source: input.source ?? null,
        companyId,
        ownerId: input.ownerId ?? null,
        customFields: input.customFields,
      },
    });

    return { data: person, error: null };
  } catch (error) {
    console.error("[CRM People] Failed to upsert person:", error);
    return { data: null, error: "Failed to upsert person" };
  }
}

export function getPersonDisplayName(person: {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
}): string {
  if (person.fullName) return person.fullName;
  const joined = [person.firstName, person.lastName].filter(Boolean).join(" ");
  if (joined) return joined;
  if (person.email) return person.email;
  return "Unknown";
}
