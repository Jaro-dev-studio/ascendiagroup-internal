"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createCrmNote } from "@/lib/actions/crm";

interface NoteComposerProps {
  personId?: string;
  companyId?: string;
  dealId?: string;
}

export function NoteComposer({
  personId,
  companyId,
  dealId,
}: NoteComposerProps) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!content.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await createCrmNote({
        content,
        personId: personId ?? null,
        companyId: companyId ?? null,
        dealId: dealId ?? null,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setContent("");
      router.refresh();
    });
  };

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3">
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Add a note about this record..."
          aria-label="Note content"
          rows={3}
        />
        {error && <p className="text-sm text-text-danger">{error}</p>}
        <div className="flex flex-row justify-end">
          <Button
            onClick={handleSubmit}
            disabled={isPending || !content.trim()}
          >
            {isPending ? "Saving..." : "Add note"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
