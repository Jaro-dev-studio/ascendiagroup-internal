"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  X,
  User,
  Building2,
  Clock,
  Users,
  DollarSign,
  Target,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calculator,
  Loader2,
  Minus,
  Plus,
  Percent,
  MessageSquare,
  Play,
  Mic,
  CircleDot,
  Check,
  Share2,
  Copy,
  ExternalLink,
  Calendar,
  FileText,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { updateSalesCallMap, createSharedQuote, deleteSharedQuote } from "@/lib/actions";
import {
  scriptPhases,
  openingScript,
  discoverySections,
  recapScript,
  solutionScript,
  closeScript,
  objectionHandlers,
  type ScriptSection,
  type DiscoveryQuestion,
} from "@/config/sales-call-script";
import {
  modulePricing,
  calculateQuote,
} from "@/config/module-pricing";
import {
  getModuleCodesFromUncheckedItems,
} from "@/config/checklist-module-mapping";
import type { Prisma } from "@prisma/client";

// Types
interface QuestionResponse {
  hasCapability: boolean | null;
  notes: string;
}

interface SectionResponses {
  [questionId: string]: QuestionResponse;
}

interface CallData {
  sections: {
    [sectionId: string]: SectionResponses;
  };
  painPoints: string[];
  estimatedHoursLost: number;
  estimatedCostPerYear: number;
}

interface FormSubmissionData {
  id: string;
  name: string;
  email: string;
  type: string;
  timeline: string | null;
  companyHeadcount: string | null;
  manualProcesses: string | null;
  budget: string | null;
  productType: string | null;
  platform: string | null;
  servicesNeeded: string[];
  utmSource: string | null;
  utmCampaign: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}

interface SharedQuoteData {
  id: string;
  token: string;
  companyName: string;
  total: number;
  onCallTotal: number;
  deposit: number;
  onCallDeposit: number;
  expiresAt: Date;
  depositPaidAt: Date | null;
  depositPaidAmount: number | null;
  viewCount: number;
  createdAt: Date;
}

interface SalesCallMapData {
  id: string;
  name: string;
  notes: string | null;
  auditData: Prisma.JsonValue | null;
  clientCompany: {
    id: string;
    name: string;
    website: string | null;
    status: string;
  } | null;
  meeting: {
    id: string;
    title: string;
    description: string | null;
    startTime: Date;
    endTime: Date;
    participants: string[];
    summary: string | null;
  } | null;
  formSubmission: FormSubmissionData | null;
  sharedQuotes: SharedQuoteData[];
  createdAt: Date;
  updatedAt: Date;
}

interface SalesViewClientProps {
  salesCallMap: SalesCallMapData;
}

type PhaseType = "opening" | "discovery" | "recap" | "solution" | "close";

