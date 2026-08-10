export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse");
  const data = await pdfParse(buffer);
  return data.text;
}

export async function extractTextFromFile(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  switch (mimeType) {
    case "application/pdf":
      return extractTextFromPdf(buffer);

    case "text/plain":
    case "text/markdown":
      return buffer.toString("utf-8");

    default:
      throw new Error(`Unsupported file type: ${mimeType}`);
  }
}
