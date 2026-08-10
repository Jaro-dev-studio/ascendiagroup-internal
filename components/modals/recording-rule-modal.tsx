"use client";

import { useEffect, useState } from "react";
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
  createRecordingRule,
  updateRecordingRule,
} from "@/lib/actions/recording-rules";
import type { RecordingRuleView } from "@/lib/fetchers/recording-rules";

const CUSTOM = "__custom__";

const ruleSchema = z.object({
  calendarEmail: z.string().email("Enter a valid calendar address"),
  userId: z.string().optional(),
  enabled: z.boolean(),
  requireExternalAttendee: z.boolean(),
  skipAllDayEvents: z.boolean(),
  onlyIfOrganizer: z.boolean(),
  minAttendees: z.coerce.number().int().min(1).max(50),
  joinMinutesBefore: z.coerce.number().int().min(0).max(30),
  botName: z.string().min(1, "Give the bot a name"),
  titleIncludes: z.string().optional(),
  titleExcludes: z.string().optional(),
});

type RuleFormData = z.infer<typeof ruleSchema>;

interface RecordingRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  mailboxes: Array<{ userId: string; email: string; name: string }>;
  rule?: RecordingRuleView | null;
  workspaceDomain: string;
}

function splitPatterns(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function RecordingRuleModal({
  isOpen,
  onClose,
  onSuccess,
  mailboxes,
  rule,
  workspaceDomain,
}: RecordingRuleModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mailboxChoice, setMailboxChoice] = useState<string>(CUSTOM);
  const isEditing = Boolean(rule);

  const form = useForm<RuleFormData>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      calendarEmail: "",
      userId: "",
      enabled: true,
      requireExternalAttendee: true,
      skipAllDayEvents: true,
      onlyIfOrganizer: false,
      minAttendees: 2,
      joinMinutesBefore: 2,
      botName: "Jaro.dev Notetaker",
      titleIncludes: "",
      titleExcludes: "",
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    form.reset({
      calendarEmail: rule?.calendarEmail ?? "",
      userId: rule?.userId ?? "",
      enabled: rule?.enabled ?? true,
      requireExternalAttendee: rule?.requireExternalAttendee ?? true,
      skipAllDayEvents: rule?.skipAllDayEvents ?? true,
      onlyIfOrganizer: rule?.onlyIfOrganizer ?? false,
      minAttendees: rule?.minAttendees ?? 2,
      joinMinutesBefore: rule?.joinMinutesBefore ?? 2,
      botName: rule?.botName ?? "Jaro.dev Notetaker",
      titleIncludes: (rule?.titleIncludes ?? []).join(", "),
      titleExcludes: (rule?.titleExcludes ?? []).join(", "),
    });

    const matched = mailboxes.find(
      (mailbox) => mailbox.email === rule?.calendarEmail
    );
    setMailboxChoice(matched ? matched.email : CUSTOM);
    setError(null);
  }, [isOpen, rule, form, mailboxes]);

  const handleMailboxChange = (value: string) => {
    setMailboxChoice(value);
    if (value === CUSTOM) return;

    const mailbox = mailboxes.find((entry) => entry.email === value);
    if (!mailbox) return;

    form.setValue("calendarEmail", mailbox.email);
    form.setValue("userId", mailbox.userId);
  };

  const onSubmit = async (data: RuleFormData) => {
    setIsLoading(true);
    setError(null);

    const payload = {
      calendarEmail: data.calendarEmail,
      userId: data.userId || null,
      enabled: data.enabled,
      requireExternalAttendee: data.requireExternalAttendee,
      skipAllDayEvents: data.skipAllDayEvents,
      onlyIfOrganizer: data.onlyIfOrganizer,
      minAttendees: data.minAttendees,
      joinMinutesBefore: data.joinMinutesBefore,
      botName: data.botName,
      titleIncludes: splitPatterns(data.titleIncludes),
      titleExcludes: splitPatterns(data.titleExcludes),
    };

    const result = rule
      ? await updateRecordingRule(rule.id, payload)
      : await createRecordingRule(payload);

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit recording rule" : "Record a calendar"}
          </DialogTitle>
          <DialogDescription>
            The notetaker joins meetings on this calendar whenever every
            condition below is met.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            {!isEditing && mailboxes.length > 0 && (
              <FormItem>
                <FormLabel>Team member</FormLabel>
                <Select value={mailboxChoice} onValueChange={handleMailboxChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a mailbox" />
                  </SelectTrigger>
                  <SelectContent>
                    {mailboxes.map((mailbox) => (
                      <SelectItem key={mailbox.email} value={mailbox.email}>
                        {mailbox.name} ({mailbox.email})
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM}>Another calendar</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}

            <FormField
              control={form.control}
              name="calendarEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Calendar address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={`jaro@${workspaceDomain}`}
                      disabled={isEditing}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Must be a @{workspaceDomain} Workspace mailbox.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <FormLabel>Recording enabled</FormLabel>
                      <FormDescription>
                        Turn off to stop scheduling new bots for this calendar.
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

            <FormField
              control={form.control}
              name="requireExternalAttendee"
              render={({ field }) => (
                <FormItem>
                  <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <FormLabel>Only external meetings</FormLabel>
                      <FormDescription>
                        Skip internal-only calls with no guest outside the team.
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="skipAllDayEvents"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                      <FormLabel>Skip all-day events</FormLabel>
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
              <FormField
                control={form.control}
                name="onlyIfOrganizer"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                      <FormLabel>Only if organiser</FormLabel>
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
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="minAttendees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum attendees</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={50} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="joinMinutesBefore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Join minutes early</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={30} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="botName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bot name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jaro.dev Notetaker" {...field} />
                  </FormControl>
                  <FormDescription>
                    How the notetaker appears in the participant list.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="titleIncludes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title must contain</FormLabel>
                  <FormControl>
                    <Input placeholder="demo, discovery, intro" {...field} />
                  </FormControl>
                  <FormDescription>
                    Comma separated. Leave empty to record every matching
                    meeting.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="titleExcludes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Never record if title contains</FormLabel>
                  <FormControl>
                    <Input placeholder="1:1, standup, personal" {...field} />
                  </FormControl>
                  <FormDescription>Comma separated.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && <p className="text-sm text-text-danger">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isEditing ? "Save changes" : "Create rule"}
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
