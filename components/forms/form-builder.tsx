"use client";

import { useState, useTransition } from "react";
import {
  ChevronDown,
  ChevronUp,
  GitBranch,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { ConditionOperator, FieldType } from "@prisma/client";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  deleteFormField,
  moveFormField,
  saveFormField,
} from "@/lib/actions/onboarding";
import { titleCase } from "@/lib/utils";

export interface BuilderField {
  id: string;
  section: string;
  label: string;
  helpText: string | null;
  type: FieldType;
  options: string[];
  isRequired: boolean;
  isCredential: boolean;
  order: number;
  conditionalFieldId: string | null;
  conditionOperator: ConditionOperator | null;
  conditionValues: string[];
}

const FIELD_TYPES: FieldType[] = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "EMAIL",
  "PHONE",
  "URL",
  "NUMBER",
  "DATE",
  "SELECT",
  "MULTI_SELECT",
  "CHECKBOX",
  "CREDENTIAL",
  "FILE_LINK",
  "SERVICE_SELECT",
];

const OPERATORS: ConditionOperator[] = [
  "EQUALS",
  "NOT_EQUALS",
  "CONTAINS",
  "IS_ANY_OF",
];

const SERVICE_OPTIONS = [
  "SEO",
  "GOOGLE_ADS",
  "META_ADS",
  "WEBSITE",
  "GOOGLE_BUSINESS_PROFILE",
  "SOCIAL_MEDIA",
  "CONTENT",
  "REPUTATION",
  "CRM_AUTOMATION",
];

const OPTION_TYPES: FieldType[] = ["SELECT", "MULTI_SELECT", "SERVICE_SELECT"];

interface DraftField {
  section: string;
  label: string;
  helpText: string;
  type: FieldType;
  optionsText: string;
  isRequired: boolean;
  isCredential: boolean;
  conditionalFieldId: string;
  conditionOperator: ConditionOperator;
  conditionValues: string[];
}

const EMPTY_DRAFT: DraftField = {
  section: "General",
  label: "",
  helpText: "",
  type: "SHORT_TEXT",
  optionsText: "",
  isRequired: false,
  isCredential: false,
  conditionalFieldId: "",
  conditionOperator: "IS_ANY_OF",
  conditionValues: [],
};

