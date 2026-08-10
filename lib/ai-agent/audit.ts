import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { ToolRisk } from "@/lib/ai-tools/types";

interface LogAgentActionInput {
  userId: string;
  chatId: string;
  toolName: string;
  args: unknown;
  risk: ToolRisk;
  status: "EXECUTED" | "REJECTED" | "FAILED";
  result?: unknown;
  error?: string | null;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  } catch {
    return {} as Prisma.InputJsonValue;
  }
}

export async function logAgentAction(input: LogAgentActionInput): Promise<void> {
  try {
    console.log(
      `[AIAgent] audit ${input.status} ${input.toolName} (${input.risk}) by ${input.userId}`
    );

    await prisma.aIActionLog.create({
      data: {
        userId: input.userId,
        chatId: input.chatId,
        toolName: input.toolName,
        args: toJson(input.args),
        risk: input.risk,
        status: input.status,
        result: input.result === undefined ? undefined : toJson(input.result),
        error: input.error ?? null,
      },
    });
  } catch (error) {
    console.error("[AIAgent] failed to write audit log:", error);
  }
}
