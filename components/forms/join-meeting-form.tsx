"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { joinMeetingNow } from "@/lib/actions/recording-rules";

const joinSchema = z.object({
  meetingUrl: z.string().min(1, "Paste a meeting link"),
  title: z.string().optional(),
});

type JoinFormData = z.infer<typeof joinSchema>;

const PLATFORM_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  zoom: "Zoom",
  microsoft_teams: "Teams",
  webex: "Webex",
};

interface JoinMeetingFormProps {
  onJoined: () => void;
  /** Off when Recall is not configured, since no bot could be created. */
  disabled?: boolean;
}

/**
 * Sends the notetaker into a call that is already running, from a pasted link.
 * The recorder normally works off the calendar, so this covers meetings that
 * were never invited: a client dialling in on the spot, or a link shared in
 * chat.
 */
export function JoinMeetingForm({
  onJoined,
  disabled = false,
}: JoinMeetingFormProps) {
  const [isJoining, setIsJoining] = useState(false);
  const [result, setResult] = useState<
    { ok: boolean; message: string } | null
  >(null);

  const form = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
    defaultValues: { meetingUrl: "", title: "" },
  });

  const onSubmit = async (data: JoinFormData) => {
    setIsJoining(true);
    setResult(null);

    const response = await joinMeetingNow({
      meetingUrl: data.meetingUrl,
      title: data.title || null,
    });

    setIsJoining(false);

    if (!response.data) {
      setResult({ ok: false, message: response.error ?? "Failed to join" });
      return;
    }

    const platform =
      PLATFORM_LABELS[response.data.platform] ?? response.data.platform;

    setResult({
      ok: true,
      message: `${response.data.botName} is joining the ${platform} call now. The transcript is imported automatically once the meeting ends.`,
    });
    form.reset({ meetingUrl: "", title: "" });
    onJoined();
  };

  return (
    <Card className="p-5">
      <div className="flex flex-row items-center gap-2">
        <Video className="size-4 text-secondary-400" />
        <h2 className="font-medium text-secondary-900">Join a meeting now</h2>
      </div>
      <p className="mt-1 text-sm text-secondary-500">
        Paste a Google Meet, Zoom, Teams or Webex link and the notetaker joins
        immediately, even if the meeting is not on a watched calendar.
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start"
        >
          <FormField
            control={form.control}
            name="meetingUrl"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="sr-only">Meeting link</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://meet.google.com/abc-defg-hij"
                    autoComplete="off"
                    disabled={disabled || isJoining}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="sm:w-56">
                <FormLabel className="sr-only">Meeting name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Meeting name (optional)"
                    autoComplete="off"
                    disabled={disabled || isJoining}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={disabled || isJoining}
            className="gap-2"
          >
            {isJoining ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Video className="size-4" />
            )}
            Join now
          </Button>
        </form>
      </Form>

      {result && (
        <p
          className={
            result.ok
              ? "mt-3 text-sm text-success-600"
              : "mt-3 text-sm text-danger-600"
          }
        >
          {result.message}
        </p>
      )}
    </Card>
  );
}
