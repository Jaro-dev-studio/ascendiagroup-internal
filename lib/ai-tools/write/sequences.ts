import prisma from "@/lib/prisma";
import {
  addSuppressionEntry,
  createSequence,
  createSequenceStep,
  deleteSequence,
  deleteSequenceStep,
  enrollContacts,
  removeEnrollment,
  removeSuppressionEntry,
  runSequencesNow,
  setEnrollmentStatus,
  setSequenceStatus,
  syncRepliesNow,
  updateSequence,
  updateSequenceStep,
} from "@/lib/actions/sequences";
import type { SequenceSettingsInput, SequenceStepInput } from "@/lib/actions/sequences";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { changeSummary, deletePreview, unwrapAction } from "./helpers";
import type { SequenceStatus } from "@prisma/client";

const SEQUENCE_STATUS_ENUM = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;
const ENROLLMENT_STATUS_ENUM = ["ACTIVE", "PAUSED", "STOPPED"] as const;

/** Mirrors the Sequence model defaults so a create call only needs name and sender. */
const SETTINGS_DEFAULTS = {
  description: null,
  senderName: null,
  timezone: "Europe/London",
  sendWindowStart: 9,
  sendWindowEnd: 17,
  sendOnWeekends: false,
  dailySendLimit: 50,
  stopOnReply: true,
  stopOnMeetingBooked: true,
  trackOpens: false,
  trackClicks: false,
  autoEnrollEnabled: false,
} as const;

const SETTINGS_PROPERTIES = {
  description: { type: "string", description: "Internal description" },
  senderName: { type: "string", description: "Display name on outgoing email" },
  timezone: { type: "string", description: "IANA timezone for the send window" },
  sendWindowStart: { type: "number", description: "First hour of the send window, 0-23" },
  sendWindowEnd: { type: "number", description: "Last hour of the send window, 1-24" },
  sendOnWeekends: { type: "boolean", description: "Allow sends on Saturday and Sunday" },
  dailySendLimit: { type: "number", description: "Maximum emails per day for this sequence" },
  stopOnReply: { type: "boolean", description: "Stop a contact's enrollment when they reply" },
  stopOnMeetingBooked: {
    type: "boolean",
    description: "Stop a contact's enrollment when they book a meeting",
  },
  trackOpens: { type: "boolean", description: "Insert an open-tracking pixel" },
  trackClicks: { type: "boolean", description: "Rewrite links for click tracking" },
  autoEnrollEnabled: {
    type: "boolean",
    description: "Automatically enroll contacts that match the sequence's entry criteria",
  },
} as const;

type SettingsArgs = Partial<Record<keyof typeof SETTINGS_PROPERTIES, unknown>>;

function buildSettings(
  args: SettingsArgs & { name?: unknown; senderEmail?: unknown },
  existing?: SequenceSettingsInput
): SequenceSettingsInput {
  const base = existing ?? {
    ...SETTINGS_DEFAULTS,
    name: "",
    senderEmail: "",
  };

  const pick = <K extends keyof SequenceSettingsInput>(
    key: K,
    value: unknown
  ): SequenceSettingsInput[K] => (value === undefined ? base[key] : (value as SequenceSettingsInput[K]));

  return {
    name: pick("name", args.name),
    senderEmail: pick("senderEmail", args.senderEmail),
    description: pick("description", args.description),
    senderName: pick("senderName", args.senderName),
    timezone: pick("timezone", args.timezone),
    sendWindowStart: pick("sendWindowStart", args.sendWindowStart),
    sendWindowEnd: pick("sendWindowEnd", args.sendWindowEnd),
    sendOnWeekends: pick("sendOnWeekends", args.sendOnWeekends),
    dailySendLimit: pick("dailySendLimit", args.dailySendLimit),
    stopOnReply: pick("stopOnReply", args.stopOnReply),
    stopOnMeetingBooked: pick("stopOnMeetingBooked", args.stopOnMeetingBooked),
    trackOpens: pick("trackOpens", args.trackOpens),
    trackClicks: pick("trackClicks", args.trackClicks),
    autoEnrollEnabled: pick("autoEnrollEnabled", args.autoEnrollEnabled),
  };
}

