"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ClientStatus, ServiceLine } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClient, updateClient } from "@/lib/actions/clients";
import { cn, titleCase } from "@/lib/utils";

const STATUSES: ClientStatus[] = [
  "LEAD",
  "ONBOARDING",
  "ACTIVE",
  "PAUSED",
  "CHURNED",
];

const SERVICES: ServiceLine[] = [
  "SEO",
  "GOOGLE_ADS",
  "META_ADS",
  "WEBSITE",
  "GOOGLE_BUSINESS_PROFILE",
  "SOCIAL_MEDIA",
  "CONTENT",
  "REPUTATION",
  "CRM_AUTOMATION",
];

export interface ClientFormValues {
  name: string;
  practiceType: string;
  website: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string;
  addressLine: string;
  city: string;
  country: string;
  packageTier: string;
  status: ClientStatus;
  monthlyRetainer: string;
  startDate: string;
  notes: string;
  accountManagerId: string;
  services: ServiceLine[];
}

interface ClientFormProps {
  clientId?: string;
  managers: { id: string; name: string | null; email: string }[];
  defaultValues?: Partial<ClientFormValues>;
}

const EMPTY: ClientFormValues = {
  name: "",
  practiceType: "",
  website: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  whatsappNumber: "",
  addressLine: "",
  city: "",
  country: "",
  packageTier: "",
  status: "ONBOARDING",
  monthlyRetainer: "",
  startDate: "",
  notes: "",
  accountManagerId: "",
  services: [],
};

export function ClientForm({
  clientId,
  managers,
  defaultValues,
}: ClientFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<ClientFormValues>({
    ...EMPTY,
    ...defaultValues,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update<K extends keyof ClientFormValues>(
    key: K,
    value: ClientFormValues[K]
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleService(service: ServiceLine) {
    setValues((current) => ({
      ...current,
      services: current.services.includes(service)
        ? current.services.filter((item) => item !== service)
        : [...current.services, service],
    }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = { ...values, services: values.services as string[] };
      const { data, error } = clientId
        ? await updateClient(clientId, payload)
        : await createClient(payload);

      if (error || !data) {
        toast.error(error ?? "Something went wrong.");
        return;
      }

      toast.success(clientId ? "Client updated." : "Client created.");
      router.push(`/dashboard/clients/${data.id}`);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Practice details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="name">Practice name</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Bright Smile Dental"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="practiceType">Practice type</Label>
            <Input
              id="practiceType"
              value={values.practiceType}
              onChange={(event) => update("practiceType", event.target.value)}
              placeholder="General dentistry, orthodontics..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={values.website}
              onChange={(event) => update("website", event.target.value)}
              placeholder="https://practice.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="addressLine">Address</Label>
            <Input
              id="addressLine"
              value={values.addressLine}
              onChange={(event) => update("addressLine", event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={values.city}
                onChange={(event) => update("city", event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={values.country}
                onChange={(event) => update("country", event.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactName">Contact name</Label>
            <Input
              id="contactName"
              value={values.contactName}
              onChange={(event) => update("contactName", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input
              id="contactEmail"
              type="email"
              value={values.contactEmail}
              onChange={(event) => update("contactEmail", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contactPhone">Contact phone</Label>
            <Input
              id="contactPhone"
              value={values.contactPhone}
              onChange={(event) => update("contactPhone", event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsappNumber">WhatsApp number</Label>
            <Input
              id="whatsappNumber"
              value={values.whatsappNumber}
              onChange={(event) => update("whatsappNumber", event.target.value)}
              placeholder="+441234567890"
            />
            <p className="text-xs text-muted-foreground">
              Inbound WhatsApp messages from this number are filed against the
              client automatically.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Engagement</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              value={values.status}
              onValueChange={(value) => update("status", value as ClientStatus)}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {titleCase(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accountManager">Account manager</Label>
            <Select
              value={values.accountManagerId || "unassigned"}
              onValueChange={(value) =>
                update("accountManagerId", value === "unassigned" ? "" : value)
              }
            >
              <SelectTrigger id="accountManager">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {managers.map((manager) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.name ?? manager.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="packageTier">Package</Label>
            <Input
              id="packageTier"
              value={values.packageTier}
              onChange={(event) => update("packageTier", event.target.value)}
              placeholder="Growth, Scale, Foundation..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="monthlyRetainer">Monthly retainer</Label>
            <Input
              id="monthlyRetainer"
              type="number"
              min="0"
              step="50"
              value={values.monthlyRetainer}
              onChange={(event) => update("monthlyRetainer", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              type="date"
              value={values.startDate}
              onChange={(event) => update("startDate", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Contracted services</Label>
            <div className="flex flex-wrap gap-2">
              {SERVICES.map((service) => {
                const isSelected = values.services.includes(service);
                return (
                  <button
                    key={service}
                    type="button"
                    onClick={() => toggleService(service)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      isSelected
                        ? "border-primary bg-primary-50 text-primary-700"
                        : "border-border bg-card text-secondary-600 hover:bg-muted"
                    )}
                  >
                    {titleCase(service)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Internal notes</Label>
            <Textarea
              id="notes"
              value={values.notes}
              onChange={(event) => update("notes", event.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {clientId ? "Save changes" : "Create client"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
