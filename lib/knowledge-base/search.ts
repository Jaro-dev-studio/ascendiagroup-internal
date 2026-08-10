import prisma from "@/lib/prisma";
import { generateEmbedding } from "./embeddings";

interface SearchResult {
  chunkId: string;
  content: string;
  documentId: string;
  documentTitle: string;
  similarity: number;
}

export async function searchKnowledgeBase(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  console.log(
    `[KnowledgeBase] Generating embedding for search query: "${query.substring(0, 80)}..."`
  );
  const queryEmbedding = await generateEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  console.log(`[KnowledgeBase] Searching for top ${topK} matching chunks...`);
  const results = await prisma.$queryRawUnsafe<
    {
      chunk_id: string;
      content: string;
      document_id: string;
      document_title: string;
      similarity: number;
    }[]
  >(
    `
    SELECT
      c.id as chunk_id,
      c.content,
      c."documentId" as document_id,
      d.title as document_title,
      1 - (c.embedding <=> $1::vector) as similarity
    FROM "KnowledgeBaseChunk" c
    JOIN "KnowledgeBaseDocument" d ON d.id = c."documentId"
    WHERE d.status = 'READY'
    ORDER BY c.embedding <=> $1::vector
    LIMIT $2
    `,
    embeddingStr,
    topK
  );

  console.log(`[KnowledgeBase] Found ${results.length} matching chunks`);
  return results.map((r) => ({
    chunkId: r.chunk_id,
    content: r.content,
    documentId: r.document_id,
    documentTitle: r.document_title,
    similarity: Number(r.similarity),
  }));
}
