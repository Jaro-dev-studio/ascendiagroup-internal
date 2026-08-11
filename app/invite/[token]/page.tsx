import { Logo } from "@/components/logo";
import prisma from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/role-labels";

import { AcceptInviteClient } from "./client";

export const metadata = { title: "Accept invite" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.teamInvite.findUnique({
    where: { token },
    include: { invitedBy: { select: { name: true, email: true } } },
  });

  const isValid =
    invite && !invite.acceptedAt && !invite.revokedAt && invite.expiresAt > new Date();

  if (!isValid) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-card">
          <Logo className="justify-center" />
          <h1 className="mt-6 text-lg font-semibold text-secondary-900">
            This invite is no longer valid
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            It may have expired or already been used. Ask an admin to send a new
            one.
          </p>
        </div>
      </main>
    );
  }

  return (
    <AcceptInviteClient
      token={token}
      email={invite.email}
      roleLabel={ROLE_LABELS[invite.role]}
      message={invite.message}
      invitedBy={invite.invitedBy.name ?? invite.invitedBy.email}
    />
  );
}
