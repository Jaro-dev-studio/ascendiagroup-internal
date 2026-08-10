"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Code,
  ExternalLink,
  RefreshCw,
  Loader2,
  Github,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  Eye,
  Trash,
  FileText,
  DollarSign,
  Layers,
  Check,
  X,
  XCircle,
  Inbox,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createDemo,
  updateDemo,
  deleteDemo,
  regenerateDemo,
  deleteDemoWithCleanup,
  previewDemoGeneration,
  generateDemoForClientCompany,
  setDemoAsDeployed,
  rejectProductBuild,
} from "@/lib/actions";
import { ApproveProductBuildModal } from "@/components/modals/approve-product-build-modal";
import {
  getMeetingsForDemoModal,
  getMVPSharedQuotesForDemoModal,
} from "@/lib/fetchers";
import { Demo, Company } from "@prisma/client";

// Tech stack options for demo creation
const TECH_STACK_OPTIONS = [
  { id: "nextauth", label: "NextAuth (auth.js)" },
  { id: "prisma", label: "Prisma" },
  { id: "neondb", label: "NeonDB postgres" },
  { id: "nextjs", label: "Next.js" },
  { id: "tailwind", label: "TailwindCSS" },
  { id: "shadcn", label: "ShadCN" },
  { id: "puppeteer", label: "Puppeteer" },
  { id: "stripe", label: "Stripe" },
] as const;

// Interfaces for fetched data
interface TemplateRepo {
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  isPrivate: boolean;
  updatedAt: string;
  pushedAt: string;
  defaultBranch: string;
}

interface MeetingForModal {
  id: string;
  title: string;
  startTime: Date;
  hasTranscript: boolean;
  transcriptLength: number;
  clientCompany: { id: string; name: string } | null;
}

interface MVPQuoteForModal {
  id: string;
  token: string;
  companyName: string;
  total: number;
  deposit: number;
  productSummary: unknown;
  lineItems: unknown;
  expiresAt: Date;
  createdAt: Date;
  mvpCallMap: {
    id: string;
    name: string;
    clientCompany: { id: string; name: string } | null;
  };
}

interface DemoWithClient extends Demo {
  clientCompany: { id: string; name: string } | null;
}

interface CompanyWithMeetings extends Company {
  meetings: Array<{
    id: string;
    title: string;
    formattedTranscript: string;
  }>;
  users: Array<{ email: string }>;
}

interface DemosClientProps {
  demos: DemoWithClient[];
  clientCompaniesWithoutDemos: CompanyWithMeetings[];
  isAdmin: boolean;
}

interface PreviewData {
  clientCompany: { id: string; name: string };
  proposedRepoName: string;
  branding: {
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    companyName: string;
  } | null;
  requirements: {
    appType: string;
    appDescription: string;
    targetUsers: string;
    keyFeatures: Array<{ name: string; description: string }>;
    uiPreferences: string[];
  } | null;
  transcript: string | null;
}

function getCursorAgentStatusLabel(cursorStatus: string | null): string {
  switch (cursorStatus) {
    case "CREATING":
      return "Setting up...";
    case "RUNNING":
      return "Building code...";
    case "FINISHED":
      return "Completed";
    case "ERROR":
      return "Error";
    case "STOPPED":
      return "Stopped";
    default:
      return "Generating";
  }
}

function getStatusBadge(status: string, cursorAgentStatus?: string | null) {
  switch (status) {
    case "queued":
      return (
        <Badge variant="outline" className="gap-1 border-warning-200 bg-warning-50 text-warning-700">
          <Inbox className="size-3" />
          Awaiting approval
        </Badge>
      );
    case "rejected":
      return (
        <Badge variant="outline" className="gap-1 border-secondary-200 bg-secondary-50 text-secondary-700">
          <XCircle className="size-3" />
          Rejected
        </Badge>
      );
    case "ready":
      return (
        <Badge variant="outline" className="gap-1 border-success-200 bg-success-50 text-success-700">
          <CheckCircle className="size-3" />
          Ready
        </Badge>
      );
    case "generating":
      return (
        <Badge variant="outline" className="gap-1 border-primary-200 bg-primary-50 text-primary-700">
          <Loader2 className="size-3 animate-spin" />
          {getCursorAgentStatusLabel(cursorAgentStatus || null)}
        </Badge>
      );
    case "deploying":
      return (
        <Badge variant="outline" className="gap-1 border-warning-200 bg-warning-50 text-warning-700">
          <Clock className="size-3" />
          Deploying
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="gap-1 border-danger-200 bg-danger-50 text-danger-700">
          <AlertCircle className="size-3" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1 border-secondary-200 bg-secondary-50 text-secondary-700">
          <Clock className="size-3" />
          Pending
        </Badge>
      );
  }
}

