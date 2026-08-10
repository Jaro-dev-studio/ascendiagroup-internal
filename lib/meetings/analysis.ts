import OpenAI from "openai";

const MODEL = "gpt-5-mini";

export interface MeetingStep {
  title: string;
  description: string;
}

export interface MeetingSummaryResult {
  summary: string;
  nextStepsJaroDev: MeetingStep[];
  nextStepsClient: MeetingStep[];
}

export interface ObjectionItem {
  objection: string;
  response: string;
  resolved: boolean;
  resolutionContext: string;
  category: "price" | "timing" | "authority" | "need" | "other";
}

export interface ObjectionAnalysisResult {
  callType: "SALES_CALL" | "CLIENT_MEETING";
  objections: ObjectionItem[];
}

const SUMMARY_SYSTEM_PROMPT = `You are a meeting analyst for Jaro.dev, a software development agency that builds MVPs for startups and companies. 
Your task is to analyze meeting transcripts and extract:
1. A concise summary of the meeting (2-3 paragraphs)
2. Next steps for Jaro.dev (the development team) - DEVELOPMENT TASKS ONLY
3. Next steps for the Client

JARO.DEV TEAM MEMBERS:
- Anyone with a @jaro.dev email address is a Jaro.dev team member.
- zenoshubh@gmail.com (Shubh) is a Jaro.dev team member (employee), NOT a client.
- Any task, action, or next step assigned to a Jaro.dev team member belongs in the Jaro.dev next steps (development tasks), NOT in the client next steps.

CRITICAL RULES FOR JARO.DEV NEXT STEPS (DEVELOPMENT TASKS):
- ONLY include DEVELOPMENT-RELATED tasks (coding, building features, fixing bugs, implementing functionality, technical work)
- DO NOT include business tasks like "schedule a meeting", "send an email", "follow up", "discuss pricing", "prepare proposal", etc.
- ONLY include tasks that were EXPLICITLY mentioned or agreed upon during the call
- DO NOT invent, assume, or infer tasks that weren't actually discussed
- Each task must be something that requires actual development/engineering work
- If no development tasks were mentioned, return an empty array

CRITICAL RULES FOR CLIENT NEXT STEPS:
- ONLY generate next steps for items which are actually relevant to the client
- Jaro.dev internal matters are not relevant next steps for the client
- ONLY include next steps that were EXPLICITLY mentioned or agreed upon during the call
- If no clear next steps were mentioned for the client, return an empty array

FOR JARO.DEV DEVELOPMENT TASKS, provide detailed descriptions that include:
- A clear, actionable title (max 100 characters) based on what was actually said
- A comprehensive description with ALL technical details discussed, including:
  * The specific feature/functionality to be built or bug to be fixed
  * Any technical requirements, constraints, or preferences mentioned
  * User flows or behavior expectations discussed
  * UI/UX details if mentioned (screens, buttons, layouts, interactions)
  * Data requirements (what data to display, store, or process)
  * Integration points with other systems or APIs if discussed
  * Edge cases or error handling requirements mentioned
  * Any examples or references provided during the call
  * Acceptance criteria or success conditions discussed
  * Dependencies or blockers mentioned
- Include exact quotes or close paraphrases from the conversation for clarity

FOR CLIENT NEXT STEPS, provide:
- A clear, actionable title (max 100 characters)
- A brief description with the specific context from the conversation

Format your response as JSON with this exact structure:
{
  "summary": "string",
  "nextStepsJaroDev": [{"title": "string", "description": "string"}],
  "nextStepsClient": [{"title": "string", "description": "string"}]
}

Remember: Only extract REAL development tasks that were ACTUALLY mentioned in the transcript. It's better to have fewer accurate, detailed tasks than to include invented or vague ones.`;

