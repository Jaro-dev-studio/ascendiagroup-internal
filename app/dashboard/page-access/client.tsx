"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  setRolePageAccess,
  setUserPageAccess,
  setUserPageAccessBulk,
  syncPagesAction,
} from "@/lib/actions/page-access";
import type {
  PageAccessGroup,
  PageAccessUser,
  RoleAccessGroup,
} from "@/lib/fetchers/page-access";

type EditableRole = "DEVELOPER" | "CLIENT";

interface PageAccessClientProps {
  users: PageAccessUser[];
  selectedUserId: string | null;
  userAccess: PageAccessGroup[];
  roleAccess: RoleAccessGroup[];
}

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  DEVELOPER: "Developer",
  CLIENT: "Client",
};

function userDisplayName(user: PageAccessUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.email;
}

export function PageAccessClient({
  users,
  selectedUserId,
  userAccess,
  roleAccess,
}: PageAccessClientProps) {
  const router = useRouter();
  const [isSyncing, startSync] = useTransition();
  const [userGroups, setUserGroups] = useState(userAccess);
  const [roleGroups, setRoleGroups] = useState(roleAccess);

  useEffect(() => setUserGroups(userAccess), [userAccess]);
  useEffect(() => setRoleGroups(roleAccess), [roleAccess]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) || null,
    [users, selectedUserId]
  );

  const overrideCount = useMemo(
    () =>
      userGroups.reduce(
        (total, group) =>
          total + group.pages.filter((page) => page.override !== null).length,
        0
      ),
    [userGroups]
  );

  const handleSync = () => {
    startSync(async () => {
      const { data, error } = await syncPagesAction();
      if (error || !data) {
        toast.error(error || "Failed to sync pages");
        return;
      }
      toast.success(
        data.skipped
          ? "Pages are already up to date"
          : `Synced pages: ${data.created} added, ${data.deactivated} removed`
      );
      router.refresh();
    });
  };

  const selectUser = (userId: string) => {
    router.push(`/dashboard/page-access?userId=${userId}`);
  };

  const updateUserPage = (pageId: string, override: boolean | null) => {
    const previous = userGroups;

    setUserGroups((groups) =>
      groups.map((group) => ({
        ...group,
        pages: group.pages.map((page) =>
          page.pageId === pageId
            ? { ...page, override, effective: override ?? page.roleDefault }
            : page
        ),
      }))
    );

    if (!selectedUserId) return;

    void setUserPageAccess(selectedUserId, pageId, override).then(({ error }) => {
      if (error) {
        setUserGroups(previous);
        toast.error(error);
        return;
      }
      router.refresh();
    });
  };

  const updateGroupForUser = (groupName: string, allowed: boolean) => {
    if (!selectedUserId) return;

    const group = userGroups.find((entry) => entry.group === groupName);
    if (!group) return;

    const previous = userGroups;
    const updates = group.pages
      .filter((page) => page.effective !== allowed)
      .map((page) => ({
        pageId: page.pageId,
        allowed: page.roleDefault === allowed ? null : allowed,
      }));

    if (updates.length === 0) return;

    const updateByPageId = new Map(
      updates.map((update) => [update.pageId, update.allowed])
    );

    setUserGroups((groups) =>
      groups.map((entry) =>
        entry.group === groupName
          ? {
            ...entry,
            pages: entry.pages.map((page) =>
              updateByPageId.has(page.pageId)
                ? {
                  ...page,
                  override: updateByPageId.get(page.pageId) ?? null,
                  effective: allowed,
                }
                : page
            ),
          }
          : entry
      )
    );

    void setUserPageAccessBulk(selectedUserId, updates).then(({ error }) => {
      if (error) {
        setUserGroups(previous);
        toast.error(error);
        return;
      }
      router.refresh();
    });
  };

  const updateRolePage = (
    role: EditableRole,
    pageId: string,
    enabled: boolean
  ) => {
    const previous = roleGroups;

    setRoleGroups((groups) =>
      groups.map((group) => ({
        ...group,
        pages: group.pages.map((page) =>
          page.pageId === pageId
            ? { ...page, roles: { ...page.roles, [role]: enabled } }
            : page
        ),
      }))
    );

    void setRolePageAccess(role, pageId, enabled).then(({ error }) => {
      if (error) {
        setRoleGroups(previous);
        toast.error(error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-secondary-900">
            <ShieldCheck className="size-6 text-primary-500" />
            Page Access
          </h1>
          <p className="mt-1 text-sm text-secondary-500">
            Choose which pages each user can reach. Admins always have access to
            everything.
          </p>
        </div>
        <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
          <RefreshCw className={cn("mr-2 size-4", isSyncing && "animate-spin")} />
          {isSyncing ? "Syncing..." : "Sync pages"}
        </Button>
      </div>

      <Tabs defaultValue="user">
        <TabsList>
          <TabsTrigger value="user">By user</TabsTrigger>
          <TabsTrigger value="role">Role defaults</TabsTrigger>
        </TabsList>

        <TabsContent value="user">
          {users.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-secondary-500">
                  There are no non-admin users yet. Create one from the Users page
                  to manage its page access.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row">
              <Card className="lg:w-72 lg:shrink-0">
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-secondary-400">
                    Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto">
                    {users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => selectUser(user.id)}
                        className={cn(
                          "flex flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition-colors",
                          user.id === selectedUserId
                            ? "bg-primary-50 text-primary-700"
                            : "text-secondary-600 hover:bg-secondary-50"
                        )}
                      >
                        <span className="text-sm font-medium">
                          {userDisplayName(user)}
                        </span>
                        <span className="flex items-center gap-2 text-xs text-secondary-400">
                          {roleLabels[user.role] || user.role}
                          {user.overrideCount > 0 && (
                            <span>{user.overrideCount} custom</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-1 flex-col gap-4">
                {selectedUser && (
                  <Card>
                    <CardContent className="flex flex-col gap-1 pt-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-secondary-900">
                          {userDisplayName(selectedUser)}
                        </span>
                        <Badge variant="secondary">
                          {roleLabels[selectedUser.role] || selectedUser.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-secondary-500">
                        {selectedUser.email}
                      </p>
                      <p className="text-sm text-secondary-500">
                        {overrideCount === 0
                          ? "Using the role defaults for every page."
                          : `${overrideCount} page${overrideCount === 1 ? "" : "s"} differ from the role defaults.`}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {userGroups.map((group) => (
                  <Card key={group.group}>
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-secondary-400">
                          {group.group}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateGroupForUser(group.group, true)}
                          >
                            Allow all
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateGroupForUser(group.group, false)}
                          >
                            Revoke all
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col">
                        {group.pages.map((page) => (
                          <div
                            key={page.pageId}
                            className="flex items-center justify-between gap-3 border-b border-secondary-100 py-2.5 last:border-b-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-secondary-900">
                                {page.label}
                              </p>
                              <p className="truncate text-xs text-secondary-400">
                                {page.path}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {page.override !== null && (
                                <>
                                  <Badge variant="outline">Custom</Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Reset ${page.label} to the role default`}
                                    onClick={() =>
                                      updateUserPage(page.pageId, null)
                                    }
                                  >
                                    <RotateCcw className="size-4" />
                                  </Button>
                                </>
                              )}
                              <Switch
                                checked={page.effective}
                                aria-label={`Access to ${page.label}`}
                                onCheckedChange={(checked) =>
                                  updateUserPage(
                                    page.pageId,
                                    checked === page.roleDefault ? null : checked
                                  )
                                }
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="role">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-secondary-500">
              Role defaults apply to every user with that role unless an admin has
              set a custom value for them.
            </p>

            {roleGroups.map((group) => (
              <Card key={group.group}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-secondary-400">
                      {group.group}
                    </CardTitle>
                    <div className="flex shrink-0 items-center gap-6 text-xs font-medium uppercase tracking-wider text-secondary-400">
                      <span className="w-16 text-center">Developer</span>
                      <span className="w-16 text-center">Client</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col">
                    {group.pages.map((page) => (
                      <div
                        key={page.pageId}
                        className="flex items-center justify-between gap-3 border-b border-secondary-100 py-2.5 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-secondary-900">
                            {page.label}
                          </p>
                          <p className="truncate text-xs text-secondary-400">
                            {page.path}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-6">
                          <div className="flex w-16 justify-center">
                            <Switch
                              checked={page.roles.DEVELOPER}
                              aria-label={`Developer access to ${page.label}`}
                              onCheckedChange={(checked) =>
                                updateRolePage("DEVELOPER", page.pageId, checked)
                              }
                            />
                          </div>
                          <div className="flex w-16 justify-center">
                            <Switch
                              checked={page.roles.CLIENT}
                              aria-label={`Client access to ${page.label}`}
                              onCheckedChange={(checked) =>
                                updateRolePage("CLIENT", page.pageId, checked)
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