/** updateSequence takes the full settings object, so unspecified fields are read back first. */
async function loadSettings(sequenceId: string): Promise<SequenceSettingsInput> {
  const sequence = await prisma.sequence.findUnique({
    where: { id: sequenceId },
    select: {
      name: true,
      description: true,
      senderEmail: true,
      senderName: true,
      timezone: true,
      sendWindowStart: true,
      sendWindowEnd: true,
      sendOnWeekends: true,
      dailySendLimit: true,
      stopOnReply: true,
      stopOnMeetingBooked: true,
      trackOpens: true,
      trackClicks: true,
      autoEnrollEnabled: true,
    },
  });

  if (!sequence) throw new Error("Sequence not found");
  return sequence;
}

async function loadStep(stepId: string): Promise<SequenceStepInput & { order: number }> {
  const step = await prisma.sequenceStep.findUnique({
    where: { id: stepId },
    select: {
      order: true,
      delayDays: true,
      delayHours: true,
      subject: true,
      bodyHtml: true,
      sendInThread: true,
    },
  });

  if (!step) throw new Error("Step not found");
  return step;
}

export const sequenceWriteTools: AITool[] = [
  defineTool({
    name: "createSequence",
    label: "Create Sequence",
    risk: "additive",
    description:
      "Create an outbound email sequence. It starts as a DRAFT with no steps and sends nothing until you add steps and set it to ACTIVE. The sender must be a workspace mailbox; check the options with querySequences or the sequence settings of an existing sequence.",
    parameters: {
      properties: {
        name: { type: "string", description: "Sequence name" },
        senderEmail: { type: "string", description: "Sending mailbox, must be a workspace address" },
        ...SETTINGS_PROPERTIES,
      },
      required: ["name", "senderEmail"],
    },
    preview: async (args) => ({
      title: "Create sequence",
      summary: `"${args.name}" sending from ${args.senderEmail}. Created as a DRAFT, so nothing sends yet.`,
      details: {
        "Send window": `${args.sendWindowStart ?? 9}:00 to ${args.sendWindowEnd ?? 17}:00 ${
          args.timezone ?? SETTINGS_DEFAULTS.timezone
        }`,
        "Daily limit": (args.dailySendLimit as number) ?? SETTINGS_DEFAULTS.dailySendLimit,
        "Stop on reply": (args.stopOnReply as boolean) ?? SETTINGS_DEFAULTS.stopOnReply,
      },
    }),
    execute: async (args) => unwrapAction(createSequence(buildSettings(args))),
  }),

  defineTool({
    name: "updateSequence",
    label: "Update Sequence",
    risk: "additive",
    description:
      "Update a sequence's settings: name, sender, send window, daily limit, exit conditions, tracking and auto-enroll. Only the fields you provide are changed. Use setSequenceStatus to start or pause sending.",
    parameters: {
      properties: {
        sequenceId: { type: "string", description: "The sequence ID" },
        name: { type: "string", description: "New sequence name" },
        senderEmail: { type: "string", description: "New sending mailbox" },
        ...SETTINGS_PROPERTIES,
      },
      required: ["sequenceId"],
    },
    preview: async (args) => {
      const { sequenceId, ...changes } = args;
      const name = await lookupEntityLabel("sequence", String(sequenceId));

      return {
        title: "Update sequence",
        summary: `${name ?? sequenceId}: ${changeSummary(changes)}`,
        details: changes,
      };
    },
    execute: async (args) => {
      const { sequenceId, ...changes } = args;
      const existing = await loadSettings(sequenceId as string);

      return unwrapAction(
        updateSequence(sequenceId as string, buildSettings(changes, existing))
      );
    },
  }),

  defineTool({
    name: "setSequenceStatus",
    label: "Set Sequence Status",
    risk: "additive",
    description:
      "Change a sequence's status. Setting it to ACTIVE starts real outbound email to every active enrollment as soon as the send window opens, and is rejected if the sequence has no steps or the sender mailbox cannot send. PAUSED and ARCHIVED also pause all in-flight enrollments.",
    parameters: {
      properties: {
        sequenceId: { type: "string", description: "The sequence ID" },
        status: {
          type: "string",
          enum: [...SEQUENCE_STATUS_ENUM],
          description: "The new status",
        },
      },
      required: ["sequenceId", "status"],
    },
    preview: async (args) => {
      const name = await lookupEntityLabel("sequence", String(args.sequenceId));
      const status = args.status as string;

      return {
        title: "Set sequence status",
        summary:
          status === "ACTIVE"
            ? `Activate "${name ?? args.sequenceId}". This starts sending real email to enrolled contacts.`
            : `Set "${name ?? args.sequenceId}" to ${status}${
              status === "PAUSED" || status === "ARCHIVED"
                ? ". In-flight enrollments are paused."
                : "."
            }`,
        details: { Sequence: name ?? args.sequenceId, Status: status },
      };
    },
    execute: async (args) =>
      unwrapAction(
        setSequenceStatus(args.sequenceId as string, args.status as SequenceStatus)
      ),
  }),

  defineTool({
    name: "deleteSequence",
    label: "Delete Sequence",
    risk: "destructive",
    description:
      "Permanently delete a sequence with all of its steps, enrollments and message history. Prefer setting the status to ARCHIVED to keep the record.",
    parameters: {
      properties: {
        sequenceId: { type: "string", description: "The sequence ID" },
      },
      required: ["sequenceId"],
    },
    preview: deletePreview("sequence", "sequenceId", "sequence"),
    execute: async (args) => unwrapAction(deleteSequence(args.sequenceId as string)),
  }),

  defineTool({
    name: "createSequenceStep",
    label: "Add Sequence Step",
    risk: "additive",
    description:
      "Add an email step to the end of a sequence. The delay is measured from the previous step's send, or from enrollment for the first step. The first step always starts a new thread regardless of sendInThread.",
    parameters: {
      properties: {
        sequenceId: { type: "string", description: "The sequence ID" },
        subject: { type: "string", description: "Email subject line" },
        bodyHtml: { type: "string", description: "Email body as HTML" },
        delayDays: { type: "number", description: "Days to wait before this step, defaults to 0" },
        delayHours: { type: "number", description: "Additional hours to wait, 0-23, defaults to 0" },
        sendInThread: {
          type: "boolean",
          description: "Send as a reply in the existing thread rather than a new one",
        },
      },
      required: ["sequenceId", "subject", "bodyHtml"],
    },
    preview: async (args) => {
      const name = await lookupEntityLabel("sequence", String(args.sequenceId));
      const body = String(args.bodyHtml ?? "");

      return {
        title: "Add sequence step",
        summary: `New step on "${name ?? args.sequenceId}" with subject "${args.subject}"`,
        details: {
          Delay: `${(args.delayDays as number) ?? 0}d ${(args.delayHours as number) ?? 0}h`,
          "Send in thread": (args.sendInThread as boolean) ?? true,
          Body: body.length > 400 ? `${body.slice(0, 397)}...` : body,
        },
      };
    },
    execute: async (args) =>
      unwrapAction(
        createSequenceStep(args.sequenceId as string, {
          subject: args.subject as string,
          bodyHtml: args.bodyHtml as string,
          delayDays: (args.delayDays as number) ?? 0,
          delayHours: (args.delayHours as number) ?? 0,
          sendInThread: (args.sendInThread as boolean) ?? true,
        })
      ),
  }),

  defineTool({
    name: "updateSequenceStep",
    label: "Update Sequence Step",
    risk: "additive",
    description:
      "Update a sequence step's subject, body, delay or threading. Only the fields you provide are changed. Find the step ID with getSequenceDetail.",
    parameters: {
      properties: {
        stepId: { type: "string", description: "The step ID" },
        subject: { type: "string", description: "New subject line" },
        bodyHtml: { type: "string", description: "New email body as HTML" },
        delayDays: { type: "number", description: "New delay in days" },
        delayHours: { type: "number", description: "New additional delay in hours, 0-23" },
        sendInThread: { type: "boolean", description: "Whether to send as a thread reply" },
      },
      required: ["stepId"],
    },
    preview: async (args) => {
      const { stepId, ...changes } = args;
      const label = await lookupEntityLabel("sequenceStep", String(stepId));

      return {
        title: "Update sequence step",
        summary: `${label ?? stepId}: ${changeSummary(changes)}`,
        details: changes,
      };
    },
    execute: async (args) => {
      const { stepId, ...changes } = args;
      const existing = await loadStep(stepId as string);

      return unwrapAction(
        updateSequenceStep(stepId as string, {
          subject: (changes.subject as string) ?? existing.subject,
          bodyHtml: (changes.bodyHtml as string) ?? existing.bodyHtml,
          delayDays: (changes.delayDays as number) ?? existing.delayDays,
          delayHours: (changes.delayHours as number) ?? existing.delayHours,
          sendInThread: (changes.sendInThread as boolean) ?? existing.sendInThread,
        })
      );
    },
  }),

  defineTool({
    name: "deleteSequenceStep",
    label: "Delete Sequence Step",
    risk: "destructive",
    description:
      "Delete a step from a sequence and renumber the remaining steps. Enrollments that already passed the removed step keep their position, so nobody receives a duplicate send.",
    parameters: {
      properties: {
        stepId: { type: "string", description: "The step ID" },
      },
      required: ["stepId"],
    },
    preview: deletePreview("sequenceStep", "stepId", "sequence step"),
    execute: async (args) => unwrapAction(deleteSequenceStep(args.stepId as string)),
  }),

  defineTool({
    name: "enrollContacts",
    label: "Enroll Contacts",
    risk: "additive",
    description:
      "Enroll contacts into a sequence. If the sequence is ACTIVE this schedules real outbound email to them. Contacts who are suppressed, marked do-not-contact, already enrolled or have no email are skipped. Resolve the person IDs with queryPeople first.",
    parameters: {
      properties: {
        sequenceId: { type: "string", description: "The sequence ID" },
        personIds: {
          type: "array",
          items: { type: "string" },
          description: "Contact IDs to enroll",
        },
      },
      required: ["sequenceId", "personIds"],
    },
    preview: async (args) => {
      const personIds = (args.personIds as string[]) ?? [];
      const sequence = await prisma.sequence.findUnique({
        where: { id: String(args.sequenceId) },
        select: { name: true, status: true, senderEmail: true },
      });

      const names = await Promise.all(
        personIds.slice(0, 10).map((id) => lookupEntityLabel("person", id))
      );
      const listed = names.filter(Boolean).join(", ");
      const extra = personIds.length > 10 ? ` and ${personIds.length - 10} more` : "";

      return {
        title: "Enroll contacts",
        summary:
          sequence?.status === "ACTIVE"
            ? `Enroll ${personIds.length} contact(s) into "${sequence.name}". This sequence is ACTIVE, so email will be sent from ${sequence.senderEmail}.`
            : `Enroll ${personIds.length} contact(s) into "${sequence?.name ?? args.sequenceId}". The sequence is ${
              sequence?.status ?? "not active"
            }, so nothing sends until it is activated.`,
        details: { Contacts: `${listed}${extra}` || "—" },
      };
    },
    execute: async (args) =>
      unwrapAction(
        enrollContacts(args.sequenceId as string, (args.personIds as string[]) ?? [])
      ),
  }),

  defineTool({
    name: "setEnrollmentStatus",
    label: "Set Enrollment Status",
    risk: "additive",
    description:
      "Pause, resume or stop one contact's enrollment. Resuming reschedules the next send from now, so a long pause does not fire immediately. Find the enrollment ID with querySequenceEnrollments.",
    parameters: {
      properties: {
        enrollmentId: { type: "string", description: "The enrollment ID" },
        status: {
          type: "string",
          enum: [...ENROLLMENT_STATUS_ENUM],
          description: "The new enrollment status",
        },
      },
      required: ["enrollmentId", "status"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("enrollment", String(args.enrollmentId));

      return {
        title: "Set enrollment status",
        summary: `${label ?? args.enrollmentId} becomes ${args.status}${
          args.status === "ACTIVE" ? ". Sending resumes from now." : "."
        }`,
        details: { Enrollment: label ?? args.enrollmentId, Status: args.status as string },
      };
    },
    execute: async (args) =>
      unwrapAction(
        setEnrollmentStatus(
          args.enrollmentId as string,
          args.status as "ACTIVE" | "PAUSED" | "STOPPED"
        )
      ),
  }),

  defineTool({
    name: "removeEnrollment",
    label: "Remove Enrollment",
    risk: "destructive",
    description:
      "Delete an enrollment and its message history. Use setEnrollmentStatus with STOPPED instead when you want to keep the record of what was sent.",
    parameters: {
      properties: {
        enrollmentId: { type: "string", description: "The enrollment ID" },
      },
      required: ["enrollmentId"],
    },
    preview: deletePreview("enrollment", "enrollmentId", "enrollment"),
    execute: async (args) => unwrapAction(removeEnrollment(args.enrollmentId as string)),
  }),

  defineTool({
    name: "addSuppressionEntry",
    label: "Add Suppression",
    risk: "additive",
    description:
      "Add an email address to the global suppression list so no sequence ever sends to it again. This applies across every sequence.",
    parameters: {
      properties: {
        email: { type: "string", description: "Email address to suppress" },
        note: { type: "string", description: "Why it is being suppressed" },
      },
      required: ["email"],
    },
    preview: async (args) => ({
      title: "Add suppression",
      summary: `${args.email} will be excluded from all outbound email, across every sequence.`,
      details: { Email: args.email as string, Note: (args.note as string) ?? "—" },
    }),
    execute: async (args) =>
      unwrapAction(addSuppressionEntry(args.email as string, args.note as string | undefined)),
  }),

  defineTool({
    name: "removeSuppressionEntry",
    label: "Remove Suppression",
    risk: "destructive",
    description:
      "Remove an email address from the global suppression list, making it eligible for outbound email again. Only do this when the contact has asked to be re-contacted.",
    parameters: {
      properties: {
        email: { type: "string", description: "Email address to unsuppress" },
      },
      required: ["email"],
    },
    preview: async (args) => ({
      title: "Remove suppression",
      summary: `${args.email} becomes eligible for outbound email again. Only do this with the contact's consent.`,
      details: { Email: args.email as string },
    }),
    execute: async (args) => unwrapAction(removeSuppressionEntry(args.email as string)),
  }),

  defineTool({
    name: "runSequencesNow",
    label: "Run Sequences Now",
    risk: "destructive",
    description:
      "Run the sequence sending job immediately instead of waiting for the cron. This sends real email through Gmail to every enrollment that is currently due.",
    parameters: { properties: {} },
    preview: async () => {
      const due = await prisma.sequenceEnrollment.count({
        where: {
          status: "ACTIVE",
          nextSendAt: { lte: new Date() },
          sequence: { status: "ACTIVE" },
        },
      });

      return {
        title: "Run sequences now",
        summary: `Sends real email immediately to the ${due} enrollment(s) currently due, subject to each sequence's send window and daily limit.`,
        details: { "Enrollments due": due },
      };
    },
    execute: async () => unwrapAction(runSequencesNow()),
  }),

  defineTool({
    name: "syncRepliesNow",
    label: "Sync Sequence Replies",
    risk: "additive",
    description:
      "Check the sending mailboxes for replies and bounces now and update enrollments accordingly. This reads Gmail but sends nothing.",
    parameters: { properties: {} },
    preview: async () => ({
      title: "Sync sequence replies",
      summary:
        "Reads the sending mailboxes for replies and bounces and stops the matching enrollments. No email is sent.",
      details: {},
    }),
    execute: async () => unwrapAction(syncRepliesNow()),
  }),
];
