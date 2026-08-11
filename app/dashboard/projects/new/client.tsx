"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createProject } from "@/lib/actions/projects";
import { titleCase } from "@/lib/utils";

const STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"];

export function NewProjectClient({
  clients,
  users,
  defaultClientId,
}: {
  clients: { id: string; name: string }[];
  users: { id: string; name: string | null; email: string }[];
  defaultClientId: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    clientId: defaultClientId,
    name: "",
    description: "",
    status: "ACTIVE",
    dueDate: "",
    ownerId: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const { data, error } = await createProject(values);
      if (error || !data) {
        toast.error(error ?? "Something went wrong.");
        return;
      }

      toast.success("Project created.");
      router.push(`/dashboard/projects/${data.id}`);
    } finally {
      setIsSaving(false);
    }
  }

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Add a client before creating a project.
          </p>
          <Button asChild className="mt-4">
            <a href="/dashboard/clients/new">Add client</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client">Client</Label>
            <Select
              value={values.clientId}
              onValueChange={(value) => setValues({ ...values, clientId: value })}
            >
              <SelectTrigger id="client">
                <SelectValue placeholder="Choose a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Project name</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
              placeholder="Practice onboarding"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              value={values.description}
              onChange={(event) =>
                setValues({ ...values, description: event.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={values.status}
                onValueChange={(value) => setValues({ ...values, status: value })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleCase(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="owner">Owner</Label>
              <Select
                value={values.ownerId || "none"}
                onValueChange={(value) =>
                  setValues({ ...values, ownerId: value === "none" ? "" : value })
                }
              >
                <SelectTrigger id="owner">
                  <SelectValue placeholder="You" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Assign to me</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name ?? user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                value={values.dueDate}
                onChange={(event) =>
                  setValues({ ...values, dueDate: event.target.value })
                }
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create project
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
