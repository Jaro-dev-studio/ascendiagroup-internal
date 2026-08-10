"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  createSequenceStep,
  updateSequenceStep,
} from "@/lib/actions/sequences";
import { SEQUENCE_VARIABLES } from "@/constants/sequences";
import type { SequenceStepView } from "@/lib/fetchers/sequences";

const stepSchema = z.object({
  delayDays: z.coerce.number().int().min(0).max(90),
  delayHours: z.coerce.number().int().min(0).max(23),
  subject: z.string().min(1, "Give the step a subject"),
  bodyHtml: z.string().min(1, "Write the email body"),
  sendInThread: z.boolean(),
});

type StepFormData = z.infer<typeof stepSchema>;

interface SequenceStepModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sequenceId: string;
  step?: SequenceStepView | null;
  /** Order the step will take, used to explain first-step behaviour. */
  nextOrder: number;
}

export function SequenceStepModal({
  isOpen,
  onClose,
  onSuccess,
  sequenceId,
  step,
  nextOrder,
}: SequenceStepModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const isEditing = Boolean(step);
  const order = step?.order ?? nextOrder;
  const isFirstStep = order === 1;

  const form = useForm<StepFormData>({
    resolver: zodResolver(stepSchema),
    defaultValues: {
      delayDays: 0,
      delayHours: 0,
      subject: "",
      bodyHtml: "",
      sendInThread: true,
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    form.reset({
      delayDays: step?.delayDays ?? (isFirstStep ? 0 : 3),
      delayHours: step?.delayHours ?? 0,
      subject: step?.subject ?? "",
      bodyHtml: step?.bodyHtml ?? "",
      sendInThread: step?.sendInThread ?? !isFirstStep,
    });
    setError(null);
  }, [isOpen, step, form, isFirstStep]);

  /** Inserts a merge tag at the caret so the editor stays keyboard-friendly. */
  const insertVariable = (token: string) => {
    const textarea = bodyRef.current;
    const current = form.getValues("bodyHtml");

    if (!textarea) {
      form.setValue("bodyHtml", `${current}${token}`);
      return;
    }

    const start = textarea.selectionStart ?? current.length;
    const end = textarea.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;

    form.setValue("bodyHtml", next, { shouldDirty: true });

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const onSubmit = async (data: StepFormData) => {
    setIsLoading(true);
    setError(null);

    const payload = {
      delayDays: data.delayDays,
      delayHours: data.delayHours,
      subject: data.subject,
      bodyHtml: data.bodyHtml,
      sendInThread: isFirstStep ? false : data.sendInThread,
    };

    const result = step
      ? await updateSequenceStep(step.id, payload)
      : await createSequenceStep(sequenceId, payload);

    setIsLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? `Edit step ${order}` : `Add step ${order}`}
          </DialogTitle>
          <DialogDescription>
            {isFirstStep
              ? "The first step starts the conversation, so it always opens a new thread."
              : "The delay is measured from the previous step's send, then clamped into the sequence's send window."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="delayDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wait days</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={90} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="delayHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wait hours</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={23} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Quick thought on {{companyName}}"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bodyHtml"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={12}
                      placeholder={
                        "<p>Hi {{firstName|there}},</p>\n<p>...</p>\n<p>{{senderFirstName}}</p>"
                      }
                      {...field}
                      ref={(element) => {
                        field.ref(element);
                        bodyRef.current = element;
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Basic HTML. A plain-text version is generated automatically,
                    and the unsubscribe footer is appended on send.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-secondary-900">
                Insert a variable
              </p>
              <div className="flex flex-row flex-wrap gap-2">
                {SEQUENCE_VARIABLES.map((variable) => (
                  <Button
                    key={variable.token}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(variable.token)}
                    title={variable.description}
                  >
                    {variable.token}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-secondary-400">
                Add a fallback with a pipe, e.g. {"{{firstName|there}}"}.
              </p>
            </div>

            {!isFirstStep && (
              <FormField
                control={form.control}
                name="sendInThread"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-border p-3">
                      <div>
                        <FormLabel>Reply in the same thread</FormLabel>
                        <FormDescription>
                          Keeps the follow-up in the existing conversation
                          instead of starting a new one.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />
            )}

            {error && <p className="text-sm text-text-danger">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isEditing ? "Save step" : "Add step"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
