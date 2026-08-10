"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Loader2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createSequence,
  testSenderMailbox,
  updateSequence,
} from "@/lib/actions/sequences";
import { CrmCriteriaBuilder } from "@/components/forms/crm-criteria-builder";
import { createFilterGroup } from "@/components/crm-table/utils";
import type { CrmFilterGroup } from "@/components/crm-table/types";
import type { CrmFilterDynamicOptions } from "@/lib/crm/filters/columns";
import { SEQUENCE_TIMEZONES } from "@/constants/sequences";
import type { SequenceDetail } from "@/lib/fetchers/sequences";

const settingsSchema = z.object({
  name: z.string().min(1, "Give the sequence a name"),
  description: z.string().optional(),
  senderEmail: z.string().email("Pick a sending mailbox"),
  senderName: z.string().optional(),
  timezone: z.string().min(1),
  sendWindowStart: z.coerce.number().int().min(0).max(23),
  sendWindowEnd: z.coerce.number().int().min(1).max(24),
  sendOnWeekends: z.boolean(),
  dailySendLimit: z.coerce.number().int().min(1).max(500),
  stopOnReply: z.boolean(),
  stopOnMeetingBooked: z.boolean(),
  trackOpens: z.boolean(),
  trackClicks: z.boolean(),
  autoEnrollEnabled: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface SequenceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sequenceId: string) => void;
  mailboxes: Array<{ email: string; name: string }>;
  sequence?: SequenceDetail | null;
  filterOptions?: CrmFilterDynamicOptions;
}

