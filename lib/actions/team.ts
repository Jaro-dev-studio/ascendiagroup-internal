"use server";

import bcrypt from "bcryptjs";
import { createId } from "@paralleldrive/cuid2";
import { revalidatePath } from "next/cache";
import type { UserRole } from "@prisma/client";

import prisma from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";
import { addDays } from "@/lib/utils";

export async function inviteTeamMember(input: {
  email: string;
  role: string;
  message?: string;
}): Promise<{ data: { token: string } | null; error: string | null }> {
  try {
    const user = await requireAdmin();
    console.log(`[Team] inviting ${input.email} as ${input.role}...`);

    const email = input.email.toLowerCase().trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { data: null, error: "Enter a valid email address." };
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return { data: null, error: "That email already has an account." };
    }

    const pendingInvite = await prisma.teamInvite.findFirst({
      where: { email, acceptedAt: null, revokedAt: null },
    });
    if (pendingInvite) {
      return {
        data: null,
        error: "There is already a pending invite for that email.",
      };
    }

    const invite = await prisma.teamInvite.create({
      data: {
        email,
        role: input.role as UserRole,
        token: createId(),
        message: input.message || null,
        invitedById: user.id,
        expiresAt: addDays(new Date(), 14),
      },
    });

    revalidatePath("/dashboard/team");
    return { data: { token: invite.token }, error: null };
  } catch (error) {
    console.error("[Team] failed to create invite", error);
    return { data: null, error: "Could not create the invite." };
  }
}

export async function revokeInvite(
  id: string
): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    await requireAdmin();
    await prisma.teamInvite.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    revalidatePath("/dashboard/team");
    return { data: { id }, error: null };
  } catch (error) {
    console.error("[Team] failed to revoke invite", error);
    return { data: null, error: "Could not revoke the invite." };
  }
}

export async function updateTeamMember(input: {
  id: string;
  role: string;
  isActive: boolean;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const admin = await requireAdmin();
    console.log(`[Team] updating member ${input.id}...`);

    if (input.id === admin.id && input.role !== admin.role) {
      return { data: null, error: "You cannot change your own role." };
    }

    const target = await prisma.user.findUnique({ where: { id: input.id } });
    if (!target) return { data: null, error: "Team member not found." };

    if (target.role === "OWNER" && admin.role !== "OWNER") {
      return { data: null, error: "Only an owner can change the owner account." };
    }

    await prisma.user.update({
      where: { id: input.id },
      data: { role: input.role as UserRole, isActive: input.isActive },
    });

    revalidatePath("/dashboard/team");
    return { data: { id: input.id }, error: null };
  } catch (error) {
    console.error("[Team] failed to update member", error);
    return { data: null, error: "Could not update the team member." };
  }
}

export async function updateOwnProfile(input: {
  name: string;
  jobTitle?: string;
  phone?: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const user = await requireUser();

    if (input.name.trim().length < 2) {
      return { data: null, error: "Enter your full name." };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: input.name.trim(),
        jobTitle: input.jobTitle || null,
        phone: input.phone || null,
      },
    });

    revalidatePath("/dashboard/profile");
    return { data: { id: user.id }, error: null };
  } catch (error) {
    console.error("[Team] failed to update profile", error);
    return { data: null, error: "Could not save your profile." };
  }
}

export async function changeOwnPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ data: { id: string } | null; error: string | null }> {
  try {
    const user = await requireUser();
    console.log("[Team] password change requested...");

    const isValid = await bcrypt.compare(input.currentPassword, user.password);
    if (!isValid) {
      return { data: null, error: "Your current password is not correct." };
    }
    if (input.newPassword.length < 8) {
      return { data: null, error: "Use at least 8 characters." };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(input.newPassword, 10) },
    });

    return { data: { id: user.id }, error: null };
  } catch (error) {
    console.error("[Team] failed to change password", error);
    return { data: null, error: "Could not change your password." };
  }
}
