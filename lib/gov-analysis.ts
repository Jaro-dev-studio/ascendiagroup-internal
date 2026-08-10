import OpenAI from "openai";
import prisma from "@/lib/prisma";
import type { GovOpportunity } from "@prisma/client";

const openai = new OpenAI();

const SCORING_WEIGHTS = {
  strategicFit: 40,
  revenuePotential: 20,
  winProbability: 20,
  competitiveAdvantage: 10,
  relationshipAccess: 10,
} as const;

interface AIScoreEntry {
  score: number;
  reasoning: string;
}

interface AIAnalysisResponse {
  summary: string;
  scores: {
    strategicFit: AIScoreEntry;
    revenuePotential: AIScoreEntry;
    winProbability: AIScoreEntry;
    competitiveAdvantage: AIScoreEntry;
    relationshipAccess: AIScoreEntry;
  };
  keyRisks: string[];
  keyAdvantages: string[];
  finalVerdict: string;
}

const ANALYSIS_SYSTEM_PROMPT = `You are an AI analyst evaluating government contract opportunities for Jaro.dev, a software development agency. Your PRIMARY job is to determine how closely the contract aligns with building websites, web applications, and software platforms.

# Company Context

Jaro.dev builds websites, web applications, and SaaS platforms. That is ALL we do.

Core capabilities:
- Full-Stack Web Application Development (React, Next.js, TypeScript, Tailwind CSS)
- Backend: Node.js, Next.js Server Actions, REST APIs
- Database: PostgreSQL, Prisma ORM
- AI/ML: OpenAI GPT integration, custom AI workflows
- Infrastructure: Vercel, AWS, Docker, serverless architecture, CI/CD pipelines
- MVP Development (2-4 week delivery)
- SaaS platforms, dashboards, internal tools, data platforms, web portals
- API development and third-party integrations
- Web scraping and automation

We do NOT do: hardware, embedded systems, networking/telecom infrastructure, cybersecurity operations, IT helpdesk/support, data center management, legacy system maintenance (mainframes, COBOL), WordPress, marketing, content creation, non-technical consulting.

Relevant NAICS codes: 541511, 541512, 541519, 518210, 541513.

# Scoring Framework

Score the opportunity across 5 criteria. Each criterion receives a score from 0-5.
The MOST IMPORTANT criterion is Strategic Fit -- how closely the work involves building websites, web apps, or software platforms.

## 1. Strategic Fit (Weight: 40) -- THIS IS THE PRIMARY DRIVER
How closely does this contract involve building websites, web applications, SaaS platforms, dashboards, portals, or custom software?
0 = Not software at all (hardware, facilities, telecom infrastructure, physical equipment)
1 = IT-adjacent but not web/software development (IT support, helpdesk, cybersecurity operations, network admin, data center ops)
2 = Software-related but not our stack (legacy systems, mainframe, COBOL, SAP, Oracle EBS, desktop apps)
3 = General software development that partially overlaps (mobile apps, embedded software, system integration)
4 = Strong web/software fit (web development, API development, cloud platforms, data systems, SaaS)
5 = Perfect match (building a web application, portal, dashboard, SaaS platform, or modern web system from scratch)

Score 0-2 for anything that is primarily about: IT operations, helpdesk, cybersecurity monitoring, network infrastructure, hardware, telecom, training, consulting, staff augmentation without clear software deliverables.
Score 4-5 ONLY if the contract clearly involves building or modernizing a web application, portal, platform, or software system.

## 2. Revenue Potential (Weight: 20)
Evaluate the potential contract value.
0 = <$10k, 1 = $10k-$50k, 2 = $50k-$150k, 3 = $150k-$500k, 4 = $500k-$2M, 5 = $2M+.
If no value is provided, estimate based on the description, agency, and scope.

## 3. Probability of Winning (Weight: 20)
Likelihood that Jaro.dev would win this contract.
0 = Impossible, 1 = <5%, 2 = 5-15%, 3 = 15-30%, 4 = 30-50%, 5 = >50%.
Consider: set-aside type, specialization required, contract size relative to our typical work, clearance requirements.

## 4. Competitive Advantage (Weight: 10)
Whether Jaro.dev has meaningful differentiation for this specific work.
0 = No advantage, 1 = Weak, 2 = Slight, 3 = Moderate, 4 = Strong, 5 = Unique advantage.

## 5. Relationship Access (Weight: 10)
Access to the buyer or contracting authority.
0 = No access, 1 = Cold bid, 2 = Limited contact, 3 = Some engagement, 4 = Strong relationship, 5 = Direct relationship.
Default to 1 (cold bid) unless information suggests otherwise.

# Instructions

Analyze the opportunity JSON provided in the user message. Return your analysis as JSON matching exactly this schema:

{
  "summary": "Brief 1-2 sentence description of the contract opportunity",
  "scores": {
    "strategicFit": { "score": <0-5>, "reasoning": "<1-2 sentences>" },
    "revenuePotential": { "score": <0-5>, "reasoning": "<1-2 sentences>" },
    "winProbability": { "score": <0-5>, "reasoning": "<1-2 sentences>" },
    "competitiveAdvantage": { "score": <0-5>, "reasoning": "<1-2 sentences>" },
    "relationshipAccess": { "score": <0-5>, "reasoning": "<1-2 sentences>" }
  },
  "keyRisks": ["risk1", "risk2", ...],
  "keyAdvantages": ["advantage1", "advantage2", ...],
  "finalVerdict": "Short paragraph with overall assessment"
}

Be harsh on Strategic Fit. If the contract is about IT support, cybersecurity operations, telecom, hardware, or anything that does not involve BUILDING software, score it 0-2. Only score 4-5 if it clearly involves developing a web application, platform, or software system.`;

