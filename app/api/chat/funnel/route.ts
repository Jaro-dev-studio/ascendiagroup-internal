import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";

export const maxDuration = 60;

const openai = new OpenAI();

const RequestSchema = z.object({
  message: z.string(),
  flowData: z.array(z.object({
    id: z.string(),
    name: z.string(),
    value: z.number(),
    percentage: z.number()
  }))
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, flowData } = RequestSchema.parse(body);

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that analyzes funnel data.
          The funnel data represents conversion stages in a business process.
          Each stage has a name, value (absolute number), and percentage (conversion rate from previous stage).
          Provide insights, suggestions, and answer questions about the funnel data.
          Be specific and use numbers from the data when relevant.
          Consider:
          - Conversion rates between stages
          - Drop-off points
          - Industry benchmarks
          - Potential optimization opportunities
          - ROI calculations when relevant
          Format responses in a clear, structured way using markdown.`,
        },
        {
          role: "user",
          content: `Current funnel data: ${JSON.stringify(flowData)}\n\nUser request: ${message}`,
        },
      ],
    });

    return NextResponse.json({
      message: completion.choices[0].message.content,
    });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
} 