"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDeal, updateDeal, updateDealStage } from "@/lib/actions/crm";
import {
  CURRENCY_OPTIONS,
  DEAL_BILLING_INTERVAL_LABELS,
  DEAL_BILLING_INTERVAL_OPTIONS,
  DEAL_PRICING_TYPE_LABELS,
  DEAL_PRICING_TYPE_OPTIONS,
  DEFAULT_RETAINER_INTERVAL,
  DEFAULT_RETAINER_PERIODS,
  formatCurrency,
} from "@/constants/crm";
import {
  dealContractValue,
  dealMonthlyRecurring,
  PRICING_AMOUNT_LABELS,
  PRICING_QUANTITY_LABELS,
  pricingItemAmount,
} from "@/lib/crm/deal-pricing";
import type { DealPricingItemView } from "@/lib/fetchers/crm";

const NONE = "__none__";

const pricingItemSchema = z.object({
  type: z.enum(["PROJECT", "HOURLY", "RETAINER"]),
  label: z.string().optional(),
  unitAmount: z.string(),
  quantity: z.string(),
  interval: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]).optional(),
});

type PricingItemFormData = z.infer<typeof pricingItemSchema>;

const dealSchema = z
  .object({
    name: z.string().min(1, "Deal name is required"),
    currency: z.string().min(1),
    stageId: z.string().min(1, "Pick a stage"),
    companyId: z.string().optional(),
    primaryPersonId: z.string().optional(),
    ownerId: z.string().optional(),
    closeDate: z.string().optional(),
    pricingItems: z.array(pricingItemSchema),
  })
  .superRefine((data, ctx) => {
    data.pricingItems.forEach((item, index) => {
      const amount = Number(item.unitAmount);
      if (!item.unitAmount || Number.isNaN(amount) || amount < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter an amount",
          path: ["pricingItems", index, "unitAmount"],
        });
      }

      if (item.type === "PROJECT") return;

      const quantity = Number(item.quantity);
      if (!item.quantity || !Number.isInteger(quantity) || quantity < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            item.type === "HOURLY"
              ? "Enter estimated hours"
              : "Enter a number of periods",
          path: ["pricingItems", index, "quantity"],
        });
      }

      if (item.type === "RETAINER" && !item.interval) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pick an interval",
          path: ["pricingItems", index, "interval"],
        });
      }
    });
  });

type DealFormData = z.infer<typeof dealSchema>;

export interface DealModalRecord {
  id: string;
  name: string;
  value: number;
  currency: string;
  pricingItems: DealPricingItemView[];
  stageId: string;
  companyId: string | null;
  primaryPersonId: string | null;
  ownerId: string | null;
  closeDate: Date | null;
}

/** A fresh row, pre-filled with the sensible defaults for its type. */
function emptyPricingItem(
  type: PricingItemFormData["type"] = "PROJECT"
): PricingItemFormData {
  return {
    type,
    label: "",
    unitAmount: "",
    quantity: type === "RETAINER" ? String(DEFAULT_RETAINER_PERIODS) : "1",
    interval: type === "RETAINER" ? DEFAULT_RETAINER_INTERVAL : undefined,
  };
}

function toPricingFormItems(
  items: DealPricingItemView[]
): PricingItemFormData[] {
  return items.map((item) => ({
    type: item.type,
    label: item.label ?? "",
    unitAmount: String(item.unitAmount),
    quantity: String(item.quantity),
    interval: item.interval ?? undefined,
  }));
}

/** Parses a row for the pricing math, treating blanks as zero. */
function toPricingLine(item: PricingItemFormData) {
  const unitAmount = Number(item.unitAmount);
  const quantity = Number(item.quantity);

  return {
    type: item.type,
    unitAmount: Number.isFinite(unitAmount) ? unitAmount : 0,
    quantity: item.type === "PROJECT" ? 1 : Number.isFinite(quantity) ? quantity : 0,
    interval: item.interval ?? null,
  };
}

interface CrmDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stages: Array<{ id: string; name: string; order: number }>;
  companies: Array<{ id: string; name: string }>;
  people: Array<{ id: string; label: string; companyId: string | null }>;
  owners: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>;
  deal?: DealModalRecord | null;
}

function ownerLabel(owner: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = [owner.firstName, owner.lastName].filter(Boolean).join(" ");
  return name || owner.email;
}