function buildOpportunityContext(opp: GovOpportunity): string {
  const context: Record<string, unknown> = {
    title: opp.title,
    agency: opp.agency,
    subAgency: opp.subAgency || undefined,
    office: opp.office || undefined,
    type: opp.type || undefined,
    naicsCode: opp.naicsCode || undefined,
    pscCode: opp.pscCode || undefined,
    classificationCode: opp.classificationCode || undefined,
    setAsideType: opp.setAsideType || undefined,
    estimatedValue: opp.estimatedValue || undefined,
    postedDate: opp.postedDate?.toISOString().split("T")[0] || undefined,
    responseDeadline: opp.responseDeadline?.toISOString().split("T")[0] || undefined,
    placeOfPerformance: opp.placeOfPerformance || undefined,
    description: opp.description || undefined,
    contactName: opp.contactName || undefined,
    contactTitle: opp.contactTitle || undefined,
    awardeeName: opp.awardeeName || undefined,
    awardDate: opp.awardDate?.toISOString().split("T")[0] || undefined,
    awardNumber: opp.awardNumber || undefined,
  };

  const cleaned = Object.fromEntries(
    Object.entries(context).filter(([, v]) => v !== undefined)
  );

  return JSON.stringify(cleaned, null, 2);
}

function calculateWeightedScore(scores: AIAnalysisResponse["scores"]): number {
  let total = 0;
  for (const [key, weight] of Object.entries(SCORING_WEIGHTS)) {
    const entry = scores[key as keyof typeof scores];
    total += entry.score * weight;
  }
  return Math.round(total / 5);
}

function getRecommendation(score: number): string {
  if (score >= 85) return "Pursue aggressively";
  if (score >= 70) return "Strong opportunity";
  if (score >= 55) return "Pursue if capacity allows";
  if (score >= 40) return "Opportunistic bid";
  return "Do not pursue";
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(5, Math.round(score)));
}

