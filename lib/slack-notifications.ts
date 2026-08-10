import prisma from "@/lib/prisma";
import { SlackNotificationEventType, EmbedFormSubmission } from "@prisma/client";
import { SLACK_SALES_ACTIVITY_CHANNEL_ID } from "@/lib/constants";
import { sendSlackMessage } from "@/lib/slack-client";
import { SERVICE_LABELS } from "@/constants/services";
import {
  BUDGET_LABELS,
  HEADCOUNT_LABELS,
  PLATFORM_LABELS,
  PRODUCT_TYPE_LABELS,
  REVENUE_LABELS,
} from "@/constants/form-submissions";
import type { CompanyResearch } from "@/lib/research/company-research";

// Re-export types and constants for server-side use
export type {
  SlackNotificationConfigData,
  ClientNotificationSettings,
} from "@/lib/slack-notification-constants";

// Base domain for hyperlinks
const BASE_URL = "https://studio.jaro.dev";

// ============================================
// NOTIFICATION TRIGGERS
// ============================================

export async function sendNotification(
  clientCompanyId: string,
  eventType: SlackNotificationEventType,
  messageText: string,
  blocks?: any[]
): Promise<void> {
  try {
    // Get client and notification config
    const client = await prisma.company.findUnique({
      where: { id: clientCompanyId },
      include: {
        slackNotificationConfigs: {
          where: { eventType },
        },
      },
    });

    if (!client) {
      console.error("[Notification] Client not found:", clientCompanyId);
      return;
    }

    const config = client.slackNotificationConfigs[0];

    // If no config exists, notifications are disabled (default is disabled)
    if (!config) {
      return;
    }

    // Send to public channel if enabled and channel exists
    if (config.sendToPublic && client.slackPublicChannelId) {
      await sendSlackMessage({
        channel: client.slackPublicChannelId,
        text: messageText,
        blocks,
      });
    }

    // Send to internal channel if enabled and channel exists
    if (config.sendToInternal && client.slackInternalChannelId) {
      await sendSlackMessage({
        channel: client.slackInternalChannelId,
        text: messageText,
        blocks,
      });
    }
  } catch (error) {
    console.error("[Notification] Error sending notification:", error);
  }
}

// ============================================
// NOTIFICATION MESSAGE BUILDERS
// ============================================

export async function notifyActionItemCreated(
  clientCompanyId: string,
  actionItemId: string,
  actionItemName: string,
  priority: string
): Promise<void> {
  const emoji = getPriorityEmoji(priority);
  const clientLink = `${BASE_URL}/dashboard/client-action-items?highlight=${actionItemId}`;
  const adminLink = `${BASE_URL}/dashboard/action-items?highlight=${actionItemId}`;
  const text = `${emoji} *New Action Item*: ${actionItemName}\nPriority: ${priority}`;
  
  await sendNotification(clientCompanyId, "ACTION_ITEM_CREATED", text, [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *New Action Item Created*`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Name:*\n${actionItemName}`,
        },
        {
          type: "mrkdwn",
          text: `*Priority:*\n${priority}`,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View (Client)",
            emoji: true,
          },
          url: clientLink,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View (Jaro.dev)",
            emoji: true,
          },
          url: adminLink,
        },
      ],
    },
  ]);
}