function toDateInput(date: Date | null): string {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

export function CrmDealModal({
  isOpen,
  onClose,
  onSuccess,
  stages,
  companies,
  people,
  owners,
  deal,
}: CrmDealModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditing = Boolean(deal);

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      name: "",
      currency: "USD",
      stageId: stages[0]?.id ?? "",
      companyId: NONE,
      primaryPersonId: NONE,
      ownerId: NONE,
      closeDate: "",
      pricingItems: [emptyPricingItem()],
    },
  });

  const pricingFields = useFieldArray({
    control: form.control,
    name: "pricingItems",
  });

  const selectedCompanyId = useWatch({
    control: form.control,
    name: "companyId",
  });

  const watchedPricingItems = useWatch({
    control: form.control,
    name: "pricingItems",
  });

  const watchedCurrency = useWatch({ control: form.control, name: "currency" });

  // The contract value is derived, so the form only ever shows the running total.
  const pricingTotals = useMemo(() => {
    const lines = (watchedPricingItems ?? []).map(toPricingLine);
    return {
      lines,
      contractValue: dealContractValue(lines),
      monthlyRecurring: dealMonthlyRecurring(lines),
    };
  }, [watchedPricingItems]);

  // Contacts at the selected company come first so the picker stays usable
  const personOptions = useMemo(() => {
    if (!selectedCompanyId || selectedCompanyId === NONE) return people;
    const atCompany = people.filter(
      (person) => person.companyId === selectedCompanyId
    );
    return atCompany.length > 0 ? atCompany : people;
  }, [people, selectedCompanyId]);

  useEffect(() => {
    if (!isOpen) return;

    const existingItems = deal?.pricingItems ?? [];

    form.reset({
      name: deal?.name ?? "",
      currency: deal?.currency ?? "USD",
      stageId: deal?.stageId ?? (stages[0]?.id ?? ""),
      companyId: deal?.companyId ?? NONE,
      primaryPersonId: deal?.primaryPersonId ?? NONE,
      ownerId: deal?.ownerId ?? NONE,
      closeDate: toDateInput(deal?.closeDate ?? null),
      pricingItems:
        existingItems.length > 0
          ? toPricingFormItems(existingItems)
          : [emptyPricingItem()],
    });
    setError(null);
  }, [isOpen, deal, stages, form]);

  /** Switching a row's type resets the fields that mean something different. */
  const handlePricingTypeChange = (
    index: number,
    type: PricingItemFormData["type"]
  ) => {
    const current = form.getValues(`pricingItems.${index}`);

    form.setValue(`pricingItems.${index}`, {
      ...current,
      type,
      quantity:
        type === "PROJECT"
          ? "1"
          : type === "RETAINER"
            ? String(DEFAULT_RETAINER_PERIODS)
            : "",
      interval: type === "RETAINER" ? DEFAULT_RETAINER_INTERVAL : undefined,
    });
    form.clearErrors(`pricingItems.${index}`);
  };

  const onSubmit = async (data: DealFormData) => {
    setIsLoading(true);
    setError(null);

    const companyId = data.companyId === NONE ? null : (data.companyId ?? null);
    const primaryPersonId =
      data.primaryPersonId === NONE ? null : (data.primaryPersonId ?? null);
    const ownerId = data.ownerId === NONE ? null : (data.ownerId ?? null);

    const pricingItems = data.pricingItems.map((item) => ({
      type: item.type,
      label: item.label || null,
      unitAmount: Number(item.unitAmount),
      quantity: item.type === "PROJECT" ? 1 : Number(item.quantity),
      interval: item.type === "RETAINER" ? (item.interval ?? null) : null,
    }));

    if (deal) {
      const result = await updateDeal(deal.id, {
        name: data.name,
        currency: data.currency,
        companyId,
        primaryPersonId,
        ownerId,
        closeDate: data.closeDate || null,
        pricingItems,
      });

      if (result.error) {
        setIsLoading(false);
        setError(result.error);
        return;
      }

      if (data.stageId !== deal.stageId) {
        const stageResult = await updateDealStage(deal.id, data.stageId);
        if (stageResult.error) {
          setIsLoading(false);
          setError(stageResult.error);
          return;
        }
      }
    } else {
      const result = await createDeal({
        name: data.name,
        currency: data.currency,
        stageId: data.stageId,
        companyId,
        primaryPersonId,
        ownerId,
        closeDate: data.closeDate || null,
        pricingItems,
      });

      if (result.error) {
        setIsLoading(false);
        setError(result.error);
        return;
      }
    }

    setIsLoading(false);
    onSuccess();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit deal" : "New deal"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme MVP build" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem className="sm:max-w-40">
                  <FormLabel>Currency</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-3">
              <div className="flex flex-row items-center justify-between gap-2">
                <div className="flex flex-col">
                  <p className="text-text-dark text-sm font-medium">Pricing</p>
                  <p className="text-xs text-text-secondary">
                    Mix project fees, hourly work and retainers as needed
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => pricingFields.append(emptyPricingItem())}
                >
                  <Plus className="mr-2 size-4" />
                  Add item
                </Button>
              </div>

              {pricingFields.fields.length === 0 && (
                <p className="rounded-md border border-border bg-background-secondary p-3 text-sm text-text-secondary">
                  No pricing set. This deal counts as {formatCurrency(0, watchedCurrency)}.
                </p>
              )}

              {pricingFields.fields.map((row, index) => {
                const type =
                  watchedPricingItems?.[index]?.type ?? row.type ?? "PROJECT";
                const line = pricingTotals.lines[index];

                return (
                  <div
                    key={row.id}
                    className="flex flex-col gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <FormField
                        control={form.control}
                        name={`pricingItems.${index}.type`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select
                              value={field.value}
                              onValueChange={(next) =>
                                handlePricingTypeChange(
                                  index,
                                  next as PricingItemFormData["type"]
                                )
                              }
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DEAL_PRICING_TYPE_OPTIONS.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {DEAL_PRICING_TYPE_LABELS[option]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`pricingItems.${index}.label`}
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={
                                  type === "RETAINER"
                                    ? "Ongoing support"
                                    : type === "HOURLY"
                                      ? "Senior engineer"
                                      : "MVP build"
                                }
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <FormField
                        control={form.control}
                        name={`pricingItems.${index}.unitAmount`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{PRICING_AMOUNT_LABELS[type]}</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="0"
                                step={type === "HOURLY" ? "5" : "100"}
                                placeholder={type === "HOURLY" ? "150" : "25000"}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {type !== "PROJECT" && (
                        <FormField
                          control={form.control}
                          name={`pricingItems.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                {PRICING_QUANTITY_LABELS[type]}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  step="1"
                                  placeholder={type === "HOURLY" ? "80" : "3"}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}

                      {type === "RETAINER" && (
                        <FormField
                          control={form.control}
                          name={`pricingItems.${index}.interval`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Interval</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value ?? DEFAULT_RETAINER_INTERVAL}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {DEAL_BILLING_INTERVAL_OPTIONS.map(
                                    (option) => (
                                      <SelectItem key={option} value={option}>
                                        {DEAL_BILLING_INTERVAL_LABELS[option]}
                                      </SelectItem>
                                    )
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <div className="flex flex-row items-center justify-between gap-2">
                      <p className="text-sm text-text-secondary">
                        Line total{" "}
                        <span className="text-text-dark font-medium">
                          {formatCurrency(
                            line ? pricingItemAmount(line) : 0,
                            watchedCurrency
                          )}
                        </span>
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => pricingFields.remove(index)}
                      >
                        <Trash2 className="mr-2 size-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-col gap-1 rounded-lg border border-border bg-background-secondary p-3">
                <div className="flex flex-row items-center justify-between gap-2">
                  <p className="text-sm text-text-secondary">Contract value</p>
                  <p className="text-text-dark text-lg font-semibold">
                    {formatCurrency(
                      pricingTotals.contractValue,
                      watchedCurrency
                    )}
                  </p>
                </div>
                {pricingTotals.monthlyRecurring > 0 && (
                  <div className="flex flex-row items-center justify-between gap-2">
                    <p className="text-xs text-text-secondary">
                      Recurring per month
                    </p>
                    <p className="text-xs font-medium text-text-secondary">
                      {formatCurrency(
                        Math.round(pricingTotals.monthlyRecurring),
                        watchedCurrency
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <FormField
              control={form.control}
              name="stageId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pick a stage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No company" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>No company</SelectItem>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="primaryPersonId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary contact</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No contact" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>No contact</SelectItem>
                      {personOptions.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          {person.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>Unassigned</SelectItem>
                        {owners.map((owner) => (
                          <SelectItem key={owner.id} value={owner.id}>
                            {ownerLabel(owner)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="closeDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected close</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {error && <p className="text-sm text-text-danger">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isEditing ? "Save changes" : "Create deal"}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
