"use client";

import { useState } from "react";
import { UserRole } from "@prisma/client";
import { Mail, Building2, Shield, Calendar, Save, Loader2, Lock, Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateUserProfile, updateUserPassword } from "@/lib/actions";

interface ProfileUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  clientCompany: {
    id: string;
    name: string;
  } | null;
  createdAt: Date;
}

interface ProfileClientProps {
  user: ProfileUser;
}

export function ProfileClient({ user }: ProfileClientProps) {
  const [firstName, setFirstName] = useState(user.firstName || "");
  const [lastName, setLastName] = useState(user.lastName || "");
  const [savedFirstName, setSavedFirstName] = useState(user.firstName || "");
  const [savedLastName, setSavedLastName] = useState(user.lastName || "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const { data, error } = await updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      if (error) {
        setMessage({ type: "error", text: error });
      } else if (data) {
        // Update saved values so hasChanges works correctly
        setSavedFirstName(data.firstName || "");
        setSavedLastName(data.lastName || "");
        setMessage({ type: "success", text: "Profile updated successfully" });
      }
    } catch {
      setMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    firstName.trim() !== savedFirstName ||
    lastName.trim() !== savedLastName;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPassword(true);
    setPasswordMessage(null);

    // Validation
    if (newPassword.length < 8) {
      setPasswordMessage({ type: "error", text: "New password must be at least 8 characters" });
      setIsSavingPassword(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match" });
      setIsSavingPassword(false);
      return;
    }

    try {
      const { error } = await updateUserPassword({
        currentPassword,
        newPassword,
      });

      if (error) {
        setPasswordMessage({ type: "error", text: error });
      } else {
        setPasswordMessage({ type: "success", text: "Password updated successfully" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setPasswordMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setIsSavingPassword(false);
    }
  };

  const canSubmitPassword = currentPassword && newPassword && confirmPassword && newPassword === confirmPassword;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-secondary-900">Profile Settings</h1>
        <p className="mt-1 text-sm text-secondary-500">
          Manage your account information and preferences
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Forms */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Profile Form */}
          <Card>
            <div className="border-b border-secondary-200 p-4">
              <h2 className="text-base font-medium text-secondary-900">Personal Information</h2>
              <p className="mt-0.5 text-sm text-secondary-500">
              Update your personal details
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Enter your first name"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Enter your last name"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="bg-secondary-50"
                />
                <p className="text-xs text-secondary-500">
                Email cannot be changed
                </p>
              </div>

              {message && (
                <div
                  className={`rounded-md p-3 text-sm ${
                  message.type === "success"
                    ? "bg-success-50 text-success-700"
                    : "bg-danger-50 text-danger-700"
                }`}
                >
                  {message.text}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isSaving || !hasChanges} className="relative">
                  <span className={isSaving ? "opacity-0" : "flex items-center"}>
                    <Save className="mr-2 size-4" />
                  Save Changes
                  </span>
                  {isSaving && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="size-4 animate-spin" />
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </Card>

          {/* Password Section */}
          <Card>
            <div className="border-b border-secondary-200 p-4">
              <h2 className="text-base font-medium text-secondary-900">Change Password</h2>
              <p className="mt-0.5 text-sm text-secondary-500">
              Update your account password
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4 p-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-500 hover:text-secondary-700"
                  >
                    {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-500 hover:text-secondary-700"
                  >
                    {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-xs text-secondary-500">
                Must be at least 8 characters
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-500 hover:text-secondary-700"
                  >
                    {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-danger-500">
                  Passwords do not match
                  </p>
                )}
              </div>

              {passwordMessage && (
                <div
                  className={`rounded-md p-3 text-sm ${
                  passwordMessage.type === "success"
                    ? "bg-success-50 text-success-700"
                    : "bg-danger-50 text-danger-700"
                }`}
                >
                  {passwordMessage.text}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={isSavingPassword || !canSubmitPassword} className="relative">
                  <span className={isSavingPassword ? "opacity-0" : "flex items-center"}>
                    <Lock className="mr-2 size-4" />
                  Update Password
                  </span>
                  {isSavingPassword && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="size-4 animate-spin" />
                    </span>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Account Information */}
        <Card>
          <div className="border-b border-secondary-200 p-4">
            <h2 className="text-base font-medium text-secondary-900">Account Details</h2>
          </div>

          <div className="flex flex-col gap-4 p-4">
            {/* Avatar */}
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary-500 text-lg font-medium text-white">
                {firstName ? firstName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-secondary-900">
                  {firstName && lastName ? `${firstName} ${lastName}` : "No name set"}
                </p>
                <p className="text-sm text-secondary-500">{user.email}</p>
              </div>
            </div>

            <div className="h-px bg-secondary-200" />

            {/* Role */}
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-secondary-100">
                <Shield className="size-4 text-secondary-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-secondary-500">Role</p>
                <Badge variant={user.role === "ADMIN" ? "outline" : "secondary"}>
                  {user.role}
                </Badge>
              </div>
            </div>

            {/* Company (for clients) */}
            {user.clientCompany && (
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-secondary-100">
                  <Building2 className="size-4 text-secondary-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-secondary-500">Company</p>
                  <p className="text-sm font-medium text-secondary-900">
                    {user.clientCompany.name}
                  </p>
                </div>
              </div>
            )}

            {/* Email */}
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-secondary-100">
                <Mail className="size-4 text-secondary-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-secondary-500">Email</p>
                <p className="truncate text-sm font-medium text-secondary-900">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Member Since */}
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-secondary-100">
                <Calendar className="size-4 text-secondary-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-secondary-500">Member Since</p>
                <p className="text-sm font-medium text-secondary-900">
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
