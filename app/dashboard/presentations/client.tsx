"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Play, Pencil, Trash2, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { deletePresentation } from "@/lib/actions";
import type { Presentation as PresentationType } from "@prisma/client";
import dayjs from "dayjs";

interface PresentationsClientProps {
  presentations: PresentationType[];
}

export function PresentationsClient({ presentations }: PresentationsClientProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this presentation?")) return;

    setIsDeleting(id);
    try {
      const result = await deletePresentation(id);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to delete presentation");
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Presentations</h1>
          <p className="text-sm text-secondary-500">
            Create and manage slide presentations
          </p>
        </div>
        <Link href="/dashboard/presentations/new">
          <Button>
            <Plus className="mr-2 size-4" />
            New Presentation
          </Button>
        </Link>
      </div>

      {presentations.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Presentation className="mb-4 size-12 text-secondary-300" />
          <h3 className="text-lg font-semibold">No presentations yet</h3>
          <p className="mt-1 text-sm text-secondary-500">
            Create your first presentation to get started.
          </p>
          <Link href="/dashboard/presentations/new" className="mt-4">
            <Button>
              <Plus className="mr-2 size-4" />
              New Presentation
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {presentations.map((p) => {
            const slideCount = Array.isArray(p.slides) ? (p.slides as unknown[]).length : 0;
            return (
              <Card key={p.id} className="flex flex-col p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{p.title}</h3>
                    <p className="text-xs text-secondary-500">
                      {slideCount} slides &middot; {dayjs(p.createdAt).format("MMM D, YYYY")}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex gap-2">
                  <Link href={`/dashboard/presentations/${p.id}/present`} className="flex-1">
                    <Button variant="default" size="sm" className="w-full">
                      <Play className="mr-1.5 size-3.5" />
                      Present
                    </Button>
                  </Link>
                  <Link href={`/dashboard/presentations/${p.id}`}>
                    <Button variant="outline" size="sm">
                      <Pencil className="size-3.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(p.id)}
                    disabled={isDeleting === p.id}
                  >
                    <Trash2 className="size-3.5 text-danger-500" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