export async function notifyTaskCompleted(
  clientCompanyId: string,
  taskId: string,
  taskName: string,
  assigneeEmail?: string
): Promise<void> {
  const clientLink = `${BASE_URL}/dashboard/client-tasks?highlight=${taskId}`;
  const adminLink = `${BASE_URL}/dashboard/tasks?highlight=${taskId}`;
  const text = `✅ *Task Completed*: ${taskName}${assigneeEmail ? `\nCompleted by: ${assigneeEmail}` : ""}`;
  
  await sendNotification(clientCompanyId, "TASK_COMPLETED", text, [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "✅ *Task Completed*",
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Task:*\n${taskName}`,
        },
        ...(assigneeEmail
          ? [
            {
              type: "mrkdwn",
              text: `*Completed by:*\n${assigneeEmail}`,
            },
          ]
          : []),
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View (Client)",
            emoji: true,
          },
          url: clientLink,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View (Jaro.dev)",
            emoji: true,
          },
          url: adminLink,
        },
      ],
    },
  ]);
}

export async function notifyActionItemCompleted(
  clientCompanyId: string,
  actionItemId: string,
  actionItemName: string
): Promise<void> {
  const clientLink = `${BASE_URL}/dashboard/client-action-items?highlight=${actionItemId}`;
  const adminLink = `${BASE_URL}/dashboard/action-items?highlight=${actionItemId}`;
  const text = `✅ *Action Item Completed*: ${actionItemName}`;
  
  await sendNotification(clientCompanyId, "ACTION_ITEM_COMPLETED", text, [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "✅ *Action Item Completed*",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Action Item:* ${actionItemName}`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View (Client)",
            emoji: true,
          },
          url: clientLink,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View (Jaro.dev)",
            emoji: true,
          },
          url: adminLink,
        },
      ],
    },
  ]);
}

export async function notifyTaskUnblocked(
  clientCompanyId: string,
  taskId: string,
  taskName: string
): Promise<void> {
  const clientLink = `${BASE_URL}/dashboard/client-tasks?highlight=${taskId}`;
  const adminLink = `${BASE_URL}/dashboard/tasks?highlight=${taskId}`;
  const text = `🔓 *Task Unblocked*: ${taskName}\nThis task is now ready to work on!`;
  
  await sendNotification(clientCompanyId, "TASK_UNBLOCKED", text, [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "🔓 *Task Unblocked*",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Task:* ${taskName}\nThis task is now ready to work on!`,
      },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View (Client)",
            emoji: true,
          },
          url: clientLink,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View (Jaro.dev)",
            emoji: true,
          },
          url: adminLink,
        },
      ],
    },
  ]);
}

export async function notifyFeatureRequested(
  clientCompanyId: string,
  requestId: string,
  requestTitle: string,
  priority: string
): Promise<void> {
  const emoji = getPriorityEmoji(priority);
  const clientLink = `${BASE_URL}/dashboard/feature-requests?highlight=${requestId}`;
  const adminLink = `${BASE_URL}/dashboard/submissions?highlight=${requestId}`;
  const text = `💡 *Feature Request*: ${requestTitle}\nPriority: ${priority}`;
  
  await sendNotification(clientCompanyId, "FEATURE_REQUESTED", text, [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "💡 *New Feature Request*",
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Title:*\n${requestTitle}`,
        },
        {
          type: "mrkdwn",
          text: `*Priority:*\n${emoji} ${priority}`,
        },
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View (Client)",
            emoji: true,
          },
          url: clientLink,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View (Jaro.dev)",
            emoji: true,
          },
          url: adminLink,
        },
      ],
    },
  ]);
}

