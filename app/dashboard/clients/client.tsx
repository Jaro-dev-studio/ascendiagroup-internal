"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, MoreHorizontal, Trash2, Edit, Building2, Search, Users, CheckCircle2, XCircle, Loader2, ChevronRight, CircleDollarSign, PhoneCall, UserX, FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { CompanyStatus } from "@prisma/client";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteClientCompany, createClientCompany, updateClientCompany, verifySlackChannel } from "@/lib/actions";

interface CompanyData {
  id: string;
  name: string;
  status: CompanyStatus;
  slackPublicChannelId: string | null;
  slackInternalChannelId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    users: number;
  };
}

const clientStatusConfig: Record<CompanyStatus, { label: string; className: string; icon: typeof CircleDollarSign }> = {
  FORM_SUBMITTED: { label: "Form Submitted", className: "bg-secondary-100 text-secondary-700", icon: FileText },
  CALL_BOOKED: { label: "Call Booked", className: "bg-primary-100 text-primary-700", icon: Calendar },
  NO_SHOW: { label: "No Show", className: "bg-destructive-100 text-destructive-700", icon: XCircle },
  ATTENDED_SALES_CALL: { label: "Attended Sales Call", className: "bg-warning-100 text-warning-700", icon: PhoneCall },
  PURCHASED: { label: "Purchased", className: "bg-success-100 text-success-700", icon: CircleDollarSign },
  LOST: { label: "Lost", className: "bg-secondary-100 text-secondary-600", icon: XCircle },
  CHURNED: { label: "Churned", className: "bg-secondary-100 text-secondary-600", icon: UserX },
};

interface SlackChannelValidation {
  status: "idle" | "validating" | "valid" | "invalid";
  channelName?: string;
  error?: string;
}

interface ClientsClientProps {
  clients: CompanyData[];
}

type StatusFilterValue = CompanyStatus | "ALL";

