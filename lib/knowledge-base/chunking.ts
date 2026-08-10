const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    const combined = currentChunk ? `${currentChunk}\n\n${trimmed}` : trimmed;

    if (estimateTokens(combined) > CHUNK_SIZE && currentChunk) {
      chunks.push(currentChunk.trim());

      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-CHUNK_OVERLAP);
      currentChunk = `${overlapWords.join(" ")}\n\n${trimmed}`;
    } else {
      currentChunk = combined;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  if (chunks.length === 0 && text.trim()) {
    const words = text.trim().split(/\s+/);
    for (let i = 0; i < words.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const slice = words.slice(i, i + CHUNK_SIZE).join(" ");
      if (slice.trim()) {
        chunks.push(slice.trim());
      }
    }
  }

  return chunks;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
