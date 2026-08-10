"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { approveProductBuild } from "@/lib/actions";
import { getMVPCallMapsForApprovalModal } from "@/lib/fetchers";

interface TemplateRepo {
  name: string;
  description: string | null;
}

interface CallMapOption {
  id: string;
  name: string;
  clientCompany: { id: string; name: string } | null;
  pageCount: number;
  apiCount: number;
  customLogicCount: number;
}

interface QueuedBuild {
  id: string;
  name: string;
  clientCompanyId: string | null;
  clientCompanyName: string | null;
  prompt: string;
}

interface ApproveProductBuildModalProps {
  build: QueuedBuild | null;
  isOpen: boolean;
  onClose: () => void;
  onApproved: (demoId: string) => void;
}

export function ApproveProductBuildModal({
  build,
  isOpen,
  onClose,
  onApproved,
}: ApproveProductBuildModalProps) {
  const [templates, setTemplates] = useState<TemplateRepo[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateRepo, setTemplateRepo] = useState("");
  const [callMaps, setCallMaps] = useState<CallMapOption[]>([]);
  const [isLoadingCallMaps, setIsLoadingCallMaps] = useState(false);
  const [mvpCallMapId, setMvpCallMapId] = useState("none");
  const [additionalContext, setAdditionalContext] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientCompanyId = build?.clientCompanyId ?? null;

  const fetchTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const response = await fetch("/api/github/templates");
      const result = await response.json();
      if (result.data) {
        setTemplates(result.data);
      } else {
        setError(result.error || "Failed to load templates");
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError("Failed to load templates");
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  const fetchCallMaps = useCallback(async (companyId: string | null) => {
    setIsLoadingCallMaps(true);
    try {
      const result = await getMVPCallMapsForApprovalModal();
      if (!result.data) {
        setError(result.error || "Failed to load MVP call maps");
        return;
      }
      setCallMaps(result.data);

      // Preselect when the company has exactly one call map, the common case
      const linked = companyId
        ? result.data.filter((callMap) => callMap.clientCompany?.id === companyId)
        : [];
      if (linked.length === 1) {
        setMvpCallMapId(linked[0].id);
      }
    } catch (err) {
      console.error("Error fetching MVP call maps:", err);
      setError("Failed to load MVP call maps");
    } finally {
      setIsLoadingCallMaps(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTemplateRepo("");
      setMvpCallMapId("none");
      setAdditionalContext("");
      setError(null);
      fetchTemplates();
      fetchCallMaps(clientCompanyId);
    }
  }, [isOpen, clientCompanyId, fetchTemplates, fetchCallMaps]);

  const isLinkedToBuild = (callMap: CallMapOption) =>
    Boolean(clientCompanyId) && callMap.clientCompany?.id === clientCompanyId;

  // Call maps for this build's company first, each group keeping the recency order
  const sortedCallMaps = [
    ...callMaps.filter(isLinkedToBuild),
    ...callMaps.filter((callMap) => !isLinkedToBuild(callMap)),
  ];

  const handleApprove = async () => {
    if (!build) return;

    if (!templateRepo) {
      setError("Select a template repository");
      return;
    }

    setIsApproving(true);
    setError(null);
    try {
      const result = await approveProductBuild(build.id, {
        templateRepo,
        additionalContext: additionalContext.trim() || undefined,
        mvpCallMapId: mvpCallMapId !== "none" ? mvpCallMapId : undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      onApproved(build.id);
      onClose();
    } catch (err) {
      console.error("Error approving build:", err);
      setError("Failed to approve build");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isApproving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Approve Build</DialogTitle>
          <DialogDescription>
            {build?.clientCompanyName
              ? `Start the build for ${build.clientCompanyName} using the selected template.`
              : "Start this build using the selected template."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mvp-call-map">MVP call map</Label>
            <Select
              value={mvpCallMapId}
              onValueChange={setMvpCallMapId}
              disabled={isApproving || isLoadingCallMaps}
            >
              <SelectTrigger id="mvp-call-map">
                <SelectValue
                  placeholder={
                    isLoadingCallMaps ? "Loading call maps..." : "Select a call map (optional)"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No call map</SelectItem>
                {sortedCallMaps.map((callMap) => (
                  <SelectItem key={callMap.id} value={callMap.id}>
                    <div className="flex items-center gap-2">
                      <span>{callMap.name}</span>
                      {isLinkedToBuild(callMap) ? (
                        <Badge variant="outline">Linked</Badge>
                      ) : (
                        callMap.clientCompany && (
                          <span className="text-xs text-secondary-500">
                            ({callMap.clientCompany.name})
                          </span>
                        )
                      )}
                      <span className="text-xs text-secondary-500">
                        {callMap.pageCount} pages, {callMap.apiCount} APIs,{" "}
                        {callMap.customLogicCount} custom
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-secondary-500">
              The scoped pages, integrations, entities and configuration are added to the prompt
              as the source of truth for the build.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="additional-context">Additional context</Label>
            <Textarea
              id="additional-context"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Anything the agent should know on top of the call requirements, e.g. must integrate with their existing Stripe account"
              rows={6}
              disabled={isApproving}
            />
            <p className="text-xs text-secondary-500">
              Appended to the prompt generated from the sales call.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="template-repo">Template repository *</Label>
            <Select
              value={templateRepo}
              onValueChange={setTemplateRepo}
              disabled={isApproving || isLoadingTemplates}
            >
              <SelectTrigger id="template-repo">
                <SelectValue
                  placeholder={isLoadingTemplates ? "Loading templates..." : "Select a template"}
                />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.name} value={template.name}>
                    <div className="flex flex-col">
                      <span>{template.name}</span>
                      {template.description && (
                        <span className="text-xs text-secondary-500">{template.description}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isLoadingTemplates && templates.length === 0 && (
              <p className="text-xs text-warning-600">
                No template repositories found in the GitHub organisation.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-danger-600">{error}</p>}
        </div>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Button
            onClick={handleApprove}
            disabled={isApproving || !templateRepo}
            className="relative flex-1"
          >
            <span className={isApproving ? "opacity-0" : ""}>Approve and Build</span>
            {isApproving && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="size-4 animate-spin" />
              </span>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isApproving}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
