"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createPrototype } from "@/lib/actions";
import { Loader2 } from "lucide-react";

export default function NewPrototypePage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const prototype = await createPrototype({ name, description });
      router.push(`/dashboard/prototypes/${prototype.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Create New Prototype</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            required
            disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
            rows={3}
            disabled={isSubmitting}
          />
        </div>
        <Button type="submit" disabled={isSubmitting} className="relative">
          <span className={isSubmitting ? "opacity-0" : ""}>
            Create Prototype
          </span>
          {isSubmitting && (
            <span className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-4 animate-spin" />
            </span>
          )}
        </Button>
      </form>
    </div>
  );
} 