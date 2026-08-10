import prisma from "@/lib/prisma";
import {
  getSequenceDetail,
  getSequences,
  getSuppressions,
} from "@/lib/fetchers/sequences";
import { getEntityHref } from "../entity-href";
import { defineTool, type AITool } from "../types";

const SEQUENCE_STATUS_ENUM = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;

const ENROLLMENT_STATUS_ENUM = [
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "REPLIED",
  "BOUNCED",
  "UNSUBSCRIBED",
  "STOPPED",
  "FAILED",
] as const;

export const sequenceReadTools: AITool[] = [
  defineTool({
    name: "querySequences",
    label: "Query Sequences",
    risk: "read",
    description:
      "List outbound email sequences with their status, sending mailbox, step count and enrollment/reply statistics. Use this to resolve a sequence name to its ID.",
    parameters: {
      properties: {
        searchQuery: { type: "string", description: "Filter by sequence name" },
        status: {
          type: "array",
          items: { type: "string", enum: [...SEQUENCE_STATUS_ENUM] },
          description: "Filter by sequence status",
        },
      },
    },
    execute: async (args) => {
      const { searchQuery, status } = args as { searchQuery?: string; status?: string[] };

      const result = await getSequences();
      if (result.error) throw new Error(result.error);

      let sequences = result.data ?? [];

      if (searchQuery) {
        const needle = searchQuery.toLowerCase();
        sequences = sequences.filter((sequence) => sequence.name.toLowerCase().includes(needle));
      }
      if (status?.length) {
        sequences = sequences.filter((sequence) => status.includes(sequence.status));
      }

      return {
        count: sequences.length,
        sequences: sequences.map((sequence) => ({
          ...sequence,
          href: getEntityHref("sequence", sequence.id),
          updatedAt: sequence.updatedAt.toISOString(),
        })),
      };
    },
  }),

  defineTool({
    name: "getSequenceDetail",
    label: "Get Sequence Detail",
    risk: "read",
    description:
      "Get a sequence with its steps (delay, subject, per-step send/open/reply counts), its enrollments and enrollment counts by status. Resolve the sequence ID with querySequences first.",
    parameters: {
      properties: {
        sequenceId: { type: "string", description: "The sequence ID" },
        includeStepBodies: {
          type: "boolean",
          description: "Include the full HTML body of each step (verbose, off by default)",
        },
      },
      required: ["sequenceId"],
    },
    execute: async (args) => {
      const { sequenceId, includeStepBodies } = args as {
        sequenceId: string;
        includeStepBodies?: boolean;
      };

      const result = await getSequenceDetail(sequenceId);
      if (result.error) throw new Error(result.error);
      if (!result.data) return { found: false, sequenceId };

      const sequence = result.data;

      return {
        found: true,
        href: getEntityHref("sequence", sequenceId),
        sequence: {
          ...sequence,
          steps: sequence.steps.map((step) => ({
            ...step,
            bodyHtml: includeStepBodies ? step.bodyHtml : undefined,
          })),
          enrollments: sequence.enrollments.map((enrollment) => ({
            ...enrollment,
            nextSendAt: enrollment.nextSendAt?.toISOString() ?? null,
            lastSentAt: enrollment.lastSentAt?.toISOString() ?? null,
            createdAt: enrollment.createdAt.toISOString(),
          })),
        },
      };
    },
  }),

  defineTool({
    name: "querySequenceEnrollments",
    label: "Query Sequence Enrollments",
    risk: "read",
    description:
      "Query sequence enrollments across sequences, optionally scoped to one sequence or one contact. Use this to find out which sequences a contact is in, or who is stalled, replied or bounced.",
    parameters: {
      properties: {
        sequenceId: { type: "string", description: "Only enrollments in this sequence" },
        personId: { type: "string", description: "Only enrollments for this contact" },
        status: {
          type: "array",
          items: { type: "string", enum: [...ENROLLMENT_STATUS_ENUM] },
          description: "Filter by enrollment status",
        },
        limit: { type: "number", description: "Maximum enrollments to return (default 25, max 100)" },
      },
    },
    execute: async (args) => {
      const { sequenceId, personId, status, limit = 25 } = args as {
        sequenceId?: string;
        personId?: string;
        status?: string[];
        limit?: number;
      };

      const where: Record<string, unknown> = {};
      if (sequenceId) where.sequenceId = sequenceId;
      if (personId) where.personId = personId;
      if (status?.length) where.status = { in: status };

      const enrollments = await prisma.sequenceEnrollment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(limit, 100),
        select: {
          id: true,
          status: true,
          currentStep: true,
          nextSendAt: true,
          stoppedReason: true,
          createdAt: true,
          completedAt: true,
          sequence: { select: { id: true, name: true, status: true } },
          person: {
            select: {
              id: true,
              fullName: true,
              email: true,
              company: { select: { id: true, name: true } },
            },
          },
        },
      });

      return {
        count: enrollments.length,
        enrollments: enrollments.map((enrollment) => ({
          id: enrollment.id,
          status: enrollment.status,
          currentStep: enrollment.currentStep,
          nextSendAt: enrollment.nextSendAt?.toISOString() ?? null,
          stoppedReason: enrollment.stoppedReason,
          createdAt: enrollment.createdAt.toISOString(),
          completedAt: enrollment.completedAt?.toISOString() ?? null,
          sequence: {
            ...enrollment.sequence,
            href: getEntityHref("sequence", enrollment.sequence.id),
          },
          person: {
            id: enrollment.person.id,
            href: getEntityHref("person", enrollment.person.id),
            name: enrollment.person.fullName,
            email: enrollment.person.email,
            company: enrollment.person.company
              ? {
                ...enrollment.person.company,
                href: getEntityHref("company", enrollment.person.company.id),
              }
              : null,
          },
        })),
      };
    },
  }),

  defineTool({
    name: "querySuppressions",
    label: "Query Suppressions",
    risk: "read",
    description:
      "List email addresses on the global suppression list, which are never sent to by any sequence.",
    parameters: {
      properties: {
        searchQuery: { type: "string", description: "Filter by email address" },
        limit: { type: "number", description: "Maximum entries to return (default 50, max 200)" },
      },
    },
    execute: async (args) => {
      const { searchQuery, limit = 50 } = args as { searchQuery?: string; limit?: number };

      const result = await getSuppressions(Math.min(limit, 200));
      if (result.error) throw new Error(result.error);

      let suppressions = result.data ?? [];
      if (searchQuery) {
        const needle = searchQuery.toLowerCase();
        suppressions = suppressions.filter((entry) => entry.email.toLowerCase().includes(needle));
      }

      return {
        count: suppressions.length,
        suppressions: suppressions.map((entry) => ({
          id: entry.id,
          email: entry.email,
          reason: entry.reason,
          note: entry.note,
          createdAt: entry.createdAt.toISOString(),
        })),
      };
    },
  }),
];
