"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { INVOICE_SENDER } from "@/config/invoice";
import { formatOrdinalDate } from "@/lib/utils";

const invoiceCompanySchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  addressLine1: z.string().min(1, "Address line 1 is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State / region is required"),
  postcode: z.string().min(1, "Postcode is required"),
  country: z.string().min(1, "Country is required"),
});

export type InvoiceCompanyFormValues = z.infer<typeof invoiceCompanySchema>;

export interface InvoiceLine {
  label: string;
  amount: number;
}

interface DownloadInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoiceLine: InvoiceLine;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatAmountWithDecimals(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function buildInvoiceHtml(
  billTo: InvoiceCompanyFormValues,
  invoiceLine: InvoiceLine,
  dateStr: string
): string {
  const sender = INVOICE_SENDER;
  const billToLines = [
    billTo.companyName,
    billTo.addressLine1,
    ...(billTo.addressLine2 ? [billTo.addressLine2] : []),
    [billTo.city, billTo.state, billTo.postcode].filter(Boolean).join(", "),
    billTo.country,
  ].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #0f172a; background: #fff; }
    .header { background: #0d9488; color: #fff; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
    .header h1 { font-size: 28px; font-weight: 700; }
    .sender { text-align: right; font-size: 12px; line-height: 1.5; }
    .body { padding: 32px; }
    .bill-to-date { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
    .bill-to { flex: 1; }
    .bill-to h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; }
    .bill-to address { font-style: normal; line-height: 1.5; }
    .date-block { text-align: right; }
    .date-block h3 { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 8px; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin-bottom: 24px; }
    .items-table { width: 100%; }
    .items-table th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; padding-bottom: 8px; }
    .items-table th.amount { text-align: right; }
    .items-table td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
    .items-table td.amount { text-align: right; font-weight: 500; }
    .total-row { display: flex; margin-top: 24px; }
    .total-row .spacer { flex: 1; background: #e0f2fe; min-height: 80px; }
    .total-row .total-block { background: #0d9488; color: #fff; padding: 16px 24px; min-width: 200px; text-align: center; }
    .total-row .total-block .label { font-size: 12px; font-weight: 600; }
    .total-row .total-block .value { font-size: 24px; font-weight: 700; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Invoice</h1>
    <div class="sender">
      <div>${sender.name}</div>
      <div>${sender.address}</div>
      <div>${sender.city}</div>
      <div>${sender.state}</div>
      <div>${sender.postcode}</div>
      <div>${sender.country}</div>
    </div>
  </div>
  <div class="body">
    <div class="bill-to-date">
      <div class="bill-to">
        <h3>Bill to:</h3>
        <address>${billToLines.map((line) => line).join("<br />")}</address>
      </div>
      <div class="date-block">
        <h3>Date</h3>
        <div>${dateStr}</div>
      </div>
    </div>
    <hr />
    <table class="items-table">
      <thead>
        <tr>
          <th>Items</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${invoiceLine.label}</td>
          <td class="amount">${formatAmount(invoiceLine.amount)}</td>
        </tr>
      </tbody>
    </table>
    <div class="total-row">
      <div class="spacer"></div>
      <div class="total-block">
        <div class="label">Total</div>
        <div class="value">${formatAmountWithDecimals(invoiceLine.amount)}</div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;
}

export function DownloadInvoiceModal({
  open,
  onClose,
  invoiceLine,
}: DownloadInvoiceModalProps) {
  const form = useForm<InvoiceCompanyFormValues>({
    resolver: zodResolver(invoiceCompanySchema),
    defaultValues: {
      companyName: "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postcode: "",
      country: "",
    },
  });

  const onSubmit = (values: InvoiceCompanyFormValues) => {
    const dateStr = formatOrdinalDate(new Date());
    const html = buildInvoiceHtml(values, invoiceLine, dateStr);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    onClose();
    form.reset();
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invoice details</DialogTitle>
          <DialogDescription>
            Enter the company details for the invoice (Bill To). The invoice will open in a new window for printing or saving as PDF.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company name</FormLabel>
                  <FormControl>
                    <Input placeholder="Company name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address line 1</FormLabel>
                  <FormControl>
                    <Input placeholder="Street address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressLine2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address line 2 (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Suite, unit, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-row gap-2">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>State / region</FormLabel>
                    <FormControl>
                      <Input placeholder="State" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex flex-row gap-2">
              <FormField
                control={form.control}
                name="postcode"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Postcode</FormLabel>
                    <FormControl>
                      <Input placeholder="Postcode" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Country</FormLabel>
                    <FormControl>
                      <Input placeholder="Country" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="flex flex-row gap-2 sm:justify-end">
              <Button type="submit">Download invoice</Button>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
