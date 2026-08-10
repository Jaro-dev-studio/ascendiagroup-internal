"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CircleCheckBig, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteStrategyItem,
  pushStrategyToBoard,
  saveStrategyItem,
  updateStrategy,
} from "@/lib/actions/strategies";
import { formatDate, titleCase } from "@/lib/utils";

interface StrategyDetail {
  id: string;
  title: string;
  status: string;
  summary: string | null;
  positioning: string | null;
  audience: string | null;
  risks: string | null;
  model: string | null;
  generatedAt: Date | null;
  projectId: string | null;
  client: { id: string; name: string };
  createdBy: { name: string | null; email: string } | null;
  phases: {
    id: string;
    phase: string;
    title: string;
    objective: string | null;
    items: {
      id: string;
      title: string;
      description: string | null;
      category: string | null;
      owner: string | null;
      priority: string;
      taskId: string | null;
    }[];
  }[];
}

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED"];

interface ItemDraft {
  id?: string;
  phaseId: string;
  title: string;
  description: string;
  category: string;
  owner: string;
  priority: string;
}

export function StrategyDetailClient({
  strategy,
}: {
  strategy: StrategyDetail;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [details, setDetails] = useState({
    title: strategy.title,
    summary: strategy.summary ?? "",
    positioning: strategy.positioning ?? "",
    audience: strategy.audience ?? "",
    risks: strategy.risks ?? "",
    status: strategy.status,
  });
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null);
  const [isSavingItem, setIsSavingItem] = useState(false);

  const totalActions = strategy.phases.reduce(
    (total, phase) => total + phase.items.length,
    0
  );
  const pushedActions = strategy.phases.reduce(
    (total, phase) => total + phase.items.filter((item) => item.taskId).length,
    0
  );

  async function onSaveDetails(event: React.FormEvent) {
    event.preventDefault();
    setIsSavingDetails(true);

    try {
      const { error } = await updateStrategy(strategy.id, details);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Strategy saved.");
      setIsEditingDetails(false);
      router.refresh();
    } finally {
      setIsSavingDetails(false);
    }
  }

  async function onSaveItem(event: React.FormEvent) {
    event.preventDefault();
    if (!itemDraft) return;

    setIsSavingItem(true);
    try {
      const { error } = await saveStrategyItem({
        phaseId: itemDraft.phaseId,
        itemId: itemDraft.id,
        title: itemDraft.title,
        description: itemDraft.description,
        category: itemDraft.category,
        owner: itemDraft.owner,
        priority: itemDraft.priority,
      });

      if (error) {
        toast.error(error);
        return;
      }

      toast.success("Action saved.");
      setItemDraft(null);
      router.refresh();
    } finally {
      setIsSavingItem(false);
    }
  }

  function onDeleteItem(id: string) {
    startTransition(async () => {
      const { error } = await deleteStrategyItem(id);
      if (error) toast.error(error);
      else router.refresh();
    });
  }

  function onPushToBoard() {
    startTransition(async () => {
      const { data, error } = await pushStrategyToBoard(strategy.id);
      if (error || !data) {
        toast.error(error ?? "Something went wrong.");
        return;
      }
      toast.success(`Created ${data.created} tasks on the delivery board.`);
      router.push(`/dashboard/projects/${data.projectId}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={strategy.title}
        description={`${strategy.client.name} · generated ${formatDate(strategy.generatedAt)}${
          strategy.model ? ` with ${strategy.model}` : ""
        }`}
        actions={
          <>
            <Button variant="outline" onClick={() => setIsEditingDetails(true)}>
              <Pencil className="mr-2 size-4" />
              Edit
            </Button>
            <Button onClick={onPushToBoard} disabled={isPending || totalActions === 0}>
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Push to board
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <StatusBadge kind="strategy" value={strategy.status} />
        <Link
          href={`/dashboard/clients/${strategy.client.id}`}
          className="text-primary hover:underline"
        >
          {strategy.client.name}
        </Link>
        <span>
          {pushedActions}/{totalActions} actions on the board
        </span>
        {strategy.projectId && (
          <Link
            href={`/dashboard/projects/${strategy.projectId}`}
            className="text-primary hover:underline"
          >
            Open project
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {[
          { label: "Summary", value: strategy.summary },
          { label: "Positioning", value: strategy.positioning },
          { label: "Audience", value: strategy.audience },
        ].map((block) => (
          <Card key={block.label}>
            <CardHeader>
              <CardTitle>{block.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-secondary-700">
                {block.value || "Not captured."}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {strategy.risks && (
        <Card>
          <CardHeader>
            <CardTitle>Risks and open questions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-secondary-700">
              {strategy.risks}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {strategy.phases.map((phase) => (
          <Card key={phase.id} className="flex flex-col">
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {phase.phase.replace("DAY_", "First ")} days
              </p>
              <CardTitle>{phase.title}</CardTitle>
              {phase.objective && (
                <p className="text-sm text-muted-foreground">{phase.objective}</p>
              )}
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              {phase.items.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No actions in this phase.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {phase.items.map((item) => (
                    <li
                      key={item.id}
                      className="group rounded-md border border-border p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-secondary-900">
                          {item.title}
                        </p>
                        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Edit action"
                            onClick={() =>
                              setItemDraft({
                                id: item.id,
                                phaseId: phase.id,
                                title: item.title,
                                description: item.description ?? "",
                                category: item.category ?? "",
                                owner: item.owner ?? "",
                                priority: item.priority,
                              })
                            }
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete action"
                            disabled={isPending}
                            onClick={() => onDeleteItem(item.id)}
                          >
                            <Trash2 className="size-3.5 text-danger-600" />
                          </Button>
                        </div>
                      </div>

                      {item.description && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge kind="priority" value={item.priority} />
                        {item.category && (
                          <span className="rounded-full bg-secondary-100 px-2 py-0.5 text-[11px] text-secondary-600">
                            {item.category}
                          </span>
                        )}
                        {item.taskId && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-accent-600">
                            <CircleCheckBig className="size-3" />
                            On board
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="mt-auto"
                onClick={() =>
                  setItemDraft({
                    phaseId: phase.id,
                    title: "",
                    description: "",
                    category: "",
                    owner: "",
                    priority: "MEDIUM",
                  })
                }
              >
                <Plus className="mr-2 size-4" />
                Add action
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isEditingDetails} onOpenChange={setIsEditingDetails}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>Edit strategy</DialogTitle>
          </DialogHeader>

          <form onSubmit={onSaveDetails} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={details.title}
                onChange={(event) =>
                  setDetails({ ...details, title: event.target.value })
                }
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={details.status}
                onValueChange={(value) => setDetails({ ...details, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleCase(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(
              [
                ["summary", "Summary"],
                ["positioning", "Positioning"],
                ["audience", "Audience"],
                ["risks", "Risks and open questions"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Label htmlFor={key}>{label}</Label>
                <Textarea
                  id={key}
                  rows={3}
                  value={details[key]}
                  onChange={(event) =>
                    setDetails({ ...details, [key]: event.target.value })
                  }
                />
              </div>
            ))}

            <DialogFooter className="flex-row justify-end gap-2">
              <Button type="submit" disabled={isSavingDetails}>
                {isSavingDetails && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                Save
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEditingDetails(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={itemDraft !== null}
        onOpenChange={(open) => !open && setItemDraft(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{itemDraft?.id ? "Edit action" : "Add action"}</DialogTitle>
          </DialogHeader>

          {itemDraft && (
            <form onSubmit={onSaveItem} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="itemTitle">Action</Label>
                <Input
                  id="itemTitle"
                  value={itemDraft.title}
                  onChange={(event) =>
                    setItemDraft({ ...itemDraft, title: event.target.value })
                  }
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="itemDescription">Detail</Label>
                <Textarea
                  id="itemDescription"
                  rows={3}
                  value={itemDraft.description}
                  onChange={(event) =>
                    setItemDraft({ ...itemDraft, description: event.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="itemCategory">Delivery lane</Label>
                  <Input
                    id="itemCategory"
                    value={itemDraft.category}
                    onChange={(event) =>
                      setItemDraft({ ...itemDraft, category: event.target.value })
                    }
                    placeholder="SEO, Google Ads..."
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="itemPriority">Priority</Label>
                  <Select
                    value={itemDraft.priority}
                    onValueChange={(value) =>
                      setItemDraft({ ...itemDraft, priority: value })
                    }
                  >
                    <SelectTrigger id="itemPriority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {titleCase(priority)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter className="flex-row justify-end gap-2">
                <Button type="submit" disabled={isSavingItem}>
                  {isSavingItem && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save action
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setItemDraft(null)}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