export async function notifyBugRequested(
  clientCompanyId: string,
  requestId: string,
  requestTitle: string,
  severity?: string
): Promise<void> {
  const severityEmoji = getSeverityEmoji(severity);
  const clientLink = `${BASE_URL}/dashboard/bug-requests?highlight=${requestId}`;
  const adminLink = `${BASE_URL}/dashboard/submissions?highlight=${requestId}`;
  const text = `🐛 *Bug Report*: ${requestTitle}${severity ? `\nSeverity: ${severity}` : ""}`;
  
  await sendNotification(clientCompanyId, "BUG_REQUESTED", text, [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "🐛 *New Bug Report*",
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Title:*\n${requestTitle}`,
        },
        ...(severity
          ? [
            {
              type: "mrkdwn",
              text: `*Severity:*\n${severityEmoji} ${severity}`,
            },
          ]
          : []),
      ],
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View (Client)",
            emoji: true,
          },
          url: clientLink,
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "View (Jaro.dev)",
            emoji: true,
          },
          url: adminLink,
        },
      ],
    },
  ]);
}

// ============================================
// CHECK FOR UNBLOCKED TASKS
// ============================================

export async function checkAndNotifyUnblockedTasks(
  completedItemId: string,
  itemType: "task" | "actionItem"
): Promise<void> {
  try {
    // Find all tasks that were blocked by this item
    let blockedTasks;
    
    if (itemType === "task") {
      blockedTasks = await prisma.task.findMany({
        where: {
          blockedByTasks: {
            some: { id: completedItemId },
          },
        },
        include: {
          blockedByTasks: true,
          blockedByActionItems: true,
          clientCompany: true,
        },
      });
    } else {
      blockedTasks = await prisma.task.findMany({
        where: {
          blockedByActionItems: {
            some: { id: completedItemId },
          },
        },
        include: {
          blockedByTasks: true,
          blockedByActionItems: true,
          clientCompany: true,
        },
      });
    }

    // Check each blocked task to see if all blockers are now done
    for (const task of blockedTasks) {
      // Check if all blocking tasks are done
      const allBlockingTasksDone = task.blockedByTasks.every(
        (t) => t.status === "DONE"
      );

      // Check if all blocking action items are done
      const allBlockingActionItemsDone = task.blockedByActionItems.every(
        (ai) => ai.status === "DONE"
      );

      // If all blockers are done, move the task out of BLOCKED and notify
      if (allBlockingTasksDone && allBlockingActionItemsDone) {
        if (task.status === "BLOCKED") {
          console.log(
            `[Notification] Unblocking task "${task.name}" (${task.id}); moving from BLOCKED to TODO...`
          );
          await prisma.task.update({
            where: { id: task.id },
            data: { status: "TODO" },
          });
        }
        await notifyTaskUnblocked(task.clientCompanyId, task.id, task.name);
      }
    }
  } catch (error) {
    console.error("[Notification] Error checking unblocked tasks:", error);
  }
}

// ============================================
// HELPERS
// ============================================

function getPriorityEmoji(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "🔴";
    case "HIGH":
      return "🟠";
    case "MEDIUM":
      return "🟡";
    case "LOW":
      return "🟢";
    default:
      return "⚪";
  }
}

function getSeverityEmoji(severity?: string): string {
  switch (severity) {
    case "CRITICAL":
      return "🔴";
    case "HIGH":
      return "🟠";
    case "MEDIUM":
      return "🟡";
    case "LOW":
      return "🟢";
    default:
      return "⚪";
  }
}

// ============================================
// SALES ACTIVITY NOTIFICATIONS
// ============================================

const budgetLabels = BUDGET_LABELS;
const revenueLabels = REVENUE_LABELS;
const platformLabels = PLATFORM_LABELS;
const productTypeLabels = PRODUCT_TYPE_LABELS;
const headcountLabels = HEADCOUNT_LABELS;
const serviceLabels = SERVICE_LABELS;

/** Trimmed so a long brief cannot blow Slack's 3000-character block limit. */
function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;
}

/**
 * The research brief, rendered as its own blocks. Sales reads this before they
 * reply, so it leads with the description and the two strongest angles.
 */
function buildResearchBlocks(research: CompanyResearch): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*What they do* _(researched automatically, confidence: ${research.confidence})_\n${truncate(research.summary, 1200)}`,
      },
    },
  ];

  const topOpportunities = research.opportunities.slice(0, 2);

  if (topOpportunities.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*How we could help*\n${topOpportunities
          .map(
            (opportunity) =>
              `• *${opportunity.title}* (${serviceLabels[opportunity.service] ?? opportunity.service})\n   ${truncate(opportunity.proposal, 400)}`
          )
          .join("\n")}`,
      },
    });
  }

  return blocks;
}

export async function notifyFormSubmission(
  submission: EmbedFormSubmission,
  research?: CompanyResearch
): Promise<void> {
  try {
    // Determine if qualified (redirected to book a call)
    const isQualified = submission.redirectedTo !== null && 
      submission.redirectedTo !== "mobile_message" && 
      submission.redirectedTo !== "low_budget_message";

    const qualificationStatus = isQualified ? "QUALIFIED" : "NOT QUALIFIED";
    const qualificationReason = !isQualified
      ? submission.redirectedTo === "low_budget_message"
        ? " (Low Budget)"
        : submission.redirectedTo === "mobile_message"
          ? " (Mobile Only)"
          : ""
      : "";

    const formType = submission.type === "BUSINESSOS" ? "Business OS" : "Regular";

    // Build the fields based on form type
    const fields: { type: string; text: string }[] = [];

    // Common fields
    fields.push({
      type: "mrkdwn",
      text: `*Name:*\n${submission.name}`,
    });
    fields.push({
      type: "mrkdwn",
      text: `*Email:*\n${submission.email}${submission.emailValidation ? ` (${submission.emailValidation})` : ""}`,
    });

    if (submission.type === "BUSINESSOS") {
      // BusinessOS form fields
      if (submission.monthlyRevenue) {
        fields.push({
          type: "mrkdwn",
          text: `*Monthly Revenue:*\n${revenueLabels[submission.monthlyRevenue] || submission.monthlyRevenue}`,
        });
      }
      if (submission.companyHeadcount) {
        fields.push({
          type: "mrkdwn",
          text: `*Company Headcount:*\n${headcountLabels[submission.companyHeadcount] || submission.companyHeadcount}`,
        });
      }
      if (submission.manualProcesses) {
        fields.push({
          type: "mrkdwn",
          text: `*Manual Processes:*\n${submission.manualProcesses.slice(0, 150)}${submission.manualProcesses.length > 150 ? "..." : ""}`,
        });
      }
    } else {
      // Regular form fields
      if (submission.monthlyRevenue) {
        fields.push({
          type: "mrkdwn",
          text: `*Monthly Revenue:*\n${revenueLabels[submission.monthlyRevenue] || submission.monthlyRevenue}`,
        });
      }
      if (submission.budget) {
        fields.push({
          type: "mrkdwn",
          text: `*Budget:*\n${budgetLabels[submission.budget] || submission.budget}`,
        });
      }
      if (submission.platform) {
        fields.push({
          type: "mrkdwn",
          text: `*Platform:*\n${platformLabels[submission.platform] || submission.platform}`,
        });
      }
      if (submission.productType) {
        fields.push({
          type: "mrkdwn",
          text: `*Product Type:*\n${productTypeLabels[submission.productType] || submission.productType}`,
        });
      }
      if (submission.hasExistingCodebase !== null) {
        fields.push({
          type: "mrkdwn",
          text: `*Existing Codebase:*\n${submission.hasExistingCodebase ? "Yes" : "No"}`,
        });
      }
      if (submission.servicesNeeded && submission.servicesNeeded.length > 0) {
        const services = submission.servicesNeeded
          .map((s) => serviceLabels[s] || s)
          .join(", ");
        fields.push({
          type: "mrkdwn",
          text: `*Services:*\n${services}`,
        });
      }
    }

    // UTM Source if available
    if (submission.utmSource) {
      fields.push({
        type: "mrkdwn",
        text: `*UTM Source:*\n${submission.utmSource}`,
      });
    }

    const text = `New ${formType} Form Submission - ${qualificationStatus}${qualificationReason}: ${submission.name} (${submission.email})`;

    await sendSlackMessage({
      channel: SLACK_SALES_ACTIVITY_CHANNEL_ID,
      text,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*New ${formType} Form Submission*\n*${qualificationStatus}*${qualificationReason}`,
          },
        },
        {
          type: "divider",
        },
        {
          type: "section",
          fields: fields.slice(0, 10), // Slack limits to 10 fields per section
        },
        ...(research ? buildResearchBlocks(research) : []),
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "View in Studio",
                emoji: true,
              },
              url: `${BASE_URL}/dashboard/submissions`,
            },
            ...(submission.personId
              ? [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "View contact",
                    emoji: true,
                  },
                  url: `${BASE_URL}/dashboard/crm/people/${submission.personId}`,
                },
              ]
              : []),
            ...(submission.companyId
              ? [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "View company",
                    emoji: true,
                  },
                  url: `${BASE_URL}/dashboard/crm/companies/${submission.companyId}`,
                },
              ]
              : []),
          ],
        },
      ],
    });

    console.log(`[Slack] Sales activity notification sent for submission ${submission.id}`);
  } catch (error) {
    console.error("[Slack] Error sending sales activity notification:", error);
  }
}