export function FormBuilder({
  formId,
  fields,
}: {
  formId: string;
  fields: BuilderField[];
}) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftField>(EMPTY_DRAFT);
  const [isSaving, setIsSaving] = useState(false);

  const parentCandidates = fields.filter(
    (field) => field.id !== editingId && OPTION_TYPES.concat("CHECKBOX").includes(field.type)
  );
  const selectedParent = parentCandidates.find(
    (field) => field.id === draft.conditionalFieldId
  );
  const parentOptions =
    selectedParent?.type === "CHECKBOX"
      ? ["Yes", "No"]
      : (selectedParent?.options ?? []);

  function openCreate() {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setIsOpen(true);
  }

  function openEdit(field: BuilderField) {
    setEditingId(field.id);
    setDraft({
      section: field.section,
      label: field.label,
      helpText: field.helpText ?? "",
      type: field.type,
      optionsText: field.options.join("\n"),
      isRequired: field.isRequired,
      isCredential: field.isCredential,
      conditionalFieldId: field.conditionalFieldId ?? "",
      conditionOperator: field.conditionOperator ?? "IS_ANY_OF",
      conditionValues: field.conditionValues,
    });
    setIsOpen(true);
  }

  function update<K extends keyof DraftField>(key: K, value: DraftField[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const options =
        draft.type === "SERVICE_SELECT"
          ? draft.optionsText
            .split("\n")
            .map((option) => option.trim())
            .filter(Boolean)
          : draft.optionsText
            .split("\n")
            .map((option) => option.trim())
            .filter(Boolean);

      const { error } = await saveFormField({
        formId,
        fieldId: editingId ?? undefined,
        field: {
          section: draft.section,
          label: draft.label,
          helpText: draft.helpText,
          type: draft.type,
          options,
          isRequired: draft.isRequired,
          isCredential: draft.isCredential,
          conditionalFieldId: draft.conditionalFieldId || null,
          conditionOperator: draft.conditionalFieldId
            ? draft.conditionOperator
            : null,
          conditionValues: draft.conditionValues,
        },
      });

      if (error) {
        toast.error(error);
        return;
      }

      toast.success(editingId ? "Question updated." : "Question added.");
      setIsOpen(false);
    } finally {
      setIsSaving(false);
    }
  }

  function onDelete(fieldId: string) {
    startTransition(async () => {
      const { error } = await deleteFormField(formId, fieldId);
      if (error) toast.error(error);
      else toast.success("Question removed.");
    });
  }

  function onMove(fieldId: string, direction: "up" | "down") {
    startTransition(async () => {
      const { error } = await moveFormField(formId, fieldId, direction);
      if (error) toast.error(error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Questions</CardTitle>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Add question
        </Button>
      </CardHeader>

      <CardContent>
        {fields.length === 0 ? (
          <EmptyState
            icon={Plus}
            title="No questions yet"
            description="Add the questions you need from every practice, then layer on conditional questions that only appear for specific services."
            action={<Button onClick={openCreate}>Add first question</Button>}
          />
        ) : (
          <ol className="flex flex-col divide-y divide-border">
            {fields.map((field, index) => {
              const parent = fields.find(
                (item) => item.id === field.conditionalFieldId
              );

              return (
                <li
                  key={field.id}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-col gap-0.5 pt-0.5">
                    <button
                      type="button"
                      aria-label="Move up"
                      disabled={index === 0 || isPending}
                      onClick={() => onMove(field.id, "up")}
                      className="text-muted-foreground transition-colors hover:text-secondary-900 disabled:opacity-30"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={index === fields.length - 1 || isPending}
                      onClick={() => onMove(field.id, "down")}
                      className="text-muted-foreground transition-colors hover:text-secondary-900 disabled:opacity-30"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-secondary-900">
                        {field.label}
                      </p>
                      {field.isRequired && <Badge variant="outline">Required</Badge>}
                      {field.isCredential && (
                        <Badge variant="warning">
                          <KeyRound className="size-3" />
                          Credential
                        </Badge>
                      )}
                    </div>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {field.section} · {titleCase(field.type)}
                      {field.options.length > 0
                        ? ` · ${field.options.length} options`
                        : ""}
                    </p>

                    {parent && (
                      <p className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary-50 px-2 py-1 text-xs text-primary-700">
                        <GitBranch className="size-3" />
                        Shows when &quot;{parent.label}&quot;{" "}
                        {titleCase(field.conditionOperator ?? "")}{" "}
                        {field.conditionValues.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit question"
                      onClick={() => openEdit(field)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete question"
                      disabled={isPending}
                      onClick={() => onDelete(field.id)}
                    >
                      <Trash2 className="size-4 text-danger-600" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="scrollbar-thin max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit question" : "Add question"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSave} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="section">Section</Label>
                <Input
                  id="section"
                  value={draft.section}
                  onChange={(event) => update("section", event.target.value)}
                  placeholder="Practice details"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="type">Answer type</Label>
                <Select
                  value={draft.type}
                  onValueChange={(value) => {
                    update("type", value as FieldType);
                    if (value === "SERVICE_SELECT") {
                      update("optionsText", SERVICE_OPTIONS.join("\n"));
                    }
                  }}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {titleCase(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="label">Question</Label>
              <Input
                id="label"
                value={draft.label}
                onChange={(event) => update("label", event.target.value)}
                placeholder="Which services are included in your package?"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="helpText">Helper text</Label>
              <Input
                id="helpText"
                value={draft.helpText}
                onChange={(event) => update("helpText", event.target.value)}
                placeholder="Shown under the question"
              />
            </div>

            {OPTION_TYPES.includes(draft.type) && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="options">Options (one per line)</Label>
                <Textarea
                  id="options"
                  rows={5}
                  value={draft.optionsText}
                  onChange={(event) => update("optionsText", event.target.value)}
                  placeholder={"Growth\nScale\nFoundation"}
                />
                {draft.type === "SERVICE_SELECT" && (
                  <p className="text-xs text-muted-foreground">
                    Service selections are applied to the client record when the
                    submission is processed. Keep the values from the list above.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-secondary-700">
                <Checkbox
                  checked={draft.isRequired}
                  onCheckedChange={(checked) =>
                    update("isRequired", checked === true)
                  }
                />
                Required
              </label>
              <label className="flex items-center gap-2 text-sm text-secondary-700">
                <Checkbox
                  checked={draft.isCredential}
                  onCheckedChange={(checked) =>
                    update("isCredential", checked === true)
                  }
                />
                Contains credentials
              </label>
            </div>

            <div className="rounded-md border border-border bg-muted p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-secondary-900">
                <GitBranch className="size-4 text-primary" />
                Conditional logic
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Show this question only when an earlier choice question matches.
              </p>

              <div className="mt-3 flex flex-col gap-3">
                <Select
                  value={draft.conditionalFieldId || "always"}
                  onValueChange={(value) => {
                    update("conditionalFieldId", value === "always" ? "" : value);
                    update("conditionValues", []);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Always show" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Always show</SelectItem>
                    {parentCandidates.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {draft.conditionalFieldId && (
                  <>
                    <Select
                      value={draft.conditionOperator}
                      onValueChange={(value) =>
                        update("conditionOperator", value as ConditionOperator)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((operator) => (
                          <SelectItem key={operator} value={operator}>
                            {titleCase(operator)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="flex flex-wrap gap-2">
                      {parentOptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          The selected question has no options to match on.
                        </p>
                      ) : (
                        parentOptions.map((option) => {
                          const isSelected = draft.conditionValues.includes(option);
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() =>
                                update(
                                  "conditionValues",
                                  isSelected
                                    ? draft.conditionValues.filter(
                                      (value) => value !== option
                                    )
                                    : [...draft.conditionValues, option]
                                )
                              }
                              className={
                                isSelected
                                  ? "rounded-full border border-primary bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700"
                                  : "rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-secondary-600 hover:bg-muted"
                              }
                            >
                              {titleCase(option)}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {editingId ? "Save question" : "Add question"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
