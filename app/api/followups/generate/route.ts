import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import OpenAI from "openai";

export const maxDuration = 300;

async function getAdminUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAdminUser();
    if (!user) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { meetingId, templateId } = await req.json();

    if (!meetingId || !templateId) {
      return NextResponse.json(
        { data: null, error: "Missing meetingId or templateId" },
        { status: 400 }
      );
    }

    console.log("[Followup] Generating followup for meeting:", meetingId, "with template:", templateId);

    console.log("[Followup] Fetching meeting and template from database...");
    const [meeting, template] = await Promise.all([
      prisma.meeting.findUnique({
        where: { id: meetingId },
        include: { clientCompany: { select: { name: true } } },
      }),
      prisma.followupTemplate.findUnique({
        where: { id: templateId },
      }),
    ]);

    if (!meeting) {
      return NextResponse.json(
        { data: null, error: "Meeting not found" },
        { status: 404 }
      );
    }
    if (!template) {
      return NextResponse.json(
        { data: null, error: "Template not found" },
        { status: 404 }
      );
    }
    if (!meeting.formattedTranscript) {
      return NextResponse.json(
        { data: null, error: "Meeting has no transcript" },
        { status: 400 }
      );
    }

    console.log("[Followup] Meeting found:", meeting.title);
    console.log("[Followup] Template found:", template.name);
    console.log("[Followup] Transcript length:", meeting.formattedTranscript.length, "chars");

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { data: null, error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    const systemPrompt = `You are an assistant for Jaro.dev, a software development agency that builds MVPs for startups and companies.

Your task is to generate content based on a meeting transcript and the following instructions:

${template.prompt}

Generate the content directly without any preamble, meta-commentary, or explanation. Just output the final content ready to use.`;

    const userPrompt = `Meeting: "${meeting.title}"
${meeting.clientCompany ? `Client: ${meeting.clientCompany.name}` : ""}
Participants: ${meeting.participants.join(", ")}
Date: ${meeting.startTime.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}

Transcript:
${meeting.formattedTranscript}`;

    console.log("[Followup] Sending request to OpenAI (model: gpt-5-mini)...");
    const startTime = Date.now();

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Followup] OpenAI response received in ${elapsed}ms`);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { data: null, error: "Empty response from AI" },
        { status: 500 }
      );
    }

    console.log("[Followup] Generated content length:", content.length, "chars");
    console.log("[Followup] Saving followup to database...");

    const followup = await prisma.meetingFollowup.create({
      data: {
        content,
        status: "DRAFT",
        meetingId: meeting.id,
        templateId: template.id,
      },
    });

    console.log("[Followup] Followup saved:", followup.id);

    return NextResponse.json({
      data: { id: followup.id, content: followup.content },
      error: null,
    });
  } catch (error) {
    console.error("[Followup] Error generating followup:", error);
    return NextResponse.json(
      { data: null, error: "Failed to generate followup" },
      { status: 500 }
    );
  }
}
