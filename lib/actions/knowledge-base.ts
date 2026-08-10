"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { del } from "@vercel/blob";
import { chunkText, stripHtml } from "@/lib/knowledge-base/chunking";
import { generateEmbeddings } from "@/lib/knowledge-base/embeddings";
import { extractTextFromFile } from "@/lib/knowledge-base/pdf-parser";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user || user.role !== "ADMIN") {
    throw new Error("Admin access required");
  }
  return user;
}

export async function createManualDocument(title: string, htmlContent: string) {
  try {
    await requireAdmin();

    const plainText = stripHtml(htmlContent);
    if (!plainText.trim()) {
      return { data: null, error: "Document content cannot be empty" };
    }

    console.log(`[KnowledgeBase] Creating manual document: "${title}"`);
    const document = await prisma.knowledgeBaseDocument.create({
      data: {
        title,
        content: plainText,
        sourceType: "MANUAL",
        status: "PROCESSING",
      },
    });

    console.log(
      `[KnowledgeBase] Document created with id: ${document.id}, starting processing...`
    );
    processDocument(document.id).catch((err) =>
      console.error(
        `[KnowledgeBase] Background processing failed for ${document.id}:`,
        err
      )
    );

    revalidatePath("/dashboard/knowledge-base");
    return { data: document, error: null };
  } catch (error) {
    console.error("[KnowledgeBase] Error creating manual document:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to create document",
    };
  }
}

export async function createDocumentFromUpload(
  fileUrl: string,
  fileName: string,
  mimeType: string
) {
  try {
    await requireAdmin();

    console.log(`[KnowledgeBase] Creating document from upload: "${fileName}"`);

    const title = fileName.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

    console.log("[KnowledgeBase] Fetching file from Vercel Blob...");
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`[KnowledgeBase] Extracting text from ${mimeType} file...`);
    const text = await extractTextFromFile(buffer, mimeType);

    if (!text.trim()) {
      return { data: null, error: "Could not extract text from file" };
    }

    const document = await prisma.knowledgeBaseDocument.create({
      data: {
        title,
        content: text,
        sourceType: "UPLOAD",
        fileUrl,
        fileName,
        mimeType,
        status: "PROCESSING",
      },
    });

    console.log(
      `[KnowledgeBase] Document created with id: ${document.id}, starting processing...`
    );
    processDocument(document.id).catch((err) =>
      console.error(
        `[KnowledgeBase] Background processing failed for ${document.id}:`,
        err
      )
    );

    revalidatePath("/dashboard/knowledge-base");
    return { data: document, error: null };
  } catch (error) {
    console.error("[KnowledgeBase] Error creating document from upload:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to create document",
    };
  }
}

async function processDocument(documentId: string) {
  try {
    const document = await prisma.knowledgeBaseDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    console.log(
      `[KnowledgeBase] Chunking document "${document.title}" (${document.content.length} chars)...`
    );
    const chunks = chunkText(document.content);
    console.log(
      `[KnowledgeBase] Created ${chunks.length} chunks, generating embeddings...`
    );

    const BATCH_SIZE = 20;
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      console.log(
        `[KnowledgeBase] Processing embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}...`
      );

      const embeddings = await generateEmbeddings(batch);

      for (let j = 0; j < batch.length; j++) {
        const embeddingStr = `[${embeddings[j].join(",")}]`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO "KnowledgeBaseChunk" (id, content, embedding, "chunkIndex", "documentId", "createdAt")
           VALUES ($1, $2, $3::vector, $4, $5, NOW())`,
          `chunk_${documentId}_${i + j}`,
          batch[j],
          embeddingStr,
          i + j,
          documentId
        );
      }
    }

    await prisma.knowledgeBaseDocument.update({
      where: { id: documentId },
      data: { status: "READY" },
    });

    console.log(
      `[KnowledgeBase] Document "${document.title}" processed successfully with ${chunks.length} chunks`
    );
  } catch (error) {
    console.error(
      `[KnowledgeBase] Error processing document ${documentId}:`,
      error
    );
    await prisma.knowledgeBaseDocument.update({
      where: { id: documentId },
      data: { status: "FAILED" },
    });
  }
}

export async function deleteDocument(documentId: string) {
  try {
    await requireAdmin();

    const document = await prisma.knowledgeBaseDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return { data: null, error: "Document not found" };
    }

    console.log(`[KnowledgeBase] Deleting document: "${document.title}"`);

    if (document.fileUrl) {
      console.log("[KnowledgeBase] Deleting file from Vercel Blob...");
      await del(document.fileUrl);
    }

    await prisma.knowledgeBaseDocument.delete({
      where: { id: documentId },
    });

    revalidatePath("/dashboard/knowledge-base");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("[KnowledgeBase] Error deleting document:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to delete document",
    };
  }
}

export async function retryProcessDocument(documentId: string) {
  try {
    await requireAdmin();

    const document = await prisma.knowledgeBaseDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      return { data: null, error: "Document not found" };
    }

    console.log(
      `[KnowledgeBase] Retrying processing for document: "${document.title}"`
    );

    await prisma.$executeRawUnsafe(
      "DELETE FROM \"KnowledgeBaseChunk\" WHERE \"documentId\" = $1",
      documentId
    );

    await prisma.knowledgeBaseDocument.update({
      where: { id: documentId },
      data: { status: "PROCESSING" },
    });

    processDocument(documentId).catch((err) =>
      console.error(
        `[KnowledgeBase] Retry processing failed for ${documentId}:`,
        err
      )
    );

    revalidatePath("/dashboard/knowledge-base");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("[KnowledgeBase] Error retrying document processing:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to retry document processing",
    };
  }
}

export async function getDocuments() {
  try {
    await requireAdmin();

    const documents = await prisma.knowledgeBaseDocument.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    return { data: documents, error: null };
  } catch (error) {
    console.error("[KnowledgeBase] Error fetching documents:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to fetch documents",
    };
  }
}
