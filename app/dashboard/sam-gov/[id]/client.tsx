"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Save,
  Plus,
  Trash2,
  Edit,
  Phone,
  Mail,
  Copy,
  Check,
  Loader2,
  Clock,
  FileText,
  MessageSquare,
  Users,
  Sparkles,
  ExternalLink,
  Award,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  GovContractStatus,
  GovContractSetAside,
  GovContactRole,
  GovActivityType,
} from "@prisma/client";
import {
  updateGovContract,
  advanceGovContractStatus,
  revertGovContractStatus,
  setGovContractOutcome,
  createGovContractContact,
  updateGovContractContact,
  deleteGovContractContact,
  addGovContractNote,
  saveGovContractDocument,
} from "@/lib/actions";

interface ContactData {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  organization: string | null;
  role: GovContactRole;
  notes: string | null;
  createdAt: Date;
}

interface ActivityData {
  id: string;
  type: GovActivityType;
  description: string;
  oldStatus: GovContractStatus | null;
  newStatus: GovContractStatus | null;
  createdAt: Date;
}

interface ContractDetail {
  id: string;
  title: string;
  solicitationNumber: string | null;
  agency: string;
  subAgency: string | null;
  naicsCode: string | null;
  setAsideType: GovContractSetAside | null;
  status: GovContractStatus;
  estimatedValue: number | null;
  awardAmount: number | null;
  responseDeadline: Date | null;
  expectedSolicitationDate: Date | null;
  awardDate: Date | null;
  performancePeriodStart: Date | null;
  performancePeriodEnd: Date | null;
  placeOfPerformance: string | null;
  description: string | null;
  samGovUrl: string | null;
  notes: string | null;
  goNoGoNotes: string | null;
  callScript: string | null;
  sourcesResponseContent: string | null;
  proposalContent: string | null;
  linkedTaskId: string | null;
  contacts: ContactData[];
  activities: ActivityData[];
  createdAt: Date;
}

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

const STATUS_LABELS: Record<GovContractStatus, string> = {
  SOURCES_SOUGHT: "Sources Sought",
  GO_NO_GO: "Go/No-Go",
  POC_OUTREACH: "POC Outreach",
  RESPONSE_DRAFTED: "Response Drafted",
  RECEIPT_CONFIRMED: "Receipt Confirmed",
  FOLLOWUP_MEETING: "Follow-up Meeting",
  AWAITING_SOLICITATION: "Awaiting Solicitation",
  SOLICITATION_RELEASED: "Solicitation Released",
  PROPOSAL_SUBMITTED: "Proposal Submitted",
  PROPOSAL_RECEIPT_CONFIRMED: "Proposal Receipt Confirmed",
  MONITORING_AWARD: "Monitoring Award",
  WON: "Won",
  LOST: "Lost",
};

const SET_ASIDE_LABELS: Record<GovContractSetAside, string> = {
  SMALL_BUSINESS: "Small Business",
  EIGHT_A: "8(a)",
  HUBZONE: "HUBZone",
  SDVOSB: "SDVOSB",
  WOSB: "WOSB",
  FULL_AND_OPEN: "Full & Open",
  OTHER: "Other",
};

const CONTACT_ROLE_LABELS: Record<GovContactRole, string> = {
  CONTRACTING_OFFICER: "Contracting Officer",
  PROGRAM_MANAGER: "Program Manager",
  TECHNICAL_POC: "Technical POC",
  SMALL_BUSINESS_REP: "Small Business Rep",
  INTERNAL: "Internal",
  OTHER: "Other",
};

const ACTIVITY_ICONS: Record<GovActivityType, typeof Clock> = {
  STATUS_CHANGE: ChevronRight,
  NOTE: MessageSquare,
  DOCUMENT_GENERATED: FileText,
  CONTACT_ADDED: Users,
  TASK_CREATED: Clock,
};

type TabType = "overview" | "contacts" | "documents" | "activity";

const DOC_TYPES = [
  { value: "FIT_ANALYSIS", label: "Go/No-Go Fit Analysis", field: "goNoGoNotes" as const },
  { value: "CALL_SCRIPT", label: "POC Call Script", field: "callScript" as const },
  { value: "SOURCES_SOUGHT_RESPONSE", label: "Sources Sought Response", field: "sourcesResponseContent" as const },
  { value: "CAPABILITY_STATEMENT", label: "Capability Statement", field: "proposalContent" as const },
  { value: "TECHNICAL_PROPOSAL", label: "Technical Proposal", field: "proposalContent" as const },
  { value: "PAST_PERFORMANCE", label: "Past Performance Narrative", field: "proposalContent" as const },
  { value: "MANAGEMENT_APPROACH", label: "Management Approach", field: "proposalContent" as const },
  { value: "COVER_LETTER", label: "Cover Letter / Executive Summary", field: "proposalContent" as const },
];

