"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  Target,
  Lightbulb,
  Shield,
  Link2,
  Grid,
  Loader2,
  ExternalLink,
  Wand2,
  Check,
  Copy,
  ChevronsUpDown,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { toast } from "sonner";
import {
  createAdTarget,
  updateAdTarget,
  deleteAdTarget,
  createAdSolution,
  updateAdSolution,
  deleteAdSolution,
  createAdRiskReversal,
  updateAdRiskReversal,
  deleteAdRiskReversal,
  createAdDestination,
  updateAdDestination,
  deleteAdDestination,
  generateAllPermutations,
  deleteUnlinkedPermutations,
  updateAdPermutation,
  updateSolutionTargets,
  updateSolutionDestinations,
} from "@/lib/actions/ad-generator";
import type {
  AdTarget,
  AdSolution,
  AdRiskReversal,
  AdDestination,
  AdPermutation,
} from "@/lib/fetchers/ad-generator";
import { Checkbox } from "@/components/ui/checkbox";
import { AdPreview } from "./ad-preview";

// ============================================================================
// Types
// ============================================================================

type TabType = "targets" | "solutions" | "riskReversals" | "destinations" | "permutations";

interface AdGeneratorClientProps {
  initialTargets: AdTarget[];
  initialSolutions: AdSolution[];
  initialRiskReversals: AdRiskReversal[];
  initialDestinations: AdDestination[];
  initialPermutations: AdPermutation[];
  error: string | null;
}

interface MetaCampaign {
  id: string;
  name: string;
  status: string;
}

interface MetaAdSet {
  id: string;
  name: string;
  status: string;
}

// ============================================================================
// Tab Button Component
// ============================================================================

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}

function TabButton({ active, onClick, icon, label, count }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-primary-600 text-white"
          : "bg-secondary-100 text-secondary-700 hover:bg-secondary-200"
      }`}
    >
      {icon}
      {label}
      <Badge variant={active ? "secondary" : "outline"} className="ml-1">
        {count}
      </Badge>
    </button>
  );
}

// ============================================================================
// Entity List Components
// ============================================================================

interface EntityItemProps {
  id: string;
  text: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function EntityItem({ text, onEdit, onDuplicate, onDelete, isDeleting }: EntityItemProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-secondary-200 bg-white p-4">
      <p className="text-sm font-medium text-secondary-900">{text}</p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onDuplicate} title="Duplicate">
          <Copy className="size-4 text-secondary-500" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onEdit} title="Edit">
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={isDeleting}
          title="Delete"
        >
          {isDeleting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4 text-danger-500" />
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Solution Preview Helper
// ============================================================================

function renderSolutionWithHighlights(text: string): React.ReactNode {
  // Parse text with {highlighted} markers
  const parts = text.split(/(\{[^}]+\})/g);
  return parts.map((part, i) => {
    if (part.startsWith("{") && part.endsWith("}")) {
      return (
        <span key={i} className="text-primary-600">
          {part.slice(1, -1)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ============================================================================
// Main Component
// ============================================================================

export function AdGeneratorClient({
  initialTargets,
  initialSolutions,
  initialRiskReversals,
  initialDestinations,
  initialPermutations,
  error,
}: AdGeneratorClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>("permutations");
  const [targets, setTargets] = useState(initialTargets);
  const [solutions, setSolutions] = useState(initialSolutions);
  const [riskReversals, setRiskReversals] = useState(initialRiskReversals);
  const [destinations, setDestinations] = useState(initialDestinations);
  const [permutations, setPermutations] = useState(initialPermutations);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    id: string;
    text: string;
  } | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [inputUrlValue, setInputUrlValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Permutation creation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPermutation, setSelectedPermutation] =
    useState<AdPermutation | null>(null);
  const [isCreateAdModalOpen, setIsCreateAdModalOpen] = useState(false);

  // Bulk create state
  const [isBulkCreateModalOpen, setIsBulkCreateModalOpen] = useState(false);
  const [isBulkCreating, setIsBulkCreating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  // Delete ad state
  const [isDeleteAdDialogOpen, setIsDeleteAdDialogOpen] = useState(false);
  const [permutationToDelete, setPermutationToDelete] = useState<AdPermutation | null>(null);
  const [isDeletingAd, setIsDeletingAd] = useState(false);

  // Permutation filter state
  const [filterTargetId, setFilterTargetId] = useState<string>("all");
  const [filterSolutionId, setFilterSolutionId] = useState<string>("all");
  const [filterRiskReversalId, setFilterRiskReversalId] = useState<string>("all");
  const [filterDestinationId, setFilterDestinationId] = useState<string>("all");
  const [filterHasLinkedAd, setFilterHasLinkedAd] = useState<string>("all");

  // Meta API state
  const [campaigns, setCampaigns] = useState<MetaCampaign[]>([]);
  const [adSets, setAdSets] = useState<MetaAdSet[]>([]);
  // Default campaign and ad set IDs
  const defaultCampaignId = "120237363019260241";
  const defaultAdSetId = "120237870252440241";
  const [selectedCampaign, setSelectedCampaign] = useState(defaultCampaignId);
  const [selectedAdSet, setSelectedAdSet] = useState(defaultAdSetId);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [isLoadingAdSets, setIsLoadingAdSets] = useState(false);
  const [isCreatingAd, setIsCreatingAd] = useState(false);
  const [useExistingAdSet, setUseExistingAdSet] = useState(false);
  const [newAdSetName, setNewAdSetName] = useState("");
  const [adHeadline, setAdHeadline] = useState("{target} {solution} | {risk_reversal}");
  const [adPrimaryText, setAdPrimaryText] = useState(
    `{target} here's a hard truth: investors don't buy businesses that can't survive without the founder.

It doesn't matter how much revenue you do.

If every decision, every client, and every fire comes back to you, the value of your company is close to zero.

That's key man risk. And until you solve it, you don't have an asset. You have a liability.

We build software that runs your business for you. {solution}. {risk_reversal}.

