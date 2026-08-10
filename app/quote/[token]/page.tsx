import { getSharedQuoteByToken } from "@/lib/actions";
import { QuoteClient } from "./client";
import { notFound } from "next/navigation";

interface LineItem {
  code: string;
  module: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  benefit?: string;
}

interface PainPointSection {
  section: string;
  items: string[];
}

interface QuotePageProps {
  params: Promise<{ token: string }>;
}

export default async function QuotePage({ params }: QuotePageProps) {
  const { token } = await params;
  const { data: quote, error } = await getSharedQuoteByToken(token);

  if (error || !quote) {
    notFound();
  }

  // Transform Prisma JsonValue types to expected types
  const transformedQuote = {
    ...quote,
    lineItems: (quote.lineItems || []) as unknown as LineItem[],
    painPoints: (quote.painPoints || null) as unknown as PainPointSection[] | null,
  };

  return <QuoteClient quote={transformedQuote} />;
}
