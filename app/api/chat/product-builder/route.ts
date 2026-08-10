import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

export const maxDuration = 60;

const openai = new OpenAI();

const MODEL = "gpt-5.6-sol";

const RequestSchema = z.object({
  message: z.string(),
  existingNodes: z.array(z.object({
    id: z.string(),
    type: z.enum(["page", "externalApi", "customLogic"]),
    name: z.string(),
    description: z.string().optional(),
    successCriteria: z.array(z.object({
      id: z.string(),
      text: z.string(),
    })).optional(),
  })).optional(),
});

// Define the functions for adding blocks and generating success criteria
const tools: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    strict: false,
    name: "add_blocks",
    description: "Add one or more blocks to the product builder diagram. Use this when the user wants to add pages, API integrations, or custom functionality to their MVP.",
    parameters: {
      type: "object",
      properties: {
        blocks: {
          type: "array",
          description: "Array of blocks to add to the diagram",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["page", "externalApi", "customLogic"],
                description: "Type of block: 'page' for UI pages/screens, 'externalApi' for third-party API integrations (Stripe, OpenAI, Twilio, etc.), 'customLogic' for custom business logic/functionality (email notifications, calculations, workflows, etc.)",
              },
              name: {
                type: "string",
                description: "Name of the block (e.g., 'Dashboard', 'Stripe API', 'Email Notifications')",
              },
              description: {
                type: "string",
                description: "Brief description of what this block does",
              },
              apiUrl: {
                type: "string",
                description: "For externalApi type only: the API URL if known",
              },
            },
            required: ["type", "name", "description"],
          },
        },
      },
      required: ["blocks"],
    },
  },
  {
    type: "function",
    strict: false,
    name: "generate_success_criteria",
    description: "Generate success criteria for one or more existing blocks. Use this when the user asks to define success criteria, acceptance criteria, or what 'done' looks like for a block.",
    parameters: {
      type: "object",
      properties: {
        criteria: {
          type: "array",
          description: "Array of success criteria to add to blocks",
          items: {
            type: "object",
            properties: {
              nodeId: {
                type: "string",
                description: "The ID of the existing block to add criteria to",
              },
              nodeName: {
                type: "string",
                description: "The name of the block (for confirmation message)",
              },
              successCriteria: {
                type: "array",
                description: "Array of success criteria texts",
                items: {
                  type: "string",
                },
              },
            },
            required: ["nodeId", "nodeName", "successCriteria"],
          },
        },
      },
      required: ["criteria"],
    },
  },
];

const SYSTEM_PROMPT = `You are an AI assistant helping to build MVP product architectures. Your job is to help users add components and define success criteria for their product.

## Adding Blocks
When users describe features they want, determine the appropriate block type(s):

1. **page** - Use for UI pages/screens users will see:
   - Dashboard, Settings, Profile, Login, Signup, Landing Page
   - Admin Panel, User Management, Reports, Analytics

2. **externalApi** - Use for third-party service integrations:
   - Stripe (payments), OpenAI (AI), Twilio (SMS), SendGrid (email)
   - Google Maps, AWS S3, Firebase, Supabase

3. **customLogic** - Use for custom backend functionality:
   - Email notification systems, Webhook handlers
   - Data processing, Calculations, Scheduled jobs

## Generating Success Criteria
When users ask about success criteria, acceptance criteria, or "what done looks like", use the generate_success_criteria function.

Success criteria should be:
- Specific and testable
- User-focused (what the user can do/see)
- Verifiable (can be checked as pass/fail)

Examples of good success criteria:
- "User can view a list of all their orders"
- "Payment is processed within 3 seconds"
- "Email is sent immediately after signup"
- "Dashboard loads in under 2 seconds"
- "User can filter results by date range"

When the user says things like:
- "Generate success criteria for the Dashboard" -> Use generate_success_criteria
- "What should be the acceptance criteria for..." -> Use generate_success_criteria
- "Define what done looks like for..." -> Use generate_success_criteria
- "Add criteria for all pages" -> Use generate_success_criteria for each page

Be helpful and proactive. Generate 3-5 meaningful success criteria per block.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, existingNodes } = RequestSchema.parse(body);

    const existingContext = existingNodes && existingNodes.length > 0
      ? `\n\nExisting blocks in the diagram (use the exact id when referencing a block):\n${existingNodes.map(n => `- id: ${n.id} | ${n.type}: ${n.name}${n.description ? ` (${n.description})` : ""}`).join("\n")}`
      : "";

    console.log("[ProductBuilder] requesting block suggestions...");
    const response = await openai.responses.create({
      model: MODEL,
      instructions: SYSTEM_PROMPT + existingContext,
      input: [{ role: "user", content: message }],
      tools,
      tool_choice: "auto",
    });

    const toolCall = response.output.find((item) => item.type === "function_call");

    if (toolCall) {
      console.log(`[ProductBuilder] model called ${toolCall.name}, generating confirmation...`);
      const args = JSON.parse(toolCall.arguments);

      if (toolCall.name === "add_blocks") {
        // Get a follow-up response for natural language
        const followUp = await openai.responses.create({
          model: MODEL,
          instructions: "You just suggested blocks to add to a product builder. Briefly confirm what was suggested in a friendly, concise way. Mention they need to approve the changes.",
          input: [{ role: "user", content: `I suggested these blocks: ${JSON.stringify(args.blocks)}` }],
        });

        return NextResponse.json({
          message: followUp.output_text,
          action: "add_blocks",
          blocks: args.blocks,
        });
      }

      if (toolCall.name === "generate_success_criteria") {
        // Get a follow-up response for natural language
        const followUp = await openai.responses.create({
          model: MODEL,
          instructions: "You just suggested success criteria for blocks in a product builder. Briefly confirm what was suggested in a friendly, concise way. Mention they need to approve the changes.",
          input: [{ role: "user", content: `I suggested these criteria: ${JSON.stringify(args.criteria)}` }],
        });

        return NextResponse.json({
          message: followUp.output_text,
          action: "generate_success_criteria",
          criteria: args.criteria,
        });
      }
    }

    console.log("[ProductBuilder] no tool call, returning plain reply");
    return NextResponse.json({
      message: response.output_text || "I can help you add pages, API integrations, or custom functionality to your MVP. I can also generate success criteria for existing blocks. Just describe what you need!",
      action: null,
      blocks: null,
    });

  } catch (error) {
    console.error("Product Builder Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
