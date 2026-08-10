"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { UserRole } from "@prisma/client";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPassword, updateOwnProfile } from "@/lib/actions/team";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/role-labels";

export function ProfileClient({
  user,
}: {
  user: {
    name: string;
    email: string;
    jobTitle: string;
    phone: string;
    role: UserRole;
  };
}) {
  const [profile, setProfile] = useState({
    name: user.name,
    jobTitle: user.jobTitle,
    phone: user.phone,
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  async function onSaveProfile(event: React.FormEvent) {
    event.preventDefault();
    setIsSavingProfile(true);

    try {
      const { error } = await updateOwnProfile(profile);
      if (error) toast.error(error);
      else toast.success("Profile saved.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function onChangePassword(event: React.FormEvent) {
    event.preventDefault();
    setIsSavingPassword(true);

    try {
      const { error } = await changeOwnPassword(passwords);
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Password updated.");
      setPasswords({ currentPassword: "", newPassword: "" });
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your profile"
        description="Update how you appear across the workspace and change your password."
      />

      <div className="grid max-w-4xl grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSaveProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={profile.name}
                  onChange={(event) =>
                    setProfile({ ...profile, name: event.target.value })
                  }
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user.email} disabled />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="jobTitle">Job title</Label>
                <Input
                  id="jobTitle"
                  value={profile.jobTitle}
                  onChange={(event) =>
                    setProfile({ ...profile, jobTitle: event.target.value })
                  }
                  placeholder="Account manager"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={profile.phone}
                  onChange={(event) =>
                    setProfile({ ...profile, phone: event.target.value })
                  }
                />
              </div>

              <div>
                <Button type="submit" disabled={isSavingProfile}>
                  {isSavingProfile && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Save profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onChangePassword} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwords.currentPassword}
                    onChange={(event) =>
                      setPasswords({
                        ...passwords,
                        currentPassword: event.target.value,
                      })
                    }
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwords.newPassword}
                    onChange={(event) =>
                      setPasswords({
                        ...passwords,
                        newPassword: event.target.value,
                      })
                    }
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div>
                  <Button type="submit" disabled={isSavingPassword}>
                    {isSavingPassword && (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    )}
                    Update password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your access</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium text-secondary-900">
                {ROLE_LABELS[user.role]}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {ROLE_DESCRIPTIONS[user.role]}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
