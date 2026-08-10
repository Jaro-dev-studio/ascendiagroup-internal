"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  FileText,
  Loader2,
  MailPlus,
} from "lucide-react";
import {
  createFollowupTemplate,
  updateFollowupTemplate,
  deleteFollowupTemplate,
} from "@/lib/actions/followups";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TemplateData {
  id: string;
  name: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    followups: number;
  };
}

interface FollowupTemplatesClientProps {
  templates: TemplateData[];
}

export function FollowupTemplatesClient({ templates }: FollowupTemplatesClientProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateData | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<TemplateData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setName("");
    setPrompt("");
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: TemplateData) => {
    setEditingTemplate(template);
    setName(template.name);
    setPrompt(template.prompt);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !prompt.trim()) return;
    setIsSaving(true);

    try {
      if (editingTemplate) {
        const result = await updateFollowupTemplate(editingTemplate.id, {
          name: name.trim(),
          prompt: prompt.trim(),
        });
        if (result.error) {
          console.error("Failed to update template:", result.error);
          return;
        }
      } else {
        const result = await createFollowupTemplate({
          name: name.trim(),
          prompt: prompt.trim(),
        });
        if (result.error) {
          console.error("Failed to create template:", result.error);
          return;
        }
      }

      setIsDialogOpen(false);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingTemplate) return;
    setIsDeleting(true);

    try {
      const result = await deleteFollowupTemplate(deletingTemplate.id);
      if (result.error) {
        console.error("Failed to delete template:", result.error);
        return;
      }
      setDeletingTemplate(null);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Followup Templates</h1>
          <p className="mt-1 text-secondary-500">
            Templates used to generate followup content from call transcripts
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="size-4" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card className="p-8 text-center">
          <MailPlus className="mx-auto size-12 text-secondary-300" />
          <p className="mt-4 text-secondary-600">No followup templates yet</p>
          <p className="mt-1 text-sm text-secondary-500">
            Create a template to start generating followup content from call transcripts
          </p>
          <Button onClick={openCreateDialog} className="mt-4 gap-2">
            <Plus className="size-4" />
            Create First Template
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 shrink-0 text-primary-500" />
                  <h3 className="font-medium text-secondary-900">{template.name}</h3>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEditDialog(template)}
                    className="rounded p-1 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-primary-500"
                  >
                    <Pencil className="size-4" />
                  </button>
                  <button
                    onClick={() => setDeletingTemplate(template)}
                    className="rounded p-1 text-secondary-400 transition-colors hover:bg-secondary-100 hover:text-danger-500"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-secondary-500">
                {template.prompt}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {template._count.followups} generated
                </Badge>
                <span className="text-xs text-secondary-400">
                  {new Date(template.createdAt).toLocaleDateString()}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "New Followup Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                placeholder="e.g. Sales Followup Email"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-prompt">Prompt</Label>
              <Textarea
                id="template-prompt"
                placeholder="Instructions for the AI on what to generate from the transcript..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
              />
              <p className="text-xs text-secondary-500">
                This prompt will be sent to AI along with the call transcript to generate the followup content.
              </p>
            </div>
            <div className="flex justify-between gap-2">
              <Button
                onClick={handleSave}
                disabled={isSaving || !name.trim() || !prompt.trim()}
                className="gap-2"
              >
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                {editingTemplate ? "Save Changes" : "Create Template"}
              </Button>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingTemplate}
        onOpenChange={(open) => {
          if (!open) setDeletingTemplate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingTemplate?.name}&quot;? This will also
              delete all followups generated from this template. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-danger-500 hover:bg-danger-600"
            >
              {isDeleting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
