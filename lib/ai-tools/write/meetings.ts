import { regenerateMeetingAnalysis } from "@/lib/actions";
import { defineTool, type AITool } from "../types";
import { lookupEntityLabel } from "../preview";
import { unwrapAction } from "./helpers";

export const meetingWriteTools: AITool[] = [
  defineTool({
    name: "regenerateMeetingAnalysis",
    label: "Regenerate Call Analysis",
    risk: "destructive",
    description:
      "Re-run AI analysis on a call transcript. This deletes and recreates the tasks and action items previously generated from that call.",
    parameters: {
      properties: { meetingId: { type: "string", description: "The meeting/call ID" } },
      required: ["meetingId"],
    },
    preview: async (args) => {
      const label = await lookupEntityLabel("meeting", String(args.meetingId));
      return {
        title: "Regenerate call analysis",
        summary: `Tasks and action items previously generated from ${label ? `"${label}"` : String(args.meetingId)} will be deleted and recreated.`,
      };
    },
    execute: async (args) =>
      unwrapAction(regenerateMeetingAnalysis(args.meetingId as string)),
  }),
];