If you want to build something that outlives you, click below and let's talk.`
  );
  const [adDescription, setAdDescription] = useState("");
  const [adLinkUrl, setAdLinkUrl] = useState("");
  const [adCallToAction, setAdCallToAction] = useState("LEARN_MORE");

  const [isPending, startTransition] = useTransition();

  // Ref for capturing ad preview as image
  const previewCaptureRef = useRef<HTMLDivElement>(null);
  const [capturePermutation, setCapturePermutation] = useState<AdPermutation | null>(null);
  const [captureDimension, setCaptureDimension] = useState<"story" | "post">("post");

  // Function to capture ad preview as image and upload to blob storage
  const captureAndUploadPreview = useCallback(async (
    permutation: AdPermutation,
    dimension: "story" | "post"
  ): Promise<string | null> => {
    // Set the permutation to render in the hidden capture container
    setCapturePermutation(permutation);
    setCaptureDimension(dimension);
    
    // Wait for React to render
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (!previewCaptureRef.current) {
      console.error("Preview capture ref not available");
      return null;
    }

    try {
      // Capture the preview as PNG data URL
      const dataUrl = await toPng(previewCaptureRef.current, {
        quality: 1.0,
        pixelRatio: 1,
        cacheBust: true,
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Create form data for upload
      const formData = new FormData();
      formData.append("file", blob, `ad-${permutation.id}-${dimension}.png`);
      formData.append("context", "ad-generator");

      // Upload to blob storage
      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        console.error("Upload failed:", errorData);
        return null;
      }

      const uploadData = await uploadResponse.json();
      return uploadData.url;
    } catch (error) {
      console.error("Failed to capture preview:", error);
      return null;
    } finally {
      setCapturePermutation(null);
    }
  }, []);

  // ============================================================================
  // CRUD Handlers
  // ============================================================================

  const handleCreate = async () => {
    if (!inputValue.trim()) {
      toast.error("Please enter a value");
      return;
    }
    if (activeTab === "destinations" && !inputUrlValue.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    startTransition(async () => {
      let result: { data: { id: string } | null; error: string | null } | undefined;
      switch (activeTab) {
        case "targets":
          result = await createAdTarget(inputValue.trim());
          if (result.data) {
            setTargets((prev) => [
              {
                id: result!.data!.id,
                name: inputValue.trim(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              ...prev,
            ]);
          }
          break;
        case "solutions":
          result = await createAdSolution(inputValue.trim());
          if (result.data) {
            setSolutions((prev) => [
              {
                id: result!.data!.id,
                text: inputValue.trim(),
                targetIds: [],
                destinationIds: [],
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              ...prev,
            ]);
          }
          break;
        case "riskReversals":
          result = await createAdRiskReversal(inputValue.trim());
          if (result.data) {
            setRiskReversals((prev) => [
              {
                id: result!.data!.id,
                text: inputValue.trim(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              ...prev,
            ]);
          }
          break;
        case "destinations":
          result = await createAdDestination(inputValue.trim(), inputUrlValue.trim());
          if (result.data) {
            setDestinations((prev) => [
              {
                id: result!.data!.id,
                label: inputValue.trim(),
                url: inputUrlValue.trim(),
                createdAt: new Date(),
                updatedAt: new Date(),
              },
              ...prev,
            ]);
          }
          break;
      }

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Created successfully");
        setIsCreateModalOpen(false);
        setInputValue("");
        setInputUrlValue("");
      }
    });
  };

  const handleEdit = async () => {
    if (!editingItem || !inputValue.trim()) {
      toast.error("Please enter a value");
      return;
    }
    if (activeTab === "destinations" && !inputUrlValue.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    startTransition(async () => {
      let result: { data: { id: string } | null; error: string | null } | undefined;
      switch (activeTab) {
        case "targets":
          result = await updateAdTarget(editingItem.id, inputValue.trim());
          if (result.data) {
            setTargets((prev) =>
              prev.map((t) =>
                t.id === editingItem.id ? { ...t, name: inputValue.trim() } : t
              )
            );
          }
          break;
        case "solutions":
          result = await updateAdSolution(editingItem.id, inputValue.trim());
          if (result.data) {
            setSolutions((prev) =>
              prev.map((s) =>
                s.id === editingItem.id ? { ...s, text: inputValue.trim() } : s
              )
            );
          }
          break;
        case "riskReversals":
          result = await updateAdRiskReversal(
            editingItem.id,
            inputValue.trim()
          );
          if (result.data) {
            setRiskReversals((prev) =>
              prev.map((r) =>
                r.id === editingItem.id ? { ...r, text: inputValue.trim() } : r
              )
            );
          }
          break;
        case "destinations":
          result = await updateAdDestination(editingItem.id, inputValue.trim(), inputUrlValue.trim());
          if (result.data) {
            setDestinations((prev) =>
              prev.map((d) =>
                d.id === editingItem.id
                  ? { ...d, label: inputValue.trim(), url: inputUrlValue.trim() }
                  : d
              )
            );
          }
          break;
      }

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Updated successfully");
        setIsEditModalOpen(false);
        setEditingItem(null);
        setInputValue("");
        setInputUrlValue("");
      }
    });
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);

    startTransition(async () => {
      let result: { data: boolean | null; error: string | null } | undefined;
      switch (activeTab) {
        case "targets":
          result = await deleteAdTarget(id);
          if (result.data) {
            setTargets((prev) => prev.filter((t) => t.id !== id));
          }
          break;
        case "solutions":
          result = await deleteAdSolution(id);
          if (result.data) {
            setSolutions((prev) => prev.filter((s) => s.id !== id));
          }
          break;
        case "riskReversals":
          result = await deleteAdRiskReversal(id);
          if (result.data) {
            setRiskReversals((prev) => prev.filter((r) => r.id !== id));
          }
          break;
        case "destinations":
          result = await deleteAdDestination(id);
          if (result.data) {
            setDestinations((prev) => prev.filter((d) => d.id !== id));
          }
          break;
      }

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Deleted successfully");
      }
      setDeletingId(null);
    });
  };

  const handleSetSolutionTargets = async (solutionId: string, newTargetIds: string[]) => {
    const solution = solutions.find((s) => s.id === solutionId);
    if (!solution) return;

    const previousTargetIds = solution.targetIds;

    setSolutions((prev) =>
      prev.map((s) =>
        s.id === solutionId ? { ...s, targetIds: newTargetIds } : s
      )
    );

    const result = await updateSolutionTargets(solutionId, newTargetIds);
    if (result.error) {
      setSolutions((prev) =>
        prev.map((s) =>
          s.id === solutionId ? { ...s, targetIds: previousTargetIds } : s
        )
      );
      toast.error(result.error);
    }
  };

  const handleSetSolutionDestinations = async (solutionId: string, newDestinationIds: string[]) => {
    const solution = solutions.find((s) => s.id === solutionId);
    if (!solution) return;

    const previousDestinationIds = solution.destinationIds;

    setSolutions((prev) =>
      prev.map((s) =>
        s.id === solutionId ? { ...s, destinationIds: newDestinationIds } : s
      )
    );

    const result = await updateSolutionDestinations(solutionId, newDestinationIds);
    if (result.error) {
      setSolutions((prev) =>
        prev.map((s) =>
          s.id === solutionId ? { ...s, destinationIds: previousDestinationIds } : s
        )
      );
      toast.error(result.error);
    }
  };

  const openEditModal = (id: string, text: string, url?: string) => {
    setEditingItem({ id, text });
    setInputValue(text);
    if (url !== undefined) setInputUrlValue(url);
    setIsEditModalOpen(true);
  };

  const openDuplicateModal = (text: string, url?: string) => {
    setInputValue(text);
    if (url !== undefined) setInputUrlValue(url);
    setIsCreateModalOpen(true);
  };

  // ============================================================================
  // Permutation Generation
  // ============================================================================

  const handleGeneratePermutations = async () => {
    setIsGenerating(true);

    const result = await generateAllPermutations();

    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      toast.success(
        `Generated ${result.data.created} permutations (${result.data.skipped} already existed)`
      );
      // Refresh the page to get updated permutations
      window.location.reload();
    }

    setIsGenerating(false);
  };

  const [isDeletingUnlinked, setIsDeletingUnlinked] = useState(false);

  const handleDeleteUnlinked = async () => {
    setIsDeletingUnlinked(true);

    const result = await deleteUnlinkedPermutations();

    if (result.error) {
      toast.error(result.error);
    } else if (result.data) {
      toast.success(`Removed ${result.data.deleted} ads not linked to Meta`);
      setPermutations((prev) => prev.filter((p) => p.metaAdId));
    }

    setIsDeletingUnlinked(false);
  };

  // ============================================================================
  // Meta Ad Creation
  // ============================================================================

  const fetchCampaigns = async () => {
    setIsLoadingCampaigns(true);
    try {
      const response = await fetch("/api/ads/campaigns");
      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setCampaigns(data.data || []);
      }
    } catch {
      toast.error("Failed to fetch campaigns");
    }
    setIsLoadingCampaigns(false);
  };

  const fetchAdSets = async (campaignId: string) => {
    setIsLoadingAdSets(true);
    try {
      const response = await fetch(
        `/api/ads/adsets?campaignId=${campaignId}`
      );
      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setAdSets(data.data || []);
      }
    } catch {
      toast.error("Failed to fetch ad sets");
    }
    setIsLoadingAdSets(false);
  };

  const openCreateAdModal = (permutation: AdPermutation) => {
    setSelectedPermutation(permutation);
    setAdLinkUrl(permutation.destination?.url ?? "");
    setIsCreateAdModalOpen(true);
    setSelectedCampaign(defaultCampaignId);
    setSelectedAdSet(defaultAdSetId);
    setUseExistingAdSet(false);
    setNewAdSetName("");
    fetchCampaigns();
    fetchAdSets(defaultCampaignId);
  };

  const handleCampaignChange = (campaignId: string) => {
    setSelectedCampaign(campaignId);
    setSelectedAdSet("");
    setAdSets([]);
    if (campaignId) {
      fetchAdSets(campaignId);
    }
  };

  // Helper to strip curly brace highlight markers from text
  const stripBraces = (text: string): string => {
    return text.replace(/\{([^}]+)\}/g, "$1");
  };

  // Replace merge tags with actual values and strip any remaining braces
  const replaceMergeTags = (text: string, perm: AdPermutation): string => {
    const replaced = text
      .replace(/\{target\}/g, stripBraces(perm.target.name))
      .replace(/\{solution\}/g, stripBraces(perm.solution.text))
      .replace(/\{risk_reversal\}/g, stripBraces(perm.riskReversal.text))
      .replace(/\{destination\}/g, perm.destination?.label ?? "")
      .replace(/\{destination_url\}/g, perm.destination?.url ?? "");
    return stripBraces(replaced);
  };

  // Build URL parameters string for Meta ads (goes in url_tags, not the URL itself)
  // Note: We build manually to avoid URL-encoding the Meta dynamic placeholders like {{site_source_name}}
  const buildUrlParams = (): string => {
    return "utm_medium=paid&utm_source={{site_source_name}}&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}";
  };

  const handleCreateAd = async () => {
    if (!selectedPermutation || !selectedAdSet) {
      toast.error("Please select a template ad set");
      return;
    }

    if (!useExistingAdSet && !newAdSetName.trim()) {
      toast.error("Please enter an ad set name");
      return;
    }

    setIsCreatingAd(true);

    try {
      let targetAdSetId = selectedAdSet;

      // Create a new ad set unless using existing
      if (!useExistingAdSet) {
        console.log("[Create Ad] Creating new ad set:", newAdSetName.trim());
        toast.info("Creating new ad set...");
        const adSetResponse = await fetch("/api/ads/adsets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId: selectedCampaign,
            name: newAdSetName.trim(),
            sourceAdSetId: selectedAdSet,
          }),
        });
        const adSetData = await adSetResponse.json();

        if (adSetData.error || !adSetData.data?.adSetId) {
          toast.error(adSetData.error || "Failed to create ad set");
          setIsCreatingAd(false);
          return;
        }

        targetAdSetId = adSetData.data.adSetId;
        setAdSets((prev) => [...prev, { id: targetAdSetId, name: newAdSetName.trim(), status: "ACTIVE" }]);
        console.log("[Create Ad] New ad set created:", targetAdSetId);
      }

      toast.info("Rendering ad images...");
      
      const postImageUrl = await captureAndUploadPreview(selectedPermutation, "post");
      if (!postImageUrl) {
        toast.error("Failed to render post image");
        setIsCreatingAd(false);
        return;
      }
      
      const storyImageUrl = await captureAndUploadPreview(selectedPermutation, "story");
      if (!storyImageUrl) {
        toast.error("Failed to render story image");
        setIsCreatingAd(false);
        return;
      }

      const adName = stripBraces(selectedPermutation.target.name);
      const finalHeadline = replaceMergeTags(adHeadline, selectedPermutation);
      const finalPrimaryText = replaceMergeTags(
        adPrimaryText,
        selectedPermutation
      );
      const finalDescription = replaceMergeTags(
        adDescription,
        selectedPermutation
      );

      const urlParams = buildUrlParams();
      const response = await fetch("/api/ads/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: selectedCampaign,
          adSetId: targetAdSetId,
          name: adName,
          imageUrl: postImageUrl,
          storyImageUrl,
          primaryText: finalPrimaryText,
          headline: finalHeadline,
          description: finalDescription,
          linkUrl: adLinkUrl,
          urlParams,
          callToAction: adCallToAction,
        }),
      });

      const data = await response.json();

      if (data.error) {
        if (data.error.startsWith("AD_SET_FULL:")) {
          toast.error("This ad set has reached the 50-ad limit (including paused ads). Please select or create a different ad set.");
        } else {
          toast.error(data.error);
        }
      } else if (data.data) {
        await updateAdPermutation(selectedPermutation.id, {
          metaAdId: data.data.adId,
          metaAdUrl: data.data.adUrl,
          metaCampaignId: selectedCampaign,
          metaAdSetId: targetAdSetId,
          adHeadline: finalHeadline,
          adPrimaryText: finalPrimaryText,
          adDescription: finalDescription,
        });

        setPermutations((prev) =>
          prev.map((p) =>
            p.id === selectedPermutation.id
              ? {
                ...p,
                metaAdId: data.data.adId,
                metaAdUrl: data.data.adUrl,
              }
              : p
          )
        );

        toast.success("Ad created successfully!");
        setIsCreateAdModalOpen(false);
        setSelectedPermutation(null);
        setSelectedCampaign(defaultCampaignId);
        setSelectedAdSet(defaultAdSetId);
      }
    } catch {
      toast.error("Failed to create ad");
    }

    setIsCreatingAd(false);
  };

  // Bulk create handler
  const openBulkCreateModal = () => {
    setIsBulkCreateModalOpen(true);
    setSelectedCampaign(defaultCampaignId);
    setSelectedAdSet(defaultAdSetId);
    setUseExistingAdSet(false);
    setNewAdSetName("");
    fetchCampaigns();
    fetchAdSets(defaultCampaignId);
  };

  const handleBulkCreateAds = async () => {
    if (!selectedAdSet) {
      toast.error("Please select a template ad set");
      return;
    }

    if (!useExistingAdSet && !newAdSetName.trim()) {
      toast.error("Please enter an ad set name");
      return;
    }

    // Get all permutations without a linked ad (respect current filters)
    const permutationsToCreate = filteredPermutations.filter((p) => !p.metaAdId);

    if (permutationsToCreate.length === 0) {
      toast.error("No permutations without linked ads to create");
      return;
    }

    setIsBulkCreating(true);
    setBulkProgress({ current: 0, total: permutationsToCreate.length });

    let successCount = 0;
    let failCount = 0;
    
    // Rate limiting configuration
    const DELAY_BETWEEN_ADS_MS = 3000;
    const MAX_RETRIES = 2;
    const RATE_LIMIT_BACKOFF_MS = 30000;
    
    // Ad set management - Meta limits ad sets to 50 ads
    const ADS_PER_AD_SET = 50;
    let currentAdSetId = selectedAdSet;
    let adsInCurrentAdSet = 0;
    let adSetBatchNumber = 1;
    
    const baseAdSetName = useExistingAdSet
      ? (adSets.find(a => a.id === selectedAdSet)?.name || "Ad Set")
      : newAdSetName.trim();

    if (!useExistingAdSet) {
      // Create the initial new ad set before starting
      console.log("[Bulk Create] Creating initial ad set:", baseAdSetName);
      toast.info(`Creating ad set: ${baseAdSetName}`);
      try {
        const response = await fetch("/api/ads/adsets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId: selectedCampaign,
            name: baseAdSetName,
            sourceAdSetId: selectedAdSet,
          }),
        });
        const data = await response.json();
        if (data.error || !data.data?.adSetId) {
          toast.error(data.error || "Failed to create ad set");
          setIsBulkCreating(false);
          setBulkProgress({ current: 0, total: 0 });
          return;
        }
        currentAdSetId = data.data.adSetId;
        setAdSets(prev => [...prev, { id: currentAdSetId, name: baseAdSetName, status: "ACTIVE" }]);
        toast.success(`Created ad set: ${baseAdSetName}`);
      } catch {
        toast.error("Failed to create ad set");
        setIsBulkCreating(false);
        setBulkProgress({ current: 0, total: 0 });
        return;
      }
    } else {
      // Using existing: fetch current ad count
      try {
        toast.info("Checking current ad set capacity...");
        const adCountResponse = await fetch(
          `/api/ads/adsets?adSetId=${selectedAdSet}&getAdCount=true`
        );
        const adCountData = await adCountResponse.json();
        
        if (adCountData.data?.adCount !== undefined) {
          adsInCurrentAdSet = adCountData.data.adCount;
          const remaining = ADS_PER_AD_SET - adsInCurrentAdSet;
          toast.info(`Ad set has ${adsInCurrentAdSet} ads, can add ${remaining} more before creating new ad set`);
        }
      } catch (error) {
        console.log("[Bulk Create] Could not fetch ad count, starting from 0:", error);
      }
    }

    // Helper function to delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Helper function to create an overflow ad set
    const createNewAdSetBatch = async (): Promise<string | null> => {
      adSetBatchNumber++;
      const batchName = `${baseAdSetName} - Batch ${adSetBatchNumber}`;
      
      toast.info(`Creating new ad set: ${batchName}`);
      
      try {
        const response = await fetch("/api/ads/adsets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaignId: selectedCampaign,
            name: batchName,
            sourceAdSetId: selectedAdSet,
          }),
        });
        
        const data = await response.json();
        
        if (data.error) {
          console.error("[Bulk Create] Failed to create new ad set:", data.error);
          toast.error(`Failed to create new ad set: ${data.error}`);
          return null;
        }
        
        if (data.data?.adSetId) {
          toast.success(`Created new ad set: ${batchName}`);
          setAdSets(prev => [...prev, {
            id: data.data.adSetId,
            name: batchName,
            status: "ACTIVE",
          }]);
          return data.data.adSetId;
        }
        
        return null;
      } catch (error) {
        console.error("[Bulk Create] Error creating ad set:", error);
        toast.error("Failed to create new ad set");
        return null;
      }
    };

    for (let i = 0; i < permutationsToCreate.length; i++) {
      const perm = permutationsToCreate[i];
      setBulkProgress({ current: i + 1, total: permutationsToCreate.length });
      
      // Check if we need to create a new ad set (every 50 ads)
      if (adsInCurrentAdSet >= ADS_PER_AD_SET) {
        const newAdSetId = await createNewAdSetBatch();
        if (!newAdSetId) {
          // If we can't create a new ad set, stop the bulk creation
          toast.error("Cannot continue: failed to create new ad set for additional ads");
          break;
        }
        currentAdSetId = newAdSetId;
        adsInCurrentAdSet = 0;
      }

      let retryCount = 0;
      let success = false;

      while (!success && retryCount <= MAX_RETRIES) {
        try {
          // Capture both post (1080x1080) and story (1080x1920) formats
          const postImageUrl = await captureAndUploadPreview(perm, "post");
          if (!postImageUrl) {
            failCount++;
            break;
          }
          
          const storyImageUrl = await captureAndUploadPreview(perm, "story");
          if (!storyImageUrl) {
            failCount++;
            break;
          }

          const adName = stripBraces(perm.target.name);
          const finalHeadline = replaceMergeTags(adHeadline, perm);
          const finalPrimaryText = replaceMergeTags(adPrimaryText, perm);
          const finalDescription = replaceMergeTags(adDescription, perm);
          const urlParams = buildUrlParams();
          const permLinkUrl = perm.destination?.url ?? adLinkUrl;

          const response = await fetch("/api/ads/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              campaignId: selectedCampaign,
              adSetId: currentAdSetId,
              name: adName,
              imageUrl: postImageUrl,
              storyImageUrl,
              primaryText: finalPrimaryText,
              headline: finalHeadline,
              description: finalDescription,
              linkUrl: permLinkUrl,
              urlParams,
              callToAction: adCallToAction,
            }),
          });

          const data = await response.json();

          // Check for rate limit error
          if (data.error && (data.error.includes("rate limit") || data.error.includes("too many calls"))) {
            retryCount++;
            if (retryCount <= MAX_RETRIES) {
              console.log(`[Bulk Create] Rate limited, waiting ${RATE_LIMIT_BACKOFF_MS / 1000}s before retry ${retryCount}/${MAX_RETRIES}`);
              toast.info("Rate limited, waiting 30s before retry...");
              await delay(RATE_LIMIT_BACKOFF_MS);
              continue;
            }
          }

          // Check for ad set full error (50 ad limit)
          if (data.error && data.error.startsWith("AD_SET_FULL:")) {
            console.log("[Bulk Create] Ad set is full, creating a new one...");
            toast.info("Ad set reached 50-ad limit, creating a new one...");
            adsInCurrentAdSet = ADS_PER_AD_SET;
            const newAdSetId = await createNewAdSetBatch();
            if (newAdSetId) {
              currentAdSetId = newAdSetId;
              adsInCurrentAdSet = 0;
              retryCount++;
              if (retryCount <= MAX_RETRIES) {
                continue;
              }
            }
            failCount++;
            success = true;
            break;
          }

          if (data.error) {
            failCount++;
            success = true;
          } else if (data.data) {
            // Update the permutation with Meta ad info
            await updateAdPermutation(perm.id, {
              metaAdId: data.data.adId,
              metaAdUrl: data.data.adUrl,
              metaCampaignId: selectedCampaign,
              metaAdSetId: currentAdSetId,
              adHeadline: finalHeadline,
              adPrimaryText: finalPrimaryText,
              adDescription: finalDescription,
            });

            setPermutations((prev) =>
              prev.map((p) =>
                p.id === perm.id
                  ? {
                    ...p,
                    metaAdId: data.data.adId,
                    metaAdUrl: data.data.adUrl,
                  }
                  : p
              )
            );
            successCount++;
            adsInCurrentAdSet++;
            success = true;
          }
        } catch {
          retryCount++;
          if (retryCount > MAX_RETRIES) {
            failCount++;
          }
        }
      }

      // Add delay between ad creations to avoid rate limiting (except for the last one)
      if (i < permutationsToCreate.length - 1) {
        await delay(DELAY_BETWEEN_ADS_MS);
      }
    }

    setIsBulkCreating(false);
    setBulkProgress({ current: 0, total: 0 });
    setIsBulkCreateModalOpen(false);
    setSelectedCampaign(defaultCampaignId);
    setSelectedAdSet(defaultAdSetId);

    const adSetsCreated = adSetBatchNumber > 1 ? ` across ${adSetBatchNumber} ad sets` : "";
    if (failCount > 0) {
      toast.error(`Created ${successCount} ads${adSetsCreated}, ${failCount} failed`);
    } else {
      toast.success(`Successfully created ${successCount} ads${adSetsCreated} on Meta`);
    }
  };

  // ============================================================================
  // Delete Meta Ad
  // ============================================================================

  const openDeleteAdDialog = (permutation: AdPermutation) => {
    setPermutationToDelete(permutation);
    setIsDeleteAdDialogOpen(true);
  };

  const handleDeleteMetaAd = async () => {
    if (!permutationToDelete || !permutationToDelete.metaAdId) {
      return;
    }

    setIsDeletingAd(true);

    try {
      const response = await fetch("/api/ads/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId: permutationToDelete.metaAdId }),
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
      } else {
        // Update the permutation to remove Meta ad link
        await updateAdPermutation(permutationToDelete.id, {
          metaAdId: undefined,
          metaAdUrl: undefined,
        });

        // Update local state
        setPermutations((prev) =>
          prev.map((p) =>
            p.id === permutationToDelete.id
              ? { ...p, metaAdId: null, metaAdUrl: null }
              : p
          )
        );

        toast.success("Ad deleted from Meta");
      }
    } catch {
      toast.error("Failed to delete ad");
    }

    setIsDeletingAd(false);
    setIsDeleteAdDialogOpen(false);
    setPermutationToDelete(null);
  };

  // ============================================================================
  // Render
  // ============================================================================

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 text-danger-600">
          <AlertCircle className="size-5" />
          <p>{error}</p>
        </div>
      </Card>
    );
  }

  const getModalTitle = () => {
    switch (activeTab) {
      case "targets":
        return "Target";
      case "solutions":
        return "Solution";
      case "riskReversals":
        return "Risk Reversal";
      case "destinations":
        return "Destination";
      default:
        return "";
    }
  };

  const getPlaceholder = () => {
    switch (activeTab) {
      case "targets":
        return "e.g., {50+} Employees?";
      case "solutions":
        return "e.g., Save $200K+/mo With {AI Agents} That Replace Your Team";
      case "riskReversals":
        return "e.g., {Risk-free}\n7-Day Trial";
      case "destinations":
        return "e.g., Business OS Landing Page";
      default:
        return "";
    }
  };

  const getHelperText = () => {
    switch (activeTab) {
      case "targets":
        return "Wrap words in curly braces {like this} to highlight them in blue";
      case "solutions":
        return "Wrap words in curly braces {like this} to highlight them in blue";
      case "riskReversals":
        return "Wrap words in curly braces {like this} to highlight them in blue with underline. Use a new line for the second line of text.";
      case "destinations":
        return "The label identifies this destination. The URL is where the ad links to.";
      default:
        return "";
    }
  };

  // Calculate possible permutations count: only solutions with assigned targets AND destinations are included
  const possiblePermutationsCount = solutions.reduce((sum, solution) => {
    if (solution.targetIds.length === 0 || solution.destinationIds.length === 0) return sum;
    return sum + solution.targetIds.length * solution.destinationIds.length;
  }, 0) * riskReversals.length;

  // Filter permutations
  const filteredPermutations = permutations.filter((p) => {
    if (filterTargetId !== "all" && p.targetId !== filterTargetId) return false;
    if (filterSolutionId !== "all" && p.solutionId !== filterSolutionId) return false;
    if (filterRiskReversalId !== "all" && p.riskReversalId !== filterRiskReversalId) return false;
    if (filterDestinationId !== "all" && p.destinationId !== filterDestinationId) return false;
    if (filterHasLinkedAd === "yes" && !p.metaAdId) return false;
    if (filterHasLinkedAd === "no" && p.metaAdId) return false;
    return true;
  });

  // Get count of permutations without linked ads (respecting filters)
  const unlinkedCount = filteredPermutations.filter((p) => !p.metaAdId).length;

  const hasActiveFilters =
    filterTargetId !== "all" ||
    filterSolutionId !== "all" ||
    filterRiskReversalId !== "all" ||
    filterDestinationId !== "all" ||
    filterHasLinkedAd !== "all";

  const clearFilters = () => {
    setFilterTargetId("all");
    setFilterSolutionId("all");
    setFilterRiskReversalId("all");
    setFilterDestinationId("all");
    setFilterHasLinkedAd("all");
  };

  return (
    <div className="space-y-6">
      {/* Hidden container for capturing ad previews as images */}
      {capturePermutation && (
        <div
          style={{
            position: "absolute",
            left: "-9999px",
            top: "-9999px",
          }}
        >
          <div ref={previewCaptureRef}>
            <AdPreview
              target={capturePermutation.target.name}
              solution={capturePermutation.solution.text}
              riskReversal={capturePermutation.riskReversal.text}
              dimension={captureDimension}
              scale={1}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <TabButton
          active={activeTab === "permutations"}
          onClick={() => setActiveTab("permutations")}
          icon={<Grid className="size-4" />}
          label="Permutations"
          count={permutations.length}
        />
        <TabButton
          active={activeTab === "targets"}
          onClick={() => setActiveTab("targets")}
          icon={<Target className="size-4" />}
          label="Targets"
          count={targets.length}
        />
        <TabButton
          active={activeTab === "solutions"}
          onClick={() => setActiveTab("solutions")}
          icon={<Lightbulb className="size-4" />}
          label="Solutions"
          count={solutions.length}
        />
        <TabButton
          active={activeTab === "destinations"}
          onClick={() => setActiveTab("destinations")}
          icon={<Link2 className="size-4" />}
          label="Destinations"
          count={destinations.length}
        />
        <TabButton
          active={activeTab === "riskReversals"}
          onClick={() => setActiveTab("riskReversals")}
          icon={<Shield className="size-4" />}
          label="Risk Reversals"
          count={riskReversals.length}
        />
      </div>

      {/* Content */}
      {activeTab !== "permutations" ? (
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-secondary-900">
              {activeTab === "targets" && "Target Audiences"}
              {activeTab === "solutions" && "Solutions"}
              {activeTab === "destinations" && "Destinations"}
              {activeTab === "riskReversals" && "Risk Reversals"}
            </h2>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 size-4" />
              Add New
            </Button>
          </div>

          <div className="space-y-3">
            {activeTab === "targets" &&
              targets.map((target) => (
                <div
                  key={target.id}
                  className="flex items-center justify-between rounded-lg border border-secondary-200 bg-white p-4"
                >
                  <p className="text-sm font-medium text-secondary-900">
                    {renderSolutionWithHighlights(target.name)}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDuplicateModal(target.name)}
                      title="Duplicate"
                    >
                      <Copy className="size-4 text-secondary-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(target.id, target.name)}
                      title="Edit"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(target.id)}
                      disabled={deletingId === target.id}
                      title="Delete"
                    >
                      {deletingId === target.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4 text-danger-500" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}

            {activeTab === "solutions" &&
              solutions.map((solution) => (
                <div
                  key={solution.id}
                  className="rounded-lg border border-secondary-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-secondary-900">
                      {renderSolutionWithHighlights(solution.text)}
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDuplicateModal(solution.text)}
                        title="Duplicate"
                      >
                        <Copy className="size-4 text-secondary-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditModal(solution.id, solution.text)}
                        title="Edit"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(solution.id)}
                        disabled={deletingId === solution.id}
                        title="Delete"
                      >
                        {deletingId === solution.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4 text-danger-500" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 justify-between gap-1 text-xs"
                        >
                          <Target className="size-3" />
                          {solution.targetIds.length === 0
                            ? "No targets"
                            : solution.targetIds.length === targets.length
                              ? "All targets"
                              : `${solution.targetIds.length} target${solution.targetIds.length !== 1 ? "s" : ""}`}
                          <ChevronsUpDown className="size-3 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search targets..." />
                          <CommandList className="max-h-48">
                            <CommandEmpty>No targets found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => {
                                  const allSelected = solution.targetIds.length === targets.length;
                                  handleSetSolutionTargets(
                                    solution.id,
                                    allSelected ? [] : targets.map((t) => t.id)
                                  );
                                }}
                              >
                                <Check
                                  className={`mr-2 size-4 ${
                                    solution.targetIds.length === targets.length
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />
                                <span className="font-medium">Select All</span>
                              </CommandItem>
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                              {targets.map((target) => {
                                const isSelected = solution.targetIds.includes(target.id);
                                return (
                                  <CommandItem
                                    key={target.id}
                                    onSelect={() => {
                                      const newIds = isSelected
                                        ? solution.targetIds.filter((id) => id !== target.id)
                                        : [...solution.targetIds, target.id];
                                      handleSetSolutionTargets(solution.id, newIds);
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 size-4 ${
                                        isSelected ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    {target.name.replace(/\{([^}]+)\}/g, "$1")}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 justify-between gap-1 text-xs"
                        >
                          <Link2 className="size-3" />
                          {solution.destinationIds.length === 0
                            ? "No destinations"
                            : solution.destinationIds.length === destinations.length
                              ? "All destinations"
                              : `${solution.destinationIds.length} destination${solution.destinationIds.length !== 1 ? "s" : ""}`}
                          <ChevronsUpDown className="size-3 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search destinations..." />
                          <CommandList className="max-h-48">
                            <CommandEmpty>No destinations found.</CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => {
                                  const allSelected = solution.destinationIds.length === destinations.length;
                                  handleSetSolutionDestinations(
                                    solution.id,
                                    allSelected ? [] : destinations.map((d) => d.id)
                                  );
                                }}
                              >
                                <Check
                                  className={`mr-2 size-4 ${
                                    solution.destinationIds.length === destinations.length
                                      ? "opacity-100"
                                      : "opacity-0"
                                  }`}
                                />
                                <span className="font-medium">Select All</span>
                              </CommandItem>
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                              {destinations.map((dest) => {
                                const isSelected = solution.destinationIds.includes(dest.id);
                                return (
                                  <CommandItem
                                    key={dest.id}
                                    onSelect={() => {
                                      const newIds = isSelected
                                        ? solution.destinationIds.filter((id) => id !== dest.id)
                                        : [...solution.destinationIds, dest.id];
                                      handleSetSolutionDestinations(solution.id, newIds);
                                    }}
                                  >
                                    <Check
                                      className={`mr-2 size-4 ${
                                        isSelected ? "opacity-100" : "opacity-0"
                                      }`}
                                    />
                                    {dest.label}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {(solution.targetIds.length === 0 || solution.destinationIds.length === 0) && (
                      <span className="text-xs text-danger-500">Skipped during generation</span>
                    )}
                  </div>
                </div>
              ))}

            {activeTab === "riskReversals" &&
              riskReversals.map((riskReversal) => (
                <div
                  key={riskReversal.id}
                  className="flex items-center justify-between rounded-lg border border-secondary-200 bg-white p-4"
                >
                  <p className="whitespace-pre-wrap text-sm font-medium text-secondary-900">
                    {renderSolutionWithHighlights(riskReversal.text)}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDuplicateModal(riskReversal.text)}
                      title="Duplicate"
                    >
                      <Copy className="size-4 text-secondary-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(riskReversal.id, riskReversal.text)}
                      title="Edit"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(riskReversal.id)}
                      disabled={deletingId === riskReversal.id}
                      title="Delete"
                    >
                      {deletingId === riskReversal.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4 text-danger-500" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}

            {activeTab === "destinations" &&
              destinations.map((dest) => (
                <div
                  key={dest.id}
                  className="flex items-center justify-between rounded-lg border border-secondary-200 bg-white p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-secondary-900">{dest.label}</p>
                    <p className="text-xs text-secondary-500">{dest.url}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDuplicateModal(dest.label, dest.url)}
                      title="Duplicate"
                    >
                      <Copy className="size-4 text-secondary-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditModal(dest.id, dest.label, dest.url)}
                      title="Edit"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(dest.id)}
                      disabled={deletingId === dest.id}
                      title="Delete"
                    >
                      {deletingId === dest.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4 text-danger-500" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}

            {((activeTab === "targets" && targets.length === 0) ||
              (activeTab === "solutions" && solutions.length === 0) ||
              (activeTab === "destinations" && destinations.length === 0) ||
              (activeTab === "riskReversals" &&
                riskReversals.length === 0)) && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-secondary-500">No items yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsCreateModalOpen(true)}
                >
                  <Plus className="mr-2 size-4" />
                  Add your first {getModalTitle().toLowerCase()}
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        /* Permutations Tab */
        <div className="space-y-6">
          {/* Generation Controls */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <Button
                onClick={handleGeneratePermutations}
                disabled={
                  isGenerating ||
                  targets.length === 0 ||
                  solutions.length === 0 ||
                  riskReversals.length === 0 ||
                  destinations.length === 0
                }
              >
                {isGenerating ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 size-4" />
                )}
                Generate All Permutations
              </Button>
              <Button
                variant="outline"
                onClick={openBulkCreateModal}
                disabled={unlinkedCount === 0}
              >
                <Plus className="mr-2 size-4" />
                Create All on Meta ({unlinkedCount})
              </Button>
              <Button
                variant="outline"
                onClick={handleDeleteUnlinked}
                disabled={isDeletingUnlinked || unlinkedCount === 0}
              >
                {isDeletingUnlinked ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                Remove ads not linked to Meta ({unlinkedCount})
              </Button>
              <span className="text-sm text-secondary-500">
                Possible combinations: {possiblePermutationsCount}
              </span>
              <span className="text-xs text-secondary-400">
                Each permutation generates both 1080x1920 (story) and 1080x1080 (post) formats
              </span>
            </div>
          </Card>

          {/* Filters */}
          {permutations.length > 0 && (
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-secondary-700">Filter:</span>
                <Select value={filterTargetId} onValueChange={setFilterTargetId}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All Targets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Targets</SelectItem>
                    {targets.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name.replace(/\{([^}]+)\}/g, "$1")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterSolutionId} onValueChange={setFilterSolutionId}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="All Solutions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Solutions</SelectItem>
                    {solutions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.text.replace(/\{([^}]+)\}/g, "$1").substring(0, 40)}...
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterRiskReversalId} onValueChange={setFilterRiskReversalId}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All Risk Reversals" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk Reversals</SelectItem>
                    {riskReversals.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.text.replace(/\{([^}]+)\}/g, "$1").replace(/\n/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterDestinationId} onValueChange={setFilterDestinationId}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="All Destinations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Destinations</SelectItem>
                    {destinations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterHasLinkedAd} onValueChange={setFilterHasLinkedAd}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Linked Ad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="yes">Has Linked Ad</SelectItem>
                    <SelectItem value="no">No Linked Ad</SelectItem>
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
                <span className="ml-auto text-sm text-secondary-500">
                  Showing {filteredPermutations.length} of {permutations.length}
                </span>
              </div>
            </Card>
          )}

          {/* Permutations Grid */}
          {permutations.length === 0 ? (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <Grid className="size-12 text-secondary-300" />
                <h3 className="mt-4 text-lg font-semibold text-secondary-900">
                  No permutations generated yet
                </h3>
                <p className="mt-2 max-w-md text-secondary-500">
                  Add targets, solutions, and risk reversals, then click
                  &ldquo;Generate All Permutations&rdquo; to create all possible
                  ad combinations.
                </p>
              </div>
            </Card>
          ) : filteredPermutations.length === 0 ? (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <Grid className="size-12 text-secondary-300" />
                <h3 className="mt-4 text-lg font-semibold text-secondary-900">
                  No permutations match your filters
                </h3>
                <p className="mt-2 text-secondary-500">
                  Try adjusting your filters or clear them to see all permutations.
                </p>
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {filteredPermutations.map((permutation) => (
                <Card
                  key={permutation.id}
                  className="overflow-hidden"
                >
                  {/* Ad Previews - Both Formats */}
                  <div className="relative flex gap-4 bg-secondary-100 p-4">
                    {/* Story Format */}
                    <div className="relative shrink-0">
                      <AdPreview
                        target={permutation.target.name}
                        solution={permutation.solution.text}
                        riskReversal={permutation.riskReversal.text}
                        dimension="story"
                        scale={0.15}
                      />
                      <div className="absolute right-1 top-1">
                        <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                          Story
                        </Badge>
                      </div>
                    </div>
                    {/* Post Format */}
                    <div className="relative shrink-0">
                      <AdPreview
                        target={permutation.target.name}
                        solution={permutation.solution.text}
                        riskReversal={permutation.riskReversal.text}
                        dimension="post"
                        scale={0.15}
                      />
                      <div className="absolute right-1 top-1">
                        <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                          Post
                        </Badge>
                      </div>
                    </div>
                    {permutation.metaAdId && (
                      <div className="absolute left-2 top-2">
                        <Badge className="border-success-200 bg-success-100 text-success-700">
                          <Check className="mr-1 size-3" />
                          Created on Meta
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="p-4">
                    <p className="mb-1 line-clamp-1 text-xs text-secondary-500">
                      {stripBraces(permutation.target.name)}
                    </p>
                    <p className="mb-1 line-clamp-1 text-xs text-secondary-400">
                      {stripBraces(permutation.solution.text)}
                    </p>
                    {permutation.destination && (
                      <p className="mb-2 line-clamp-1 text-xs text-secondary-400">
                        <Link2 className="mr-1 inline size-3" />
                        {permutation.destination.label}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {permutation.metaAdUrl ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            asChild
                          >
                            <a
                              href={permutation.metaAdUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="mr-2 size-3" />
                              View on Meta
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            onClick={() => openDeleteAdDialog(permutation)}
                          >
                            <Trash2 className="size-4 text-danger-500" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => openCreateAdModal(permutation)}
                        >
                          <Plus className="mr-2 size-3" />
                          Create on Meta
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create {getModalTitle()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {activeTab === "solutions" || activeTab === "riskReversals" ? (
              <Textarea
                placeholder={getPlaceholder()}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                rows={3}
              />
            ) : (
              <Input
                placeholder={getPlaceholder()}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            )}
            {activeTab === "destinations" && (
              <Input
                placeholder="e.g., https://jaro.dev/business-os"
                value={inputUrlValue}
                onChange={(e) => setInputUrlValue(e.target.value)}
              />
            )}
            {getHelperText() && (
              <p className="text-xs text-secondary-500">{getHelperText()}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateModalOpen(false); setInputUrlValue(""); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {getModalTitle()}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {activeTab === "solutions" || activeTab === "riskReversals" ? (
              <Textarea
                placeholder={getPlaceholder()}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                rows={3}
              />
            ) : (
              <Input
                placeholder={getPlaceholder()}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            )}
            {activeTab === "destinations" && (
              <Input
                placeholder="e.g., https://jaro.dev/business-os"
                value={inputUrlValue}
                onChange={(e) => setInputUrlValue(e.target.value)}
              />
            )}
            {getHelperText() && (
              <p className="text-xs text-secondary-500">{getHelperText()}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditModalOpen(false); setInputUrlValue(""); }}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Ad Modal */}
      <Dialog open={isCreateAdModalOpen} onOpenChange={setIsCreateAdModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Create Ad on Meta</DialogTitle>
          </DialogHeader>
          {selectedPermutation && (
            <div className="max-h-[calc(90vh-140px)] space-y-6 overflow-y-auto pr-2">
              {/* Preview - Both Formats */}
              <div className="flex justify-center gap-4">
                <div className="overflow-hidden rounded-lg border">
                  <AdPreview
                    target={selectedPermutation.target.name}
                    solution={selectedPermutation.solution.text}
                    riskReversal={selectedPermutation.riskReversal.text}
                    dimension="story"
                    scale={0.15}
                  />
                  <p className="bg-secondary-100 py-1 text-center text-xs text-secondary-500">Story</p>
                </div>
                <div className="overflow-hidden rounded-lg border">
                  <AdPreview
                    target={selectedPermutation.target.name}
                    solution={selectedPermutation.solution.text}
                    riskReversal={selectedPermutation.riskReversal.text}
                    dimension="post"
                    scale={0.15}
                  />
                  <p className="bg-secondary-100 py-1 text-center text-xs text-secondary-500">Post</p>
                </div>
              </div>

              {/* Campaign & Ad Set Selection */}
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Campaign
                    </label>
                    <Select
                      value={selectedCampaign}
                      onValueChange={handleCampaignChange}
                      disabled={isLoadingCampaigns}
                    >
                      <SelectTrigger>
                        {isLoadingCampaigns ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <SelectValue placeholder="Select campaign" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {campaigns.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Template Ad Set
                    </label>
                    <Select
                      value={selectedAdSet}
                      onValueChange={setSelectedAdSet}
                      disabled={!selectedCampaign || isLoadingAdSets}
                    >
                      <SelectTrigger>
                        {isLoadingAdSets ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <SelectValue placeholder="Select ad set" />
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        {adSets.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="useExistingAdSet"
                    checked={useExistingAdSet}
                    onCheckedChange={(checked) => setUseExistingAdSet(checked === true)}
                  />
                  <label htmlFor="useExistingAdSet" className="text-sm">
                    Add to existing ad set instead of creating a new one
                  </label>
                </div>

                {!useExistingAdSet && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      New Ad Set Name
                    </label>
                    <Input
                      value={newAdSetName}
                      onChange={(e) => setNewAdSetName(e.target.value)}
                      placeholder="e.g. Founders - Business OS - March 2026"
                    />
                    <p className="mt-1 text-xs text-secondary-400">
                      A new ad set will be created with the same settings as the template
                    </p>
                  </div>
                )}
              </div>

              {/* Ad Copy Fields */}
              <div className="space-y-4">
                <p className="text-xs text-secondary-500">
                  Use merge tags: {"{target}"}, {"{solution}"}, {"{risk_reversal}"}, {"{destination}"}
                </p>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Headline
                  </label>
                  <Input
                    value={adHeadline}
                    onChange={(e) => setAdHeadline(e.target.value)}
                    placeholder="{target}"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Primary Text
                  </label>
                  <Textarea
                    value={adPrimaryText}
                    onChange={(e) => setAdPrimaryText(e.target.value)}
                    placeholder="{solution} | {risk_reversal}"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Description (optional)
                  </label>
                  <Input
                    value={adDescription}
                    onChange={(e) => setAdDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Link URL {selectedPermutation?.destination && (
                        <span className="font-normal text-secondary-400">
                          (from {selectedPermutation.destination.label})
                        </span>
                      )}
                    </label>
                    <Input
                      value={adLinkUrl}
                      onChange={(e) => setAdLinkUrl(e.target.value)}
                      placeholder="https://jaro.dev/business-os"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Call to Action
                    </label>
                    <Select value={adCallToAction} onValueChange={setAdCallToAction}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LEARN_MORE">Learn More</SelectItem>
                        <SelectItem value="SIGN_UP">Sign Up</SelectItem>
                        <SelectItem value="SHOP_NOW">Shop Now</SelectItem>
                        <SelectItem value="BOOK_NOW">Book Now</SelectItem>
                        <SelectItem value="CONTACT_US">Contact Us</SelectItem>
                        <SelectItem value="GET_QUOTE">Get Quote</SelectItem>
                        <SelectItem value="APPLY_NOW">Apply Now</SelectItem>
                        <SelectItem value="DOWNLOAD">Download</SelectItem>
                        <SelectItem value="GET_OFFER">Get Offer</SelectItem>
                        <SelectItem value="REQUEST_TIME">Request Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateAdModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAd}
              disabled={isCreatingAd || !selectedAdSet || (!useExistingAdSet && !newAdSetName.trim())}
            >
              {isCreatingAd && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Create Ad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Ads Modal */}
      <Dialog open={isBulkCreateModalOpen} onOpenChange={setIsBulkCreateModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Create All Ads on Meta</DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-140px)] space-y-6 overflow-y-auto pr-2">
            {/* Summary */}
            <div className="rounded-lg bg-secondary-50 p-4">
              <p className="text-sm text-secondary-700">
                This will create <span className="font-semibold">{unlinkedCount}</span> ads on Meta
                for all permutations that don&apos;t already have a linked ad
                {hasActiveFilters && " (based on current filters)"}.
              </p>
              <p className="mt-2 text-sm text-secondary-600">
                {useExistingAdSet
                  ? "Ads will be added to the selected ad set. New ad sets are created automatically when the 50-ad limit is reached."
                  : "A new ad set will be created with settings cloned from the template. Additional ad sets are created automatically if the 50-ad limit is reached."}
              </p>
            </div>

            {/* Campaign & Ad Set Selection */}
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Campaign
                  </label>
                  <Select
                    value={selectedCampaign}
                    onValueChange={handleCampaignChange}
                    disabled={isLoadingCampaigns || isBulkCreating}
                  >
                    <SelectTrigger>
                      {isLoadingCampaigns ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <SelectValue placeholder="Select campaign" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Template Ad Set
                  </label>
                  <Select
                    value={selectedAdSet}
                    onValueChange={setSelectedAdSet}
                    disabled={!selectedCampaign || isLoadingAdSets || isBulkCreating}
                  >
                    <SelectTrigger>
                      {isLoadingAdSets ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <SelectValue placeholder="Select ad set" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {adSets.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="bulkUseExistingAdSet"
                  checked={useExistingAdSet}
                  onCheckedChange={(checked) => setUseExistingAdSet(checked === true)}
                  disabled={isBulkCreating}
                />
                <label htmlFor="bulkUseExistingAdSet" className="text-sm">
                  Add to existing ad set instead of creating a new one
                </label>
              </div>

              {!useExistingAdSet && (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    New Ad Set Name
                  </label>
                  <Input
                    value={newAdSetName}
                    onChange={(e) => setNewAdSetName(e.target.value)}
                    placeholder="e.g. Founders - Business OS - March 2026"
                    disabled={isBulkCreating}
                  />
                  <p className="mt-1 text-xs text-secondary-400">
                    A new ad set will be created with the same settings as the template. If more than 50 ads, additional ad sets are created with &quot;Batch 2&quot;, &quot;Batch 3&quot;, etc.
                  </p>
                </div>
              )}
            </div>

            {/* Ad Copy Fields */}
            <div className="space-y-4">
              <p className="text-xs text-secondary-500">
                Use merge tags: {"{target}"}, {"{solution}"}, {"{risk_reversal}"}, {"{destination}"}
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Headline
                </label>
                <Input
                  value={adHeadline}
                  onChange={(e) => setAdHeadline(e.target.value)}
                  placeholder="{target}"
                  disabled={isBulkCreating}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Primary Text
                </label>
                <Textarea
                  value={adPrimaryText}
                  onChange={(e) => setAdPrimaryText(e.target.value)}
                  placeholder="{solution} | {risk_reversal}"
                  rows={3}
                  disabled={isBulkCreating}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Description (optional)
                </label>
                <Input
                  value={adDescription}
                  onChange={(e) => setAdDescription(e.target.value)}
                  placeholder="Optional description"
                  disabled={isBulkCreating}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Link URL <span className="font-normal text-secondary-400">(from each destination)</span>
                  </label>
                  <Input
                    value="Uses each permutation's destination URL"
                    disabled
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Call to Action
                  </label>
                  <Select
                    value={adCallToAction}
                    onValueChange={setAdCallToAction}
                    disabled={isBulkCreating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEARN_MORE">Learn More</SelectItem>
                      <SelectItem value="SIGN_UP">Sign Up</SelectItem>
                      <SelectItem value="SHOP_NOW">Shop Now</SelectItem>
                      <SelectItem value="BOOK_NOW">Book Now</SelectItem>
                      <SelectItem value="CONTACT_US">Contact Us</SelectItem>
                      <SelectItem value="GET_QUOTE">Get Quote</SelectItem>
                      <SelectItem value="APPLY_NOW">Apply Now</SelectItem>
                      <SelectItem value="DOWNLOAD">Download</SelectItem>
                      <SelectItem value="GET_OFFER">Get Offer</SelectItem>
                      <SelectItem value="REQUEST_TIME">Request Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Progress */}
            {isBulkCreating && (
              <div className="rounded-lg bg-primary-50 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-primary-700">
                    Creating ads...
                  </span>
                  <span className="text-primary-600">
                    {bulkProgress.current} / {bulkProgress.total}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-primary-200">
                  <div
                    className="h-full bg-primary-600 transition-all duration-300"
                    style={{
                      width: `${(bulkProgress.current / bulkProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkCreateModalOpen(false)}
              disabled={isBulkCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkCreateAds}
              disabled={isBulkCreating || !selectedAdSet || unlinkedCount === 0 || (!useExistingAdSet && !newAdSetName.trim())}
            >
              {isBulkCreating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create {unlinkedCount} Ads
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Ad Confirmation Dialog */}
      <AlertDialog open={isDeleteAdDialogOpen} onOpenChange={setIsDeleteAdDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Ad from Meta</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this ad from Meta? This action cannot be undone.
              The ad will be permanently deleted from your Meta Ads account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={handleDeleteMetaAd}
              disabled={isDeletingAd}
              className="bg-danger-600 hover:bg-danger-700"
            >
              {isDeletingAd ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
            <AlertDialogCancel disabled={isDeletingAd}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