const OBJECTION_SYSTEM_PROMPT = `You are a sales call analyst for Jaro.dev, a software development agency that builds MVPs for startups and companies.

Your task is to:
1. Detect whether this is a SALES_CALL (discussing purchasing services, pricing, proposals) or a CLIENT_MEETING (discussing ongoing project work with an existing client)
2. If it's a SALES_CALL, extract all objections raised by the prospect

CALL TYPE DETECTION:
- SALES_CALL indicators:
  * Discussion of pricing, costs, budget, investment
  * Questions about services, what Jaro.dev offers
  * Proposal or quote discussions
  * Discovery questions about their business problems
  * Objections about buying or moving forward
  * Discussions about "getting started", contracts, deposits
  * First-time meeting with a new prospect
  
- CLIENT_MEETING indicators:
  * Discussion of specific project tasks, bugs, features
  * Technical implementation details
  * Project status updates
  * References to work already in progress
  * Discussions about existing deliverables

OBJECTION EXTRACTION (for SALES_CALL only):
Identify any objections the prospect raises about moving forward with purchasing. Common objection categories:
- "price": Concerns about cost, budget, or value for money
- "timing": Not the right time, too busy, need to wait
- "authority": Need to check with partner, team, board, etc.
- "need": Questioning if they actually need the solution
- "other": Any other hesitation or pushback

For each objection, capture:
1. objection: The exact concern raised by the prospect (quote or close paraphrase)
2. response: How the salesperson (Jaro.dev) responded to the objection
3. resolved: true if the prospect accepted the response and moved on (indicated by agreement, asking about next steps, or moving to new topics without resistance). false if they continued pushing back, didn't accept the response, or the call ended without resolution.
4. resolutionContext: Brief description of what happened after the response (e.g., "Prospect agreed and asked about timeline", "Prospect still seemed hesitant and asked to think about it")
5. category: One of "price", "timing", "authority", "need", or "other"

Format your response as JSON with this exact structure:
{
  "callType": "SALES_CALL" | "CLIENT_MEETING",
  "objections": [
    {
      "objection": "string",
      "response": "string", 
      "resolved": boolean,
      "resolutionContext": "string",
      "category": "price" | "timing" | "authority" | "need" | "other"
    }
  ]
}

If it's a CLIENT_MEETING, return an empty objections array.
If it's a SALES_CALL with no objections, return an empty objections array.`;

const EMPTY_SUMMARY: MeetingSummaryResult = {
  summary: "",
  nextStepsJaroDev: [],
  nextStepsClient: [],
};

export async function generateMeetingSummary(
  transcript: string,
  clientCompanyName: string | null,
  logPrefix = "[Meeting Processor]"
): Promise<MeetingSummaryResult> {
  console.log(`${logPrefix} generating meeting summary...`);
  console.log(
    `${logPrefix} client="${clientCompanyName || "Unknown"}", transcript=${transcript.length} chars`
  );

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.warn(`${logPrefix} OPENAI_API_KEY not configured, skipping summary`);
    return EMPTY_SUMMARY;
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  const userPrompt = `Analyze this meeting transcript${clientCompanyName ? ` with client "${clientCompanyName}"` : ""}:

${transcript}

Extract the summary and next steps as specified.`;

  try {
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: SUMMARY_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    console.log(`${logPrefix} summary returned in ${Date.now() - startTime}ms`);
    console.log(
      `${logPrefix} tokens - prompt: ${response.usage?.prompt_tokens}, completion: ${response.usage?.completion_tokens}`
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const result = JSON.parse(content) as MeetingSummaryResult;

    console.log(
      `${logPrefix} summary parsed: jaroDevSteps=${result.nextStepsJaroDev?.length ?? 0}, clientSteps=${result.nextStepsClient?.length ?? 0}`
    );

    return {
      summary: result.summary || "",
      nextStepsJaroDev: Array.isArray(result.nextStepsJaroDev)
        ? result.nextStepsJaroDev
        : [],
      nextStepsClient: Array.isArray(result.nextStepsClient)
        ? result.nextStepsClient
        : [],
    };
  } catch (error) {
    console.error(`${logPrefix} summary generation failed:`, error);
    return EMPTY_SUMMARY;
  }
}

export async function generateObjectionAnalysis(
  transcript: string,
  clientCompanyName: string | null,
  isExistingClient: boolean,
  logPrefix = "[Meeting Processor]"
): Promise<ObjectionAnalysisResult> {
  console.log(`${logPrefix} analysing objections...`);

  const fallback: ObjectionAnalysisResult = {
    callType: isExistingClient ? "CLIENT_MEETING" : "SALES_CALL",
    objections: [],
  };

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.warn(
      `${logPrefix} OPENAI_API_KEY not configured, skipping objection analysis`
    );
    return fallback;
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  const userPrompt = `Analyze this call transcript${clientCompanyName ? ` with "${clientCompanyName}"` : ""}:

${transcript}

Detect the call type and extract any objections raised.`;

  try {
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: OBJECTION_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    console.log(
      `${logPrefix} objection analysis returned in ${Date.now() - startTime}ms`
    );

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const result = JSON.parse(content) as ObjectionAnalysisResult;

    console.log(
      `${logPrefix} callType=${result.callType}, objections=${result.objections?.length ?? 0}`
    );

    return {
      callType: result.callType || fallback.callType,
      objections: Array.isArray(result.objections) ? result.objections : [],
    };
  } catch (error) {
    console.error(`${logPrefix} objection analysis failed:`, error);
    return fallback;
  }
}