export function SequenceSettingsModal({
  isOpen,
  onClose,
  onSuccess,
  mailboxes,
  sequence,
  filterOptions,
}: SequenceSettingsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailboxCheck, setMailboxCheck] = useState<string | null>(null);
  const [isCheckingMailbox, setIsCheckingMailbox] = useState(false);
  // Held outside react-hook-form: the criteria are trees, not field values
  const [entryFilters, setEntryFilters] = useState<CrmFilterGroup>(
    createFilterGroup
  );
  const [exitFilters, setExitFilters] = useState<CrmFilterGroup>(
    createFilterGroup
  );
  const isEditing = Boolean(sequence);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      name: "",
      description: "",
      senderEmail: mailboxes[0]?.email ?? "",
      senderName: "",
      timezone: "Europe/London",
      sendWindowStart: 9,
      sendWindowEnd: 17,
      sendOnWeekends: false,
      dailySendLimit: 50,
      stopOnReply: true,
      stopOnMeetingBooked: true,
      trackOpens: false,
      trackClicks: false,
      autoEnrollEnabled: false,
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    form.reset({
      name: sequence?.name ?? "",
      description: sequence?.description ?? "",
      senderEmail: sequence?.senderEmail ?? mailboxes[0]?.email ?? "",
      senderName: sequence?.senderName ?? "",
      timezone: sequence?.timezone ?? "Europe/London",
      sendWindowStart: sequence?.sendWindowStart ?? 9,
      sendWindowEnd: sequence?.sendWindowEnd ?? 17,
      sendOnWeekends: sequence?.sendOnWeekends ?? false,
      dailySendLimit: sequence?.dailySendLimit ?? 50,
      stopOnReply: sequence?.stopOnReply ?? true,
      stopOnMeetingBooked: sequence?.stopOnMeetingBooked ?? true,
      trackOpens: sequence?.trackOpens ?? false,
      trackClicks: sequence?.trackClicks ?? false,
      autoEnrollEnabled: sequence?.autoEnrollEnabled ?? false,
    });
    setEntryFilters(sequence?.entryFilters ?? createFilterGroup());
    setExitFilters(sequence?.exitFilters ?? createFilterGroup());
    setError(null);
    setMailboxCheck(null);
  }, [isOpen, sequence, mailboxes, form]);

  const handleTestMailbox = async () => {
    const email = form.getValues("senderEmail");
    if (!email) return;

    setIsCheckingMailbox(true);
    const result = await testSenderMailbox(email);
    setIsCheckingMailbox(false);
    setMailboxCheck(
      result.data ? `Verified ${result.data.emailAddress}` : (result.error ?? "Failed")
    );
  };

  const onSubmit = async (data: SettingsFormData) => {
    setIsLoading(true);
    setError(null);

    const payload = {
      name: data.name,
      description: data.description || null,
      senderEmail: data.senderEmail,
      senderName: data.senderName || null,
      timezone: data.timezone,
      sendWindowStart: data.sendWindowStart,
      sendWindowEnd: data.sendWindowEnd,
      sendOnWeekends: data.sendOnWeekends,
      dailySendLimit: data.dailySendLimit,
      stopOnReply: data.stopOnReply,
      stopOnMeetingBooked: data.stopOnMeetingBooked,
      trackOpens: data.trackOpens,
      trackClicks: data.trackClicks,
      autoEnrollEnabled: data.autoEnrollEnabled,
      entryFilters,
      exitFilters,
    };

    const result = sequence
      ? await updateSequence(sequence.id, payload)
      : await createSequence(payload);

    setIsLoading(false);

    if (result.error || !result.data) {
      setError(result.error ?? "Failed to save sequence");
      return;
    }

    onSuccess(result.data.id);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Sequence settings" : "New sequence"}
          </DialogTitle>
          <DialogDescription>
            Emails send from a real @jaro.dev mailbox, so replies land in that
            inbox and follow-ups thread onto the same conversation.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="MVP enquiry follow-up" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Who this is for and what it is trying to achieve"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="senderEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Send from</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick a mailbox" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mailboxes.map((mailbox) => (
                          <SelectItem key={mailbox.email} value={mailbox.email}>
                            {mailbox.name} ({mailbox.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="senderName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jaro Bakker" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-row items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestMailbox}
                disabled={isCheckingMailbox}
                className="gap-2"
              >
                {isCheckingMailbox ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Test mailbox
              </Button>
              {mailboxCheck && (
                <span className="text-sm text-secondary-500">{mailboxCheck}</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SEQUENCE_TIMEZONES.map((timezone) => (
                          <SelectItem key={timezone} value={timezone}>
                            {timezone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dailySendLimit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Daily send limit</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={500} {...field} />
                    </FormControl>
                    <FormDescription>
                      Across the whole sequence, per day.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="sendWindowStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Send window opens</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={23} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sendWindowEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Send window closes</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={24} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <ToggleRow
              control={form.control}
              name="sendOnWeekends"
              label="Send at weekends"
              description="Off keeps outbound to weekdays only."
            />
            <ToggleRow
              control={form.control}
              name="stopOnReply"
              label="Stop on reply"
              description="Ends the sequence as soon as the contact answers."
            />
            <ToggleRow
              control={form.control}
              name="stopOnMeetingBooked"
              label="Stop when a meeting is booked"
              description="Ends the sequence as soon as a meeting with the contact appears on a team calendar."
            />
            <ToggleRow
              control={form.control}
              name="trackOpens"
              label="Track opens"
              description="Adds a tracking pixel. Measurably hurts inbox placement, so leave off unless you need the data."
            />
            <ToggleRow
              control={form.control}
              name="trackClicks"
              label="Track clicks"
              description="Rewrites links through a redirect. Same trade-off as open tracking."
            />
            <div className="flex flex-col gap-2">
              <FormLabel>Entry criteria</FormLabel>
              <FormDescription>
                Who belongs in this sequence, matched against the contact, their
                company and their deals. Group conditions to mix and with or.
              </FormDescription>
              <CrmCriteriaBuilder
                mode="entry"
                value={entryFilters}
                onChange={setEntryFilters}
                filterOptions={filterOptions}
                sequenceId={sequence?.id ?? null}
                excludeFilters={exitFilters}
              />
            </div>

            <ToggleRow
              control={form.control}
              name="autoEnrollEnabled"
              label="Auto-enroll matching contacts"
              description="Enrolls anyone who starts matching the entry criteria, checked every few minutes."
            />

            <div className="flex flex-col gap-2">
              <FormLabel>Exit criteria</FormLabel>
              <FormDescription>
                Anyone in the sequence who starts matching this is stopped, and
                contacts already matching it are never enrolled.
              </FormDescription>
              <CrmCriteriaBuilder
                mode="exit"
                value={exitFilters}
                onChange={setExitFilters}
                filterOptions={filterOptions}
                sequenceId={sequence?.id ?? null}
              />
            </div>

            {error && <p className="text-sm text-text-danger">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isEditing ? "Save settings" : "Create sequence"}
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

type ToggleName =
  | "sendOnWeekends"
  | "stopOnReply"
  | "stopOnMeetingBooked"
  | "trackOpens"
  | "trackClicks"
  | "autoEnrollEnabled";

function ToggleRow({
  control,
  name,
  label,
  description,
}: {
  control: ReturnType<typeof useForm<SettingsFormData>>["control"];
  name: ToggleName;
  label: string;
  description: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <FormLabel>{label}</FormLabel>
              <FormDescription>{description}</FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </div>
        </FormItem>
      )}
    />
  );
}
