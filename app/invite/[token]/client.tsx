"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvite } from "@/lib/actions/auth";

export function AcceptInviteClient({
  token,
  email,
  roleLabel,
  message,
  invitedBy,
}: {
  token: string;
  email: string;
  roleLabel: string;
  message: string | null;
  invitedBy: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await acceptInvite({ token, name, password });
      if (error) {
        toast.error(error);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Account created. Please sign in.");
        router.push("/");
        return;
      }

      toast.success("Welcome to the team.");
      router.push("/dashboard");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-card"
      >
        <Logo />

        <h1 className="mt-6 text-xl font-semibold tracking-tight text-secondary-900">
          Join the Ascendiagroup workspace
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {invitedBy} invited {email} to join as {roleLabel}.
        </p>

        {message && (
          <p className="mt-4 rounded-md bg-muted px-4 py-3 text-sm text-secondary-700">
            {message}
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Choose a password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create my account
          </Button>
        </form>
      </motion.div>
    </main>
  );
}
