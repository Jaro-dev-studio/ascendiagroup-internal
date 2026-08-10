"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Eye,
  ChevronRight,
  DollarSign,
  Clock,
  Building2,
  Landmark,
  BarChart3,
  FileText,
  Trophy,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { GlossaryModal } from "@/components/modals/glossary-modal";
import type { GovContractStatus, GovContractSetAside } from "@prisma/client";
import { createGovContract, deleteGovContract, advanceGovContractStatus } from "@/lib/actions";

interface ContractData {
  id: string;
  title: string;
  solicitationNumber: string | null;
  agency: string;
  subAgency: string | null;
  naicsCode: string | null;
  setAsideType: GovContractSetAside | null;
  status: GovContractStatus;
  estimatedValue: number | null;
  responseDeadline: Date | null;
  placeOfPerformance: string | null;
  description: string | null;
  samGovUrl: string | null;
  createdAt: Date;
  _count: {
    activities: number;
    contacts: number;
  };
}

const STATUS_CONFIG: Record<GovContractStatus, { label: string; shortLabel: string }> = {
  SOURCES_SOUGHT: { label: "Sources Sought / RFI", shortLabel: "Sources Sought" },
  GO_NO_GO: { label: "Go / No-Go", shortLabel: "Go/No-Go" },
  POC_OUTREACH: { label: "POC Outreach", shortLabel: "POC Outreach" },
  RESPONSE_DRAFTED: { label: "Response Drafted", shortLabel: "Response" },
  RECEIPT_CONFIRMED: { label: "Receipt Confirmed", shortLabel: "Receipt" },
  FOLLOWUP_MEETING: { label: "Follow-up Meeting", shortLabel: "Follow-up" },
  AWAITING_SOLICITATION: { label: "Awaiting Solicitation", shortLabel: "Awaiting" },
  SOLICITATION_RELEASED: { label: "Solicitation Released", shortLabel: "Released" },
  PROPOSAL_SUBMITTED: { label: "Proposal Submitted", shortLabel: "Submitted" },
  PROPOSAL_RECEIPT_CONFIRMED: { label: "Proposal Receipt Confirmed", shortLabel: "Confirmed" },
  MONITORING_AWARD: { label: "Monitoring Award", shortLabel: "Monitoring" },
  WON: { label: "Won", shortLabel: "Won" },
  LOST: { label: "Lost", shortLabel: "Lost" },
};

const STATUS_ORDER: GovContractStatus[] = [
  "SOURCES_SOUGHT",
  "GO_NO_GO",
  "POC_OUTREACH",
  "RESPONSE_DRAFTED",
  "RECEIPT_CONFIRMED",
  "FOLLOWUP_MEETING",
  "AWAITING_SOLICITATION",
  "SOLICITATION_RELEASED",
  "PROPOSAL_SUBMITTED",
  "PROPOSAL_RECEIPT_CONFIRMED",
  "MONITORING_AWARD",
  "WON",
  "LOST",
];

const SET_ASIDE_LABELS: Record<GovContractSetAside, string> = {
  SMALL_BUSINESS: "Small Business",
  EIGHT_A: "8(a)",
  HUBZONE: "HUBZone",
  SDVOSB: "SDVOSB",
  WOSB: "WOSB",
  FULL_AND_OPEN: "Full & Open",
  OTHER: "Other",
};

interface SamGovClientProps {
  contracts: ContractData[];
}

