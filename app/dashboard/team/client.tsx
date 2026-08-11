"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Loader2, Mail, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  inviteTeamMember,
  revokeInvite,
  updateTeamMember,
} from "@/lib/actions/team";
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
} from "@/lib/role-labels";
import { formatDate, formatRelative, initials } from "@/lib/utils";

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: string;
  jobTitle: string | null;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  _count: { managedClients: number; assignedTasks: number };
}

interface Invite {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: { name: string | null; email: string };
}

export function TeamClient({
  members,
  invites,
  currentUserId,
}: {
  members: Member[];
  invites: Invite[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteValues, setInviteValues] = useState({
    email: "",
    role: "ACCOUNT_MANAGER",
    message: "",
  });
  const [isInviting, setIsInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function onInvite(event: React.FormEvent) {
    event.preventDefault();
    setIsInviting(true);

    try {
      const { data, error } = await inviteTeamMember(inviteValues);
      if (error || !data) {
        toast.error(error ?? "Something went wrong.");
        return;
      }

      const link = `${window.location.origin}/invite/${data.token}`;
      setInviteLink(link);
      navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success("Invite created and link copied.");
      router.refresh();
    } finally {
      setIsInviting(false);
    }
  }

  function onUpdateMember(member: Member, changes: Partial<Member>) {
    startTransition(async () => {
      const { error } = await updateTeamMember({
        id: member.id,
        role: (changes.role ?? member.role) as string,
        isActive: changes.isActive ?? member.isActive,
      });

      if (error) toast.error(error);
      else {
        toast.success("Team member updated.");
        router.refresh();
      }
    });
  }

  function onRevoke(id: string) {
    startTransition(async () => {
      const { error } = await revokeInvite(id);
      if (error) toast.error(error);
      else {
        toast.success("Invite revoked.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team"
        description="Invite colleagues and control what each role can reach inside the workspace."
        actions={
          <Button onClick={() => setIsInviteOpen(true)}>
            <UserPlus className="mr-2 size-4" />
            Invite member
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col divide-y divide-border">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-xs font-semibold text-secondary-700">
                    {initials(member.name ?? member.email)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-secondary-900">
                      {member.name ?? member.email}
                      {member.id === currentUserId && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          You
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email}
                      {member.jobTitle ? ` · ${member.jobTitle}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {member._count.managedClients} clients ·{" "}
                      {member._count.assignedTasks} tasks ·{" "}
                      {member.lastLogin
                        ? `last seen ${formatRelative(member.lastLogin)}`
                        : "never signed in"}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {member.role === "OWNER" ? (
                    <Badge>Owner</Badge>
                  ) : (
                    <Select
                      value={member.role}
                      disabled={isPending}
                      onValueChange={(value) =>
                        onUpdateMember(member, { role: value })
                      }
                    >
                      <SelectTrigger className="h-9 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={member.isActive}
                      disabled={isPending || member.id === currentUserId}
                      onCheckedChange={(checked) =>
                        onUpdateMember(member, { isActive: checked })
                      }
                    />
                    Active
                  </label>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invites</CardTitle>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No pending invites.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-secondary-900">
                      <Mail className="mr-1.5 inline size-3.5 text-muted-foreground" />
                      {invite.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABELS[invite.role as keyof typeof ROLE_LABELS]} ·
                      invited by {invite.invitedBy.name ?? invite.invitedBy.email} ·
                      expires {formatDate(invite.expiresAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          `${window.location.origin}/invite/${invite.token}`
                        );
                        toast.success("Invite link copied.");
                      }}
                    >
                      <Copy className="mr-1.5 size-3.5" />
                      Copy link
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => onRevoke(invite.id)}
                    >
                      <X className="mr-1.5 size-3.5" />
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What each role can do</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col divide-y divide-border">
            {(Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[]).map(
              (role) => (
                <div key={role} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-6">
                  <dt className="w-full text-sm font-medium text-secondary-900 sm:w-48">
                    {ROLE_LABELS[role]}
                  </dt>
                  <dd className="flex-1 text-sm text-muted-foreground">
                    {ROLE_DESCRIPTIONS[role]}
                  </dd>
                </div>
              )
            )}
          </dl>
        </CardContent>
      </Card>

      <Dialog
        open={isInviteOpen}
        onOpenChange={(open) => {
          setIsInviteOpen(open);
          if (!open) setInviteLink(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              Creates a single-use link they use to set their own password.
            </DialogDescription>
          </DialogHeader>

          {inviteLink ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-xs text-secondary-700">
                  {inviteLink}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Copy invite link"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                    toast.success("Copied.");
                  }}
                >
                  <Copy className="size-4" />
                </Button>
              </div>
              <DialogFooter className="flex-row justify-end gap-2">
                <Button
                  onClick={() => {
                    setInviteLink(null);
                    setInviteValues({
                      email: "",
                      role: "ACCOUNT_MANAGER",
                      message: "",
                    });
                  }}
                >
                  Invite another
                </Button>
                <Button variant="ghost" onClick={() => setIsInviteOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={onInvite} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inviteEmail">Work email</Label>
                <Input
                  id="inviteEmail"
                  type="email"
                  value={inviteValues.email}
                  onChange={(event) =>
                    setInviteValues({ ...inviteValues, email: event.target.value })
                  }
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inviteRole">Role</Label>
                <Select
                  value={inviteValues.role}
                  onValueChange={(value) =>
                    setInviteValues({ ...inviteValues, role: value })
                  }
                >
                  <SelectTrigger id="inviteRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {
                    ROLE_DESCRIPTIONS[
                      inviteValues.role as keyof typeof ROLE_DESCRIPTIONS
                    ]
                  }
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="inviteMessage">Note</Label>
                <Textarea
                  id="inviteMessage"
                  rows={3}
                  value={inviteValues.message}
                  onChange={(event) =>
                    setInviteValues({
                      ...inviteValues,
                      message: event.target.value,
                    })
                  }
                  placeholder="Shown on the invite page."
                />
              </div>

              <DialogFooter className="flex-row justify-end gap-2">
                <Button type="submit" disabled={isInviting}>
                  {isInviting && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Create invite
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsInviteOpen(false)}
                  disabled={isInviting}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
