"use server";

import { revalidatePath } from "next/cache";
import type { DocumentSource } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";
import { answerFromKnowledgeBase } from "@/lib/ai/knowledge";

export async function saveKnowledgeDocument(input: {
  id?: string;
  clientId: string;
  title: string;
  content: string;
  source: string;
  tags: string[];
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const user = await requireStaff();
    console.log(`[KnowledgeBase] saving document "${input.title}"...`);

    if (input.title.trim().length < 2) {
      return { data: null, error: "Give the document a title." };
    }
    if (input.content.trim().length < 10) {
      return { data: null, error: "Add some content to the document." };
    }

    const data = {
      title: input.title.trim(),
      content: input.content.trim(),
      source: input.source as DocumentSource,
      tags: input.tags.filter(Boolean),
    };

    let documentId = input.id;

    if (documentId) {
      await prisma.knowledgeDocument.update({ where: { id: documentId }, data });
    } else {
      const created = await prisma.knowledgeDocument.create({
        data: { ...data, clientId: input.clientId, createdById: user.id },
      });
      documentId = created.id;

      await prisma.activityLog.create({
        data: {
          clientId: input.clientId,
          actorId: user.id,
          type: "DOCUMENT_ADDED",
          title: `Knowledge base updated: ${data.title}`,
          link: `/dashboard/knowledge-base?clientId=${input.clientId}`,
        },
      });
    }

    revalidatePath("/dashboard/knowledge-base");
    revalidatePath(`/dashboard/clients/${input.clientId}`);
    return { data: { id: documentId }, error: null };
  } catch (error) {
    console.error("[KnowledgeBase] failed to save document", error);
    return { data: null, error: "Could not save the document." };
  }
}

export async function deleteKnowledgeDocument(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    const document = await prisma.knowledgeDocument.delete({ where: { id } });

    revalidatePath("/dashboard/knowledge-base");
    revalidatePath(`/dashboard/clients/${document.clientId}`);
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[KnowledgeBase] failed to delete document", error);
    return { data: null, error: "Could not delete the document." };
  }
}

/**
 * Links the client to a Claude project so the team can open the same context
 * inside Claude, and records when the knowledge base was last handed over.
 */
export async function linkClaudeProject(input: {
  clientId: string;
  projectId: string;
  projectUrl: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log(`[KnowledgeBase] linking Claude project for ${input.clientId}...`);

    if (input.projectUrl && !/^https?:\/\//.test(input.projectUrl)) {
      return { data: null, error: "Enter the full Claude project URL." };
    }

    await prisma.client.update({
      where: { id: input.clientId },
      data: {
        claudeProjectId: input.projectId.trim() || null,
        claudeProjectUrl: input.projectUrl.trim() || null,
        claudeSyncedAt: input.projectId.trim() ? new Date() : null,
      },
    });

    revalidatePath("/dashboard/knowledge-base");
    revalidatePath(`/dashboard/clients/${input.clientId}`);
    return { data: { id: input.clientId }, error: null };
  } catch (error) {
    console.error("[KnowledgeBase] failed to link Claude project", error);
    return { data: null, error: "Could not link the Claude project." };
  }
}

/** Builds the single document a team member pastes into a Claude project. */
export async function buildClaudeProjectContext(
  clientId: string
): Promise<{ data: { content: string; documents: number } | null; error: string | null }> {
  try {
    await requireStaff();
    console.log("[KnowledgeBase] building Claude project context...");

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        services: true,
        documents: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!client) return { data: null, error: "Client not found." };
    if (client.documents.length === 0) {
      return {
        data: null,
        error: "This knowledge base is empty. Add documents before exporting.",
      };
    }

    const header = [
      `# ${client.name} — client knowledge base`,
      client.practiceType ? `Practice type: ${client.practiceType}` : "",
      client.website ? `Website: ${client.website}` : "",
      client.packageTier ? `Package: ${client.packageTier}` : "",
      client.services.length
        ? `Services: ${client.services.map((service) => service.service).join(", ")}`
        : "",
      `Exported: ${new Date().toISOString().slice(0, 10)}`,
    ]
      .filter(Boolean)
      .join("\n");

    const body = client.documents
      .map(
        (document) =>
          `\n\n## ${document.title}\nSource: ${document.source}\n\n${document.content}`
      )
      .join("\n");

    return {
      data: { content: `${header}${body}`, documents: client.documents.length },
      error: null,
    };
  } catch (error) {
    console.error("[KnowledgeBase] failed to build context", error);
    return { data: null, error: "Could not build the Claude context." };
  }
}

export async function askKnowledgeBase(input: {
  clientId: string;
  conversationId?: string;
  question: string;
}): Promise<{
  data: { conversationId: string; answer: string; contextTitles: string[] } | null;
  error: string | null;
}> {
  try {
    const user = await requireStaff();

    if (input.question.trim().length < 3) {
      return { data: null, error: "Ask a longer question." };
    }

    let conversationId = input.conversationId;

    if (!conversationId) {
      const conversation = await prisma.claudeConversation.create({
        data: {
          clientId: input.clientId,
          createdById: user.id,
          title: input.question.slice(0, 60),
        },
      });
      conversationId = conversation.id;
    }

    await prisma.claudeMessage.create({
      data: { conversationId, role: "USER", content: input.question.trim() },
    });

    const { answer, contextTitles } = await answerFromKnowledgeBase({
      conversationId,
      clientId: input.clientId,
      question: input.question.trim(),
    });

    await prisma.claudeMessage.create({
      data: { conversationId, role: "ASSISTANT", content: answer, contextTitles },
    });

    revalidatePath("/dashboard/knowledge-base");
    return { data: { conversationId, answer, contextTitles }, error: null };
  } catch (error) {
    console.error("[KnowledgeBase] question failed", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Could not answer that question.",
    };
  }
}
