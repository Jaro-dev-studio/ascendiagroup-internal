import { notFound } from "next/navigation";
import { getMVPSharedQuoteByToken } from "@/lib/actions";
import { MVPQuoteClient } from "./client";

interface MVPQuotePageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function MVPQuotePage({ params }: MVPQuotePageProps) {
  const { token } = await params;

  const { data: quote, error } = await getMVPSharedQuoteByToken(token);

  if (error || !quote) {
    notFound();
  }

  return <MVPQuoteClient quote={quote} />;
}
