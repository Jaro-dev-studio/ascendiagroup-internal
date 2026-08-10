"use client";

import { Ban, CircleAlert, CircleCheck, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingAction } from "./types";

interface ConfirmationCardProps {
  action: PendingAction;
  isBusy: boolean;
  onDecide: (actionId: string, approved: boolean) => void;
}

const RISK_COPY: Record<PendingAction["risk"], string> = {
  additive: "Creates or changes data",
  destructive: "Destructive or irreversible",
};

export function ConfirmationCard({ action, isBusy, onDecide }: ConfirmationCardProps) {
  const isDestructive = action.risk === "destructive";
  const isResolved = action.status !== "PENDING";

  return (
    <div
      className={cn(
        "mb-3 overflow-hidden rounded-md border",
        isResolved
          ? "border-neutral-200 bg-neutral-50"
          : isDestructive
            ? "border-danger-200 bg-danger-50"
            : "border-primary-200 bg-primary-50"
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <div className="mt-0.5 shrink-0">
          {isResolved ? (
            <ResolvedIcon status={action.status} />
          ) : isDestructive ? (
            <TriangleAlert className="size-4 text-danger-600" />
          ) : (
            <ShieldAlert className="size-4 text-primary-600" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-neutral-900">{action.title}</p>
            <span
              className={cn(
                "rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                isDestructive
                  ? "bg-danger-100 text-danger-700"
                  : "bg-primary-100 text-primary-700"
              )}
            >
              {RISK_COPY[action.risk]}
            </span>
          </div>

          <p className="mt-1 text-sm text-neutral-700">{action.summary}</p>

          {action.details && Object.keys(action.details).length > 0 && (
            <dl className="mt-2 flex flex-col gap-1 rounded-sm bg-white p-2">
              {Object.entries(action.details).map(([key, value]) => (
                <div key={key} className="flex gap-2 text-xs">
                  <dt className="shrink-0 font-medium text-neutral-500">{key}</dt>
                  <dd className="min-w-0 flex-1 break-words text-neutral-800">
                    {String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {isResolved ? (
            <p className="mt-2 text-xs font-medium text-neutral-500">
              {statusLabel(action.status)}
            </p>
          ) : (
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant={isDestructive ? "destructive" : "primary"}
                disabled={isBusy}
                onClick={() => onDecide(action.id, true)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isBusy}
                onClick={() => onDecide(action.id, false)}
              >
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResolvedIcon({ status }: { status: PendingAction["status"] }) {
  if (status === "EXECUTED") return <CircleCheck className="size-4 text-success-600" />;
  if (status === "REJECTED") return <Ban className="size-4 text-neutral-400" />;
  return <CircleAlert className="size-4 text-danger-600" />;
}

function statusLabel(status: PendingAction["status"]): string {
  if (status === "EXECUTED") return "Approved and applied";
  if (status === "REJECTED") return "Rejected — nothing was changed";
  if (status === "FAILED") return "Approved but failed to apply";
  return "";
}
