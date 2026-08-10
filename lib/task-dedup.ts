import { generateEmbeddings } from "@/lib/knowledge-base/embeddings";

export interface NextStep {
  title: string;
  description: string;
}

interface ExistingItem {
  name: string;
  description: string | null;
}

interface FilterOptions {
  threshold?: number;
  logPrefix?: string;
}

// Cosine similarity above this value is treated as a duplicate. text-embedding-3-small
// tends to produce high similarities for paraphrases of short task titles, so we keep
// this relatively strict to avoid dropping genuinely distinct next steps.
const DEFAULT_SIMILARITY_THRESHOLD = 0.85;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function buildText(title: string, description?: string | null): string {
  return [title, description].filter(Boolean).join(". ").trim();
}

/**
 * Filters out candidate next steps that are semantically near-duplicates of
 * existing tasks/action items (or of earlier candidates in the same batch),
 * using cosine similarity over OpenAI embeddings.
 *
 * Fails open: if embedding generation throws, all candidates are returned so
 * deduplication never blocks task creation.
 */
export async function filterDuplicateSteps(
  candidateSteps: NextStep[],
  existingItems: ExistingItem[],
  options?: FilterOptions
): Promise<NextStep[]> {
  const threshold = options?.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const logPrefix = options?.logPrefix ?? "[Dedup]";

  if (candidateSteps.length === 0) {
    return [];
  }

  try {
    console.log(
      `${logPrefix} Checking ${candidateSteps.length} candidate(s) against ${existingItems.length} existing item(s) for duplicates...`
    );

    const candidateTexts = candidateSteps.map((step) =>
      buildText(step.title, step.description)
    );
    const existingTexts = existingItems.map((item) =>
      buildText(item.name, item.description)
    );

    const embeddings = await generateEmbeddings([
      ...candidateTexts,
      ...existingTexts,
    ]);

    const candidateEmbeddings = embeddings.slice(0, candidateTexts.length);
    const existingEmbeddings = embeddings.slice(candidateTexts.length);

    const accepted: NextStep[] = [];
    const acceptedEmbeddings: number[][] = [];

    for (let i = 0; i < candidateSteps.length; i++) {
      const step = candidateSteps[i];
      const embedding = candidateEmbeddings[i];

      // Compare against existing items and against candidates we have already
      // accepted in this batch (guards against the model returning near-identical steps).
      const comparisonEmbeddings = [...existingEmbeddings, ...acceptedEmbeddings];

      let maxSimilarity = 0;
      for (const other of comparisonEmbeddings) {
        const similarity = cosineSimilarity(embedding, other);
        if (similarity > maxSimilarity) maxSimilarity = similarity;
      }

      if (maxSimilarity >= threshold) {
        console.log(
          `${logPrefix} Skipping duplicate "${step.title}" (similarity ${maxSimilarity.toFixed(
            3
          )} >= ${threshold})`
        );
        continue;
      }

      accepted.push(step);
      acceptedEmbeddings.push(embedding);
    }

    console.log(
      `${logPrefix} Kept ${accepted.length}/${candidateSteps.length} candidate(s) after deduplication`
    );

    return accepted;
  } catch (error) {
    console.error(
      `${logPrefix} Deduplication failed, keeping all candidates:`,
      error
    );
    return candidateSteps;
  }
}
