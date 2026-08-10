import OpenAI from "openai";

const openai = new OpenAI();

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = text.replace(/\n+/g, " ").trim();
  if (!trimmed) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: trimmed,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const cleaned = texts.map((t) => t.replace(/\n+/g, " ").trim());

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: cleaned,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}
