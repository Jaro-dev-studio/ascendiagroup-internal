"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  Rocket,
  Search,
  ChevronRight,
  Building2,
  FileText,
  Loader2,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createMVPCallMap, updateMVPCallMap, deleteMVPCallMap } from "@/lib/actions";
import type { Prisma } from "@prisma/client";

interface MVPCallMapData {
  id: string;
  name: string;
  notes: string | null;
  flowData: Prisma.JsonValue | null;
  configuratorData: Prisma.JsonValue | null;
  clientCompany: {
    id: string;
    name: string;
  } | null;
  formSubmission: {
    id: string;
    name: string;
    email: string;
    type: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ClientData {
  id: string;
  name: string;
}

interface FormSubmissionData {
  id: string;
  name: string;
  email: string;
  type: string;
  createdAt: Date;
}

interface MVPCallMapsClientProps {
  mvpCallMaps: MVPCallMapData[];
  clients: ClientData[];
  formSubmissions: FormSubmissionData[];
}

export function MVPCallMapsClient({
  mvpCallMaps: initialMVPCallMaps,
  clients,
  formSubmissions,
}: MVPCallMapsClientProps) {
  const [mvpCallMaps, setMVPCallMaps] = useState(initialMVPCallMaps);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCallMap, setEditingCallMap] = useState<MVPCallMapData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [clientCompanyId, setClientCompanyId] = useState<string>("");
  const [formSubmissionId, setFormSubmissionId] = useState<string>("");

  const filteredMVPCallMaps = useMemo(() => {
    if (!searchQuery.trim()) return mvpCallMaps;
    const query = searchQuery.toLowerCase();
    return mvpCallMaps.filter(
      (callMap) =>
        callMap.name.toLowerCase().includes(query) ||
        callMap.clientCompany?.name.toLowerCase().includes(query) ||
        callMap.formSubmission?.name.toLowerCase().includes(query) ||
        callMap.formSubmission?.email.toLowerCase().includes(query)
    );
  }, [mvpCallMaps, searchQuery]);

  const resetForm = () => {
    setName("");
    setNotes("");
    setClientCompanyId("");
    setFormSubmissionId("");
    setError(null);
  };

  const handleCreate = () => {
    setEditingCallMap(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (callMap: MVPCallMapData) => {
    setEditingCallMap(callMap);
    setName(callMap.name);
    setNotes(callMap.notes || "");
    setClientCompanyId(callMap.clientCompany?.id || "");
    setFormSubmissionId(callMap.formSubmission?.id || "");
    setError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingCallMap) {
        const result = await updateMVPCallMap(editingCallMap.id, {
          name,
          notes: notes || undefined,
          clientCompanyId: clientCompanyId || null,
          formSubmissionId: formSubmissionId || null,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.data) {
          setMVPCallMaps(
            mvpCallMaps.map((c) =>
              c.id === editingCallMap.id ? { ...c, ...result.data } : c
            )
          );
        }
      } else {
        const result = await createMVPCallMap({
          name,
          notes: notes || undefined,
          clientCompanyId: clientCompanyId || undefined,
          formSubmissionId: formSubmissionId || undefined,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.data) {
          setMVPCallMaps([result.data as MVPCallMapData, ...mvpCallMaps]);
        }
      }
      setIsModalOpen(false);
      resetForm();
      setEditingCallMap(null);
    } catch (err) {
      console.error("Error saving MVP call map:", err);
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this MVP call map? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsDeleting(id);
    try {
      const result = await deleteMVPCallMap(id);
      if (result.error) {
        alert(result.error);
        return;
      }

      setMVPCallMaps(mvpCallMaps.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Error deleting MVP call map:", err);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">MVP Call Maps</h1>
          <p className="text-secondary-600">
            Product builder and pricing for MVP offers
          </p>
        </div>
        <Button onClick={handleCreate} size="sm" className="sm:size-default">
          <Plus className="mr-2 size-4" />
          New MVP Call Map
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search MVP call maps..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        icon={<Search className="size-4" />}
      />

      {mvpCallMaps.length === 0 ? (
        <Card className="p-8 text-center">
          <Rocket className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">
            No MVP call maps yet
          </h3>
          <p className="mt-2 text-secondary-600">
            Get started by creating your first MVP call map
          </p>
          <Button onClick={handleCreate} className="mt-4">
            <Plus className="mr-2 size-4" />
            Create MVP Call Map
          </Button>
        </Card>
      ) : filteredMVPCallMaps.length === 0 ? (
        <Card className="p-8 text-center">
          <Search className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">
            No results found
          </h3>
          <p className="mt-2 text-secondary-600">
            Try adjusting your search query
          </p>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-secondary-200">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Prospect
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-200">
                {filteredMVPCallMaps.map((callMap) => {
                  return (
                    <tr key={callMap.id} className="group hover:bg-secondary-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link
                          href={`/dashboard/mvp-call-maps/${callMap.id}`}
                          className="flex items-center gap-3"
                        >
                          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100">
                            <Rocket className="size-4 text-primary-600" />
                          </div>
                          <p className="font-medium text-secondary-900 group-hover:text-primary-600">
                            {callMap.name}
                          </p>
                          <ChevronRight className="size-4 text-secondary-300 opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {callMap.formSubmission ? (
                          <div className="flex items-center gap-2">
                            <FileText className="size-4 text-secondary-400" />
                            <div>
                              <p className="text-sm font-medium text-secondary-900">
                                {callMap.formSubmission.name}
                              </p>
                              <p className="text-xs text-secondary-500">
                                {callMap.formSubmission.email}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-secondary-400">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        {callMap.clientCompany ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="size-4 text-secondary-400" />
                            <span className="text-sm text-secondary-600">
                              {callMap.clientCompany.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-secondary-400">-</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-secondary-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-4" />
                          {new Date(callMap.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(callMap)}>
                              <Edit className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(callMap.id)}
                              disabled={isDeleting === callMap.id}
                              className="text-danger-600 focus:text-danger-600"
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCallMap ? "Edit MVP Call Map" : "Create MVP Call Map"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Acme Corp - MVP Discovery"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any notes about this MVP call..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="formSubmission">Link to Form Submission</Label>
              <Select
                value={formSubmissionId || "none"}
                onValueChange={(value) => setFormSubmissionId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a form submission (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {formSubmissions.map((submission) => (
                    <SelectItem key={submission.id} value={submission.id}>
                      {submission.name} ({submission.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Link to Client</Label>
              <Select
                value={clientCompanyId || "none"}
                onValueChange={(value) => setClientCompanyId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a client (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && <p className="text-sm text-danger-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {editingCallMap ? "Update" : "Create"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