export function SalesViewClient({ salesCallMap: initialSalesCallMap }: SalesViewClientProps) {
  const [salesCallMap] = useState(initialSalesCallMap);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showQuoteBuilder, setShowQuoteBuilder] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [moduleQuantities, setModuleQuantities] = useState<Record<string, number>>({});
  // Selected part IDs per module code. Undefined for a module means "all parts included".
  const [selectedParts, setSelectedParts] = useState<Record<string, string[]>>({});
  
  // Share quote state
  const [showShareDialog, setShowShareDialog] = useState(false);
  // Default expiry date is 7 days from now
  const [shareExpiryDate, setShareExpiryDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  });
  const [isCreatingShareLink, setIsCreatingShareLink] = useState(false);
  const [sharedQuoteUrl, setSharedQuoteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deletingQuoteId, setDeletingQuoteId] = useState<string | null>(null);
  const [sharedQuotes, setSharedQuotes] = useState(initialSalesCallMap.sharedQuotes);

  // Current phase and section tracking
  const [currentPhase, setCurrentPhase] = useState<PhaseType>("opening");
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  // Call data state
  const [callData, setCallData] = useState<CallData>(() => {
    if (initialSalesCallMap.auditData && typeof initialSalesCallMap.auditData === "object" && !Array.isArray(initialSalesCallMap.auditData)) {
      const data = initialSalesCallMap.auditData as unknown as CallData;
      return {
        sections: data.sections || {},
        painPoints: data.painPoints || [],
        estimatedHoursLost: data.estimatedHoursLost || 0,
        estimatedCostPerYear: data.estimatedCostPerYear || 0,
      };
    }
    return {
      sections: {},
      painPoints: [],
      estimatedHoursLost: 0,
      estimatedCostPerYear: 0,
    };
  });

  // Debounce refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCallDataRef = useRef<CallData>(callData);

  useEffect(() => {
    pendingCallDataRef.current = callData;
  }, [callData]);

  // Debounced save
  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const result = await updateSalesCallMap(salesCallMap.id, {
          auditData: pendingCallDataRef.current as unknown as Prisma.InputJsonValue,
        });
        if (result.data) {
          setLastSaved(new Date());
        }
      } catch (error) {
        console.error("Error saving call data:", error);
      } finally {
        setIsSaving(false);
      }
    }, 500);
  }, [salesCallMap.id]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Get response for a question
  const getQuestionResponse = useCallback(
    (sectionId: string, questionId: string): QuestionResponse => {
      return callData.sections[sectionId]?.[questionId] || { hasCapability: null, notes: "" };
    },
    [callData]
  );

  // Update question response
  const updateQuestionResponse = useCallback(
    (sectionId: string, questionId: string, response: Partial<QuestionResponse>) => {
      setCallData((prev) => {
        const currentResponse = prev.sections[sectionId]?.[questionId] || { hasCapability: null, notes: "" };
        return {
          ...prev,
          sections: {
            ...prev.sections,
            [sectionId]: {
              ...prev.sections[sectionId],
              [questionId]: {
                ...currentResponse,
                ...response,
              },
            },
          },
        };
      });
      debouncedSave();
    },
    [debouncedSave]
  );

  // Get all unchecked item IDs (questions answered "No")
  const allUncheckedItemIds = useMemo(() => {
    const unchecked: string[] = [];
    discoverySections.forEach((section) => {
      section.questions.forEach((question) => {
        const response = callData.sections[section.id]?.[question.id];
        if (response?.hasCapability === false) {
          unchecked.push(...question.checklistItemIds);
        }
      });
    });
    return [...new Set(unchecked)];
  }, [callData]);

  // Get identified pain points grouped by section (with module codes for solutions)
  const identifiedPainPointsBySection = useMemo(() => {
    const grouped: Record<string, Array<{
      noResponseRecap: string;
      notes: string;
      moduleCodes: string[];
    }>> = {};
    
    discoverySections.forEach((section) => {
      const sectionPainPoints: Array<{
        noResponseRecap: string;
        notes: string;
        moduleCodes: string[];
      }> = [];
      
      section.questions.forEach((question) => {
        const response = callData.sections[section.id]?.[question.id];
        if (response?.hasCapability === false) {
          // Get module codes for this question's checklist items
          const moduleCodes = getModuleCodesFromUncheckedItems(question.checklistItemIds);
          sectionPainPoints.push({
            noResponseRecap: question.noResponseRecap,
            notes: response.notes || "",
            moduleCodes,
          });
        }
      });
      
      if (sectionPainPoints.length > 0) {
        grouped[section.title] = sectionPainPoints;
      }
    });
    
    return grouped;
  }, [callData]);

  // Flat list for counting
  const identifiedPainPointsCount = useMemo(() => {
    return Object.values(identifiedPainPointsBySection).reduce(
      (sum, points) => sum + points.length,
      0
    );
  }, [identifiedPainPointsBySection]);

  // Get module codes and quote
  const uncheckedModuleCodes = useMemo(() => {
    return getModuleCodesFromUncheckedItems(allUncheckedItemIds);
  }, [allUncheckedItemIds]);

  const quote = useMemo(() => {
    return calculateQuote(uncheckedModuleCodes, moduleQuantities, discountPercent, selectedParts);
  }, [uncheckedModuleCodes, moduleQuantities, discountPercent, selectedParts]);

  // Create shareable quote link
  const handleCreateShareLink = async () => {
    setIsCreatingShareLink(true);
    try {
      // Prepare pain points for the quote
      const painPointsForQuote = Object.entries(identifiedPainPointsBySection).map(
        ([section, points]) => ({
          section,
          items: points.map((p) => p.noResponseRecap),
        })
      );

      // Prepare line items with benefits and their included parts (objectives)
      const lineItemsWithBenefits = quote.lineItems.map((item) => {
        const module = modulePricing[item.code];
        const includedParts = item.parts
          ?.filter((part) => part.included)
          .map((part) => ({
            name: part.name,
            price: part.price,
            objective: part.objective,
          }));
        return {
          ...item,
          parts: includedParts && includedParts.length > 0 ? includedParts : undefined,
          benefit: module?.benefit || undefined,
        };
      });

      // Use the selected expiry date (set to end of day)
      const expiresAt = new Date(shareExpiryDate);
      expiresAt.setHours(23, 59, 59, 999);

      const result = await createSharedQuote({
        salesCallMapId: salesCallMap.id,
        companyName:
          salesCallMap.clientCompany?.name ||
          salesCallMap.formSubmission?.name ||
          salesCallMap.name,
        contactName: salesCallMap.formSubmission
          ? salesCallMap.formSubmission.firstName && salesCallMap.formSubmission.lastName
            ? `${salesCallMap.formSubmission.firstName} ${salesCallMap.formSubmission.lastName}`
            : salesCallMap.formSubmission.name
          : undefined,
        contactEmail: salesCallMap.formSubmission?.email,
        lineItems: lineItemsWithBenefits,
        subtotal: quote.subtotal,
        discountPercent: quote.discountPercent,
        discountAmount: quote.discountAmount,
        total: quote.total,
        deposit: quote.deposit,
        balance: quote.balance,
        painPoints: painPointsForQuote.length > 0 ? painPointsForQuote : undefined,
        expiresAt,
      });

      if (result.data) {
        const url = `${window.location.origin}/quote/${result.data.token}`;
        setSharedQuoteUrl(url);
      } else {
        console.error("Error creating share link:", result.error);
      }
    } catch (error) {
      console.error("Error creating share link:", error);
    } finally {
      setIsCreatingShareLink(false);
    }
  };

  // Copy share link to clipboard
  const handleCopyLink = async () => {
    if (sharedQuoteUrl) {
      await navigator.clipboard.writeText(sharedQuoteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm("Are you sure you want to delete this quote? This action cannot be undone.")) {
      return;
    }
    
    setDeletingQuoteId(quoteId);
    try {
      const result = await deleteSharedQuote(quoteId, salesCallMap.id);
      if (result.error) {
        alert(result.error);
      } else {
        setSharedQuotes((prev) => prev.filter((q) => q.id !== quoteId));
      }
    } catch {
      alert("Failed to delete quote");
    } finally {
      setDeletingQuoteId(null);
    }
  };

  // Reset share dialog state when closing
  const handleShareDialogOpenChange = (open: boolean) => {
    setShowShareDialog(open);
    if (!open) {
      setSharedQuoteUrl(null);
      setCopied(false);
    }
  };

  // Navigation
  const currentSection = discoverySections[currentSectionIndex];

  const goToNextStep = () => {
    if (currentPhase === "opening") {
      setCurrentPhase("discovery");
      setCurrentSectionIndex(0);
    } else if (currentPhase === "discovery") {
      if (currentSectionIndex < discoverySections.length - 1) {
        setCurrentSectionIndex((prev) => prev + 1);
      } else {
        setCurrentPhase("recap");
      }
    } else if (currentPhase === "recap") {
      setCurrentPhase("solution");
    } else if (currentPhase === "solution") {
      setCurrentPhase("close");
    }
  };

  const goToPreviousStep = () => {
    if (currentPhase === "discovery") {
      if (currentSectionIndex > 0) {
        setCurrentSectionIndex((prev) => prev - 1);
      } else {
        setCurrentPhase("opening");
      }
    } else if (currentPhase === "recap") {
      setCurrentPhase("discovery");
      setCurrentSectionIndex(discoverySections.length - 1);
    } else if (currentPhase === "solution") {
      setCurrentPhase("recap");
    } else if (currentPhase === "close") {
      setCurrentPhase("solution");
    }
  };

  const canGoBack = currentPhase !== "opening";
  const canGoForward = currentPhase !== "close";

  // Get progress info
  const getProgressInfo = () => {
    const phases = scriptPhases;
    const currentPhaseIndex = phases.findIndex((p) => p.id === currentPhase);
    let stepText = "";
    
    if (currentPhase === "discovery") {
      stepText = `${currentSection.title} (${currentSectionIndex + 1}/${discoverySections.length})`;
    } else {
      stepText = phases[currentPhaseIndex].title;
    }
    
    return {
      phaseIndex: currentPhaseIndex,
      totalPhases: phases.length,
      stepText,
      duration: phases[currentPhaseIndex].duration,
    };
  };

  const progress = getProgressInfo();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Render phase content
  const renderPhaseContent = () => {
    switch (currentPhase) {
      case "opening":
        return <OpeningPhase />;
      case "discovery":
        return (
          <DiscoveryPhase
            section={currentSection}
            getResponse={getQuestionResponse}
            updateResponse={updateQuestionResponse}
          />
        );
      case "recap":
        return <RecapPhase painPointsBySection={identifiedPainPointsBySection} />;
      case "solution":
        return <SolutionPhase painPointsBySection={identifiedPainPointsBySection} />;
      case "close":
        return (
          <ClosePhase
            quote={quote}
            painPointsBySection={identifiedPainPointsBySection}
            onOpenQuoteBuilder={() => setShowQuoteBuilder(true)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-secondary-200 bg-white px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/sales-call-maps/${salesCallMap.id}`}>
            <Button variant="ghost" size="icon">
              <X className="size-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-secondary-900">
              {salesCallMap.formSubmission
                ? `Call with ${salesCallMap.formSubmission.firstName || salesCallMap.formSubmission.name}`
                : salesCallMap.name}
            </h1>
            <div className="flex items-center gap-2 text-sm text-secondary-500">
              <Mic className="size-3" />
              {progress.stepText}
              <span className="text-secondary-300">|</span>
              <Clock className="size-3" />
              {progress.duration}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Save status */}
          {isSaving ? (
            <div className="flex items-center gap-2 text-sm text-secondary-500">
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </div>
          ) : lastSaved ? (
            <div className="flex items-center gap-2 text-sm text-secondary-500">
              <CheckCircle2 className="size-4 text-success-500" />
              Saved
            </div>
          ) : null}

          {/* Pain points count */}
          <Badge variant="outline" className="gap-1">
            <AlertTriangle className="size-3" />
            {identifiedPainPointsCount} gaps found
          </Badge>

          {/* Quote Builder */}
          <Sheet open={showQuoteBuilder} onOpenChange={setShowQuoteBuilder}>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Calculator className="mr-2 size-4" />
                Quote: {formatCurrency(quote.total)}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Calculator className="size-5" />
                  Live Quote Builder
                </SheetTitle>
              </SheetHeader>
              <QuoteBuilderContent
                quote={quote}
                moduleQuantities={moduleQuantities}
                setModuleQuantities={setModuleQuantities}
                discountPercent={discountPercent}
                setDiscountPercent={setDiscountPercent}
                setSelectedParts={setSelectedParts}
              />
            </SheetContent>
          </Sheet>

          {/* Share Quote */}
          <Dialog open={showShareDialog} onOpenChange={handleShareDialogOpenChange}>
            <DialogTrigger asChild>
              <Button>
                <Share2 className="mr-2 size-4" />
                Share Quote
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Share Quote with Prospect</DialogTitle>
                <DialogDescription>
                  Create a shareable link for{" "}
                  {salesCallMap.clientCompany?.name ||
                    salesCallMap.formSubmission?.name ||
                    "the prospect"}{" "}
                  to view and accept their quote.
                </DialogDescription>
              </DialogHeader>

              {/* Existing Quotes */}
              {sharedQuotes && sharedQuotes.length > 0 && (
                <div className="border-b border-secondary-200 pb-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-secondary-900">
                    <FileText className="size-4" />
                    Previously Created Quotes
                  </h4>
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {sharedQuotes.map((sq) => {
                      const isExpired = new Date() > new Date(sq.expiresAt);
                      const isPaid = !!sq.depositPaidAt;
                      const isDeleting = deletingQuoteId === sq.id;
                      return (
                        <div
                          key={sq.id}
                          className={cn(
                            "flex items-center justify-between rounded-lg border border-secondary-200 bg-secondary-50 p-3",
                            isDeleting && "opacity-50"
                          )}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-secondary-900">
                                {formatCurrency(sq.total)}
                              </span>
                              {isPaid && (
                                <Badge className="bg-success-100 text-success-700">
                                  Paid
                                </Badge>
                              )}
                              {isExpired && !isPaid && (
                                <Badge className="bg-danger-100 text-danger-700">
                                  Expired
                                </Badge>
                              )}
                              {!isExpired && !isPaid && (
                                <Badge className="bg-primary-100 text-primary-700">
                                  Active
                                </Badge>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs text-secondary-500">
                              <span>Created {new Date(sq.createdAt).toLocaleDateString()}</span>
                              <span>{sq.viewCount} views</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                            >
                              <a
                                href={`/quote/${sq.token}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="size-4" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteQuote(sq.id)}
                              disabled={isDeleting}
                              className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                            >
                              {isDeleting ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {!sharedQuoteUrl ? (
                <div className="space-y-4 py-4">
                  <h4 className="text-sm font-semibold text-secondary-900">Create New Quote</h4>
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Quote expires on</Label>
                    <Input
                      id="expiry"
                      type="date"
                      value={shareExpiryDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setShareExpiryDate(e.target.value)}
                      className="w-48"
                    />
                    <p className="text-xs text-secondary-500">
                      The quote will expire and become inaccessible after this date.
                    </p>
                  </div>

                  <div className="rounded-lg border border-secondary-200 bg-secondary-50 p-4">
                    <h4 className="mb-2 text-sm font-semibold text-secondary-900">
                      Quote includes:
                    </h4>
                    <ul className="space-y-1 text-sm text-secondary-600">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-success-500" />
                        {quote.lineItems.length} modules ({formatCurrency(quote.total)})
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-success-500" />
                        15% same-day discount offer
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="size-4 text-success-500" />
                        All identified pain points and solutions
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  <div className="rounded-lg border border-success-200 bg-success-50 p-4">
                    <div className="flex items-center gap-2 text-success-700">
                      <CheckCircle2 className="size-5" />
                      <span className="font-semibold">Quote link created</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Share this link</Label>
                    <div className="flex gap-2">
                      <Input
                        value={sharedQuoteUrl}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopyLink}
                        className={cn(copied && "bg-success-50 text-success-600")}
                      >
                        {copied ? (
                          <Check className="size-4" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => window.open(sharedQuoteUrl, "_blank")}
                    >
                      <ExternalLink className="mr-2 size-4" />
                      Preview
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={handleCopyLink}
                    >
                      <Copy className="mr-2 size-4" />
                      {copied ? "Copied" : "Copy Link"}
                    </Button>
                  </div>

                  <p className="text-center text-xs text-secondary-500">
                    <Calendar className="mr-1 inline size-3" />
                    Expires on {new Date(shareExpiryDate).toLocaleDateString()}
                  </p>
                </div>
              )}

              {!sharedQuoteUrl && (
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowShareDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateShareLink}
                    disabled={isCreatingShareLink}
                  >
                    {isCreatingShareLink ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Share2 className="mr-2 size-4" />
                        Create Link
                      </>
                    )}
                  </Button>
                </DialogFooter>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Progress bar */}
      <div className="border-b border-secondary-100 bg-secondary-50 px-6 py-2">
        <div className="flex items-center gap-2">
          {scriptPhases.map((phase, index) => (
            <div key={phase.id} className="flex items-center gap-2">
              <button
                onClick={() => {
                  setCurrentPhase(phase.id as PhaseType);
                  if (phase.id === "discovery") {
                    setCurrentSectionIndex(0);
                  }
                }}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  currentPhase === phase.id
                    ? "bg-primary-600 text-white"
                    : index < progress.phaseIndex
                      ? "bg-success-100 text-success-700"
                      : "bg-secondary-200 text-secondary-600 hover:bg-secondary-300"
                )}
              >
                {index < progress.phaseIndex ? (
                  <Check className="size-3" />
                ) : (
                  <CircleDot className="size-3" />
                )}
                {phase.title}
              </button>
              {index < scriptPhases.length - 1 && (
                <ChevronRight className="size-4 text-secondary-300" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Prospect Info */}
        <div className="w-72 shrink-0 overflow-y-auto border-r border-secondary-200 bg-secondary-50 p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-secondary-500">
            Prospect
          </h2>

          {salesCallMap.formSubmission ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary-100">
                  <User className="size-5 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-secondary-900">
                    {salesCallMap.formSubmission.firstName &&
                    salesCallMap.formSubmission.lastName
                      ? `${salesCallMap.formSubmission.firstName} ${salesCallMap.formSubmission.lastName}`
                      : salesCallMap.formSubmission.name}
                  </p>
                  <p className="text-xs text-secondary-500">
                    {salesCallMap.formSubmission.email}
                  </p>
                </div>
              </div>

              {salesCallMap.clientCompany && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="size-4 text-secondary-400" />
                  <span className="text-secondary-700">
                    {salesCallMap.clientCompany.name}
                  </span>
                </div>
              )}

              {salesCallMap.formSubmission.companyHeadcount && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-secondary-400" />
                  <span className="text-secondary-700">
                    {salesCallMap.formSubmission.companyHeadcount} employees
                  </span>
                </div>
              )}

              {salesCallMap.formSubmission.budget && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="size-4 text-secondary-400" />
                  <span className="text-secondary-700">
                    {salesCallMap.formSubmission.budget}
                  </span>
                </div>
              )}

              {salesCallMap.formSubmission.utmSource && (
                <div className="flex items-center gap-2 text-sm">
                  <Target className="size-4 text-secondary-400" />
                  <span className="text-secondary-700">
                    via {salesCallMap.formSubmission.utmSource}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-secondary-500">No prospect linked</p>
          )}

          {/* Pain Points Summary */}
          {identifiedPainPointsCount > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-secondary-500">
                Gaps Found ({identifiedPainPointsCount})
              </h2>
              <div className="space-y-3">
                {Object.entries(identifiedPainPointsBySection).slice(0, 4).map(([section, points]) => (
                  <div key={section}>
                    <p className="mb-1 text-xs font-semibold text-secondary-600">{section}</p>
                    {points.slice(0, 2).map((pain, i) => (
                      <div
                        key={i}
                        className="mb-1 rounded-lg border border-warning-200 bg-warning-50 p-2"
                      >
                        <p className="text-xs text-warning-700">
                          {pain.noResponseRecap}
                        </p>
                      </div>
                    ))}
                    {points.length > 2 && (
                      <p className="text-xs text-secondary-400">+{points.length - 2} more</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Script Area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8">
            <div className="mx-auto max-w-3xl">{renderPhaseContent()}</div>
          </div>

          {/* Navigation Footer */}
          <div className="flex items-center justify-between border-t border-secondary-200 bg-white px-8 py-4">
            <Button
              variant="outline"
              onClick={goToPreviousStep}
              disabled={!canGoBack}
            >
              <ChevronLeft className="mr-2 size-4" />
              Back
            </Button>

            <div className="flex items-center gap-2 text-sm text-secondary-500">
              Phase {progress.phaseIndex + 1} of {progress.totalPhases}
            </div>

            <Button onClick={goToNextStep} disabled={!canGoForward}>
              Next
              <ChevronRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Opening Phase Component
function OpeningPhase() {
  return (
    <div className="space-y-8">
      <div>
        <Badge className="mb-4">Phase 1: Opening</Badge>
        <h2 className="text-2xl font-bold text-secondary-900">
          Build rapport & set the agenda
        </h2>
        <p className="mt-2 text-secondary-600">
          Start with genuine connection, then set expectations for the call.
        </p>
      </div>

      <Card className="border-2 border-primary-200 bg-primary-50 p-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-1 size-5 text-primary-600" />
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-primary-700">Greeting</p>
              <p className="mt-1 text-lg text-primary-900">
                &quot;{openingScript.greeting}&quot;
              </p>
            </div>
            <div className="rounded-lg bg-primary-100 p-3 text-sm italic text-primary-700">
              {openingScript.smallTalk}
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-2 border-primary-200 bg-primary-50 p-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-1 size-5 text-primary-600" />
          <div>
            <p className="text-sm font-medium text-primary-700">Set the Agenda</p>
            <p className="mt-2 whitespace-pre-line text-lg text-primary-900">
              &quot;{openingScript.agendaSetting}&quot;
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-2 border-success-200 bg-success-50 p-6">
        <div className="flex items-start gap-3">
          <Play className="mt-1 size-5 text-success-600" />
          <div>
            <p className="text-sm font-medium text-success-700">
              Transition to Discovery
            </p>
            <p className="mt-1 text-lg text-success-900">
              &quot;{openingScript.transitionToDiscovery}&quot;
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Discovery Phase Component
function DiscoveryPhase({
  section,
  getResponse,
  updateResponse,
}: {
  section: ScriptSection;
  getResponse: (sectionId: string, questionId: string) => QuestionResponse;
  updateResponse: (sectionId: string, questionId: string, response: Partial<QuestionResponse>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <Badge className="mb-4">Phase 2: Discovery</Badge>
        <h2 className="text-2xl font-bold text-secondary-900">{section.title}</h2>
      </div>

      {/* Transition Script */}
      <Card className="border-2 border-primary-200 bg-primary-50 p-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-1 size-5 text-primary-600" />
          <div>
            <p className="text-sm font-medium text-primary-700">Ask</p>
            <p className="mt-1 text-lg text-primary-900">
              &quot;{section.transitionScript}&quot;
            </p>
          </div>
        </div>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        {section.questions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            response={getResponse(section.id, question.id)}
            onUpdateResponse={(response) =>
              updateResponse(section.id, question.id, response)
            }
          />
        ))}
      </div>

      {/* Red Flags */}
      <Card className="border border-danger-200 bg-danger-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-danger-600" />
          <div>
            <p className="text-sm font-semibold text-danger-700">
              Red Flags to Listen For
            </p>
            <ul className="mt-2 space-y-1">
              {section.redFlags.map((flag, i) => (
                <li key={i} className="text-sm text-danger-700">
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Question Card Component
function QuestionCard({
  question,
  response,
  onUpdateResponse,
}: {
  question: DiscoveryQuestion;
  response: QuestionResponse;
  onUpdateResponse: (response: Partial<QuestionResponse>) => void;
}) {
  return (
    <Card className="overflow-hidden">
      {/* Ask Script */}
      <div className="border-b border-secondary-100 bg-secondary-50 p-4">
        <p className="text-sm font-medium text-secondary-500">Ask</p>
        <p className="mt-1 text-lg font-medium text-secondary-900">
          &quot;{question.askScript}&quot;
        </p>
        {question.quantifyingQuestion && (
          <p className="mt-2 text-sm italic text-secondary-600">
            Follow-up: &quot;{question.quantifyingQuestion}&quot;
          </p>
        )}
      </div>

      {/* Response Section */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Notes */}
          <div className="flex-1">
            <Label htmlFor={`notes-${question.id}`} className="text-sm text-secondary-600">
              Notes / Their Answer
            </Label>
            <Textarea
              id={`notes-${question.id}`}
              value={response.notes}
              onChange={(e) => onUpdateResponse({ notes: e.target.value })}
              placeholder="Capture their response here..."
              className="mt-1 min-h-[80px] resize-none"
            />
          </div>

          {/* Yes/No Toggle */}
          <div className="shrink-0">
            <p className="mb-2 text-sm text-secondary-600">
              {question.yesNoQuestion}?
            </p>
            <div className="flex gap-2">
              <Button
                variant={response.hasCapability === true ? "default" : "outline"}
                size="sm"
                onClick={() => onUpdateResponse({ hasCapability: true })}
                className={cn(
                  response.hasCapability === true &&
                    "bg-success-600 hover:bg-success-700"
                )}
              >
                <CheckCircle2 className="mr-1 size-4" />
                Yes
              </Button>
              <Button
                variant={response.hasCapability === false ? "default" : "outline"}
                size="sm"
                onClick={() => onUpdateResponse({ hasCapability: false })}
                className={cn(
                  response.hasCapability === false &&
                    "bg-danger-600 hover:bg-danger-700"
                )}
              >
                <XCircle className="mr-1 size-4" />
                No
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Recap Phase Component
function RecapPhase({
  painPointsBySection,
}: {
  painPointsBySection: Record<string, Array<{ noResponseRecap: string; notes: string; moduleCodes: string[] }>>;
}) {
  const hasPainPoints = Object.keys(painPointsBySection).length > 0;
  
  return (
    <div className="space-y-8">
      <div>
        <Badge className="mb-4">Phase 3: Recap Pain Points</Badge>
        <h2 className="text-2xl font-bold text-secondary-900">
          Confirm what you heard
        </h2>
        <p className="mt-2 text-secondary-600">
          Summarize the gaps you identified and get confirmation before presenting
          solutions.
        </p>
      </div>

      <Card className="border-2 border-primary-200 bg-primary-50 p-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-1 size-5 text-primary-600" />
          <div>
            <p className="text-sm font-medium text-primary-700">Say</p>
            <p className="mt-1 text-lg text-primary-900">
              &quot;{recapScript.intro}&quot;
            </p>
          </div>
        </div>
      </Card>

      {/* Pain Points to Recap - Grouped by Section */}
      {hasPainPoints ? (
        <div className="space-y-6">
          {Object.entries(painPointsBySection).map(([section, points]) => (
            <Card key={section} className="overflow-hidden">
              <div className="border-b border-secondary-200 bg-secondary-50 px-4 py-3">
                <h3 className="font-semibold text-secondary-900">{section}</h3>
              </div>
              <div className="p-4">
                <ul className="space-y-3">
                  {points.map((pain, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <XCircle className="mt-0.5 size-5 shrink-0 text-danger-500" />
                      <div className="flex-1">
                        <p className="text-secondary-900">{pain.noResponseRecap}</p>
                        {pain.notes && (
                          <p className="mt-1 text-sm italic text-secondary-500">
                            &quot;{pain.notes}&quot;
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-2 border-dashed border-secondary-300 p-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success-500" />
          <p className="mt-4 text-lg font-medium text-secondary-900">
            No gaps identified yet
          </p>
          <p className="mt-2 text-secondary-600">
            Go back to Discovery and mark questions as Yes/No to identify pain
            points.
          </p>
        </Card>
      )}

      <Card className="border-2 border-primary-200 bg-primary-50 p-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-1 size-5 text-primary-600" />
          <div>
            <p className="text-sm font-medium text-primary-700">Confirm</p>
            <p className="mt-1 text-lg text-primary-900">
              &quot;{recapScript.confirmation}&quot;
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-2 border-success-200 bg-success-50 p-6">
        <div className="flex items-start gap-3">
          <Play className="mt-1 size-5 text-success-600" />
          <div>
            <p className="text-sm font-medium text-success-700">
              Transition to Solution
            </p>
            <p className="mt-1 text-lg text-success-900">
              &quot;{recapScript.solutionTransition}&quot;
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Solution Phase Component
function SolutionPhase({
  painPointsBySection,
}: {
  painPointsBySection: Record<string, Array<{ noResponseRecap: string; notes: string; moduleCodes: string[] }>>;
}) {
  const hasPainPoints = Object.keys(painPointsBySection).length > 0;

  // Group pain points by solution module - each module shown once with all problems it solves
  const solutionsByModule = useMemo(() => {
    const moduleMap: Record<string, {
      module: typeof modulePricing[string];
      painPoints: Array<{ text: string; section: string }>;
    }> = {};

    Object.entries(painPointsBySection).forEach(([section, points]) => {
      points.forEach((pain) => {
        pain.moduleCodes.forEach((code) => {
          const module = modulePricing[code];
          if (module) {
            if (!moduleMap[code]) {
              moduleMap[code] = {
                module,
                painPoints: [],
              };
            }
            // Avoid duplicate pain points
            const exists = moduleMap[code].painPoints.some(
              (p) => p.text === pain.noResponseRecap
            );
            if (!exists) {
              moduleMap[code].painPoints.push({
                text: pain.noResponseRecap,
                section,
              });
            }
          }
        });
      });
    });

    return Object.values(moduleMap);
  }, [painPointsBySection]);

  // Group solutions by category for better organization
  const solutionsByCategory = useMemo(() => {
    const categories: Record<string, typeof solutionsByModule> = {};
    
    solutionsByModule.forEach((solution) => {
      const category = solution.module.category;
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(solution);
    });

    return categories;
  }, [solutionsByModule]);

  return (
    <div className="space-y-8">
      <div>
        <Badge className="mb-4">Phase 4: Solution Demo</Badge>
        <h2 className="text-2xl font-bold text-secondary-900">
          Show how you solve their problems
        </h2>
        <p className="mt-2 text-secondary-600">
          Demo only the modules relevant to their specific pain points.
        </p>
      </div>

      <Card className="border-2 border-primary-200 bg-primary-50 p-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-1 size-5 text-primary-600" />
          <p className="text-lg text-primary-900">
            &quot;{solutionScript.intro}&quot;
          </p>
        </div>
      </Card>

      {/* Solutions grouped by category, each module shown once */}
      {hasPainPoints ? (
        <div className="space-y-6">
          {Object.entries(solutionsByCategory).map(([category, solutions]) => (
            <Card key={category} className="overflow-hidden">
              <div className="border-b border-secondary-200 bg-secondary-50 px-4 py-3">
                <h3 className="font-semibold text-secondary-900">{category}</h3>
              </div>
              <div className="divide-y divide-secondary-100">
                {solutions.map((solution) => (
                  <div key={solution.module.code} className="p-4">
                    {/* The solution module */}
                    <div className="flex items-start gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success-100">
                        <CheckCircle2 className="size-5 text-success-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {solution.module.code}
                          </Badge>
                          <span className="font-semibold text-secondary-900">
                            {solution.module.name}
                          </span>
                        </div>
                        {solution.module.benefit && (
                          <p className="mt-1 text-sm text-success-700">
                            {solution.module.benefit}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Problems this solution addresses */}
                    <div className="ml-11 mt-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-secondary-500">
                        Solves {solution.painPoints.length} issue{solution.painPoints.length !== 1 ? "s" : ""}
                      </p>
                      <ul className="space-y-1">
                        {solution.painPoints.map((pain, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-secondary-600">
                            <XCircle className="mt-0.5 size-3.5 shrink-0 text-warning-500" />
                            <span>{pain.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Delivered in clear parts, each with an objective */}
                    {solution.module.parts && solution.module.parts.length > 0 && (
                      <div className="ml-11 mt-3">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-secondary-500">
                          Delivered in {solution.module.parts.length} parts
                        </p>
                        <ul className="space-y-2">
                          {solution.module.parts.map((part) => (
                            <li
                              key={part.id}
                              className="rounded-lg border border-secondary-100 bg-secondary-50 p-2"
                            >
                              <div className="flex items-center gap-2">
                                <Target className="size-3.5 shrink-0 text-primary-600" />
                                <span className="text-sm font-medium text-secondary-900">
                                  {part.name}
                                </span>
                              </div>
                              <p className="ml-5 mt-0.5 text-xs text-secondary-600">
                                {part.objective}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-2 border-dashed border-secondary-300 p-8 text-center">
          <CheckCircle2 className="mx-auto size-12 text-success-500" />
          <p className="mt-4 text-lg font-medium text-secondary-900">
            No modules needed
          </p>
          <p className="mt-2 text-secondary-600">
            They have everything covered!
          </p>
        </Card>
      )}

      {/* Custom Software Explanation */}
      {hasPainPoints && (
        <Card className="border-2 border-primary-200 bg-primary-50 p-6">
          <div className="flex items-start gap-3">
            <MessageSquare className="mt-1 size-5 text-primary-600" />
            <div>
              <p className="text-sm font-medium text-primary-700">Explain the Approach</p>
              <p className="mt-1 text-lg text-primary-900">
                &quot;Here&apos;s how it works - we build you a complete custom software application tailored to your business. This isn&apos;t off-the-shelf software with features you&apos;ll never use. It&apos;s a purpose-built system with all of these solutions and integrations working together seamlessly. You own it, it&apos;s built specifically for how your business operates, and it grows with you.&quot;
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="border-2 border-success-200 bg-success-50 p-6">
        <div className="flex items-start gap-3">
          <Play className="mt-1 size-5 text-success-600" />
          <div>
            <p className="text-sm font-medium text-success-700">
              Transition to Pricing
            </p>
            <p className="mt-1 text-lg text-success-900">
              &quot;{solutionScript.transitionToPrice}&quot;
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Close Phase Component
function ClosePhase({
  quote,
  painPointsBySection,
  onOpenQuoteBuilder,
}: {
  quote: ReturnType<typeof calculateQuote>;
  painPointsBySection: Record<string, Array<{ noResponseRecap: string; notes: string; moduleCodes: string[] }>>;
  onOpenQuoteBuilder: () => void;
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Group modules by section (same order as solutions)
  const modulesBySection = useMemo(() => {
    type SectionModule = {
      code: string;
      name: string;
      lineTotal: number;
      parts?: Array<{ id: string; name: string; objective: string; price: number }>;
    };
    const grouped: Record<string, SectionModule[]> = {};
    const usedCodes = new Set<string>();

    Object.entries(painPointsBySection).forEach(([section, points]) => {
      const sectionModules: SectionModule[] = [];

      points.forEach((pain) => {
        pain.moduleCodes.forEach((code) => {
          if (!usedCodes.has(code)) {
            const lineItem = quote.lineItems.find(item => item.code === code);
            if (lineItem) {
              sectionModules.push({
                code: lineItem.code,
                name: lineItem.module,
                lineTotal: lineItem.lineTotal,
                parts: lineItem.parts?.filter((p) => p.included),
              });
              usedCodes.add(code);
            }
          }
        });
      });

      if (sectionModules.length > 0) {
        grouped[section] = sectionModules;
      }
    });

    return grouped;
  }, [painPointsBySection, quote.lineItems]);

  const hasSections = Object.keys(modulesBySection).length > 0;

  return (
    <div className="space-y-8">
      <div>
        <Badge className="mb-4">Phase 5: Pricing & Close</Badge>
        <h2 className="text-2xl font-bold text-secondary-900">
          Present the investment
        </h2>
      </div>

      <Card className="border-2 border-primary-200 bg-primary-50 p-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-1 size-5 text-primary-600" />
          <div>
            <p className="text-sm font-medium text-primary-700">Say</p>
            <p className="mt-1 text-lg text-primary-900">
              &quot;{closeScript.priceIntro}&quot;
            </p>
          </div>
        </div>
      </Card>

      {/* Quote Summary grouped by section */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-secondary-900">
            Investment Summary
          </h3>
          <Button onClick={onOpenQuoteBuilder}>
            <Calculator className="mr-2 size-4" />
            Edit Quote
          </Button>
        </div>

        {hasSections ? (
          <div className="mt-4 space-y-6">
            {Object.entries(modulesBySection).map(([section, modules]) => {
              const sectionTotal = modules.reduce((sum, m) => sum + m.lineTotal, 0);
              return (
                <div key={section}>
                  <div className="mb-3 flex items-center justify-between border-b border-secondary-200 pb-2">
                    <h4 className="font-semibold text-secondary-900">{section}</h4>
                    <span className="text-sm font-medium text-secondary-600">
                      {formatCurrency(sectionTotal)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {modules.map((module) => (
                      <div
                        key={module.code}
                        className="rounded-lg bg-secondary-50 p-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {module.code}
                            </Badge>
                            <span className="text-sm text-secondary-700">{module.name}</span>
                          </div>
                          <span className="font-medium">{formatCurrency(module.lineTotal)}</span>
                        </div>
                        {module.parts && module.parts.length > 0 && (
                          <ul className="mt-2 space-y-1.5 border-t border-secondary-200 pt-2">
                            {module.parts.map((part) => (
                              <li
                                key={part.id}
                                className="flex items-start justify-between gap-2"
                              >
                                <div className="flex items-start gap-2">
                                  <Target className="mt-0.5 size-3.5 shrink-0 text-primary-600" />
                                  <div>
                                    <p className="text-xs font-medium text-secondary-800">
                                      {part.name}
                                    </p>
                                    <p className="text-xs text-secondary-500">
                                      {part.objective}
                                    </p>
                                  </div>
                                </div>
                                <span className="shrink-0 text-xs text-secondary-500">
                                  {formatCurrency(part.price)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {quote.lineItems.map((item) => {
              const includedParts = item.parts?.filter((p) => p.included);
              return (
                <div
                  key={item.code}
                  className="rounded-lg bg-secondary-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {item.code}
                      </Badge>
                      <span className="text-sm text-secondary-700">{item.module}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(item.lineTotal)}</span>
                  </div>
                  {includedParts && includedParts.length > 0 && (
                    <ul className="mt-2 space-y-1.5 border-t border-secondary-200 pt-2">
                      {includedParts.map((part) => (
                        <li key={part.id} className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <Target className="mt-0.5 size-3.5 shrink-0 text-primary-600" />
                            <div>
                              <p className="text-xs font-medium text-secondary-800">
                                {part.name}
                              </p>
                              <p className="text-xs text-secondary-500">{part.objective}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-xs text-secondary-500">
                            {formatCurrency(part.price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 border-t border-secondary-200 pt-4">
          <div className="flex items-center justify-between text-xl font-bold">
            <span>Total Investment</span>
            <span className="text-primary-600">{formatCurrency(quote.total)}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-success-50 p-4 text-center">
              <p className="text-sm text-success-600">Deposit (20%)</p>
              <p className="text-2xl font-bold text-success-700">
                {formatCurrency(quote.deposit)}
              </p>
              <p className="text-xs text-success-600">Due today to begin</p>
            </div>
            <div className="rounded-lg bg-secondary-100 p-4 text-center">
              <p className="text-sm text-secondary-500">Balance (80%)</p>
              <p className="text-2xl font-bold text-secondary-700">
                {formatCurrency(quote.balance)}
              </p>
              <p className="text-xs text-secondary-500">Due on delivery</p>
            </div>
          </div>
        </div>
      </Card>

      {/* 15% On-Call Discount */}
      <Card className="overflow-hidden border-2 border-success-500">
        <div className="bg-success-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="size-5" />
              <span className="text-lg font-semibold">15% Same-Day Decision Discount</span>
            </div>
            <Badge className="bg-white text-success-700">
              Save {formatCurrency(Math.round(quote.total * 0.15))}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-success-100">
            If they commit on this call, they get 15% off the total investment
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Standard Price Column */}
            <div className="rounded-lg border border-secondary-200 bg-secondary-50 p-4">
              <p className="text-sm text-secondary-500">Standard Price</p>
              <p className="text-xs text-secondary-400">if you accept at a later date</p>
              <p className="mt-2 text-xl font-bold text-secondary-400 line-through">
                {formatCurrency(quote.total)}
              </p>
              <div className="mt-3 space-y-2 border-t border-secondary-200 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-secondary-400">Deposit (20%)</span>
                  <span className="font-medium text-secondary-400 line-through">
                    {formatCurrency(quote.deposit)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-secondary-400">Balance (80%)</span>
                  <span className="font-medium text-secondary-400 line-through">
                    {formatCurrency(quote.balance)}
                  </span>
                </div>
              </div>
            </div>
            {/* Today's Price Column */}
            <div className="rounded-lg border-2 border-success-500 bg-success-50 p-4">
              <p className="text-sm font-medium text-success-600">Today&apos;s Price</p>
              <p className="text-xs text-success-500">if you decide on this call</p>
              <p className="mt-2 text-2xl font-bold text-success-700">
                {formatCurrency(Math.round(quote.total * 0.85))}
              </p>
              <div className="mt-3 space-y-2 border-t border-success-200 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-success-600">Deposit (20%)</span>
                  <span className="font-bold text-success-700">
                    {formatCurrency(Math.round(quote.total * 0.85 * 0.2))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-success-600">Balance (80%)</span>
                  <span className="font-bold text-success-700">
                    {formatCurrency(Math.round(quote.total * 0.85 * 0.8))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-2 border-success-200 bg-success-50 p-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-1 size-5 text-success-600" />
          <div>
            <p className="text-sm font-medium text-success-700">Close with On-Call Discount</p>
            <p className="mt-1 text-lg text-success-900">
              &quot;If you&apos;re ready to move forward today, I can lock in our 15% 
              same-day decision discount. That brings your investment down from{" "}
              {formatCurrency(quote.total)} to just{" "}
              {formatCurrency(Math.round(quote.total * 0.85))}. Your deposit to get 
              started would be {formatCurrency(Math.round(quote.total * 0.85 * 0.2))}, 
              and the balance is due when we go live. Does that work for you?&quot;
            </p>
          </div>
        </div>
      </Card>

      <Card className="border-2 border-primary-200 bg-primary-50 p-6">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-1 size-5 text-primary-600" />
          <div>
            <p className="text-sm font-medium text-primary-700">Alternative (No Discount)</p>
            <p className="mt-1 text-lg text-primary-900">
              &quot;Your total investment is {formatCurrency(quote.total)}. We start with 
              a 20% deposit of {formatCurrency(quote.deposit)}, and the balance is due 
              when we go live. Ready to get started?&quot;
            </p>
          </div>
        </div>
      </Card>

      {/* Objection Handlers */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-secondary-900">
          Common Objection Handlers
        </h3>
        <div className="space-y-3">
          {Object.values(objectionHandlers).map((handler) => (
            <Card key={handler.objection} className="p-4">
              <p className="font-medium text-danger-600">
                &quot;{handler.objection}&quot;
              </p>
              <p className="mt-2 text-sm text-secondary-700">{handler.response}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// Quote Builder Content Component
function QuoteBuilderContent({
  quote,
  moduleQuantities,
  setModuleQuantities,
  discountPercent,
  setDiscountPercent,
  setSelectedParts,
}: {
  quote: ReturnType<typeof calculateQuote>;
  moduleQuantities: Record<string, number>;
  setModuleQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  discountPercent: number;
  setDiscountPercent: React.Dispatch<React.SetStateAction<number>>;
  setSelectedParts: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Toggle a single part on/off for a module. Base foundation parts are always included.
  const togglePart = (moduleCode: string, partId: string, allPartIds: string[]) => {
    setSelectedParts((prev) => {
      const current = prev[moduleCode] ?? allPartIds;
      const next = current.includes(partId)
        ? current.filter((id) => id !== partId)
        : [...current, partId];
      return { ...prev, [moduleCode]: next };
    });
  };

  return (
    <div className="mt-6 space-y-6">
      {quote.lineItems.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-secondary-900">
            Recommended Modules
          </h3>
          {quote.lineItems.map((item) => {
            const module = modulePricing[item.code];
            return (
              <div
                key={item.code}
                className="rounded-lg border border-secondary-200 p-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="outline" className="mb-1">
                      {item.code}
                    </Badge>
                    <p className="font-medium text-secondary-900">{item.module}</p>
                    <p className="text-xs text-secondary-500">
                      Base: {formatCurrency(module.basePrice)}
                      {module.multiplier && (
                        <span>
                          {" "}
                          + {formatCurrency(module.multiplier)} per{" "}
                          {module.multiplierPer}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    {module.multiplier && (
                      <div className="mb-1 flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-6"
                          onClick={() =>
                            setModuleQuantities((prev) => ({
                              ...prev,
                              [item.code]: Math.max(1, (prev[item.code] || 1) - 1),
                            }))
                          }
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-8 text-center text-sm">
                          {moduleQuantities[item.code] || 1}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-6"
                          onClick={() =>
                            setModuleQuantities((prev) => ({
                              ...prev,
                              [item.code]: (prev[item.code] || 1) + 1,
                            }))
                          }
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    )}
                    <p className="font-semibold text-secondary-900">
                      {formatCurrency(item.lineTotal)}
                    </p>
                  </div>
                </div>

                {/* Parts breakdown - split the module into deliverables */}
                {item.parts && item.parts.length > 0 && (
                  <div className="mt-3 border-t border-secondary-100 pt-3">
                    {(() => {
                      const isFoundation = item.code === "BASE" || item.code === "USER";
                      const allPartIds = item.parts.map((p) => p.id);
                      return (
                        <>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-secondary-400">
                            {isFoundation ? "Includes" : "Parts (toggle to adjust price)"}
                          </p>
                          <div className="space-y-2">
                            {item.parts.map((part) => (
                              <button
                                key={part.id}
                                type="button"
                                disabled={isFoundation}
                                onClick={() =>
                                  togglePart(item.code, part.id, allPartIds)
                                }
                                className={cn(
                                  "flex w-full items-start gap-2 rounded-lg border p-2 text-left transition-colors",
                                  isFoundation && "cursor-default",
                                  part.included
                                    ? "border-primary-200 bg-primary-50"
                                    : "border-secondary-200 bg-white opacity-60"
                                )}
                              >
                                <div
                                  className={cn(
                                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                                    part.included
                                      ? "border-primary-600 bg-primary-600 text-white"
                                      : "border-secondary-300 bg-white"
                                  )}
                                >
                                  {part.included && <Check className="size-3" />}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium text-secondary-900">
                                      {part.name}
                                    </span>
                                    <span className="text-sm font-medium text-secondary-600">
                                      {formatCurrency(part.price)}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 text-xs text-secondary-500">
                                    {part.objective}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-secondary-200 p-8">
          <CheckCircle2 className="size-10 text-success-500" />
          <p className="mt-2 text-center text-secondary-600">
            No modules needed based on current responses.
          </p>
        </div>
      )}

      {quote.lineItems.length > 0 && (
        <>
          <div className="space-y-2">
            <Label htmlFor="discount">Bundle Discount (%)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="discount"
                type="number"
                min={0}
                max={50}
                value={discountPercent}
                onChange={(e) =>
                  setDiscountPercent(Math.min(50, Math.max(0, Number(e.target.value))))
                }
                className="w-24"
              />
              <Percent className="size-4 text-secondary-400" />
            </div>
          </div>

          <div className="space-y-3 rounded-lg bg-secondary-50 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-secondary-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(quote.subtotal)}</span>
            </div>
            {quote.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-success-600">
                <span>Discount ({quote.discountPercent}%)</span>
                <span>-{formatCurrency(quote.discountAmount)}</span>
              </div>
            )}
            <div className="border-t border-secondary-200 pt-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Investment</span>
                <span className="text-primary-600">{formatCurrency(quote.total)}</span>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t border-secondary-200 pt-4">
              <h4 className="text-sm font-semibold text-secondary-900">
                Payment Terms
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-success-200 bg-success-50 p-3 text-center">
                  <p className="text-xs text-success-600">Deposit (20%)</p>
                  <p className="text-lg font-bold text-success-700">
                    {formatCurrency(quote.deposit)}
                  </p>
                </div>
                <div className="rounded-lg border border-secondary-200 bg-white p-3 text-center">
                  <p className="text-xs text-secondary-500">Balance (80%)</p>
                  <p className="text-lg font-bold text-secondary-700">
                    {formatCurrency(quote.balance)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
