"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { CompanyResearchStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCompanyResearchStatus, startCompanyResearch } from "@/lib/actions/crm";
import { serviceLabel } from "@/constants/services";
import { cn, formatCrmDateTime } from "@/lib/utils";
import { RESEARCH_EVIDENCE_LABELS } from "@/constants/research";
import type { ResearchOpportunity, ResearchSource } from "@/types/research";

interface CompanyResearchProps {
  companyId: string;
  summary: string | null;
  opportunities: ResearchOpportunity[];
  discoveryQuestions: string[];
  sources: ResearchSource[];
  confidence: string | null;
  status: CompanyResearchStatus;
  error: string | null;
  researchedAt: Date | null;
}

const CONFIDENCE_CLASSES: Record<string, string> = {
  high: "bg-primary-100 text-primary-700",
  medium: "bg-secondary-100 text-secondary-700",
  low: "bg-secondary-100 text-text-secondary",
};

const POLL_INTERVAL_MS = 5_000;
/** A run whose server died would leave the record pending, so stop watching. */
const POLL_TIMEOUT_MS = 5 * 60 * 1_000;

export function CompanyResearch({
  companyId,
  summary,
  opportunities,
  discoveryQuestions,
  sources,
  confidence,
  status,
  error,
  researchedAt,
}: CompanyResearchProps) {
  const router = useRouter();
  const [isQueueing, startTransition] = useTransition();
  const [isRunning, setIsRunning] = useState(status === "PENDING");

  const handleResearch = () => {
    startTransition(async () => {
      const result = await startCompanyResearch(companyId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setIsRunning(true);
      toast.success("Research started. It takes about a minute, you can keep working.");
    });
  };

  useEffect(() => {
    if (status === "PENDING") setIsRunning(true);
  }, [status]);

  // The run finishes on the server after the action responded, so the brief on
  // screen is only refreshed once the record says the run is done.
  useEffect(() => {
    if (!isRunning) return;

    const startedAt = Date.now();

    const interval = setInterval(async () => {
      const { data } = await getCompanyResearchStatus(companyId);

      if (!data) {
        setIsRunning(false);
        return;
      }

      if (data.status === "PENDING") {
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) setIsRunning(false);
        return;
      }

      setIsRunning(false);

      if (data.status === "FAILED") {
        toast.error(data.error ?? "The research came back empty");
      } else {
        toast.success("Research updated");
      }

      router.refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isRunning, companyId, router]);

  const isBusy = isQueueing || isRunning;

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-row items-center gap-2">
              <Sparkles className="size-4 text-text-tertiary" aria-hidden />
              <h2 className="text-text-dark text-sm font-semibold">What they do</h2>
              {confidence && (
                <Badge
                  className={cn(
                    "text-xs font-medium",
                    CONFIDENCE_CLASSES[confidence] ?? CONFIDENCE_CLASSES.low
                  )}
                >
                  {confidence} confidence
                </Badge>
              )}
            </div>

            <Button variant="outline" onClick={handleResearch} disabled={isBusy}>
              <RefreshCw className={cn("mr-2 size-4", isBusy && "animate-spin")} aria-hidden />
              {isBusy ? "Researching…" : summary ? "Re-run research" : "Research this company"}
            </Button>
          </div>

          {summary ? (
            <p className="whitespace-pre-wrap text-sm text-text-secondary">{summary}</p>
          ) : (
            <p className="text-sm text-text-secondary">
              {isBusy
                ? "Research is running. This takes about a minute, and it keeps going if you navigate away."
                : status === "FAILED"
                  ? `The last research attempt failed${error ? `: ${error}` : "."}`
                  : "No research yet. It runs automatically when a qualified lead comes in, or you can run it now."}
            </p>
          )}

          {researchedAt && (
            <p className="text-xs text-text-tertiary">
              Researched {formatCrmDateTime(researchedAt)}
            </p>
          )}
        </div>
      </Card>

      {opportunities.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-row items-center gap-2">
            <Lightbulb className="size-4 text-text-tertiary" aria-hidden />
            <h2 className="text-text-dark text-sm font-semibold">
              How we could help them ({opportunities.length})
            </h2>
          </div>

          {opportunities.map((opportunity, index) => (
            <Card key={`${opportunity.title}-${index}`} className="p-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <h3 className="text-text-dark text-sm font-semibold">{opportunity.title}</h3>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {serviceLabel(opportunity.service)}
                  </Badge>
                </div>

                <dl className="flex flex-col gap-2">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs uppercase tracking-wide text-text-tertiary">
                      {RESEARCH_EVIDENCE_LABELS[opportunity.evidence] ?? "What we found"}
                    </dt>
                    <dd className="text-sm text-text-secondary">{opportunity.observation}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs uppercase tracking-wide text-text-tertiary">
                      What we would build
                    </dt>
                    <dd className="text-sm text-text-secondary">{opportunity.proposal}</dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-xs uppercase tracking-wide text-text-tertiary">
                      Why it matters to them
                    </dt>
                    <dd className="text-sm text-text-secondary">{opportunity.impact}</dd>
                  </div>
                </dl>
              </div>
            </Card>
          ))}
        </div>
      )}

      {discoveryQuestions.length > 0 && (
        <Card className="p-4">
          <h2 className="text-text-dark mb-2 text-sm font-semibold">Ask them on the call</h2>
          <ul className="flex flex-col gap-2">
            {discoveryQuestions.map((question, index) => (
              <li key={`${question}-${index}`} className="flex flex-row gap-2 text-sm text-text-secondary">
                <span className="text-text-tertiary" aria-hidden>
                  {index + 1}.
                </span>
                {question}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {sources.length > 0 && (
        <Card className="p-4">
          <h2 className="text-text-dark mb-2 text-sm font-semibold">Sources</h2>
          <ul className="flex flex-col gap-1.5">
            {sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-row items-center gap-1.5 text-sm text-primary-600 hover:underline"
                >
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{source.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
