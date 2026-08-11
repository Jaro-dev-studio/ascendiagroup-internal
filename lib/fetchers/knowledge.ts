import "server-only";

import prisma from "@/lib/prisma";

export async function getKnowledgeBase(clientId: string) {
  try {
    console.log(`[KnowledgeBase] loading documents for ${clientId}...`);

    const [client, documents, conversation] = await Promise.all([
      prisma.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          name: true,
          claudeProjectId: true,
          claudeProjectUrl: true,
          claudeSyncedAt: true,
        },
      }),
      prisma.knowledgeDocument.findMany({
        where: { clientId },
        orderBy: { updatedAt: "desc" },
        include: { createdBy: { select: { name: true, email: true } } },
      }),
      prisma.claudeConversation.findFirst({
        where: { clientId },
        orderBy: { updatedAt: "desc" },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      }),
    ]);

    if (!client) return { data: null, error: "Client not found." };

    return { data: { client, documents, conversation }, error: null };
  } catch (error) {
    console.error("[KnowledgeBase] failed to load", error);
    return { data: null, error: "Could not load the knowledge base." };
  }
}

export async function getKnowledgeCounts() {
  try {
    const grouped = await prisma.knowledgeDocument.groupBy({
      by: ["clientId"],
      _count: { _all: true },
    });

    return {
      data: Object.fromEntries(
        grouped.map((row) => [row.clientId, row._count._all])
      ),
      error: null,
    };
  } catch (error) {
    console.error("[KnowledgeBase] failed to count documents", error);
    return { data: null, error: "Could not load document counts." };
  }
}
