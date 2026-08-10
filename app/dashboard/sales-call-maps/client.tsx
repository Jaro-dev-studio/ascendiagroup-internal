"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  ClipboardList,
  Search,
  ChevronRight,
  Building2,
  Phone,
  FileText,
  Loader2,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { createSalesCallMap, updateSalesCallMap, deleteSalesCallMap } from "@/lib/actions";
import {
  calculateOverallScore,
  type AuditData,
} from "@/config/sales-audit-schema";
import type { Prisma } from "@prisma/client";

interface SalesCallMapData {
  id: string;
  name: string;
  notes: string | null;
  auditData: Prisma.JsonValue | null;
  clientCompany: {
    id: string;
    name: string;
  } | null;
  meeting: {
    id: string;
    title: string;
    startTime: Date;
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

interface MeetingData {
  id: string;
  title: string;
  startTime: Date;
}

interface FormSubmissionData {
  id: string;
  name: string;
  email: string;
  type: string;
  createdAt: Date;
}

interface SalesCallMapsClientProps {
  salesCallMaps: SalesCallMapData[];
  clients: ClientData[];
  meetings: MeetingData[];
  formSubmissions: FormSubmissionData[];
}

export function SalesCallMapsClient({
  salesCallMaps: initialSalesCallMaps,
  clients,
  meetings,
  formSubmissions,
}: SalesCallMapsClientProps) {
  const [salesCallMaps, setSalesCallMaps] = useState(initialSalesCallMaps);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCallMap, setEditingCallMap] = useState<SalesCallMapData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [clientCompanyId, setClientCompanyId] = useState<string>("");
  const [meetingId, setMeetingId] = useState<string>("");
  const [formSubmissionId, setFormSubmissionId] = useState<string>("");

  const filteredSalesCallMaps = useMemo(() => {
    if (!searchQuery.trim()) return salesCallMaps;
    const query = searchQuery.toLowerCase();
    return salesCallMaps.filter(
      (callMap) =>
        callMap.name.toLowerCase().includes(query) ||
        callMap.clientCompany?.name.toLowerCase().includes(query) ||
        callMap.formSubmission?.name.toLowerCase().includes(query) ||
        callMap.formSubmission?.email.toLowerCase().includes(query)
    );
  }, [salesCallMaps, searchQuery]);

  const resetForm = () => {
    setName("");
    setNotes("");
    setClientCompanyId("");
    setMeetingId("");
    setFormSubmissionId("");
    setError(null);
  };

  const handleCreate = () => {
    setEditingCallMap(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleEdit = (callMap: SalesCallMapData) => {
    setEditingCallMap(callMap);
    setName(callMap.name);
    setNotes(callMap.notes || "");
    setClientCompanyId(callMap.clientCompany?.id || "");
    setMeetingId(callMap.meeting?.id || "");
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
        const result = await updateSalesCallMap(editingCallMap.id, {
          name,
          notes: notes || undefined,
          clientCompanyId: clientCompanyId || null,
          meetingId: meetingId || null,
          formSubmissionId: formSubmissionId || null,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.data) {
          setSalesCallMaps(
            salesCallMaps.map((c) =>
              c.id === editingCallMap.id ? { ...c, ...result.data } : c
            )
          );
        }
      } else {
        const result = await createSalesCallMap({
          name,
          notes: notes || undefined,
          clientCompanyId: clientCompanyId || undefined,
          meetingId: meetingId || undefined,
          formSubmissionId: formSubmissionId || undefined,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.data) {
          setSalesCallMaps([result.data as SalesCallMapData, ...salesCallMaps]);
        }
      }
      setIsModalOpen(false);
      resetForm();
      setEditingCallMap(null);
    } catch (err) {
      console.error("Error saving sales call map:", err);
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this sales call map? This action cannot be undone."
      )
    ) {
      return;
    }

    setIsDeleting(id);
    try {
      const result = await deleteSalesCallMap(id);
      if (result.error) {
        alert(result.error);
        return;
      }

      setSalesCallMaps(salesCallMaps.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Error deleting sales call map:", err);
    } finally {
      setIsDeleting(null);
    }
  };

  const getScoreBadgeColor = (percentage: number) => {
    if (percentage >= 70) return "bg-success-100 text-success-700";
    if (percentage >= 40) return "bg-warning-100 text-warning-700";
    return "bg-danger-100 text-danger-700";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Sales Call Maps</h1>
          <p className="text-secondary-600">
            Operations audit checklists for sales calls
          </p>
        </div>
        <Button onClick={handleCreate} size="sm" className="sm:size-default">
          <Plus className="mr-2 size-4" />
          New Call Map
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary-400" />
        <Input
          placeholder="Search call maps..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {salesCallMaps.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardList className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">
            No sales call maps yet
          </h3>
          <p className="mt-2 text-secondary-600">
            Get started by creating your first sales call map
          </p>
          <Button onClick={handleCreate} className="mt-4">
            <Plus className="mr-2 size-4" />
            Create Call Map
          </Button>
        </Card>
      ) : filteredSalesCallMaps.length === 0 ? (
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
                    Score
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
                {filteredSalesCallMaps.map((callMap) => {
                  const scoreData = calculateOverallScore(callMap.auditData as AuditData | null);
                  return (
                    <tr key={callMap.id} className="group hover:bg-secondary-50">
                      <td className="whitespace-nowrap px-6 py-4">
                        <Link
                          href={`/dashboard/sales-call-maps/${callMap.id}`}
                          className="flex items-center gap-3"
                        >
                          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100">
                            <ClipboardList className="size-4 text-primary-600" />
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
                      <td className="whitespace-nowrap px-6 py-4">
                        <Badge
                          className={getScoreBadgeColor(scoreData.percentage)}
                        >
                          {scoreData.totalScore}/80 ({scoreData.percentage}%)
                        </Badge>
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
              {editingCallMap ? "Edit Sales Call Map" : "Create Sales Call Map"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Acme Corp - Initial Discovery"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any notes about this sales call..."
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

            <div className="space-y-2">
              <Label htmlFor="meeting">Link to Meeting</Label>
              <Select
                value={meetingId || "none"}
                onValueChange={(value) => setMeetingId(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a meeting (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {meetings.map((meeting) => (
                    <SelectItem key={meeting.id} value={meeting.id}>
                      {meeting.title} (
                      {new Date(meeting.startTime).toLocaleDateString()})
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
              {editingCallMap ? "Update Call Map" : "Create Call Map"}
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
