"use client";

import { useMemo, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import type { ConditionOperator, FieldType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { cn, titleCase } from "@/lib/utils";

export interface RenderableField {
  id: string;
  section: string;
  label: string;
  helpText: string | null;
  type: FieldType;
  options: string[];
  isRequired: boolean;
  isCredential: boolean;
  conditionalFieldId: string | null;
  conditionOperator: ConditionOperator | null;
  conditionValues: string[];
}

export interface AnswerMap {
  [fieldId: string]: { value?: string; values?: string[] };
}

const MULTI_TYPES: FieldType[] = ["MULTI_SELECT", "SERVICE_SELECT"];

function matchesCondition(
  operator: ConditionOperator,
  expected: string[],
  answer?: { value?: string; values?: string[] }
) {
  const actual = answer?.values?.length
    ? answer.values
    : answer?.value
      ? [answer.value]
      : [];

  switch (operator) {
    case "EQUALS":
      return actual.length === 1 && expected.includes(actual[0]);
    case "NOT_EQUALS":
      return actual.length === 0 || !actual.some((item) => expected.includes(item));
    case "CONTAINS":
      return actual.some((item) =>
        expected.some((value) =>
          item.toLowerCase().includes(value.toLowerCase())
        )
      );
    case "IS_ANY_OF":
    default:
      return actual.some((item) => expected.includes(item));
  }
}

/**
 * A question is shown when its own condition passes and every ancestor in the
 * branch is also visible, which is what makes the split pathways work.
 */
export function isFieldVisible(
  field: RenderableField,
  fields: RenderableField[],
  answers: AnswerMap,
  seen = new Set<string>()
): boolean {
  if (!field.conditionalFieldId || !field.conditionOperator) return true;
  if (seen.has(field.id)) return true;

  const parent = fields.find((item) => item.id === field.conditionalFieldId);
  if (!parent) return true;

  seen.add(field.id);
  if (!isFieldVisible(parent, fields, answers, seen)) return false;

  return matchesCondition(
    field.conditionOperator,
    field.conditionValues,
    answers[parent.id]
  );
}

function inputTypeFor(type: FieldType) {
  switch (type) {
    case "EMAIL":
      return "email";
    case "PHONE":
      return "tel";
    case "URL":
    case "FILE_LINK":
      return "url";
    case "NUMBER":
      return "number";
    case "DATE":
      return "date";
    case "CREDENTIAL":
      return "password";
    default:
      return "text";
  }
}

interface OnboardingFormRendererProps {
  fields: RenderableField[];
  defaults?: {
    practiceName?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
  };
  isPreview?: boolean;
  onSubmit?: (payload: {
    practiceName: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    answers: { fieldId: string; value?: string; values?: string[] }[];
  }) => Promise<void>;
}

export function OnboardingFormRenderer({
  fields,
  defaults,
  isPreview = false,
  onSubmit,
}: OnboardingFormRendererProps) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [practiceName, setPracticeName] = useState(defaults?.practiceName ?? "");
  const [contactName, setContactName] = useState(defaults?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(defaults?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(defaults?.contactPhone ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleFields = useMemo(
    () => fields.filter((field) => isFieldVisible(field, fields, answers)),
    [fields, answers]
  );

  const sections = useMemo(() => {
    const grouped = new Map<string, RenderableField[]>();
    for (const field of visibleFields) {
      const existing = grouped.get(field.section) ?? [];
      existing.push(field);
      grouped.set(field.section, existing);
    }
    return Array.from(grouped.entries());
  }, [visibleFields]);

  function setAnswer(fieldId: string, next: { value?: string; values?: string[] }) {
    setAnswers((current) => ({ ...current, [fieldId]: next }));
  }

  function toggleValue(fieldId: string, option: string) {
    setAnswers((current) => {
      const existing = current[fieldId]?.values ?? [];
      const values = existing.includes(option)
        ? existing.filter((item) => item !== option)
        : [...existing, option];
      return { ...current, [fieldId]: { values } };
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!onSubmit) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        practiceName,
        contactName,
        contactEmail,
        contactPhone,
        answers: visibleFields.map((field) => ({
          fieldId: field.id,
          value: answers[field.id]?.value,
          values: answers[field.id]?.values,
        })),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary-500">
          Your practice
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="practiceName">Practice name</Label>
            <Input
              id="practiceName"
              value={practiceName}
              onChange={(event) => setPracticeName(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactName">Your name</Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactEmail">Email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactPhone">Phone</Label>
            <Input
              id="contactPhone"
              type="tel"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
            />
          </div>
        </div>
      </section>

      {sections.map(([section, sectionFields]) => (
        <section key={section} className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary-500">
            {section}
          </h2>

          {sectionFields.map((field) => {
            const answer = answers[field.id];

            return (
              <div
                key={field.id}
                className={cn(
                  "flex animate-fade-in flex-col gap-1.5",
                  field.conditionalFieldId &&
                    "rounded-md border-l-2 border-primary-200 pl-4"
                )}
              >
                <Label htmlFor={field.id} className="flex items-center gap-2">
                  {field.label}
                  {field.isRequired && <span className="text-danger-600">*</span>}
                  {field.isCredential && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-medium text-warning-700">
                      <KeyRound className="size-3" />
                      Credential
                    </span>
                  )}
                </Label>

                {field.helpText && (
                  <p className="text-xs text-muted-foreground">{field.helpText}</p>
                )}

                {field.type === "LONG_TEXT" && (
                  <Textarea
                    id={field.id}
                    rows={4}
                    required={field.isRequired}
                    value={answer?.value ?? ""}
                    onChange={(event) =>
                      setAnswer(field.id, { value: event.target.value })
                    }
                  />
                )}

                {field.type === "CHECKBOX" && (
                  <label className="flex items-center gap-2 text-sm text-secondary-700">
                    <Checkbox
                      id={field.id}
                      checked={answer?.value === "Yes"}
                      onCheckedChange={(checked) =>
                        setAnswer(field.id, { value: checked ? "Yes" : "No" })
                      }
                    />
                    Yes
                  </label>
                )}

                {field.type === "SELECT" && (
                  <Select
                    value={answer?.value ?? ""}
                    onValueChange={(value) => setAnswer(field.id, { value })}
                  >
                    <SelectTrigger id={field.id}>
                      <SelectValue placeholder="Choose an option" />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {MULTI_TYPES.includes(field.type) && (
                  <div className="flex flex-wrap gap-2">
                    {field.options.map((option) => {
                      const isSelected = (answer?.values ?? []).includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleValue(field.id, option)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            isSelected
                              ? "border-primary bg-primary-50 text-primary-700"
                              : "border-border bg-card text-secondary-600 hover:bg-muted"
                          )}
                        >
                          {field.type === "SERVICE_SELECT"
                            ? titleCase(option)
                            : option}
                        </button>
                      );
                    })}
                  </div>
                )}

                {!["LONG_TEXT", "CHECKBOX", "SELECT", ...MULTI_TYPES].includes(
                  field.type
                ) && (
                  <Input
                    id={field.id}
                    type={inputTypeFor(field.type)}
                    required={field.isRequired}
                    value={answer?.value ?? ""}
                    onChange={(event) =>
                      setAnswer(field.id, { value: event.target.value })
                    }
                  />
                )}
              </div>
            );
          })}
        </section>
      ))}

      {!isPreview && (
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          Submit onboarding form
        </Button>
      )}

      {isPreview && (
        <p className="rounded-md bg-muted px-4 py-3 text-xs text-muted-foreground">
          Preview mode — answers are not saved. Conditional questions appear and
          disappear exactly as they will for the client.
        </p>
      )}
    </form>
  );
}