export function ClientsClient({ clients: initialClients }: ClientsClientProps) {
  const searchParams = useSearchParams();
  
  // Parse status query param for filtering (e.g., /dashboard/clients?status=CHURNED)
  const statusParam = searchParams?.get("status");
  const initialStatusFilter = useMemo((): StatusFilterValue => {
    if (statusParam && ["ATTENDED_SALES_CALL", "PURCHASED", "LOST", "CHURNED", "ALL"].includes(statusParam)) {
      return statusParam as StatusFilterValue;
    }
    return "PURCHASED"; // Default
  }, [statusParam]);

  const [clients, setClients] = useState(initialClients);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(initialStatusFilter);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<CompanyData | null>(null);
  const [clientName, setClientName] = useState("");
  const [slackPublicChannelId, setSlackPublicChannelId] = useState("");
  const [slackInternalChannelId, setSlackInternalChannelId] = useState("");
  const [publicChannelValidation, setPublicChannelValidation] = useState<SlackChannelValidation>({ status: "idle" });
  const [internalChannelValidation, setInternalChannelValidation] = useState<SlackChannelValidation>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredClients = useMemo(() => {
    let result = clients;
    
    // Filter by status
    if (statusFilter !== "ALL") {
      result = result.filter((client) => client.status === statusFilter);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((client) =>
        client.name.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [clients, searchQuery, statusFilter]);

  const resetForm = () => {
    setClientName("");
    setSlackPublicChannelId("");
    setSlackInternalChannelId("");
    setPublicChannelValidation({ status: "idle" });
    setInternalChannelValidation({ status: "idle" });
    setError(null);
  };

  const handleCreateClient = () => {
    setEditingClient(null);
    resetForm();
    setIsModalOpen(true);
  };

  const handleEditClient = (client: CompanyData) => {
    setEditingClient(client);
    setClientName(client.name);
    setSlackPublicChannelId(client.slackPublicChannelId || "");
    setSlackInternalChannelId(client.slackInternalChannelId || "");
    // Set validation status to valid if channels exist (they were validated before)
    setPublicChannelValidation(client.slackPublicChannelId ? { status: "valid" } : { status: "idle" });
    setInternalChannelValidation(client.slackInternalChannelId ? { status: "valid" } : { status: "idle" });
    setError(null);
    setIsModalOpen(true);
  };

  const handleVerifyChannel = async (
    channelId: string,
    setValidation: (v: SlackChannelValidation) => void
  ) => {
    if (!channelId.trim()) {
      setValidation({ status: "idle" });
      return;
    }

    setValidation({ status: "validating" });
    
    const result = await verifySlackChannel(channelId.trim());
    
    if (result.error) {
      setValidation({ status: "invalid", error: result.error });
    } else if (result.data?.valid) {
      setValidation({ status: "valid", channelName: result.data.channelName });
    } else {
      setValidation({ status: "invalid", error: "Channel not found" });
    }
  };

  const handleSubmit = async () => {
    if (!clientName.trim()) {
      setError("Name is required");
      return;
    }

    // Check if Slack channels need validation
    const publicChannelTrimmed = slackPublicChannelId.trim();
    const internalChannelTrimmed = slackInternalChannelId.trim();

    // Validate public channel if provided and not already validated
    if (publicChannelTrimmed && publicChannelValidation.status !== "valid") {
      if (publicChannelValidation.status === "idle") {
        setError("Please verify the public Slack channel before saving");
        return;
      }
      if (publicChannelValidation.status === "invalid") {
        setError("Public Slack channel is invalid. Please fix or remove it.");
        return;
      }
      if (publicChannelValidation.status === "validating") {
        setError("Please wait for channel validation to complete");
        return;
      }
    }

    // Validate internal channel if provided and not already validated
    if (internalChannelTrimmed && internalChannelValidation.status !== "valid") {
      if (internalChannelValidation.status === "idle") {
        setError("Please verify the internal Slack channel before saving");
        return;
      }
      if (internalChannelValidation.status === "invalid") {
        setError("Internal Slack channel is invalid. Please fix or remove it.");
        return;
      }
      if (internalChannelValidation.status === "validating") {
        setError("Please wait for channel validation to complete");
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editingClient) {
        const result = await updateClientCompany(editingClient.id, {
          name: clientName,
          slackPublicChannelId: publicChannelTrimmed || null,
          slackInternalChannelId: internalChannelTrimmed || null,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.data) {
          setClients(clients.map((c) => (c.id === editingClient.id ? result.data : c)));
        }
      } else {
        const result = await createClientCompany({ name: clientName });
        if (result.error) {
          setError(result.error);
          return;
        }
        if (result.data) {
          // For new clients, update with Slack channels if provided
          if (publicChannelTrimmed || internalChannelTrimmed) {
            const updateResult = await updateClientCompany(result.data.id, {
              name: clientName,
              slackPublicChannelId: publicChannelTrimmed || null,
              slackInternalChannelId: internalChannelTrimmed || null,
            });
            if (updateResult.data) {
              setClients([updateResult.data, ...clients]);
            } else {
              setClients([result.data, ...clients]);
            }
          } else {
            setClients([result.data, ...clients]);
          }
        }
      }
      setIsModalOpen(false);
      resetForm();
      setEditingClient(null);
    } catch (err) {
      console.error("Error saving client:", err);
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm("Are you sure you want to delete this client? This action cannot be undone.")) {
      return;
    }

    setIsDeleting(clientId);
    try {
      const result = await deleteClientCompany(clientId);
      if (result.error) {
        alert(result.error);
        return;
      }

      setClients(clients.filter((c) => c.id !== clientId));
    } catch (err) {
      console.error("Error deleting client:", err);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Clients</h1>
          <p className="text-secondary-600">Manage your client companies</p>
        </div>
        <Button onClick={handleCreateClient} size="sm" className="sm:size-default">
          <Plus className="mr-2 size-4" />
          New Client
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary-400" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilterValue)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="PURCHASED">
              <span className="flex items-center gap-2">
                <CircleDollarSign className="size-3" />
                Purchased
              </span>
            </SelectItem>
            <SelectItem value="ATTENDED_SALES_CALL">
              <span className="flex items-center gap-2">
                <PhoneCall className="size-3" />
                Attended Sales Call
              </span>
            </SelectItem>
            <SelectItem value="LOST">
              <span className="flex items-center gap-2">
                <XCircle className="size-3" />
                Lost
              </span>
            </SelectItem>
            <SelectItem value="CHURNED">
              <span className="flex items-center gap-2">
                <UserX className="size-3" />
                Churned
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {clients.length === 0 ? (
        <Card className="p-8 text-center">
          <Building2 className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">No clients yet</h3>
          <p className="mt-2 text-secondary-600">Get started by creating your first client</p>
          <Button onClick={handleCreateClient} className="mt-4">
            <Plus className="mr-2 size-4" />
            Create Client
          </Button>
        </Card>
      ) : filteredClients.length === 0 ? (
        <Card className="p-8 text-center">
          <Search className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">No results found</h3>
          <p className="mt-2 text-secondary-600">Try adjusting your search query</p>
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
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-secondary-500">
                    Users
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
                {filteredClients.map((client) => (
                  <tr key={client.id} className="group hover:bg-secondary-50">
                    <td className="whitespace-nowrap px-6 py-4">
                      <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-primary-100">
                          <Building2 className="size-4 text-primary-600" />
                        </div>
                        <p className="font-medium text-secondary-900 group-hover:text-primary-600">
                          {client.name}
                        </p>
                        <ChevronRight className="size-4 text-secondary-300 opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {(() => {
                        const statusInfo = clientStatusConfig[client.status];
                        const StatusIcon = statusInfo.icon;
                        return (
                          <Badge className={`gap-1 ${statusInfo.className}`}>
                            <StatusIcon className="size-3" />
                            {statusInfo.label}
                          </Badge>
                        );
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-secondary-600">
                        <Users className="size-4" />
                        <span>{client._count.users}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-secondary-500">
                      {new Date(client.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditClient(client)}>
                            <Edit className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClient(client.id)}
                            disabled={isDeleting === client.id}
                            className="text-danger-600 focus:text-danger-600"
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Client Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? "Edit Client" : "Create New Client"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Enter client name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            {/* Slack Public Channel */}
            <div className="space-y-2">
              <Label htmlFor="slackPublicChannel">
                Public Slack Channel
                <span className="ml-1 text-xs text-secondary-500">(client has access)</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="slackPublicChannel"
                  placeholder="e.g., C01234567890"
                  value={slackPublicChannelId}
                  onChange={(e) => {
                    setSlackPublicChannelId(e.target.value);
                    setPublicChannelValidation({ status: "idle" });
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleVerifyChannel(slackPublicChannelId, setPublicChannelValidation)}
                  disabled={!slackPublicChannelId.trim() || publicChannelValidation.status === "validating"}
                >
                  {publicChannelValidation.status === "validating" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : publicChannelValidation.status === "valid" ? (
                    <CheckCircle2 className="size-4 text-success-600" />
                  ) : publicChannelValidation.status === "invalid" ? (
                    <XCircle className="size-4 text-danger-600" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                </Button>
              </div>
              {publicChannelValidation.status === "valid" && publicChannelValidation.channelName && (
                <p className="text-xs text-success-600">#{publicChannelValidation.channelName}</p>
              )}
              {publicChannelValidation.status === "invalid" && publicChannelValidation.error && (
                <p className="text-xs text-danger-600">{publicChannelValidation.error}</p>
              )}
            </div>

            {/* Slack Internal Channel */}
            <div className="space-y-2">
              <Label htmlFor="slackInternalChannel">
                Internal Slack Channel
                <span className="ml-1 text-xs text-secondary-500">(client doesn&apos;t have access)</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="slackInternalChannel"
                  placeholder="e.g., C01234567890"
                  value={slackInternalChannelId}
                  onChange={(e) => {
                    setSlackInternalChannelId(e.target.value);
                    setInternalChannelValidation({ status: "idle" });
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleVerifyChannel(slackInternalChannelId, setInternalChannelValidation)}
                  disabled={!slackInternalChannelId.trim() || internalChannelValidation.status === "validating"}
                >
                  {internalChannelValidation.status === "validating" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : internalChannelValidation.status === "valid" ? (
                    <CheckCircle2 className="size-4 text-success-600" />
                  ) : internalChannelValidation.status === "invalid" ? (
                    <XCircle className="size-4 text-danger-600" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                </Button>
              </div>
              {internalChannelValidation.status === "valid" && internalChannelValidation.channelName && (
                <p className="text-xs text-success-600">#{internalChannelValidation.channelName}</p>
              )}
              {internalChannelValidation.status === "invalid" && internalChannelValidation.error && (
                <p className="text-xs text-danger-600">{internalChannelValidation.error}</p>
              )}
            </div>

            {error && <p className="text-sm text-danger-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              {editingClient ? "Update Client" : "Create Client"}
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