export async function analyzeOpportunity(
  opp: GovOpportunity
): Promise<{ data: { overallScore: number; recommendation: string } | null; error: string | null }> {
  try {
    console.log(`[AI Analysis] Analyzing opportunity: ${opp.title} (${opp.noticeId})`);

    const opportunityJson = buildOpportunityContext(opp);

    console.log("[AI Analysis] Calling OpenAI gpt-5-mini...");

    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        { role: "user", content: opportunityJson },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.error("[AI Analysis] No content in OpenAI response");
      return { data: null, error: "No content in AI response" };
    }

    console.log("[AI Analysis] Parsing AI response...");

    const parsed: AIAnalysisResponse = JSON.parse(content);

    const strategicFitScore = clampScore(parsed.scores.strategicFit.score);
    const revenuePotentialScore = clampScore(parsed.scores.revenuePotential.score);
    const winProbabilityScore = clampScore(parsed.scores.winProbability.score);
    const competitiveAdvantageScore = clampScore(parsed.scores.competitiveAdvantage.score);
    const relationshipAccessScore = clampScore(parsed.scores.relationshipAccess.score);

    const clampedScores = {
      strategicFit: { score: strategicFitScore, reasoning: parsed.scores.strategicFit.reasoning },
      revenuePotential: { score: revenuePotentialScore, reasoning: parsed.scores.revenuePotential.reasoning },
      winProbability: { score: winProbabilityScore, reasoning: parsed.scores.winProbability.reasoning },
      competitiveAdvantage: { score: competitiveAdvantageScore, reasoning: parsed.scores.competitiveAdvantage.reasoning },
      relationshipAccess: { score: relationshipAccessScore, reasoning: parsed.scores.relationshipAccess.reasoning },
    };

    const overallScore = calculateWeightedScore(clampedScores);
    const recommendation = getRecommendation(overallScore);

    console.log(`[AI Analysis] Score: ${overallScore}/100 - ${recommendation}`);

    console.log("[AI Analysis] Upserting analysis to database...");

    await prisma.govOpportunityAnalysis.upsert({
      where: { opportunityId: opp.id },
      create: {
        opportunityId: opp.id,
        overallScore,
        recommendation,
        strategicFitScore,
        strategicFitReasoning: parsed.scores.strategicFit.reasoning,
        revenuePotentialScore,
        revenuePotentialReasoning: parsed.scores.revenuePotential.reasoning,
        winProbabilityScore,
        winProbabilityReasoning: parsed.scores.winProbability.reasoning,
        competitiveAdvantageScore,
        competitiveAdvantageReasoning: parsed.scores.competitiveAdvantage.reasoning,
        relationshipAccessScore,
        relationshipAccessReasoning: parsed.scores.relationshipAccess.reasoning,
        summary: parsed.summary,
        keyRisks: JSON.stringify(parsed.keyRisks),
        keyAdvantages: JSON.stringify(parsed.keyAdvantages),
        finalVerdict: parsed.finalVerdict,
        analyzedAt: new Date(),
      },
      update: {
        overallScore,
        recommendation,
        strategicFitScore,
        strategicFitReasoning: parsed.scores.strategicFit.reasoning,
        revenuePotentialScore,
        revenuePotentialReasoning: parsed.scores.revenuePotential.reasoning,
        winProbabilityScore,
        winProbabilityReasoning: parsed.scores.winProbability.reasoning,
        competitiveAdvantageScore,
        competitiveAdvantageReasoning: parsed.scores.competitiveAdvantage.reasoning,
        relationshipAccessScore,
        relationshipAccessReasoning: parsed.scores.relationshipAccess.reasoning,
        summary: parsed.summary,
        keyRisks: JSON.stringify(parsed.keyRisks),
        keyAdvantages: JSON.stringify(parsed.keyAdvantages),
        finalVerdict: parsed.finalVerdict,
        analyzedAt: new Date(),
      },
    });

    console.log("[AI Analysis] Analysis saved successfully");

    return { data: { overallScore, recommendation }, error: null };
  } catch (error) {
    console.error(`[AI Analysis] Error analyzing opportunity ${opp.noticeId}:`, error);
    return {
      data: null,
      error: `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

interface BatchOptions {
  batchSize?: number;
  concurrency?: number;
  staleAfterDays?: number;
  activeOnly?: boolean;
}

export async function analyzeOpportunityBatch(
  options: BatchOptions = {}
): Promise<{ analyzed: number; errors: number }> {
  const { batchSize = 20, concurrency = 5, staleAfterDays = 7, activeOnly = true } = options;

  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - staleAfterDays);

  console.log(`[AI Analysis] Fetching opportunities to analyze (batch size: ${batchSize}, concurrency: ${concurrency}, stale after: ${staleAfterDays} days)...`);

  const opportunities = await prisma.govOpportunity.findMany({
    where: {
      ...(activeOnly ? { isActive: true } : {}),
      isDismissed: false,
      OR: [
        { analysis: null },
        { analysis: { analyzedAt: { lt: staleDate } } },
      ],
    },
    orderBy: [
      { responseDeadline: "asc" },
      { postedDate: "desc" },
    ],
    take: batchSize,
  });

  console.log(`[AI Analysis] Found ${opportunities.length} opportunities to analyze`);

  let analyzed = 0;
  let errors = 0;

  for (let i = 0; i < opportunities.length; i += concurrency) {
    const chunk = opportunities.slice(i, i + concurrency);
    console.log(`[AI Analysis] Processing chunk ${Math.floor(i / concurrency) + 1} (${chunk.length} opportunities)...`);

    const results = await Promise.allSettled(
      chunk.map((opp) => analyzeOpportunity(opp))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.data) {
        analyzed++;
      } else {
        errors++;
      }
    }
  }

  console.log(`[AI Analysis] Batch complete: ${analyzed} analyzed, ${errors} errors`);

  return { analyzed, errors };
}
