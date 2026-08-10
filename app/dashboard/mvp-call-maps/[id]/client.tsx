"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Mail,
  User,
  Play,
  DollarSign,
  Users,
  Rocket,
  FileCode,
  Cpu,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateMVPCallMap } from "@/lib/actions";
import {
  calculateMVPQuote,
  type FlowData,
  type ConfiguratorData,
} from "@/config/mvp-pricing";
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

interface MVPCallMapData {
  id: string;
  name: string;
  notes: string | null;
  flowData: Prisma.JsonValue | null;
  configuratorData: Prisma.JsonValue | null;
  clientCompany: {
    id: string;
    name: string;
    website: string | null;
    status: string;
  } | null;
  formSubmission: FormSubmissionData | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ClientData {
  id: string;
  name: string;
}

interface FormSubmissionOption {
  id: string;
  name: string;
  email: string;
  type: string;
  createdAt: Date;
}

interface MVPCallMapDetailClientProps {
  mvpCallMap: MVPCallMapData;
  formSubmissions: FormSubmissionOption[];
  clients: ClientData[];
}

export function MVPCallMapDetailClient({
  mvpCallMap: initialMVPCallMap,
  formSubmissions,
  clients,
}: MVPCallMapDetailClientProps) {
  const [mvpCallMap, setMVPCallMap] = useState(initialMVPCallMap);
  const [isUpdating, setIsUpdating] = useState(false);

  // Parse flow and configurator data
  const flowData = useMemo(() => {
    if (mvpCallMap.flowData && typeof mvpCallMap.flowData === "object") {
      return mvpCallMap.flowData as unknown as FlowData;
    }
    return null;
  }, [mvpCallMap.flowData]);

  const configuratorData = useMemo(() => {
    if (mvpCallMap.configuratorData && typeof mvpCallMap.configuratorData === "object") {
      return mvpCallMap.configuratorData as unknown as ConfiguratorData;
    }
    return null;
  }, [mvpCallMap.configuratorData]);

  // Calculate quote
  const quote = useMemo(() => {
    return calculateMVPQuote(flowData, configuratorData);
  }, [flowData, configuratorData]);

  // Count elements from flow data
  const elementCounts = useMemo(() => {
    if (!flowData) {
      return { pages: 0, apis: 0, customLogic: 0 };
    }
    return {
      pages: flowData.nodes.filter((n) => n.type === "page").length,
      apis: flowData.nodes.filter((n) => n.type === "externalApi").length,
      customLogic: flowData.nodes.filter((n) => n.type === "customLogic").length,
    };
  }, [flowData]);

  // Update form submission
  const updateFormSubmission = async (formSubmissionId: string | null) => {
    setIsUpdating(true);
    try {
      const result = await updateMVPCallMap(mvpCallMap.id, {
        formSubmissionId,
      });
      if (result.data) {
        const linkedSubmission = formSubmissionId
          ? formSubmissions.find((s) => s.id === formSubmissionId)
          : null;
        setMVPCallMap((prev) => ({
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

  // Update client company
  const updateClientCompany = async (clientCompanyId: string | null) => {
    setIsUpdating(true);
    try {
      const result = await updateMVPCallMap(mvpCallMap.id, {
        clientCompanyId,
      });
      if (result.data) {
        const linkedClient = clientCompanyId
          ? clients.find((c) => c.id === clientCompanyId)
          : null;
        setMVPCallMap((prev) => ({
          ...prev,
          clientCompany: linkedClient
            ? {
              id: linkedClient.id,
              name: linkedClient.name,
              website: null,
              status: "ATTENDED_SALES_CALL",
            }
            : null,
        }));
      }
    } catch (error) {
      console.error("Error updating client company:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/mvp-call-maps">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">
              {mvpCallMap.name}
            </h1>
            <p className="text-secondary-600">
              Created {new Date(mvpCallMap.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <Link href={`/dashboard/mvp-call-maps/${mvpCallMap.id}/sales-view`}>
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
                value={mvpCallMap.formSubmission?.id || "none"}
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

            {mvpCallMap.formSubmission ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                    <User className="size-5 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-sm text-secondary-500">Name</p>
                    <p className="font-medium text-secondary-900">
                      {mvpCallMap.formSubmission.firstName &&
                      mvpCallMap.formSubmission.lastName
                        ? `${mvpCallMap.formSubmission.firstName} ${mvpCallMap.formSubmission.lastName}`
                        : mvpCallMap.formSubmission.name}
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
                      {mvpCallMap.formSubmission.email}
                    </p>
                  </div>
                </div>
                {mvpCallMap.formSubmission.companyHeadcount && (
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                      <Users className="size-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm text-secondary-500">Team Size</p>
                      <p className="font-medium text-secondary-900">
                        {mvpCallMap.formSubmission.companyHeadcount}
                      </p>
                    </div>
                  </div>
                )}
                {mvpCallMap.formSubmission.budget && (
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                      <DollarSign className="size-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm text-secondary-500">Budget</p>
                      <p className="font-medium text-secondary-900">
                        {mvpCallMap.formSubmission.budget}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-center rounded-lg border-2 border-dashed border-secondary-200 p-8">
                <div className="text-center">
                  <User className="mx-auto size-8 text-secondary-400" />
                  <p className="mt-2 text-sm text-secondary-600">
                    Link a form submission to see prospect information
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Client Company Card */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-secondary-900">
                <Building2 className="size-5" />
                Client Company
              </h2>
              <Select
                value={mvpCallMap.clientCompany?.id || "none"}
                onValueChange={(value) =>
                  updateClientCompany(value === "none" ? null : value)
                }
                disabled={isUpdating}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Link client company..." />
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

            {mvpCallMap.clientCompany ? (
              <div className="mt-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary-100">
                  <Building2 className="size-5 text-primary-600" />
                </div>
                <div>
                  <Link
                    href={`/dashboard/clients/${mvpCallMap.clientCompany.id}`}
                    className="font-medium text-primary-600 hover:underline"
                  >
                    {mvpCallMap.clientCompany.name}
                  </Link>
                  <p className="text-sm text-secondary-500">
                    {mvpCallMap.clientCompany.status.replace(/_/g, " ")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-center rounded-lg border-2 border-dashed border-secondary-200 p-8">
                <div className="text-center">
                  <Building2 className="mx-auto size-8 text-secondary-400" />
                  <p className="mt-2 text-sm text-secondary-600">
                    Link a client company (optional)
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Product Overview */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-secondary-900">
              Product Overview
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-secondary-200 p-4 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-primary-100">
                  <FileCode className="size-6 text-primary-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-secondary-900">
                  {elementCounts.pages}
                </p>
                <p className="text-sm text-secondary-500">Pages</p>
              </div>
              <div className="rounded-lg border border-secondary-200 p-4 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-success-100">
                  <Globe className="size-6 text-success-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-secondary-900">
                  {elementCounts.apis}
                </p>
                <p className="text-sm text-secondary-500">External APIs</p>
              </div>
              <div className="rounded-lg border border-secondary-200 p-4 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-warning-100">
                  <Cpu className="size-6 text-warning-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-secondary-900">
                  {elementCounts.customLogic}
                </p>
                <p className="text-sm text-secondary-500">Custom Logic</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quote Summary Card */}
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-secondary-900">
              <DollarSign className="size-5" />
               Quote
            </h2>
            <div className="mt-4 rounded-lg bg-primary-50 p-6 text-center">
              <p className="text-sm font-medium text-secondary-600">
                Total Investment
              </p>
              <p className="mt-1 text-4xl font-bold text-primary-600">
                {formatCurrency(quote.total)}
              </p>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary-600">Line Items</span>
                <span className="font-medium">{quote.lineItems.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-600">Deposit (20%)</span>
                <span className="font-medium text-success-600">
                  {formatCurrency(quote.deposit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-600">Balance (80%)</span>
                <span className="font-medium">{formatCurrency(quote.balance)}</span>
              </div>
            </div>

            <Link
              href={`/dashboard/mvp-call-maps/${mvpCallMap.id}/sales-view`}
              className="mt-4 block"
            >
              <Button className="w-full">
                <Rocket className="mr-2 size-4" />
                Open Product Builder
              </Button>
            </Link>
          </Card>

          {/* Notes */}
          {mvpCallMap.notes && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-secondary-900">Notes</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-secondary-600">
                {mvpCallMap.notes}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