export function DemosClient({
  demos: initialDemos,
  clientCompaniesWithoutDemos: initialClients,
  isAdmin,
}: DemosClientProps) {
  const [demos, setDemos] = useState(initialDemos);
  const [clientsWithoutDemos, setClientsWithoutDemos] = useState(initialClients);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isGenerateClientDialogOpen, setIsGenerateClientDialogOpen] = useState(false);
  const [editingDemo, setEditingDemo] = useState<DemoWithClient | null>(null);
  const [deletingDemo, setDeletingDemo] = useState<DemoWithClient | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete options
  const [deleteGitHub, setDeleteGitHub] = useState(true);
  const [deleteVercel, setDeleteVercel] = useState(true);

  // Prompt preview
  const [viewingPromptDemo, setViewingPromptDemo] = useState<DemoWithClient | null>(null);
  const [isPromptCopied, setIsPromptCopied] = useState(false);

  // Approval queue
  const [approvingBuild, setApprovingBuild] = useState<DemoWithClient | null>(null);
  const [rejectingBuild, setRejectingBuild] = useState<DemoWithClient | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  // Generate for client
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [customRepoName, setCustomRepoName] = useState<string>("");
  const [clientTemplateRepo, setClientTemplateRepo] = useState<string>("");
  const [clientTemplates, setClientTemplates] = useState<TemplateRepo[]>([]);
  const [isLoadingClientTemplates, setIsLoadingClientTemplates] = useState(false);

  const [createFormData, setCreateFormData] = useState({
    name: "",
    prompt: "",
    templateRepo: "",
    meetingId: "",
    mvpSharedQuoteId: "",
    techStack: [] as string[],
  });

  const [editFormData, setEditFormData] = useState({
    name: "",
  });

  // Data for enhanced create modal
  const [templates, setTemplates] = useState<TemplateRepo[]>([]);
  const [meetings, setMeetings] = useState<MeetingForModal[]>([]);
  const [mvpQuotes, setMVPQuotes] = useState<MVPQuoteForModal[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);

  // Fetch templates from GitHub API
  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await fetch("/api/github/templates");
      const result = await response.json();
      if (result.data) {
        setTemplates(result.data);
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  // Fetch meetings and quotes for modal
  const fetchMeetingsAndQuotes = useCallback(async () => {
    setIsLoadingMeetings(true);
    setIsLoadingQuotes(true);
    try {
      const [meetingsResult, quotesResult] = await Promise.all([
        getMeetingsForDemoModal(),
        getMVPSharedQuotesForDemoModal(),
      ]);
      if (meetingsResult.data) {
        setMeetings(meetingsResult.data);
      }
      if (quotesResult.data) {
        setMVPQuotes(quotesResult.data);
      }
    } catch (err) {
      console.error("Error fetching meetings/quotes:", err);
    } finally {
      setIsLoadingMeetings(false);
      setIsLoadingQuotes(false);
    }
  }, []);

  const handleOpenCreateDialog = () => {
    setCreateFormData({
      name: "",
      prompt: "",
      templateRepo: "",
      meetingId: "",
      mvpSharedQuoteId: "",
      techStack: [],
    });
    setError(null);
    setIsCreateDialogOpen(true);
    // Fetch data when dialog opens
    fetchTemplates();
    fetchMeetingsAndQuotes();
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setCreateFormData({
      name: "",
      prompt: "",
      templateRepo: "",
      meetingId: "",
      mvpSharedQuoteId: "",
      techStack: [],
    });
    setError(null);
  };

  // Toggle tech stack item
  const toggleTechStack = (techId: string) => {
    setCreateFormData((prev) => ({
      ...prev,
      techStack: prev.techStack.includes(techId)
        ? prev.techStack.filter((t) => t !== techId)
        : [...prev.techStack, techId],
    }));
  };

  const handleOpenEditDialog = (demo: DemoWithClient) => {
    setEditingDemo(demo);
    setEditFormData({
      name: demo.name,
    });
    setError(null);
    setIsEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingDemo(null);
    setEditFormData({ name: "" });
    setError(null);
  };

  const handleOpenDeleteDialog = (demo: DemoWithClient) => {
    setDeletingDemo(demo);
    setDeleteGitHub(true);
    setDeleteVercel(true);
    setError(null);
    setIsDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingDemo(null);
    setError(null);
  };

  const fetchClientTemplates = useCallback(async () => {
    setIsLoadingClientTemplates(true);
    try {
      const response = await fetch("/api/github/templates");
      const result = await response.json();
      if (result.data) {
        setClientTemplates(result.data);
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
    } finally {
      setIsLoadingClientTemplates(false);
    }
  }, []);

  const handleOpenGenerateClientDialog = () => {
    setSelectedClientId("");
    setPreviewData(null);
    setClientTemplateRepo("");
    setError(null);
    setIsGenerateClientDialogOpen(true);
    fetchClientTemplates();
  };

  const handleCloseGenerateClientDialog = () => {
    setIsGenerateClientDialogOpen(false);
    setSelectedClientId("");
    setPreviewData(null);
    setClientTemplateRepo("");
    setError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.name.trim() || !createFormData.prompt.trim()) return;

    if (!createFormData.templateRepo) {
      setError("Select a template repository");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // Convert tech stack IDs to labels
      const techStackLabels = createFormData.techStack.map((id) => {
        const option = TECH_STACK_OPTIONS.find((opt) => opt.id === id);
        return option?.label || id;
      });

      const result = await createDemo({
        name: createFormData.name,
        prompt: createFormData.prompt,
        templateRepo: createFormData.templateRepo,
        meetingId: createFormData.meetingId && createFormData.meetingId !== "none" ? createFormData.meetingId : undefined,
        mvpSharedQuoteId: createFormData.mvpSharedQuoteId && createFormData.mvpSharedQuoteId !== "none" ? createFormData.mvpSharedQuoteId : undefined,
        techStack: techStackLabels.length > 0 ? techStackLabels : undefined,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.data) {
        setDemos([{ ...result.data, clientCompany: null }, ...demos]);
      }
      handleCloseCreateDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create demo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDemo || !editFormData.name.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await updateDemo(editingDemo.id, {
        name: editFormData.name,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setDemos(
        demos.map((d) =>
          d.id === editingDemo.id ? { ...d, ...result.data } : d
        )
      );
      handleCloseEditDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update demo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWithCleanup = async () => {
    if (!deletingDemo) return;

    setIsDeleting(deletingDemo.id);
    setError(null);
    try {
      const result = await deleteDemoWithCleanup(deletingDemo.id, {
        deleteGitHub,
        deleteVercel,
      });
      if (result.error && !result.data?.deleted) {
        setError(result.error);
        return;
      }

      // Remove from list
      setDemos(demos.filter((d) => d.id !== deletingDemo.id));

      // Add client back to available list if it was linked
      if (deletingDemo.clientCompanyId && deletingDemo.clientCompany) {
        const clientToRestore = initialClients.find(
          (c) => c.id === deletingDemo.clientCompanyId
        );
        if (clientToRestore) {
          setClientsWithoutDemos([...clientsWithoutDemos, clientToRestore]);
        }
      }

      handleCloseDeleteDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete demo");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSimpleDelete = async (demoId: string) => {
    if (!confirm("Are you sure you want to delete this demo? This will only remove the database record.")) {
      return;
    }

    setIsDeleting(demoId);
    try {
      const result = await deleteDemo(demoId);
      if (result.error) {
        console.error(result.error);
        return;
      }
      setDemos(demos.filter((d) => d.id !== demoId));
    } catch (err) {
      console.error("Error deleting demo:", err);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRegenerateDemo = async (demoId: string) => {
    if (!confirm("Are you sure you want to regenerate this demo? This will launch a new AI agent.")) {
      return;
    }

    setIsRegenerating(demoId);
    try {
      const result = await regenerateDemo(demoId);
      if (result.error) {
        console.error(result.error);
        return;
      }

      if (result.data) {
        setDemos(
          demos.map((d) => (d.id === demoId ? { ...d, ...result.data } : d))
        );
      }
    } catch (err) {
      console.error("Error regenerating demo:", err);
    } finally {
      setIsRegenerating(null);
    }
  };

  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  // Sync status for demos in deploying/generating state on page load
  useEffect(() => {
    const syncPendingDemos = async () => {
      const demosToSync = demos.filter(
        (d) => d.status === "deploying" || d.status === "generating"
      );

      for (const demo of demosToSync) {
        try {
          const response = await fetch(`/api/demos/${demo.id}/sync`, {
            method: "POST",
          });
          const result = await response.json();

          if (result.data && result.data.newStatus) {
            setDemos((prevDemos) =>
              prevDemos.map((d) =>
                d.id === demo.id ? { ...d, status: result.data.newStatus } : d
              )
            );
          }
        } catch (err) {
          console.error(`Error syncing demo ${demo.id} status:`, err);
        }
      }
    };

    syncPendingDemos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleSyncStatus = async (demoId: string) => {
    setIsSyncing(demoId);
    try {
      const response = await fetch(`/api/demos/${demoId}/sync`, {
        method: "POST",
      });
      const result = await response.json();

      if (result.data && result.data.newStatus) {
        setDemos(
          demos.map((d) =>
            d.id === demoId ? { ...d, status: result.data.newStatus } : d
          )
        );
      }
    } catch (err) {
      console.error("Error syncing demo status:", err);
    } finally {
      setIsSyncing(null);
    }
  };

  const [isSettingDeployed, setIsSettingDeployed] = useState<string | null>(null);

  const handleSetAsDeployed = async (demoId: string) => {
    setIsSettingDeployed(demoId);
    try {
      const result = await setDemoAsDeployed(demoId);
      if (result.error) {
        console.error(result.error);
        return;
      }
      if (result.data) {
        setDemos(
          demos.map((d) =>
            d.id === demoId ? { ...d, ...result.data } : d
          )
        );
      }
    } catch (err) {
      console.error("Error setting demo as deployed:", err);
    } finally {
      setIsSettingDeployed(null);
    }
  };

  const handlePreviewGeneration = async () => {
    if (!selectedClientId) return;

    setIsLoadingPreview(true);
    setError(null);
    setPreviewData(null);

    try {
      const result = await previewDemoGeneration(selectedClientId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPreviewData(result.data);
      // Initialize custom repo name with proposed name
      if (result.data) {
        setCustomRepoName(result.data.proposedRepoName);
      }
      // Close the client select dialog and open the preview dialog
      setIsGenerateClientDialogOpen(false);
      setIsPreviewDialogOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleGenerateForClient = async () => {
    // Use previewData if available, otherwise use selectedClientId
    const clientId = previewData?.clientCompany.id || selectedClientId;
    if (!clientId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await generateDemoForClientCompany(
        clientId,
        customRepoName || undefined,
        clientTemplateRepo
      );
      if (result.error) {
        setError(result.error);
        return;
      }

      // Close dialogs and reload page to get updated data
      setIsPreviewDialogOpen(false);
      setIsGenerateClientDialogOpen(false);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate demo");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenRejectDialog = (build: DemoWithClient) => {
    setRejectingBuild(build);
    setRejectionReason("");
    setRejectError(null);
  };

  const handleConfirmReject = async () => {
    if (!rejectingBuild) return;

    setIsRejecting(true);
    setRejectError(null);
    try {
      const result = await rejectProductBuild(rejectingBuild.id, rejectionReason || undefined);
      if (result.error) {
        setRejectError(result.error);
        return;
      }

      setDemos(
        demos.map((d) =>
          d.id === rejectingBuild.id
            ? { ...d, status: "rejected", rejectionReason: rejectionReason || null }
            : d
        )
      );
      setRejectingBuild(null);
    } catch (err) {
      console.error("Error rejecting build:", err);
      setRejectError("Failed to reject build");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleOpenGitHub = (demo: DemoWithClient) => {
    if (demo.githubRepoUrl) {
      window.open(demo.githubRepoUrl, "_blank");
    }
  };

  const handleOpenDeployment = (demo: DemoWithClient) => {
    if (demo.vercelDeployUrl) {
      window.open(demo.vercelDeployUrl, "_blank");
    }
  };

  const handleOpenPromptDialog = (demo: DemoWithClient) => {
    setIsPromptCopied(false);
    setViewingPromptDemo(demo);
  };

  const handleCopyPrompt = async () => {
    if (!viewingPromptDemo) return;
    try {
      await navigator.clipboard.writeText(viewingPromptDemo.prompt);
      setIsPromptCopied(true);
      setTimeout(() => setIsPromptCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy prompt:", err);
    }
  };

  const queuedBuilds = demos.filter((demo) => demo.status === "queued");
  const activeDemos = demos.filter((demo) => demo.status !== "queued");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-900">Products</h1>
          <p className="text-secondary-600">AI-built client products</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && clientsWithoutDemos.length > 0 && (
            <Button variant="outline" size="sm" className="sm:size-default" onClick={handleOpenGenerateClientDialog}>
              <Users className="mr-2 size-4" />
              <span className="hidden sm:inline">Generate for Client</span>
              <span className="sm:hidden">For Client</span>
            </Button>
          )}
          <Button onClick={handleOpenCreateDialog} size="sm" className="sm:size-default">
            <Plus className="mr-2 size-4" />
            New Product
          </Button>
        </div>
      </div>

      {isAdmin && queuedBuilds.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Inbox className="size-5 text-warning-600" />
            <h2 className="text-lg font-semibold text-secondary-900">Pending Approval</h2>
            <Badge variant="outline" className="border-warning-200 bg-warning-50 text-warning-700">
              {queuedBuilds.length}
            </Badge>
          </div>
          <div className="flex flex-col gap-4">
            {queuedBuilds.map((build) => (
              <Card key={build.id} className="p-6">
                <div className="flex flex-col gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-secondary-900">{build.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {getStatusBadge(build.status)}
                      {build.clientCompany && (
                        <Badge variant="outline" className="gap-1">
                          <Users className="size-3" />
                          {build.clientCompany.name}
                        </Badge>
                      )}
                      <span className="text-xs text-secondary-500">
                        Queued {new Date(build.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-md bg-secondary-50 p-4">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-secondary-500">
                      Generated prompt
                    </p>
                    <p className="line-clamp-6 whitespace-pre-wrap text-sm text-secondary-700">
                      {build.prompt}
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto p-0 text-xs"
                      onClick={() => handleOpenPromptDialog(build)}
                    >
                      <Eye className="mr-1 size-3" />
                      View full prompt
                    </Button>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button onClick={() => setApprovingBuild(build)} className="sm:w-auto">
                      <Check className="mr-2 size-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleOpenRejectDialog(build)}
                      className="sm:w-auto"
                    >
                      <X className="mr-2 size-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {activeDemos.length === 0 ? (
        <Card className="p-8 text-center">
          <Code className="mx-auto size-12 text-secondary-400" />
          <h3 className="mt-4 text-lg font-medium text-secondary-900">
            No products yet
          </h3>
          <p className="mt-2 text-secondary-600">
            Get started by creating your first AI-built product
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {isAdmin && clientsWithoutDemos.length > 0 && (
              <Button variant="outline" onClick={handleOpenGenerateClientDialog}>
                <Users className="mr-2 size-4" />
                Generate for Client
              </Button>
            )}
            <Button onClick={handleOpenCreateDialog}>
              <Plus className="mr-2 size-4" />
              Create Product
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {activeDemos.map((demo) => (
            <Card key={demo.id} className="relative p-6">
              {/* Loading overlay for regenerating */}
              {isRegenerating === demo.id && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-white/90">
                  <Loader2 className="size-8 animate-spin text-primary-500" />
                  <p className="mt-2 text-sm font-medium text-secondary-700">
                    Regenerating...
                  </p>
                  <p className="mt-1 text-xs text-secondary-500">
                    Launching AI agent
                  </p>
                </div>
              )}

              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-secondary-900">
                    {demo.name}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {getStatusBadge(demo.status, demo.cursorAgentStatus)}
                    {demo.clientCompany && (
                      <Badge variant="outline" className="gap-1">
                        <Users className="size-3" />
                        {demo.clientCompany.name}
                      </Badge>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleOpenPromptDialog(demo)}>
                      <FileText className="mr-2 size-4" />
                      View Prompt
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => window.open(`/demo/${demo.slug || demo.id}`, "_blank")}
                    >
                      <ExternalLink className="mr-2 size-4" />
                      View Product
                    </DropdownMenuItem>
                    {demo.vercelDeployUrl && (
                      <DropdownMenuItem onClick={() => handleOpenDeployment(demo)}>
                        <ExternalLink className="mr-2 size-4" />
                        Open Deployment
                      </DropdownMenuItem>
                    )}
                    {demo.githubRepoUrl && (
                      <DropdownMenuItem onClick={() => handleOpenGitHub(demo)}>
                        <Github className="mr-2 size-4" />
                        Open GitHub
                      </DropdownMenuItem>
                    )}
                    {demo.vercelProjectId && demo.githubRepoName && (
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(
                            `https://vercel.com/staz-limited/${demo.githubRepoName}`,
                            "_blank"
                          )
                        }
                      >
                        <ExternalLink className="mr-2 size-4" />
                        Open Vercel
                      </DropdownMenuItem>
                    )}
                    {demo.cursorAgentId && (
                      <DropdownMenuItem
                        onClick={() =>
                          window.open(
                            demo.cursorAgentUrl || `https://cursor.com/agents?id=${demo.cursorAgentId}`,
                            "_blank"
                          )
                        }
                      >
                        <Code className="mr-2 size-4" />
                        Open Cursor Agent
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleOpenEditDialog(demo)}>
                      <Edit className="mr-2 size-4" />
                      Rename
                    </DropdownMenuItem>
                    {demo.status === "generating" && demo.cursorAgentId && (
                      <DropdownMenuItem
                        onClick={() => handleSyncStatus(demo.id)}
                        disabled={isSyncing === demo.id}
                      >
                        {isSyncing === demo.id ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 size-4" />
                        )}
                        Sync Status
                      </DropdownMenuItem>
                    )}
                    {demo.status !== "ready" && (
                      <DropdownMenuItem
                        onClick={() => handleSetAsDeployed(demo.id)}
                        disabled={isSettingDeployed === demo.id}
                      >
                        {isSettingDeployed === demo.id ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-2 size-4" />
                        )}
                        Set as Deployed
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => handleRegenerateDemo(demo.id)}
                      disabled={
                        isRegenerating === demo.id ||
                        demo.status === "generating" ||
                        demo.status === "deploying"
                      }
                    >
                      {isRegenerating === demo.id ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 size-4" />
                      )}
                      Regenerate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {isAdmin && (demo.githubRepoName || demo.vercelProjectId) ? (
                      <DropdownMenuItem
                        onClick={() => handleOpenDeleteDialog(demo)}
                        className="text-danger-600 focus:text-danger-600"
                      >
                        <Trash className="mr-2 size-4" />
                        Delete with Cleanup...
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleSimpleDelete(demo.id)}
                        disabled={isDeleting === demo.id}
                        className="text-danger-600 focus:text-danger-600"
                      >
                        <Trash2 className="mr-2 size-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <p className="mt-2 line-clamp-3 text-sm text-secondary-600">
                {demo.prompt}
              </p>
              <Button
                variant="link"
                size="sm"
                className="mt-1 h-auto p-0 text-xs"
                onClick={() => handleOpenPromptDialog(demo)}
              >
                <Eye className="mr-1 size-3" />
                View full prompt
              </Button>

              {demo.errorMessage && demo.status === "failed" && (
                <p className="mt-2 text-xs text-danger-600">{demo.errorMessage}</p>
              )}

              {demo.rejectionReason && demo.status === "rejected" && (
                <p className="mt-2 text-xs text-secondary-500">
                  Rejected: {demo.rejectionReason}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-secondary-200 pt-4">
                <p className="text-xs text-secondary-500">
                  Created {new Date(demo.createdAt).toLocaleDateString()}
                </p>
                <div className="flex gap-1">
                  {demo.githubRepoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => handleOpenGitHub(demo)}
                    >
                      <Github className="size-3" />
                    </Button>
                  )}
                  {demo.vercelDeployUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() => handleOpenDeployment(demo)}
                    >
                      <ExternalLink className="size-3" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Product</DialogTitle>
            <DialogDescription>
              Create a new AI-built product with optional context from meetings and quotes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-600">
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={createFormData.name}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, name: e.target.value })
                }
                placeholder="Enter product name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">Prompt</Label>
              <Textarea
                id="prompt"
                value={createFormData.prompt}
                onChange={(e) =>
                  setCreateFormData({ ...createFormData, prompt: e.target.value })
                }
                placeholder="Describe the application you want to generate..."
                rows={4}
                required
              />
              <p className="text-xs text-secondary-500">
                The AI agent will first create a PLAN.md, then implement the first steps.
              </p>
            </div>

            {/* Template Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Github className="size-4" />
                Template Repository *
              </Label>
              <Select
                value={createFormData.templateRepo}
                onValueChange={(value) =>
                  setCreateFormData({ ...createFormData, templateRepo: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingTemplates ? "Loading templates..." : "Select a template"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.name} value={template.name}>
                      <div className="flex flex-col">
                        <span>{template.name}</span>
                        {template.description && (
                          <span className="text-xs text-secondary-500">
                            {template.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Meeting Selection (for transcript) */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileText className="size-4" />
                Call Transcript
              </Label>
              <Select
                value={createFormData.meetingId}
                onValueChange={(value) =>
                  setCreateFormData({ ...createFormData, meetingId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingMeetings ? "Loading meetings..." : "Select a meeting (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No transcript</SelectItem>
                  {meetings.map((meeting) => (
                    <SelectItem key={meeting.id} value={meeting.id}>
                      <div className="flex items-center gap-2">
                        <span>{meeting.title}</span>
                        {meeting.hasTranscript && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(meeting.transcriptLength / 1000)}k chars
                          </Badge>
                        )}
                        {meeting.clientCompany && (
                          <span className="text-xs text-secondary-500">
                            ({meeting.clientCompany.name})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-secondary-500">
                The full transcript will be included as context for the AI agent.
              </p>
            </div>

            {/* MVP Quote Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="size-4" />
                MVP Quote
              </Label>
              <Select
                value={createFormData.mvpSharedQuoteId}
                onValueChange={(value) =>
                  setCreateFormData({ ...createFormData, mvpSharedQuoteId: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingQuotes ? "Loading quotes..." : "Select a quote (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No quote</SelectItem>
                  {mvpQuotes.map((quote) => (
                    <SelectItem key={quote.id} value={quote.id}>
                      <div className="flex items-center gap-2">
                        <span>{quote.companyName}</span>
                        <Badge variant="outline" className="text-xs">
                          ${quote.total.toLocaleString()}
                        </Badge>
                        <span className="text-xs text-secondary-500">
                          ({quote.mvpCallMap.name})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-secondary-500">
                The quote details (pages, APIs, features) will guide the AI agent.
              </p>
            </div>

            {/* Tech Stack Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Layers className="size-4" />
                Tech Stack
              </Label>
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-secondary-200 p-3">
                {TECH_STACK_OPTIONS.map((tech) => (
                  <div key={tech.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`tech-${tech.id}`}
                      checked={createFormData.techStack.includes(tech.id)}
                      onCheckedChange={() => toggleTechStack(tech.id)}
                    />
                    <Label
                      htmlFor={`tech-${tech.id}`}
                      className="cursor-pointer text-sm font-normal"
                    >
                      {tech.label}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-secondary-500">
                Selected technologies will be required in the generated app.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !createFormData.name.trim() ||
                  !createFormData.prompt.trim() ||
                  !createFormData.templateRepo
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Product"
                )}
              </Button>
              <Button type="button" variant="outline" onClick={handleCloseCreateDialog}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit/Rename Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-600">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, name: e.target.value })
                }
                placeholder="Enter product name"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="submit" disabled={isSubmitting || !editFormData.name.trim()}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCloseEditDialog}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete with Cleanup Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product with Cleanup</DialogTitle>
            <DialogDescription>
              Choose what to delete along with the product record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-600">
                {error}
              </div>
            )}
            <div className="rounded-lg border border-secondary-200 p-4">
              <p className="font-medium text-secondary-900">{deletingDemo?.name}</p>
              {deletingDemo?.clientCompany && (
                <p className="text-sm text-secondary-600">
                  Client: {deletingDemo.clientCompany.name}
                </p>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="delete-github"
                  checked={deleteGitHub}
                  onCheckedChange={(checked) => setDeleteGitHub(checked === true)}
                />
                <Label htmlFor="delete-github" className="flex items-center gap-2">
                  <Github className="size-4" />
                  Delete GitHub repository
                  {deletingDemo?.githubRepoName && (
                    <span className="text-xs text-secondary-500">
                      ({deletingDemo.githubRepoName})
                    </span>
                  )}
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="delete-vercel"
                  checked={deleteVercel}
                  onCheckedChange={(checked) => setDeleteVercel(checked === true)}
                />
                <Label htmlFor="delete-vercel" className="flex items-center gap-2">
                  <ExternalLink className="size-4" />
                  Delete Vercel project
                  {deletingDemo?.vercelProjectId && (
                    <span className="text-xs text-secondary-500">
                      ({deletingDemo.vercelProjectId})
                    </span>
                  )}
                </Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="destructive"
                onClick={handleDeleteWithCleanup}
                disabled={isDeleting === deletingDemo?.id}
              >
                {isDeleting === deletingDemo?.id ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </Button>
              <Button variant="outline" onClick={handleCloseDeleteDialog}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate for Client Dialog - Select client then preview */}
      <Dialog open={isGenerateClientDialogOpen} onOpenChange={setIsGenerateClientDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Product for Client</DialogTitle>
            <DialogDescription>
              Select a client company to preview what will be generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {error && (
              <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-600">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>Client Company</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clientsWithoutDemos.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <span>{client.name}</span>
                        {client.meetings.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Has transcript
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={handlePreviewGeneration}
                disabled={!selectedClientId || isLoadingPreview}
              >
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Loading Preview...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 size-4" />
                    Preview
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleCloseGenerateClientDialog}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog - Shows what will be created, allows generating */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Product Preview</DialogTitle>
            <DialogDescription>
              Review what will be created for this client.
            </DialogDescription>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <div className="rounded-lg border border-secondary-200 p-4">
                <h4 className="font-medium text-secondary-900">Client Company</h4>
                <p className="text-secondary-600">{previewData.clientCompany.name}</p>
              </div>

              <div className="rounded-lg border border-secondary-200 p-4">
                <h4 className="mb-2 font-medium text-secondary-900">GitHub Repository</h4>
                <div className="flex items-center gap-2">
                  <span className="text-secondary-600">Jaro-dev-studio/</span>
                  <Input
                    value={customRepoName}
                    onChange={(e) => setCustomRepoName(e.target.value)}
                    placeholder="repo-name"
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-secondary-200 p-4">
                <h4 className="mb-2 font-medium text-secondary-900">Template Repository *</h4>
                <Select
                  value={clientTemplateRepo}
                  onValueChange={setClientTemplateRepo}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={isLoadingClientTemplates ? "Loading templates..." : "Select a template"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clientTemplates.map((template) => (
                      <SelectItem key={template.name} value={template.name}>
                        <div className="flex flex-col">
                          <span>{template.name}</span>
                          {template.description && (
                            <span className="text-xs text-secondary-500">
                              {template.description}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {previewData.branding && (
                <div className="rounded-lg border border-secondary-200 p-4">
                  <h4 className="font-medium text-secondary-900">Branding (Scraped)</h4>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-6 rounded border"
                        style={{ backgroundColor: previewData.branding.primaryColor }}
                      />
                      <span className="text-xs">Primary</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="size-6 rounded border"
                        style={{ backgroundColor: previewData.branding.secondaryColor }}
                      />
                      <span className="text-xs">Secondary</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="size-6 rounded border"
                        style={{ backgroundColor: previewData.branding.accentColor }}
                      />
                      <span className="text-xs">Accent</span>
                    </div>
                  </div>
                  {previewData.branding.logoUrl && (
                    <p className="mt-2 truncate text-xs text-secondary-500">
                      Logo: {previewData.branding.logoUrl}
                    </p>
                  )}
                </div>
              )}

              {previewData.requirements && (
                <div className="rounded-lg border border-secondary-200 p-4">
                  <h4 className="font-medium text-secondary-900">Extracted Requirements</h4>
                  <div className="mt-2 space-y-2 text-sm">
                    <p>
                      <span className="font-medium">App Type:</span>{" "}
                      {previewData.requirements.appType}
                    </p>
                    <p>
                      <span className="font-medium">Description:</span>{" "}
                      {previewData.requirements.appDescription}
                    </p>
                    <p>
                      <span className="font-medium">Target Users:</span>{" "}
                      {previewData.requirements.targetUsers}
                    </p>
                    <div>
                      <span className="font-medium">Key Features:</span>
                      <ul className="ml-4 mt-1 list-disc">
                        {previewData.requirements.keyFeatures.map((f, i) => (
                          <li key={i}>
                            {f.name}: {f.description}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {previewData.transcript && (
                <div className="rounded-lg border border-secondary-200 p-4">
                  <h4 className="font-medium text-secondary-900">Transcript Preview</h4>
                  <p className="mt-2 whitespace-pre-wrap text-xs text-secondary-600">
                    {previewData.transcript}
                  </p>
                </div>
              )}

              {!previewData.transcript && (
                <div className="rounded-lg border border-warning-200 bg-warning-50 p-4">
                  <p className="text-sm text-warning-700">
                    No transcript available. Default requirements will be used.
                  </p>
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="rounded-md bg-danger-50 p-3 text-sm text-danger-600">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleGenerateForClient}
              disabled={!previewData || isSubmitting || !clientTemplateRepo}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Product"
              )}
            </Button>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full prompt preview */}
      <Dialog
        open={Boolean(viewingPromptDemo)}
        onOpenChange={(open) => !open && setViewingPromptDemo(null)}
      >
        <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
          <DialogHeader>
            <DialogTitle>{viewingPromptDemo?.name}</DialogTitle>
            <DialogDescription>
              {viewingPromptDemo?.clientCompany
                ? `Full prompt used to build this product for ${viewingPromptDemo.clientCompany.name}.`
                : "Full prompt used to build this product."}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md bg-secondary-50 p-4">
            <p className="whitespace-pre-wrap break-words text-sm text-secondary-700">
              {viewingPromptDemo?.prompt}
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button onClick={handleCopyPrompt} className="flex-1">
              {isPromptCopied ? (
                <Check className="mr-2 size-4" />
              ) : (
                <Copy className="mr-2 size-4" />
              )}
              {isPromptCopied ? "Copied" : "Copy prompt"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setViewingPromptDemo(null)}
              className="flex-1"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve queued build */}
      <ApproveProductBuildModal
        build={
          approvingBuild
            ? {
              id: approvingBuild.id,
              name: approvingBuild.name,
              clientCompanyId: approvingBuild.clientCompany?.id || null,
              clientCompanyName: approvingBuild.clientCompany?.name || null,
              prompt: approvingBuild.prompt,
            }
            : null
        }
        isOpen={Boolean(approvingBuild)}
        onClose={() => setApprovingBuild(null)}
        onApproved={() => window.location.reload()}
      />

      {/* Reject queued build */}
      <Dialog
        open={Boolean(rejectingBuild)}
        onOpenChange={(open) => !open && !isRejecting && setRejectingBuild(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Build</DialogTitle>
            <DialogDescription>
              {rejectingBuild?.clientCompany
                ? `The build for ${rejectingBuild.clientCompany.name} will not be started. It stays on record so you can revisit it later.`
                : "This build will not be started. It stays on record so you can revisit it later."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="rejection-reason">Reason (optional)</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Why is this build not going ahead?"
              rows={3}
              disabled={isRejecting}
            />
            {rejectError && <p className="text-sm text-danger-600">{rejectError}</p>}
          </div>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={isRejecting}
              className="flex-1"
            >
              {isRejecting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject Build"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setRejectingBuild(null)}
              disabled={isRejecting}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
