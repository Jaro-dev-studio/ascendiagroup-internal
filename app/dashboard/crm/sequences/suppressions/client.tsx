"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ban, Loader2, Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  addSuppressionEntry,
  removeSuppressionEntry,
} from "@/lib/actions/sequences";
import { cn, formatCrmDate } from "@/lib/utils";
import type { SuppressionView } from "@/lib/fetchers/sequences";

interface SuppressionsClientProps {
  suppressions: SuppressionView[];
}

const REASON_CLASSES: Record<string, string> = {
  unsubscribed: "bg-warning-100 text-warning-700",
  bounced: "bg-danger-100 text-danger-700",
  complained: "bg-danger-100 text-danger-700",
  manual: "bg-secondary-100 text-secondary-700",
};

export function SuppressionsClient({ suppressions }: SuppressionsClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!email.trim()) return;

    setIsAdding(true);
    setError(null);

    const result = await addSuppressionEntry(email.trim(), note.trim() || undefined);
    setIsAdding(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setEmail("");
    setNote("");
    router.refresh();
  };

  const handleRemove = async (target: string) => {
    setPendingEmail(target);
    await removeSuppressionEntry(target);
    setPendingEmail(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/crm/sequences"
          className="flex w-fit flex-row items-center gap-1 text-sm text-secondary-500 hover:text-secondary-900"
        >
          <ArrowLeft className="size-4" />
          All sequences
        </Link>

        <div>
          <h1 className="text-2xl font-bold text-secondary-900">
            Suppression list
          </h1>
          <p className="mt-1 text-secondary-500">
            Every address here is blocked before any sequence send. Unsubscribes
            and bounces are added automatically.
          </p>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="font-medium text-secondary-900">Add an address</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="person@example.com"
            type="email"
          />
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Reason (optional)"
          />
          <Button
            onClick={handleAdd}
            disabled={isAdding || !email.trim()}
            className="shrink-0 gap-2"
          >
            {isAdding ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Suppress
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-text-danger">{error}</p>}
      </Card>

      <Card className="p-5">
        <h2 className="font-medium text-secondary-900">
          {suppressions.length} suppressed address
          {suppressions.length === 1 ? "" : "es"}
        </h2>

        {suppressions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Ban className="size-8 text-secondary-300" />
            <p className="text-sm text-secondary-500">
              Nothing suppressed yet.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col divide-y divide-border">
            {suppressions.map((suppression) => (
              <div
                key={suppression.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-row flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-secondary-900">
                      {suppression.email}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        REASON_CLASSES[suppression.reason] ??
                          "bg-secondary-100 text-secondary-700"
                      )}
                    >
                      {suppression.reason}
                    </span>
                  </div>
                  <p className="text-xs text-secondary-400">
                    Added {formatCrmDate(suppression.createdAt)}
                    {suppression.note ? ` · ${suppression.note}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 flex-row items-center gap-2">
                  {pendingEmail === suppression.email && (
                    <Loader2 className="size-4 animate-spin text-secondary-400" />
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(suppression.email)}
                    className="gap-1"
                  >
                    <Undo2 className="size-4" />
                    Allow again
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
