"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOwnerAccount } from "@/lib/actions/auth";

const HIGHLIGHTS = [
  "Conditional intake forms that branch by package and service",
  "Claude-generated 30/60/90 day roadmaps from calls and forms",
  "One knowledge base per practice, fed by calls and WhatsApp",
];

export function AuthClient({ needsSetup }: { needsSetup: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "setup">(
    needsSetup ? "setup" : "signin"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSignIn(emailValue: string, passwordValue: string) {
    const result = await signIn("credentials", {
      email: emailValue,
      password: passwordValue,
      redirect: false,
    });

    if (result?.error) {
      toast.error("Those credentials did not match an active account.");
      return false;
    }

    router.refresh();
    router.push("/dashboard");
    return true;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === "setup") {
        const { error } = await createOwnerAccount({ name, email, password });
        if (error) {
          toast.error(error);
          return;
        }
        toast.success("Workspace created. Signing you in...");
      }

      await handleSignIn(email, password);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          <Logo className="mb-8" />

          <h1 className="text-2xl font-semibold tracking-tight text-secondary-900">
            {mode === "setup" ? "Set up your workspace" : "Sign in"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "setup"
              ? "Create the owner account to start onboarding practices."
              : "Use your Ascendiagroup account to access the delivery workspace."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
            {mode === "setup" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Katie Bennett"
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@ascendiagroup.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "setup" ? "At least 8 characters" : "••••••••"}
                autoComplete={
                  mode === "setup" ? "new-password" : "current-password"
                }
                required
              />
            </div>

            <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {mode === "setup" ? "Create workspace" : "Sign in"}
              {!isSubmitting && <ArrowRight className="ml-2 size-4" />}
            </Button>
          </form>

          {needsSetup && mode === "signin" && (
            <button
              type="button"
              onClick={() => setMode("setup")}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Set up the first account instead
            </button>
          )}

          {!needsSetup && (
            <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
              Accounts are created by an owner or admin from Settings, Team.
              Clients receive their own portal link by email.
            </p>
          )}
        </motion.div>
      </section>

      <section className="hidden flex-1 flex-col justify-center bg-secondary-900 px-12 py-16 text-white lg:flex">
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-primary-300">
            Delivery operating system
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight">
            From signed contract to a scaffolded 90 day plan, without the manual
            handover.
          </h2>
          <ul className="mt-8 flex flex-col gap-4">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span className="text-secondary-200">{highlight}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </section>
    </main>
  );
}
