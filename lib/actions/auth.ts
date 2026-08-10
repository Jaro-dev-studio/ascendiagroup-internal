"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";

import prisma from "@/lib/prisma";

const setupSchema = z.object({
  name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export async function createOwnerAccount(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ data: { email: string } | null; error: string | null }> {
  try {
    console.log("[Auth] handling first-run owner account creation...");
    const parsed = setupSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues[0].message };
    }

    const existing = await prisma.user.count();
    if (existing > 0) {
      return {
        data: null,
        error: "This workspace is already set up. Sign in instead.",
      };
    }

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase().trim(),
        password: await bcrypt.hash(parsed.data.password, 10),
        role: "OWNER",
      },
    });

    console.log(`[Auth] owner account created for ${user.email}`);
    return { data: { email: user.email }, error: null };
  } catch (error) {
    console.error("[Auth] failed to create owner account", error);
    return { data: null, error: "Could not create the account. Try again." };
  }
}

export async function acceptInvite(input: {
  token: string;
  name: string;
  password: string;
}): Promise<{ data: { email: string } | null; error: string | null }> {
  try {
    console.log("[Auth] accepting team invite...");

    const invite = await prisma.teamInvite.findUnique({
      where: { token: input.token },
    });

    if (!invite || invite.revokedAt) {
      return { data: null, error: "This invite is no longer valid." };
    }
    if (invite.acceptedAt) {
      return { data: null, error: "This invite has already been used." };
    }
    if (invite.expiresAt < new Date()) {
      return { data: null, error: "This invite has expired." };
    }
    if (input.password.length < 8) {
      return { data: null, error: "Use at least 8 characters for your password." };
    }
    if (input.name.trim().length < 2) {
      return { data: null, error: "Enter your full name." };
    }

    const existing = await prisma.user.findUnique({
      where: { email: invite.email },
    });
    if (existing) {
      return {
        data: null,
        error: "An account already exists for this email. Sign in instead.",
      };
    }

    await prisma.$transaction([
      prisma.user.create({
        data: {
          email: invite.email,
          name: input.name.trim(),
          password: await bcrypt.hash(input.password, 10),
          role: invite.role,
        },
      }),
      prisma.teamInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    console.log(`[Auth] invite accepted by ${invite.email}`);
    return { data: { email: invite.email }, error: null };
  } catch (error) {
    console.error("[Auth] failed to accept invite", error);
    return { data: null, error: "Could not accept the invite. Try again." };
  }
}
