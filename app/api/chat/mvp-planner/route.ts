import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

export const maxDuration = 60;

const openai = new OpenAI();

const MODEL = "gpt-5.6-sol";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const RequestSchema = z.object({
  messages: z.array(MessageSchema),
  currentNodes: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["page", "externalApi", "customLogic"]),
        name: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
});

const tools: OpenAI.Responses.Tool[] = [
  {
    type: "function",
    strict: false,
    name: "update_diagram",
    description:
      "Add blocks to the MVP architecture diagram. Call this whenever the user describes features, pages, integrations, or functionality. Each block becomes a node in the visual diagram.",
    parameters: {
      type: "object",
      properties: {
        blocks: {
          type: "array",
          description: "Blocks to add to the diagram",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["page", "externalApi", "customLogic"],
                description:
                  "Block type: 'page' for UI screens, 'externalApi' for third-party APIs, 'customLogic' for custom backend logic",
              },
              name: {
                type: "string",
                description: "Short name for the block (e.g. 'Dashboard', 'Stripe API')",
              },
              description: {
                type: "string",
                description: "One-line description of what this block does",
              },
            },
            required: ["type", "name", "description"],
          },
        },
        edges: {
          type: "array",
          description:
            "Connections between blocks. Use the block name as identifier. Only add edges when there is a clear data flow or navigation relationship.",
          items: {
            type: "object",
            properties: {
              sourceName: {
                type: "string",
                description: "Name of the source block",
              },
              targetName: {
                type: "string",
                description: "Name of the target block",
              },
            },
            required: ["sourceName", "targetName"],
          },
        },
      },
      required: ["blocks"],
    },
  },
];

const SYSTEM_PROMPT = `You are a friendly, expert MVP architect at Jaro.dev, a software development agency that builds MVPs for startups and companies. The user just booked a discovery call and you're helping them plan their MVP architecture to get an instant rough quote.

## Your Goal
Guide the user through defining their MVP by asking smart questions one at a time. After each answer, update the diagram with relevant blocks using the update_diagram tool. Build up the architecture progressively.

## Conversation Flow
Follow this sequence, asking ONE question at a time. After each answer, call update_diagram if the answer reveals any pages, integrations, or logic needed:

1. **Core Idea** - "Thanks for booking a call with us! To get started on your MVP plan, can you tell me in a few sentences what your product does and what problem it solves?"

2. **Target Users** - "Who are the main users of this product? Are there different user types (e.g. admin vs regular user, buyer vs seller)?"

3. **Key Pages/Screens** - "What are the main pages or screens a user would interact with? For example: dashboard, profile, settings, listing page, etc."

4. **Core Workflow** - "Walk me through the main thing a user does in your app - the core workflow from start to finish."

5. **Third-party Integrations** - "Will you need any third-party integrations? Common ones include: payments (Stripe), email (SendGrid), file storage (AWS S3), maps, analytics, AI/ML, social auth, etc."

6. **Custom Logic** - "Are there any unique features or business logic that go beyond standard CRUD? For example: matching algorithms, recommendation engines, automated notifications, complex calculations, real-time features, etc."

7. **Wrap-up** - Summarize what you've captured, show the total quote estimate, and let them know the discovery call will refine this further.

## Rules
- Ask ONE question at a time, never multiple
- After each user response, ALWAYS call update_diagram if there are any new components to add
- Include the default pages (Dashboard, Organization Settings, User Settings) in your first update_diagram call
- Use 'page' type for any UI screen the user sees
- Use 'externalApi' for any third-party service integration
- Use 'customLogic' for backend logic, algorithms, workers, or non-CRUD functionality
- Keep block names short and clear (2-4 words max)
- Keep descriptions to one sentence
- Add edges between blocks that have clear relationships (e.g. a checkout page connects to Stripe API)
- Be conversational and encouraging, not robotic
- If the user gives vague answers, ask a follow-up to clarify before moving on
- Don't overwhelm the user - keep responses concise (2-3 sentences max before asking the next question)
- At the end, mention that the quote is a rough estimate and the discovery call will refine it

## Pricing Context (for your awareness, don't share exact pricing)
- Base build: $3,500
- Dashboard + Settings (included): $2,500
- Additional pages: $1,000 each
- External API integrations: $750 each
- Custom logic/unique features: $1,250 each
- Auth providers: $600 each
- The running total is calculated automatically from the diagram`;

export async function POST(request: Request) {
  try {
    console.log("[MvpPlanner] Received chat request");

    const body = await request.json();
    const { messages, currentNodes } = RequestSchema.parse(body);

    console.log(
      `[MvpPlanner] Processing ${messages.length} messages, ${currentNodes?.length || 0} existing nodes`
    );

    const existingContext =
      currentNodes && currentNodes.length > 0
        ? `\n\nCurrent blocks in the diagram:\n${currentNodes.map((n) => `- ${n.type}: ${n.name}${n.description ? ` (${n.description})` : ""}`).join("\n")}`
        : "";

    const input: OpenAI.Responses.ResponseInput = messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    console.log("[MvpPlanner] Calling OpenAI...");

    const response = await openai.responses.create({
      model: MODEL,
      instructions: SYSTEM_PROMPT + existingContext,
      input,
      tools,
      tool_choice: "auto",
    });

    const toolCall = response.output.find((item) => item.type === "function_call");

    if (toolCall && toolCall.name === "update_diagram") {
      console.log("[MvpPlanner] AI wants to update diagram");

      const args = JSON.parse(toolCall.arguments);

      const followUp = await openai.responses.create({
        model: MODEL,
        instructions: SYSTEM_PROMPT + existingContext,
        input: [
          ...input,
          // Replaying a function_call requires its paired reasoning item, so pass the whole output
          ...response.output,
          {
            type: "function_call_output",
            call_id: toolCall.call_id,
            output: `Successfully added ${args.blocks?.length || 0} blocks to the diagram. The user can see them in real-time on the right side of their screen along with the updated quote total.`,
          },
        ],
        tools,
        tool_choice: "none",
      });

      console.log(
        `[MvpPlanner] Returning ${args.blocks?.length || 0} blocks and follow-up message`
      );

      return NextResponse.json({
        message:
          followUp.output_text ||
          "I've updated your MVP diagram. What else would you like to add?",
        blocks: args.blocks || [],
        edges: args.edges || [],
      });
    }

    console.log("[MvpPlanner] Returning text-only response");

    return NextResponse.json({
      message:
        response.output_text ||
        "I can help you plan your MVP. Tell me about what you're building!",
      blocks: [],
      edges: [],
    });
  } catch (error) {
    console.error("[MvpPlanner] API error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
