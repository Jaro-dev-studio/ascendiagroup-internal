"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlideForm } from "@/components/presentations/slide-form";
import { type Slide, getDefaultSlides } from "@/components/presentations/slide-types";
import { createPresentation, splitScriptIntoLines } from "@/lib/actions";

export function NewPresentationClient() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<Slide[]>(getDefaultSlides());
  const [isSaving, setIsSaving] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      alert("Please enter a title");
      return;
    }

    setIsSaving(true);
    try {
      const result = await createPresentation({
        title: title.trim(),
        slides,
      });

      if (result.error) {
        alert(result.error);
        return;
      }

      if (result.data) {
        router.push(`/dashboard/presentations/${result.data.id}`);
      }
    } catch {
      alert("Failed to create presentation");
    } finally {
      setIsSaving(false);
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
            <h1 className="text-2xl font-bold">New Presentation</h1>
          </div>
        </div>
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
