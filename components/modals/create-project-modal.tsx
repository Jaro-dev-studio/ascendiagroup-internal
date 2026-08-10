"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Check,
  ExternalLink,
  AlertCircle,
  Github,
  GitBranch,
} from "lucide-react";

type ProjectStep = "form" | "creating" | "done" | "error";

interface ProjectProgress {
  githubCreated: boolean;
  vercelCreated: boolean;
  cursorLaunched: boolean;
  cursorStatus: string | null;
  cursorAgentUrl: string | null;
  error: string | null;
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (name: string, prompt: string) => Promise<void>;
  step: ProjectStep;
  progress: ProjectProgress;
}

function StepIndicator({
  completed,
  loading,
  label,
}: {
  completed: boolean;
  loading: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-6 items-center justify-center rounded-full border border-border">
        {completed ? (
          <Check className="size-4 text-success-600" />
        ) : loading ? (
          <Loader2 className="size-4 animate-spin text-primary-600" />
        ) : (
          <div className="size-2 rounded-full bg-secondary-300" />
        )}
      </div>
      <span className={completed ? "text-text-primary" : "text-text-secondary"}>
        {label}
      </span>
    </div>
  );
}

function CursorStatusBadge({ status }: { status: string | null }) {
  if (!status) return null;

  const statusConfig: Record<string, { label: string; className: string }> = {
    CREATING: { label: "Creating", className: "bg-warning-100 text-warning-700" },
    RUNNING: { label: "Running", className: "bg-primary-100 text-primary-700" },
    FINISHED: { label: "Finished", className: "bg-success-100 text-success-700" },
    ERROR: { label: "Error", className: "bg-danger-100 text-danger-700" },
    STOPPED: { label: "Stopped", className: "bg-secondary-100 text-secondary-700" },
  };

  const config = statusConfig[status] || { label: status, className: "bg-secondary-100 text-secondary-700" };

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

export function CreateProjectModal({
  isOpen,
  onClose,
  onCreateProject,
  step,
  progress,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    if (step === "creating") return; // Prevent closing during creation
    setName("");
    setPrompt("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim() || !prompt.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateProject(name.trim(), prompt.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCreatingOrDone = step === "creating" || step === "done" || step === "error";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="flex max-w-2xl flex-col p-0">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <GitBranch className="size-4 text-text-secondary" />
          <span className="text-sm font-medium">Create Project</span>
        </div>

        {!isCreatingOrDone ? (
          <>
            {/* Form */}
            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="project-name" className="text-text-primary text-sm font-medium">
                  Project Name
                </label>
                <Input
                  id="project-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Acme Dashboard"
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="project-prompt" className="text-text-primary text-sm font-medium">
                  Prompt for Cursor Agent
                </label>
                <Textarea
                  id="project-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what you want the Cursor agent to build..."
                  className="min-h-[150px] resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
              <Button
                onClick={handleSubmit}
                disabled={!name.trim() || !prompt.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Project"
                )}
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Progress View */}
            <div className="flex flex-col gap-6 px-4 py-6">
              <div className="flex flex-col gap-4">
                <StepIndicator
                  completed={progress.githubCreated}
                  loading={!progress.githubCreated && step === "creating"}
                  label="Create GitHub repository"
                />
                <StepIndicator
                  completed={progress.vercelCreated}
                  loading={progress.githubCreated && !progress.vercelCreated && step === "creating"}
                  label="Create Vercel project"
                />
                <StepIndicator
                  completed={progress.cursorLaunched}
                  loading={progress.vercelCreated && !progress.cursorLaunched && step === "creating"}
                  label="Launch Cursor agent"
                />
              </div>

              {/* Cursor Agent Status */}
              {progress.cursorLaunched && (
                <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary text-sm font-medium">Cursor Agent</span>
                    <CursorStatusBadge status={progress.cursorStatus} />
                  </div>
                  {progress.cursorAgentUrl && (
                    <a
                      href={progress.cursorAgentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 hover:underline"
                    >
                      <ExternalLink className="size-4" />
                      View agent in Cursor
                    </a>
                  )}
                </div>
              )}

              {/* Error State */}
              {step === "error" && progress.error && (
                <div className="flex items-start gap-3 rounded-lg border border-danger-200 bg-danger-50 p-4">
                  <AlertCircle className="size-5 text-danger-600" />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-danger-700">Error</span>
                    <span className="text-sm text-danger-600">{progress.error}</span>
                  </div>
                </div>
              )}

              {/* Success State */}
              {step === "done" && progress.cursorStatus === "FINISHED" && (
                <div className="flex items-start gap-3 rounded-lg border border-success-200 bg-success-50 p-4">
                  <Check className="size-5 text-success-600" />
                  <span className="text-sm font-medium text-success-700">
                    Project created successfully
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3">
              {progress.cursorAgentUrl && (
                <Button asChild variant="outline">
                  <a
                    href={progress.cursorAgentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="mr-2 size-4" />
                    Open in Cursor
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={step === "creating"}
              >
                {step === "creating" ? "Creating..." : "Close"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
