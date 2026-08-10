"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlideForm } from "@/components/presentations/slide-form";
import { type Slide } from "@/components/presentations/slide-types";
import { updatePresentation, splitScriptIntoLines } from "@/lib/actions";
import type { Presentation } from "@prisma/client";

interface EditPresentationClientProps {
  presentation: Presentation;
}

export function EditPresentationClient({ presentation }: EditPresentationClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState(presentation.title);
  const [slides, setSlides] = useState<Slide[]>(
    (presentation.slides as unknown as Slide[]) || []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);

  const handleSave = async (): Promise<boolean> => {
    if (!title.trim()) {
      alert("Please enter a title");
      return false;
    }

    setIsSaving(true);
    try {
      const result = await updatePresentation(presentation.id, {
        title: title.trim(),
        slides,
      });

      if (result.error) {
        alert(result.error);
        return false;
      }

      return true;
    } catch {
      alert("Failed to update presentation");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePresent = async () => {
    const saved = await handleSave();
    if (saved) {
      router.push(`/dashboard/presentations/${presentation.id}/present`);
    }
  };

  const handleLiveEdit = async () => {
    const saved = await handleSave();
    if (saved) {
      router.push(`/dashboard/presentations/${presentation.id}/live-edit`);
    }
  };

  const handleAiSplit = async (script: string): Promise<string | null> => {
    setIsSplitting(true);
    try {
      const result = await splitScriptIntoLines({ script });
      if (result.error) {
        alert(result.error);
        return null;
      }
      return result.data;
    } catch {
      alert("Failed to split script");
      return null;
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/presentations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Edit Presentation</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleLiveEdit} disabled={isSaving}>
            Live Edit
          </Button>
          <Button variant="outline" onClick={handlePresent} disabled={isSaving}>
            Present
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 size-4" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Presentation title"
          className="max-w-md"
        />
      </div>

      <SlideForm
        slides={slides}
        onSlidesChange={setSlides}
        onAiSplit={handleAiSplit}
        isSplitting={isSplitting}
      />
    </div>
  );
}
