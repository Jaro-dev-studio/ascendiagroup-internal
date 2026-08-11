"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CircleCheckBig, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  OnboardingFormRenderer,
  type RenderableField,
} from "@/components/forms/onboarding-form-renderer";
import { Logo } from "@/components/logo";
import { submitOnboardingForm } from "@/lib/actions/onboarding";

interface PublicOnboardingClientProps {
  token: string;
  formName: string;
  intro: string | null;
  isComplete: boolean;
  fields: RenderableField[];
  defaults: {
    practiceName: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  };
}

export function PublicOnboardingClient({
  token,
  formName,
  intro,
  isComplete,
  fields,
  defaults,
}: PublicOnboardingClientProps) {
  const [isDone, setIsDone] = useState(isComplete);

  async function onSubmit(payload: {
    practiceName: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    answers: { fieldId: string; value?: string; values?: string[] }[];
  }) {
    const { error } = await submitOnboardingForm({ token, ...payload });

    if (error) {
      toast.error(error);
      return;
    }

    setIsDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo />
          <span className="text-xs text-muted-foreground">Client onboarding</span>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8">
        {isDone ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-border bg-card p-8 text-center shadow-card"
          >
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-50 text-accent-600">
              <CircleCheckBig className="size-6" />
            </span>
            <h1 className="mt-5 text-xl font-semibold text-secondary-900">
              Thank you — we have everything we need
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Your answers have been sent to your account manager. They will build
              your 90 day plan and be in touch with next steps.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-8"
          >
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-secondary-900">
                {formName}
              </h1>
              {intro && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {intro}
                </p>
              )}
              <p className="mt-4 flex items-start gap-2 rounded-md bg-muted px-4 py-3 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                Anything marked as a credential is stored securely and only shown to
                your delivery team.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-card sm:p-8">
              {fields.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  This form has no questions yet. Please contact your account
                  manager.
                </p>
              ) : (
                <OnboardingFormRenderer
                  fields={fields}
                  defaults={defaults}
                  onSubmit={onSubmit}
                />
              )}
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}
