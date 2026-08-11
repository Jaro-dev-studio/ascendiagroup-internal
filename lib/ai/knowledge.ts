import "server-only";

import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";
import { completeWithClaude } from "@/lib/integrations/claude";

export interface KnowledgeMatch {
  id: string;
  title: string;
  source: string;
  snippet: string;
}

const SYSTEM_PROMPT = `You are the delivery assistant for a dental and healthcare marketing agency.
You answer questions about a specific client using only the knowledge base excerpts provided.
Cite the document titles you used. If the excerpts do not contain the answer, say what is missing
and suggest which source (onboarding form, call transcript, WhatsApp thread) would cover it.`;

/**
 * Postgres full text search over the client knowledge base. Falls back to the
 * most recent documents so the assistant still has context for broad questions.
 */
export async function searchKnowledge(
  clientId: string,
  query: string,
  limit = 6
): Promise<KnowledgeMatch[]> {
  const trimmed = query.trim();

  if (trimmed.length > 2) {
    const matches = await prisma.$queryRaw<KnowledgeMatch[]>(Prisma.sql`
      SELECT
        id,
        title,
        source::text AS source,
        ts_headline(
          'english',
          content,
          plainto_tsquery('english', ${trimmed}),
          'MaxFragments=2,MaxWords=45,MinWords=25,StartSel=,StopSel='
        ) AS snippet
      FROM "KnowledgeDocument"
      WHERE "clientId" = ${clientId}
        AND to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${trimmed})
      ORDER BY ts_rank(
        to_tsvector('english', title || ' ' || content),
        plainto_tsquery('english', ${trimmed})
      ) DESC
      LIMIT ${limit}
    `);

    if (matches.length) return matches;
  }

  const recent = await prisma.knowledgeDocument.findMany({
    where: { clientId },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { id: true, title: true, source: true, content: true },
  });

  return recent.map((document) => ({
    id: document.id,
    title: document.title,
    source: document.source,
    snippet: document.content.slice(0, 1200),
  }));
}

export async function answerFromKnowledgeBase(options: {
  conversationId: string;
  clientId: string;
  question: string;
}) {
  const [client, history] = await Promise.all([
    prisma.client.findUnique({ where: { id: options.clientId } }),
    prisma.claudeMessage.findMany({
      where: { conversationId: options.conversationId },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
  ]);

  if (!client) throw new Error("Client not found");

  console.log(`[KnowledgeBase] searching ${client.name} documents...`);
  const matches = await searchKnowledge(options.clientId, options.question);

  if (!matches.length) {
    throw new Error(
      "This client has no knowledge base documents yet. Add onboarding answers, a transcript or a note first."
    );
  }

  const context = matches
    .map(
      (match) =>
        `<document title="${match.title}" source="${match.source}">\n${match.snippet}\n</document>`
    )
    .join("\n\n");

  console.log(
    `[KnowledgeBase] asking Claude with ${matches.length} document excerpts...`
  );

  const { text } = await completeWithClaude({
    system: SYSTEM_PROMPT,
    prompt: `Client: ${client.name}\n\nKnowledge base excerpts:\n${context}\n\nQuestion: ${options.question}`,
    maxTokens: 2000,
    history: history.map((message) => ({
      role: message.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: message.content,
    })),
  });

  return { answer: text, contextTitles: matches.map((match) => match.title) };
}
