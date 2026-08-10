import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

export const maxDuration = 60;

const openai = new OpenAI();

const RequestSchema = z.object({
  blockType: z.enum(["page", "externalApi", "customLogic"]),
  name: z.string(),
  description: z.string().optional(),
  existingCriteria: z.array(z.string()).optional(),
});

const SYSTEM_PROMPT = `You are an expert at defining clear, testable success criteria for software features.

Generate 3-5 success criteria for the given component. Each criterion should be:
- Short and clear (one sentence)
- User-focused (what can the user do/see)
- Testable (can be verified as pass/fail)
- Action-oriented (use verbs like "can", "displays", "allows", "sends", "validates")

Examples of good success criteria:
- "User can create, edit and delete donors from the CRM"
- "Dashboard displays real-time metrics updated every 30 seconds"
- "System validates email format before submission"
- "API returns payment confirmation within 3 seconds"
- "User receives confirmation email after registration"

DO NOT include numbering or bullet points. Return only the criteria text, one per line.
Avoid repeating any existing criteria provided.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { blockType, name, description, existingCriteria } = RequestSchema.parse(body);

    const blockTypeLabel = 
      blockType === "page" ? "page/screen" :
        blockType === "externalApi" ? "external API integration" :
          "custom functionality";

    const existingContext = existingCriteria && existingCriteria.length > 0
      ? `\n\nExisting criteria (do not repeat these):\n${existingCriteria.map(c => `- ${c}`).join("\n")}`
      : "";

    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Generate success criteria for this ${blockTypeLabel}:

Name: ${name}
${description ? `Description: ${description}` : ""}${existingContext}`,
        },
      ],
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content || "";
    
    // Split response into individual criteria
    const criteria = response
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("-") && !line.match(/^\d+\./))
      .map((line) => line.replace(/^[-*]\s*/, "").trim());

    return NextResponse.json({ criteria });
  } catch (error) {
    console.error("Generate Success Criteria API error:", error);
    return NextResponse.json(
      { error: "Failed to generate success criteria" },
      { status: 500 }
    );
  }
}