export function GovContractDetailClient({ contract: initialContract }: { contract: ContractDetail }) {
  const [contract, setContract] = useState(initialContract);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isSaving, setIsSaving] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isReverting, setIsReverting] = useState(false);

  // Overview form state
  const [editForm, setEditForm] = useState({
    title: contract.title,
    agency: contract.agency,
    subAgency: contract.subAgency || "",
    solicitationNumber: contract.solicitationNumber || "",
    naicsCode: contract.naicsCode || "",
    setAsideType: contract.setAsideType || "",
    estimatedValue: contract.estimatedValue?.toString() || "",
    awardAmount: contract.awardAmount?.toString() || "",
    responseDeadline: contract.responseDeadline ? new Date(contract.responseDeadline).toISOString().split("T")[0] : "",
    expectedSolicitationDate: contract.expectedSolicitationDate ? new Date(contract.expectedSolicitationDate).toISOString().split("T")[0] : "",
    placeOfPerformance: contract.placeOfPerformance || "",
    description: contract.description || "",
    samGovUrl: contract.samGovUrl || "",
    notes: contract.notes || "",
  });

  // Contact state
  const [contacts, setContacts] = useState(contract.contacts);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactData | null>(null);
  const [contactForm, setContactForm] = useState({
    name: "",
    title: "",
    email: "",
    phone: "",
    organization: "",
    role: "CONTRACTING_OFFICER" as GovContactRole,
    notes: "",
  });
  const [isSavingContact, setIsSavingContact] = useState(false);

  // Activity state
  const [activities, setActivities] = useState(contract.activities);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Documents state
  const [selectedDocType, setSelectedDocType] = useState(DOC_TYPES[0].value);
  const [additionalContext, setAdditionalContext] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Advance dialog for solicitation date
  const [showSolicitationDateDialog, setShowSolicitationDateDialog] = useState(false);
  const [solicitationDate, setSolicitationDate] = useState("");

  // Outcome dialog
  const [showOutcomeDialog, setShowOutcomeDialog] = useState<"WON" | "LOST" | null>(null);
  const [outcomeAwardAmount, setOutcomeAwardAmount] = useState("");
  const [outcomeAwardDate, setOutcomeAwardDate] = useState("");

  const currentStatusIndex = STATUS_ORDER.indexOf(contract.status);
  const isTerminal = contract.status === "WON" || contract.status === "LOST";
  const canAdvance = !isTerminal && currentStatusIndex < STATUS_ORDER.length - 2;
  const canRevert = currentStatusIndex > 0 && contract.status !== "LOST";

  const handleSaveOverview = async () => {
    setIsSaving(true);
    try {
      const result = await updateGovContract(contract.id, {
        title: editForm.title,
        agency: editForm.agency,
        subAgency: editForm.subAgency || null,
        solicitationNumber: editForm.solicitationNumber || null,
        naicsCode: editForm.naicsCode || null,
        setAsideType: (editForm.setAsideType || null) as GovContractSetAside | null,
        estimatedValue: editForm.estimatedValue ? parseFloat(editForm.estimatedValue) : null,
        awardAmount: editForm.awardAmount ? parseFloat(editForm.awardAmount) : null,
        responseDeadline: editForm.responseDeadline ? new Date(editForm.responseDeadline) : null,
        expectedSolicitationDate: editForm.expectedSolicitationDate ? new Date(editForm.expectedSolicitationDate) : null,
        placeOfPerformance: editForm.placeOfPerformance || null,
        description: editForm.description || null,
        samGovUrl: editForm.samGovUrl || null,
        notes: editForm.notes || null,
      });
      if (result.data) {
        setContract((prev) => ({ ...prev, ...result.data! }));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAdvance = async () => {
    // If advancing to AWAITING_SOLICITATION, prompt for date
    if (contract.status === "FOLLOWUP_MEETING") {
      setShowSolicitationDateDialog(true);
      return;
    }
    // If at MONITORING_AWARD, show outcome dialog
    if (contract.status === "MONITORING_AWARD") {
      setShowOutcomeDialog("WON");
      return;
    }

    setIsAdvancing(true);
    try {
      const result = await advanceGovContractStatus(contract.id);
      if (result.data) {
        setContract((prev) => ({ ...prev, status: result.data!.status }));
      }
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleAdvanceWithDate = async () => {
    setIsAdvancing(true);
    try {
      const result = await advanceGovContractStatus(
        contract.id,
        solicitationDate ? new Date(solicitationDate) : undefined
      );
      if (result.data) {
        setContract((prev) => ({
          ...prev,
          status: result.data!.status,
          expectedSolicitationDate: result.data!.expectedSolicitationDate,
        }));
        setShowSolicitationDateDialog(false);
        setSolicitationDate("");
      }
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleSetOutcome = async () => {
    if (!showOutcomeDialog) return;
    setIsAdvancing(true);
    try {
      const result = await setGovContractOutcome(
        contract.id,
        showOutcomeDialog,
        outcomeAwardAmount ? parseFloat(outcomeAwardAmount) : undefined,
        outcomeAwardDate ? new Date(outcomeAwardDate) : undefined
      );
      if (result.data) {
        setContract((prev) => ({ ...prev, ...result.data! }));
        setShowOutcomeDialog(null);
        setOutcomeAwardAmount("");
        setOutcomeAwardDate("");
      }
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleRevert = async () => {
    setIsReverting(true);
    try {
      const result = await revertGovContractStatus(contract.id);
      if (result.data) {
        setContract((prev) => ({ ...prev, status: result.data!.status }));
      }
    } finally {
      setIsReverting(false);
    }
  };

  const handleSaveContact = async () => {
    setIsSavingContact(true);
    try {
      if (editingContact) {
        const result = await updateGovContractContact(editingContact.id, {
          name: contactForm.name,
          title: contactForm.title || null,
          email: contactForm.email || null,
          phone: contactForm.phone || null,
          organization: contactForm.organization || null,
          role: contactForm.role,
          notes: contactForm.notes || null,
        });
        if (result.data) {
          setContacts((prev) =>
            prev.map((c) => (c.id === editingContact.id ? { ...c, ...result.data! } : c))
          );
        }
      } else {
        const result = await createGovContractContact({
          govContractId: contract.id,
          name: contactForm.name,
          title: contactForm.title || undefined,
          email: contactForm.email || undefined,
          phone: contactForm.phone || undefined,
          organization: contactForm.organization || undefined,
          role: contactForm.role,
          notes: contactForm.notes || undefined,
        });
        if (result.data) {
          setContacts((prev) => [result.data!, ...prev]);
        }
      }
      setIsContactDialogOpen(false);
      setEditingContact(null);
      setContactForm({ name: "", title: "", email: "", phone: "", organization: "", role: "CONTRACTING_OFFICER", notes: "" });
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    const result = await deleteGovContractContact(id);
    if (result.data) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setIsAddingNote(true);
    try {
      const result = await addGovContractNote(contract.id, newNote.trim());
      if (result.data) {
        setActivities((prev) => [result.data!, ...prev]);
        setNewNote("");
      }
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleGenerateDocument = async () => {
    setIsGenerating(true);
    setGeneratedContent("");
    try {
      const res = await fetch("/api/chat/gov-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractId: contract.id,
          documentType: selectedDocType,
          additionalContext: additionalContext.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.content) {
        setGeneratedContent(data.content);
        // Save to the appropriate field
        const docConfig = DOC_TYPES.find((d) => d.value === selectedDocType);
        if (docConfig) {
          await saveGovContractDocument(contract.id, docConfig.field, data.content);
        }
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openEditContact = (contact: ContactData) => {
    setEditingContact(contact);
    setContactForm({
      name: contact.name,
      title: contact.title || "",
      email: contact.email || "",
      phone: contact.phone || "",
      organization: contact.organization || "",
      role: contact.role,
      notes: contact.notes || "",
    });
    setIsContactDialogOpen(true);
  };

  const openNewContact = () => {
    setEditingContact(null);
    setContactForm({ name: "", title: "", email: "", phone: "", organization: "", role: "CONTRACTING_OFFICER", notes: "" });
    setIsContactDialogOpen(true);
  };

  const tabs: { id: TabType; label: string; icon: typeof FileText }[] = [
    { id: "overview", label: "Overview", icon: FileText },
    { id: "contacts", label: `Contacts (${contacts.length})`, icon: Users },
    { id: "documents", label: "Documents", icon: Sparkles },
    { id: "activity", label: `Activity (${activities.length})`, icon: Clock },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/sam-gov">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-text-dark text-2xl font-bold">{contract.title}</h1>
          <p className="text-sm text-text-secondary">
            {contract.agency}
            {contract.solicitationNumber && ` | ${contract.solicitationNumber}`}
          </p>
        </div>
        {contract.samGovUrl && (
          <a href={contract.samGovUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 size-3" />
              SAM.gov
            </Button>
          </a>
        )}
      </div>

      {/* Status Stepper */}
      <Card className="p-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {STATUS_ORDER.filter((s) => s !== "LOST").map((status, idx) => {
            const isCurrent = contract.status === status;
            const isPast = currentStatusIndex > idx || (contract.status === "LOST" && idx <= 10);
            const isLost = contract.status === "LOST" && status === "WON";

            return (
              <div key={status} className="flex shrink-0 items-center">
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isPast
                        ? "bg-success-100 text-success-700"
                        : isLost
                          ? "bg-destructive-100 text-destructive-700"
                          : "bg-secondary-100 text-secondary-500"
                  }`}
                >
                  {STATUS_LABELS[status]}
                </div>
                {idx < STATUS_ORDER.length - 2 && (
                  <ChevronRight className="mx-1 size-3 shrink-0 text-secondary-400" />
                )}
              </div>
            );
          })}
          {contract.status === "LOST" && (
            <>
              <ChevronRight className="mx-1 size-3 shrink-0 text-secondary-400" />
              <div className="bg-destructive-100 text-destructive-700 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium">
                Lost
              </div>
            </>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {canRevert && (
            <Button variant="outline" size="sm" onClick={handleRevert} disabled={isReverting}>
              <ChevronLeft className="mr-1 size-3" />
              {isReverting ? "Reverting..." : "Revert"}
            </Button>
          )}
          {canAdvance && (
            <Button size="sm" onClick={handleAdvance} disabled={isAdvancing}>
              {isAdvancing ? "Advancing..." : `Advance to ${STATUS_LABELS[STATUS_ORDER[currentStatusIndex + 1]]}`}
              <ChevronRight className="ml-1 size-3" />
            </Button>
          )}
          {contract.status === "MONITORING_AWARD" && (
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" onClick={() => setShowOutcomeDialog("WON")}>
                <Award className="mr-1 size-3" />
                Mark as Won
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowOutcomeDialog("LOST")}>
                <XCircle className="mr-1 size-3" />
                Mark as Lost
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "hover:text-text-dark border-transparent text-text-secondary"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <Card className="p-6">
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Title</Label>
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div>
                <Label>Agency</Label>
                <Input
                  value={editForm.agency}
                  onChange={(e) => setEditForm((p) => ({ ...p, agency: e.target.value }))}
                />
              </div>
              <div>
                <Label>Sub-Agency</Label>
                <Input
                  value={editForm.subAgency}
                  onChange={(e) => setEditForm((p) => ({ ...p, subAgency: e.target.value }))}
                />
              </div>
              <div>
                <Label>Solicitation Number</Label>
                <Input
                  value={editForm.solicitationNumber}
                  onChange={(e) => setEditForm((p) => ({ ...p, solicitationNumber: e.target.value }))}
                />
              </div>
              <div>
                <Label>NAICS Code</Label>
                <Input
                  value={editForm.naicsCode}
                  onChange={(e) => setEditForm((p) => ({ ...p, naicsCode: e.target.value }))}
                />
              </div>
              <div>
                <Label>Set-Aside Type</Label>
                <Select
                  value={editForm.setAsideType}
                  onValueChange={(v) => setEditForm((p) => ({ ...p, setAsideType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SET_ASIDE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Estimated Value ($)</Label>
                <Input
                  type="number"
                  value={editForm.estimatedValue}
                  onChange={(e) => setEditForm((p) => ({ ...p, estimatedValue: e.target.value }))}
                />
              </div>
              <div>
                <Label>Award Amount ($)</Label>
                <Input
                  type="number"
                  value={editForm.awardAmount}
                  onChange={(e) => setEditForm((p) => ({ ...p, awardAmount: e.target.value }))}
                />
              </div>
              <div>
                <Label>Response Deadline</Label>
                <Input
                  type="date"
                  value={editForm.responseDeadline}
                  onChange={(e) => setEditForm((p) => ({ ...p, responseDeadline: e.target.value }))}
                />
              </div>
              <div>
                <Label>Expected Solicitation Date</Label>
                <Input
                  type="date"
                  value={editForm.expectedSolicitationDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, expectedSolicitationDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Place of Performance</Label>
                <Input
                  value={editForm.placeOfPerformance}
                  onChange={(e) => setEditForm((p) => ({ ...p, placeOfPerformance: e.target.value }))}
                />
              </div>
              <div>
                <Label>SAM.gov URL</Label>
                <Input
                  value={editForm.samGovUrl}
                  onChange={(e) => setEditForm((p) => ({ ...p, samGovUrl: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
                rows={4}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex justify-start">
              <Button onClick={handleSaveOverview} disabled={isSaving}>
                <Save className="mr-2 size-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === "contacts" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-text-dark text-lg font-semibold">Points of Contact</h2>
            <Button onClick={openNewContact} size="sm">
              <Plus className="mr-2 size-4" />
              Add Contact
            </Button>
          </div>
          {contacts.length === 0 ? (
            <Card className="p-8 text-center">
              <Users className="mx-auto size-8 text-text-secondary" />
              <p className="mt-2 text-sm text-text-secondary">No contacts added yet</p>
              <Button onClick={openNewContact} variant="outline" size="sm" className="mt-4">
                <Plus className="mr-2 size-4" />
                Add First Contact
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {contacts.map((contact) => (
                <Card key={contact.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-text-dark font-medium">{contact.name}</h3>
                      {contact.title && (
                        <p className="text-sm text-text-secondary">{contact.title}</p>
                      )}
                      {contact.organization && (
                        <p className="text-xs text-text-secondary">{contact.organization}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {CONTACT_ROLE_LABELS[contact.role]}
                      </Badge>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEditContact(contact)}>
                        <Edit className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => handleDeleteContact(contact.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="text-primary flex items-center gap-1 text-xs hover:underline">
                        <Mail className="size-3" />
                        {contact.email}
                      </a>
                    )}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="text-primary flex items-center gap-1 text-xs hover:underline">
                        <Phone className="size-3" />
                        {contact.phone}
                      </a>
                    )}
                  </div>
                  {contact.notes && (
                    <p className="mt-2 text-xs text-text-secondary">{contact.notes}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <h2 className="text-text-dark text-lg font-semibold">AI Document Generator</h2>
            <p className="mb-4 text-sm text-text-secondary">
              Generate government contract documents using Jaro.dev company knowledge and this contract&apos;s details.
            </p>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Document Type</Label>
                  <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((dt) => (
                        <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Additional Context (optional)</Label>
                <Textarea
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Any specific requirements, emphasis areas, or details to include..."
                  rows={3}
                />
              </div>
              <div>
                <Button onClick={handleGenerateDocument} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 size-4" />
                      Generate Document
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {generatedContent && (
            <Card className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-text-dark text-sm font-semibold">Generated Content</h3>
                <Button variant="outline" size="sm" onClick={handleCopyContent}>
                  {copied ? (
                    <>
                      <Check className="mr-2 size-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 size-3" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="prose prose-sm max-w-none rounded-lg border border-border bg-background-secondary/30 p-4">
                <pre className="text-text-dark whitespace-pre-wrap text-sm">{generatedContent}</pre>
              </div>
            </Card>
          )}

          {/* Show previously saved documents */}
          {(contract.goNoGoNotes || contract.callScript || contract.sourcesResponseContent || contract.proposalContent) && (
            <Card className="p-6">
              <h3 className="text-text-dark mb-4 text-sm font-semibold">Saved Documents</h3>
              <div className="flex flex-col gap-3">
                {contract.goNoGoNotes && (
                  <details className="group">
                    <summary className="text-primary cursor-pointer text-sm font-medium hover:underline">
                      Go/No-Go Analysis
                    </summary>
                    <pre className="text-text-dark mt-2 whitespace-pre-wrap rounded-lg border border-border bg-background-secondary/30 p-3 text-xs">
                      {contract.goNoGoNotes}
                    </pre>
                  </details>
                )}
                {contract.callScript && (
                  <details className="group">
                    <summary className="text-primary cursor-pointer text-sm font-medium hover:underline">
                      POC Call Script
                    </summary>
                    <pre className="text-text-dark mt-2 whitespace-pre-wrap rounded-lg border border-border bg-background-secondary/30 p-3 text-xs">
                      {contract.callScript}
                    </pre>
                  </details>
                )}
                {contract.sourcesResponseContent && (
                  <details className="group">
                    <summary className="text-primary cursor-pointer text-sm font-medium hover:underline">
                      Sources Sought Response
                    </summary>
                    <pre className="text-text-dark mt-2 whitespace-pre-wrap rounded-lg border border-border bg-background-secondary/30 p-3 text-xs">
                      {contract.sourcesResponseContent}
                    </pre>
                  </details>
                )}
                {contract.proposalContent && (
                  <details className="group">
                    <summary className="text-primary cursor-pointer text-sm font-medium hover:underline">
                      Proposal Content
                    </summary>
                    <pre className="text-text-dark mt-2 whitespace-pre-wrap rounded-lg border border-border bg-background-secondary/30 p-3 text-xs">
                      {contract.proposalContent}
                    </pre>
                  </details>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="flex flex-col gap-4">
          <Card className="p-4">
            <div className="flex gap-3">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
                className="flex-1"
              />
              <Button onClick={handleAddNote} disabled={isAddingNote || !newNote.trim()} className="self-end">
                {isAddingNote ? "Adding..." : "Add Note"}
              </Button>
            </div>
          </Card>
          <div className="flex flex-col gap-2">
            {activities.length === 0 ? (
              <Card className="p-8 text-center">
                <Clock className="mx-auto size-8 text-text-secondary" />
                <p className="mt-2 text-sm text-text-secondary">No activity yet</p>
              </Card>
            ) : (
              activities.map((activity) => {
                const Icon = ACTIVITY_ICONS[activity.type] || Clock;
                return (
                  <Card key={activity.id} className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-secondary-100 p-1.5">
                        <Icon className="size-3 text-secondary-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-text-dark text-sm">{activity.description}</p>
                        <p className="mt-1 text-xs text-text-secondary">
                          {new Date(activity.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {activity.newStatus && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {STATUS_LABELS[activity.newStatus]}
                        </Badge>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Solicitation Date Dialog */}
      <Dialog open={showSolicitationDateDialog} onOpenChange={setShowSolicitationDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Expected Solicitation Date</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Enter the expected solicitation date confirmed during the follow-up meeting. A task will be automatically created 7 days before this date.
          </p>
          <div>
            <Label>Solicitation Date</Label>
            <Input
              type="date"
              value={solicitationDate}
              onChange={(e) => setSolicitationDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={handleAdvanceWithDate} disabled={isAdvancing || !solicitationDate}>
              {isAdvancing ? "Advancing..." : "Advance to Awaiting Solicitation"}
            </Button>
            <Button variant="outline" onClick={() => setShowSolicitationDateDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outcome Dialog */}
      <Dialog open={!!showOutcomeDialog} onOpenChange={() => setShowOutcomeDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {showOutcomeDialog === "WON" ? "Mark as Won" : "Mark as Lost"}
            </DialogTitle>
          </DialogHeader>
          {showOutcomeDialog === "WON" && (
            <div className="flex flex-col gap-4">
              <div>
                <Label>Award Amount ($)</Label>
                <Input
                  type="number"
                  value={outcomeAwardAmount}
                  onChange={(e) => setOutcomeAwardAmount(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label>Award Date</Label>
                <Input
                  type="date"
                  value={outcomeAwardDate}
                  onChange={(e) => setOutcomeAwardDate(e.target.value)}
                />
              </div>
            </div>
          )}
          {showOutcomeDialog === "LOST" && (
            <p className="text-sm text-text-secondary">
              Are you sure you want to mark this contract as lost?
            </p>
          )}
          <DialogFooter>
            <Button
              onClick={handleSetOutcome}
              disabled={isAdvancing}
              variant={showOutcomeDialog === "LOST" ? "destructive" : "default"}
            >
              {isAdvancing ? "Saving..." : showOutcomeDialog === "WON" ? "Confirm Won" : "Confirm Lost"}
            </Button>
            <Button variant="outline" onClick={() => setShowOutcomeDialog(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={contactForm.name}
                onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Full name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={contactForm.title}
                  onChange={(e) => setContactForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Program Manager"
                />
              </div>
              <div>
                <Label>Role *</Label>
                <Select
                  value={contactForm.role}
                  onValueChange={(v) => setContactForm((p) => ({ ...p, role: v as GovContactRole }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTACT_ROLE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@agency.gov"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div>
              <Label>Organization</Label>
              <Input
                value={contactForm.organization}
                onChange={(e) => setContactForm((p) => ({ ...p, organization: e.target.value }))}
                placeholder="Agency or organization name"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={contactForm.notes}
                onChange={(e) => setContactForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Any notes about this contact..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveContact} disabled={isSavingContact || !contactForm.name.trim()}>
              {isSavingContact ? "Saving..." : editingContact ? "Update Contact" : "Add Contact"}
            </Button>
            <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