export function SamGovClient({ contracts: initialContracts }: SamGovClientProps) {
  const [contracts, setContracts] = useState(initialContracts);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);

  const [newContract, setNewContract] = useState({
    title: "",
    agency: "",
    subAgency: "",
    solicitationNumber: "",
    naicsCode: "",
    setAsideType: "" as string,
    estimatedValue: "",
    responseDeadline: "",
    samGovUrl: "",
    description: "",
  });

  const filteredContracts = useMemo(() => {
    if (!searchQuery.trim()) return contracts;
    const q = searchQuery.toLowerCase();
    return contracts.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.agency.toLowerCase().includes(q) ||
        c.solicitationNumber?.toLowerCase().includes(q)
    );
  }, [contracts, searchQuery]);

  const groupedByStatus = useMemo(() => {
    const groups: Record<string, ContractData[]> = {};
    for (const status of STATUS_ORDER) {
      groups[status] = [];
    }
    for (const contract of filteredContracts) {
      if (groups[contract.status]) {
        groups[contract.status].push(contract);
      }
    }
    return groups;
  }, [filteredContracts]);

  const handleCreate = async () => {
    if (!newContract.title.trim() || !newContract.agency.trim()) return;
    setIsCreating(true);
    try {
      const result = await createGovContract({
        title: newContract.title.trim(),
        agency: newContract.agency.trim(),
        subAgency: newContract.subAgency.trim() || undefined,
        solicitationNumber: newContract.solicitationNumber.trim() || undefined,
        naicsCode: newContract.naicsCode.trim() || undefined,
        setAsideType: (newContract.setAsideType || undefined) as GovContractSetAside | undefined,
        estimatedValue: newContract.estimatedValue ? parseFloat(newContract.estimatedValue) : undefined,
        responseDeadline: newContract.responseDeadline ? new Date(newContract.responseDeadline) : undefined,
        samGovUrl: newContract.samGovUrl.trim() || undefined,
        description: newContract.description.trim() || undefined,
      });
      if (result.data) {
        setContracts((prev) => [
          { ...result.data!, _count: { activities: 1, contacts: 0 }, responseDeadline: result.data!.responseDeadline, placeOfPerformance: result.data!.placeOfPerformance, createdAt: result.data!.createdAt } as ContractData,
          ...prev,
        ]);
        setIsCreateOpen(false);
        setNewContract({
          title: "",
          agency: "",
          subAgency: "",
          solicitationNumber: "",
          naicsCode: "",
          setAsideType: "",
          estimatedValue: "",
          responseDeadline: "",
          samGovUrl: "",
          description: "",
        });
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const result = await deleteGovContract(deleteId);
      if (result.data) {
        setContracts((prev) => prev.filter((c) => c.id !== deleteId));
        setDeleteId(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAdvance = async (contractId: string) => {
    const result = await advanceGovContractStatus(contractId);
    if (result.data) {
      setContracts((prev) =>
        prev.map((c) =>
          c.id === contractId ? { ...c, status: result.data!.status } : c
        )
      );
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const totalActive = contracts.filter((c) => c.status !== "WON" && c.status !== "LOST").length;
  const totalValue = contracts.reduce((sum, c) => sum + (c.estimatedValue || 0), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Landmark className="text-primary size-6" />
            <h1 className="text-text-dark text-2xl font-bold">SAM.gov Contracts</h1>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            {totalActive} active contracts{totalValue > 0 && ` | ${formatCurrency(totalValue)} total pipeline value`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <Input
              placeholder="Search contracts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            New Contract
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/sam-gov/market-research">
          <Button variant="outline">
            <BarChart3 className="mr-2 size-4" />
            Market Research
          </Button>
        </Link>
        <Link href="/dashboard/sam-gov/opportunities">
          <Button variant="outline">
            <FileText className="mr-2 size-4" />
            Opportunities Feed
          </Button>
        </Link>
        <Link href="/dashboard/sam-gov/competitors">
          <Button variant="outline">
            <Trophy className="mr-2 size-4" />
            Competitors
          </Button>
        </Link>
        <Button variant="outline" onClick={() => setIsGlossaryOpen(true)}>
          <BookOpen className="mr-2 size-4" />
          Glossary
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_ORDER.map((status) => {
          const items = groupedByStatus[status] || [];
          const config = STATUS_CONFIG[status];
          const isTerminal = status === "WON" || status === "LOST";

          return (
            <div
              key={status}
              className="flex min-w-[280px] max-w-[280px] shrink-0 flex-col rounded-lg border border-border bg-background-secondary/30"
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 border-b border-border p-3">
                <h3 className="text-text-dark truncate text-sm font-semibold">
                  {config.shortLabel}
                </h3>
                <Badge variant="outline" className="ml-auto shrink-0">
                  {items.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 250px)" }}>
                {items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-text-secondary">
                    No contracts
                  </p>
                ) : (
                  items.map((contract) => (
                    <Link
                      key={contract.id}
                      href={`/dashboard/sam-gov/${contract.id}`}
                      className="block"
                    >
                      <Card className="group cursor-pointer p-3 transition-shadow hover:shadow-md">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-text-dark line-clamp-2 text-sm font-medium">
                            {contract.title}
                          </h4>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
                              >
                                <MoreHorizontal className="size-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/sam-gov/${contract.id}`}>
                                  <Eye className="mr-2 size-4" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              {!isTerminal && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleAdvance(contract.id);
                                  }}
                                >
                                  <ChevronRight className="mr-2 size-4" />
                                  Advance Status
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  setDeleteId(contract.id);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 size-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        <div className="mt-2 flex items-center gap-1 text-xs text-text-secondary">
                          <Building2 className="size-3" />
                          <span className="truncate">{contract.agency}</span>
                        </div>

                        {contract.estimatedValue && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                            <DollarSign className="size-3" />
                            <span>{formatCurrency(contract.estimatedValue)}</span>
                          </div>
                        )}

                        {contract.responseDeadline && (
                          <div className="mt-1 flex items-center gap-1 text-xs text-text-secondary">
                            <Clock className="size-3" />
                            <span>{new Date(contract.responseDeadline).toLocaleDateString()}</span>
                          </div>
                        )}

                        {contract.setAsideType && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            {SET_ASIDE_LABELS[contract.setAsideType]}
                          </Badge>
                        )}
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Contract Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Government Contract</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={newContract.title}
                onChange={(e) => setNewContract((p) => ({ ...p, title: e.target.value }))}
                placeholder="Contract opportunity title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Agency *</Label>
                <Input
                  value={newContract.agency}
                  onChange={(e) => setNewContract((p) => ({ ...p, agency: e.target.value }))}
                  placeholder="e.g. Department of Defense"
                />
              </div>
              <div>
                <Label>Sub-Agency</Label>
                <Input
                  value={newContract.subAgency}
                  onChange={(e) => setNewContract((p) => ({ ...p, subAgency: e.target.value }))}
                  placeholder="e.g. Army Corps of Engineers"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Solicitation Number</Label>
                <Input
                  value={newContract.solicitationNumber}
                  onChange={(e) => setNewContract((p) => ({ ...p, solicitationNumber: e.target.value }))}
                  placeholder="e.g. W912HZ-25-R-0001"
                />
              </div>
              <div>
                <Label>NAICS Code</Label>
                <Input
                  value={newContract.naicsCode}
                  onChange={(e) => setNewContract((p) => ({ ...p, naicsCode: e.target.value }))}
                  placeholder="e.g. 541512"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Set-Aside Type</Label>
                <Select
                  value={newContract.setAsideType}
                  onValueChange={(v) => setNewContract((p) => ({ ...p, setAsideType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SET_ASIDE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estimated Value</Label>
                <Input
                  type="number"
                  value={newContract.estimatedValue}
                  onChange={(e) => setNewContract((p) => ({ ...p, estimatedValue: e.target.value }))}
                  placeholder="e.g. 500000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Response Deadline</Label>
                <Input
                  type="date"
                  value={newContract.responseDeadline}
                  onChange={(e) => setNewContract((p) => ({ ...p, responseDeadline: e.target.value }))}
                />
              </div>
              <div>
                <Label>SAM.gov URL</Label>
                <Input
                  value={newContract.samGovUrl}
                  onChange={(e) => setNewContract((p) => ({ ...p, samGovUrl: e.target.value }))}
                  placeholder="https://sam.gov/opp/..."
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newContract.description}
                onChange={(e) => setNewContract((p) => ({ ...p, description: e.target.value }))}
                placeholder="Brief description of the opportunity"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={isCreating || !newContract.title.trim() || !newContract.agency.trim()}>
              {isCreating ? "Creating..." : "Create Contract"}
            </Button>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contract</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Are you sure you want to delete this contract? This will also remove all contacts and activity history. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GlossaryModal
        isOpen={isGlossaryOpen}
        onClose={() => setIsGlossaryOpen(false)}
      />
    </div>
  );
}
