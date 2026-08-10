"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Mail,
  Calendar,
  Clock,
  User,
  FileText,
  CheckCircle2,
  TrendingUp,
  Phone,
  Target,
  DollarSign,
  Users,
  Briefcase,
  Link2,
  Play,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { updateSalesCallMap } from "@/lib/actions";
import {
  salesAuditConfig,
  calculateSectionScore,
  getUncheckedImprovements,
  getAllCheckedItemIds,
} from "@/config/sales-audit-schema";
import {
  calculateQuote,
} from "@/config/module-pricing";
import {
  getModuleCodesFromUncheckedItems,
} from "@/config/checklist-module-mapping";
import type { Prisma } from "@prisma/client";

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
  createdAt: Date;
  updatedAt: Date;
}

interface FormSubmissionOption {
  id: string;
  name: string;
  email: string;
  type: string;
  createdAt: Date;
}

interface SalesCallMapDetailClientProps {
  salesCallMap: SalesCallMapData;
  formSubmissions: FormSubmissionOption[];
}

export function SalesCallMapDetailClient({
  salesCallMap: initialSalesCallMap,
  formSubmissions,
}: SalesCallMapDetailClientProps) {
  const [salesCallMap, setSalesCallMap] = useState(initialSalesCallMap);
  const [isUpdating, setIsUpdating] = useState(false);

  // Get all checked item IDs (handles both AuditData and CallData formats)
  const allCheckedItemIds = useMemo(() => {
    return getAllCheckedItemIds(salesCallMap.auditData);
  }, [salesCallMap.auditData]);

  // Get all unchecked item IDs
  const allUncheckedItemIds = useMemo(() => {
    const unchecked: string[] = [];
    salesAuditConfig.sections.forEach((section) => {
      section.checklistItems.forEach((item) => {
        if (!allCheckedItemIds.includes(item.id)) {
          unchecked.push(item.id);
        }
      });
    });
    return unchecked;
  }, [allCheckedItemIds]);

  // Calculate section scores (using allCheckedItemIds for both formats)
  const sectionScores = useMemo(() => {
    const scores: Record<string, number> = {};
    salesAuditConfig.sections.forEach((section) => {
      scores[section.id] = calculateSectionScore(section, allCheckedItemIds);
    });
    return scores;
  }, [allCheckedItemIds]);

  // Overall score (calculated using allCheckedItemIds which handles both formats)
  const overallScore = useMemo(() => {
    let totalScore = 0;
    for (const section of salesAuditConfig.sections) {
      totalScore += calculateSectionScore(section, allCheckedItemIds);
    }
    return {
      totalScore,
      maxScore: 80,
      percentage: Math.round((totalScore / 80) * 100),
    };
  }, [allCheckedItemIds]);

  // Get module codes and quote
  const uncheckedModuleCodes = useMemo(() => {
    return getModuleCodesFromUncheckedItems(allUncheckedItemIds);
  }, [allUncheckedItemIds]);

  const quote = useMemo(() => {
    return calculateQuote(uncheckedModuleCodes, {}, 0);
  }, [uncheckedModuleCodes]);

  // Top improvements (using allCheckedItemIds for both formats)
  const topImprovements = useMemo(() => {
    const improvements: Array<{ section: string; item: { label: string; impact: string } }> = [];
    salesAuditConfig.sections.forEach((section) => {
      const unchecked = getUncheckedImprovements(section, allCheckedItemIds);
      unchecked.slice(0, 2).forEach((item) => {
        improvements.push({ section: section.title, item });
      });
    });
    return improvements.slice(0, 6);
  }, [allCheckedItemIds]);

  // Update form submission
  const updateFormSubmission = async (formSubmissionId: string | null) => {
    setIsUpdating(true);
    try {
      const result = await updateSalesCallMap(salesCallMap.id, {
        formSubmissionId,
      });
      if (result.data) {
        const linkedSubmission = formSubmissionId
          ? formSubmissions.find((s) => s.id === formSubmissionId)
          : null;
        setSalesCallMap((prev) => ({
          ...prev,
          formSubmission: linkedSubmission
            ? {
              id: linkedSubmission.id,
              name: linkedSubmission.name,
              email: linkedSubmission.email,
              type: linkedSubmission.type,
              timeline: null,
              companyHeadcount: null,
              manualProcesses: null,
              budget: null,
              productType: null,
              platform: null,
              servicesNeeded: [],
              utmSource: null,
              utmCampaign: null,
              firstName: null,
              lastName: null,
              createdAt: linkedSubmission.createdAt,
            }
            : null,
        }));
      }
    } catch (error) {
      console.error("Error updating form submission:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const getScoreColor = (score: number, max: number = 10) => {
    const percentage = (score / max) * 100;
    if (percentage >= 70) return "text-success-600";
    if (percentage >= 40) return "text-warning-600";
    return "text-danger-600";
  };

  const getScoreBgColor = (score: number, max: number = 10) => {
    const percentage = (score / max) * 100;
    if (percentage >= 70) return "bg-success-100";
    if (percentage >= 40) return "bg-warning-100";
    return "bg-danger-100";
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const totalChecklistItems = salesAuditConfig.sections.reduce(
    (sum, s) => sum + s.checklistItems.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sales-call-maps">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">
              {salesCallMap.name}
            </h1>
            <p className="text-secondary-600">
              Created {new Date(salesCallMap.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Link href={`/dashboard/sales-call-maps/${salesCallMap.id}/sales-view`}>
          <Button size="lg">
            <Play className="mr-2 size-4" />
            Open Sales View
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Prospect Info Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-secondary-900">
                <User className="size-5" />
                Prospect Information
              </h2>
              <Select
                value={salesCallMap.formSubmission?.id || "none"}
                onValueChange={(value) =>
                  updateFormSubmission(value === "none" ? null : value)
                }
                disabled={isUpdating}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Link form submission..." />
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

            {salesCallMap.formSubmission ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                    <User className="size-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm text-secondary-500">Name</p>
                    <p className="font-medium text-secondary-900">
                      {salesCallMap.formSubmission.firstName &&
                      salesCallMap.formSubmission.lastName
                        ? `${salesCallMap.formSubmission.firstName} ${salesCallMap.formSubmission.lastName}`
                        : salesCallMap.formSubmission.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                    <Mail className="size-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm text-secondary-500">Email</p>
                    <p className="font-medium text-secondary-900">
                      {salesCallMap.formSubmission.email}
                    </p>
                  </div>
                </div>
                {salesCallMap.formSubmission.companyHeadcount && (
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                      <Users className="size-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm text-secondary-500">Team Size</p>
                      <p className="font-medium text-secondary-900">
                        {salesCallMap.formSubmission.companyHeadcount}
                      </p>
                    </div>
                  </div>
                )}
                {salesCallMap.formSubmission.budget && (
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                      <DollarSign className="size-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm text-secondary-500">Budget</p>
                      <p className="font-medium text-secondary-900">
                        {salesCallMap.formSubmission.budget}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-center rounded-lg border-2 border-dashed border-secondary-200 p-8">
                <div className="text-center">
                  <Link2 className="mx-auto size-8 text-secondary-400" />
                  <p className="mt-2 text-sm text-secondary-600">
                    Link a form submission to see prospect information
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Linked Meeting */}
          {salesCallMap.meeting && (
            <Card className="p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-secondary-900">
                <Phone className="size-5" />
                Linked Meeting
              </h2>
              <div className="mt-4">
                <p className="font-medium text-secondary-900">
                  {salesCallMap.meeting.title}
                </p>
                <p className="text-sm text-secondary-500">
                  {new Date(salesCallMap.meeting.startTime).toLocaleDateString()}{" "}
                  at {new Date(salesCallMap.meeting.startTime).toLocaleTimeString()}
                </p>
                {salesCallMap.meeting.summary && (
                  <p className="mt-2 text-sm text-secondary-600">
                    {salesCallMap.meeting.summary}
                  </p>
                )}
              </div>
            </Card>
          )}

          {/* Section Scores */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-secondary-900">
              Audit Section Scores
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {salesAuditConfig.sections.map((section) => {
                const score = sectionScores[section.id];
                // Count checked items that belong to this section
                const checkedCount = section.checklistItems.filter(
                  (item) => allCheckedItemIds.includes(item.id)
                ).length;
                return (
                  <div
                    key={section.id}
                    className="flex items-center justify-between rounded-lg border border-secondary-200 p-3"
                  >
                    <div>
                      <p className="font-medium text-secondary-900">
                        {section.title}
                      </p>
                      <p className="text-xs text-secondary-500">
                        {checkedCount}/{section.checklistItems.length} items checked
                      </p>
                    </div>
                    <Badge
                      className={cn(
                        "text-lg font-bold",
                        getScoreBgColor(score),
                        getScoreColor(score)
                      )}
                    >
                      {score}/10
                    </Badge>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Top Improvements */}
          {topImprovements.length > 0 && (
            <Card className="p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-secondary-900">
                <AlertTriangle className="size-5 text-warning-500" />
                Top Improvement Opportunities
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {topImprovements.map((improvement, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-secondary-200 p-3"
                  >
                    <p className="text-xs font-medium text-secondary-400">
                      {improvement.section}
                    </p>
                    <p className="mt-1 text-sm font-medium text-secondary-900">
                      {improvement.item.label}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-success-600">
                      <TrendingUp className="size-3" />
                      {improvement.item.impact}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Overall Score Card */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-secondary-900">
              Audit Summary
            </h2>
            <div
              className={cn(
                "mt-4 rounded-lg p-6 text-center",
                getScoreBgColor(overallScore.totalScore, 80)
              )}
            >
              <p className="text-sm font-medium text-secondary-600">
                Overall Score
              </p>
              <p
                className={cn(
                  "mt-1 text-5xl font-bold",
                  getScoreColor(overallScore.totalScore, 80)
                )}
              >
                {overallScore.totalScore}
                <span className="text-xl font-normal text-secondary-400">/80</span>
              </p>
              <p
                className={cn(
                  "mt-2 text-lg font-medium",
                  getScoreColor(overallScore.totalScore, 80)
                )}
              >
                {overallScore.percentage}% Maturity
              </p>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary-600">Items Checked</span>
                <span className="font-medium">
                  {allCheckedItemIds.length}/{totalChecklistItems}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-600">Gaps Identified</span>
                <span className="font-medium text-warning-600">
                  {allUncheckedItemIds.length}
                </span>
              </div>
            </div>
          </Card>

          {/*  Quote */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-secondary-900">
               Quote
            </h2>
            <div className="mt-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-secondary-600">Modules Needed</span>
                <span className="font-medium">{quote.lineItems.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary-600">Base Estimate</span>
                <span className="font-medium">
                  {formatCurrency(quote.subtotal)}
                </span>
              </div>
              <div className="border-t border-secondary-200 pt-3">
                <div className="flex justify-between">
                  <span className="font-medium text-secondary-900">
                    Est. Investment
                  </span>
                  <span className="text-xl font-bold text-primary-600">
                    {formatCurrency(quote.total)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-secondary-500">
                  20% deposit: {formatCurrency(quote.deposit)}
                </p>
              </div>
            </div>

            <Link
              href={`/dashboard/sales-call-maps/${salesCallMap.id}/sales-view`}
              className="mt-4 block"
            >
              <Button variant="outline" className="w-full">
                <ExternalLink className="mr-2 size-4" />
                Open Quote Builder
              </Button>
            </Link>
          </Card>

          {/* Linked Client */}
          {salesCallMap.clientCompany && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-secondary-900">
                Linked Client
              </h2>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                  <Building2 className="size-5 text-primary-600" />
                </div>
                <div>
                  <Link
                    href={`/dashboard/clients/${salesCallMap.clientCompany.id}`}
                    className="font-medium text-primary-600 hover:underline"
                  >
                    {salesCallMap.clientCompany.name}
                  </Link>
                  <p className="text-sm text-secondary-500">
                    {salesCallMap.clientCompany.status.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
