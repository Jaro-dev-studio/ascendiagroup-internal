"use client";

import { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Calendar,
  Zap,
  ArrowRight,
  Shield,
  Rocket,
  Mail,
  Loader2,
  CreditCard,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createQuoteCheckoutSession } from "@/lib/actions";

interface LinePart {
  name: string;
  price: number;
  objective: string;
}

interface LineItem {
  code: string;
  module: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  benefit?: string;
  parts?: LinePart[];
}

interface PainPointSection {
  section: string;
  items: string[];
}

interface SharedQuoteData {
  id: string;
  token: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  lineItems: LineItem[];
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  deposit: number;
  balance: number;
  onCallDiscountPercent: number;
  onCallTotal: number;
  onCallDeposit: number;
  onCallBalance: number;
  painPoints: PainPointSection[] | null;
  expiresAt: Date;
  viewCount: number;
  createdAt: Date;
  depositPaidAt: Date | null;
  depositPaidAmount: number | null;
  salesCallMap: {
    id: string;
    name: string;
    clientCompany: {
      id: string;
      name: string;
      website: string | null;
    } | null;
  };
}

interface QuoteClientProps {
  quote: SharedQuoteData;
}

export function QuoteClient({ quote }: QuoteClientProps) {
  const searchParams = useSearchParams();
  const paymentStatus = searchParams?.get("payment");
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [email, setEmail] = useState(quote.contactEmail || "");

  const lineItems = quote.lineItems as LineItem[];
  const painPoints = quote.painPoints as PainPointSection[] | null;
  const isAlreadyPaid = !!quote.depositPaidAt;

  const handleAcceptQuote = async () => {
    if (!email || !email.includes("@")) {
      setPaymentError("Please enter a valid email address");
      return;
    }

    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const baseUrl = window.location.origin;
      const result = await createQuoteCheckoutSession(quote.token, baseUrl, email);

      if (result.error) {
        setPaymentError(result.error);
        return;
      }

      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      setPaymentError("An unexpected error occurred. Please try again.");
    } finally {
      setIsProcessingPayment(false);
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

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const daysUntilExpiry = useMemo(() => {
    const now = new Date();
    const expiry = new Date(quote.expiresAt);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [quote.expiresAt]);

  // Calculate discount expiry time (24 hours after creation)
  const discountExpiresAt = useMemo(() => {
    const created = new Date(quote.createdAt);
    return new Date(created.getTime() + 24 * 60 * 60 * 1000);
  }, [quote.createdAt]);

  // Countdown timer state
  const [timeRemaining, setTimeRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, expired: false });

  // Update countdown every second
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const diff = discountExpiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining({ hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeRemaining({ hours, minutes, seconds, expired: false });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [discountExpiresAt]);

  const isSameDayDiscountEligible = !timeRemaining.expired;

  const savings = quote.total - quote.onCallTotal;

  // Group line items by category (based on code prefix)
  const groupedLineItems = useMemo(() => {
    const categories: Record<string, { name: string; items: LineItem[] }> = {
      BASE: { name: "Platform Foundation", items: [] },
      USER: { name: "Platform Foundation", items: [] },
      M: { name: "Marketing & Lead Generation", items: [] },
      S: { name: "Sales Operations", items: [] },
      D: { name: "Delivery & Fulfillment", items: [] },
      C: { name: "Customer Success", items: [] },
      F: { name: "Finance & Admin", items: [] },
      I: { name: "Integrations & Platform", items: [] },
    };

    lineItems.forEach((item) => {
      if (item.code === "BASE" || item.code === "USER") {
        categories[item.code].items.push(item);
      } else {
        const prefix = item.code.charAt(0);
        if (categories[prefix]) {
          categories[prefix].items.push(item);
        }
      }
    });

    // Merge BASE and USER into one category
    const baseItems = [...categories.BASE.items, ...categories.USER.items];
    
    const result: Array<{ category: string; items: LineItem[] }> = [];
    
    if (baseItems.length > 0) {
      result.push({ category: "Platform Foundation", items: baseItems });
    }
    
    Object.entries(categories).forEach(([key, value]) => {
      if (key !== "BASE" && key !== "USER" && value.items.length > 0) {
        result.push({ category: value.name, items: value.items });
      }
    });

    return result;
  }, [lineItems]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary-50 to-white">
      {/* Header */}
      <header className="border-b border-secondary-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Image
            src="/logo.png"
            alt="Jaro.dev"
            width={120}
            height={40}
            className="h-8 w-auto"
          />
          <div className="flex items-center gap-2 text-sm text-secondary-500">
            <Calendar className="size-4" />
            Quote valid until {formatDate(quote.expiresAt)}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b border-secondary-100 bg-white py-12">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center">
            <Badge variant="outline" className="mb-4">
              Custom Software Solution
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-secondary-900">
              Your Business Operating System
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-secondary-600">
              A custom-built software solution designed specifically for{" "}
              <span className="font-semibold text-primary-600">
                {quote.companyName}
              </span>{" "}
              to streamline operations and accelerate growth.
            </p>
          </div>

          {/* Urgency Banner */}
          {daysUntilExpiry <= 7 && daysUntilExpiry > 0 && (
            <div className="mx-auto mt-8 max-w-xl rounded-xl border border-warning-200 bg-warning-50 p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-warning-700">
                <Clock className="size-5" />
                <span className="font-semibold">
                  This quote expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="space-y-8">
          {/* Problems We're Solving */}
          {painPoints && painPoints.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-secondary-100 bg-secondary-50 px-6 py-4">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-secondary-900">
                  <Zap className="size-5 text-primary-600" />
                  What We're Solving for {quote.companyName}
                </h2>
              </div>
              <div className="divide-y divide-secondary-100">
                {painPoints.map((section, idx) => (
                  <div key={idx} className="p-6">
                    <h3 className="mb-3 font-semibold text-secondary-800">
                      {section.section}
                    </h3>
                    <ul className="space-y-2">
                      {section.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-500" />
                          <span className="text-secondary-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Solution Modules */}
          <Card className="overflow-hidden">
            <div className="border-b border-secondary-100 bg-secondary-50 px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-secondary-900">
                <Rocket className="size-5 text-primary-600" />
                Your Custom Solution Includes
              </h2>
            </div>
            <div className="divide-y divide-secondary-100">
              {groupedLineItems.map((group, idx) => (
                <div key={idx} className="p-6">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-secondary-500">
                    {group.category}
                  </h3>
                  <div className="space-y-4">
                    {group.items.map((item) => (
                      <div key={item.code}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {item.code}
                              </Badge>
                              <span className="font-medium text-secondary-900">
                                {item.module}
                              </span>
                            </div>
                            {item.benefit && (
                              <p className="mt-1 text-sm text-secondary-600">
                                {item.benefit}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="font-semibold text-secondary-900">
                              {formatCurrency(item.lineTotal)}
                            </span>
                          </div>
                        </div>

                        {/* Parts breakdown - clear objectives for each piece */}
                        {item.parts && item.parts.length > 0 && (
                          <ul className="mt-3 space-y-2 border-l-2 border-secondary-100 pl-4">
                            {item.parts.map((part, i) => (
                              <li
                                key={i}
                                className="flex items-start justify-between gap-4"
                              >
                                <div className="flex items-start gap-2">
                                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-500" />
                                  <div>
                                    <p className="text-sm font-medium text-secondary-800">
                                      {part.name}
                                    </p>
                                    <p className="text-sm text-secondary-500">
                                      {part.objective}
                                    </p>
                                  </div>
                                </div>
                                <span className="shrink-0 text-sm text-secondary-500">
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
              ))}
            </div>
          </Card>

          {/* What's Included */}
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-secondary-900">
              <Shield className="size-5 text-primary-600" />
              What's Included
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                "Custom-built software you own",
                "All integrations",
                "Documentation & user guides",
                "Ongoing maintenance options",
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-success-500" />
                  <span className="text-secondary-700">{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </main>

      {/* Pricing Section - Full Width */}
      <section className="border-t border-secondary-200 bg-secondary-50 py-12">
        <div className="mx-auto max-w-xl px-6">
          <Card className="overflow-hidden border-2 border-primary-500">
            <div className="bg-primary-600 px-6 py-4 text-white">
              <h3 className="font-semibold">Your Investment</h3>
              <p className="mt-1 text-sm text-primary-100">
                Custom software solution for {quote.companyName}
              </p>
            </div>
            <div className="p-6">
              {/* Same-Day Discount Countdown - Only shown within 24 hours */}
              {isSameDayDiscountEligible && (
                <div className="rounded-lg border-2 border-success-500 bg-success-50 p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-success-700">
                    <Zap className="size-5" />
                    <span className="font-semibold">
                      {quote.onCallDiscountPercent}% Same-Day-Purchase Discount Applied
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <span className="text-lg text-secondary-400 line-through">
                      {formatCurrency(quote.total)}
                    </span>
                    <ArrowRight className="size-4 text-success-600" />
                    <span className="text-2xl font-bold text-success-700">
                      {formatCurrency(quote.onCallTotal)}
                    </span>
                  </div>
                  <Badge className="mt-2 bg-success-600 text-white">
                    You save {formatCurrency(savings)}
                  </Badge>
                  
                  <div className="mt-4 border-t border-success-200 pt-4">
                    <div className="flex items-center justify-center gap-2 text-sm text-success-700">
                      <Clock className="size-4" />
                      <span className="font-medium">Discount expires in</span>
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <div className="rounded bg-success-600 px-2 py-1 text-white">
                        <span className="text-lg font-bold">{String(timeRemaining.hours).padStart(2, "0")}</span>
                        <span className="text-xs">h</span>
                      </div>
                      <span className="text-lg font-bold text-success-600">:</span>
                      <div className="rounded bg-success-600 px-2 py-1 text-white">
                        <span className="text-lg font-bold">{String(timeRemaining.minutes).padStart(2, "0")}</span>
                        <span className="text-xs">m</span>
                      </div>
                      <span className="text-lg font-bold text-success-600">:</span>
                      <div className="rounded bg-success-600 px-2 py-1 text-white">
                        <span className="text-lg font-bold">{String(timeRemaining.seconds).padStart(2, "0")}</span>
                        <span className="text-xs">s</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Success/Cancelled Messages */}
              {paymentStatus === "success" && (
                <div className="rounded-lg border-2 border-success-500 bg-success-50 p-4 text-center">
                  <CheckCircle2 className="mx-auto size-8 text-success-600" />
                  <p className="mt-2 font-semibold text-success-700">Payment Successful</p>
                  <p className="mt-1 text-sm text-success-600">
                    Thank you! Your deposit has been received and we will begin work immediately.
                  </p>
                </div>
              )}

              {paymentStatus === "cancelled" && (
                <div className="rounded-lg border border-warning-300 bg-warning-50 p-4 text-center">
                  <p className="font-medium text-warning-700">Payment Cancelled</p>
                  <p className="mt-1 text-sm text-warning-600">
                    No worries! You can try again when you are ready.
                  </p>
                </div>
              )}

              {/* Already Paid */}
              {isAlreadyPaid && !paymentStatus && (
                <div className="rounded-lg border-2 border-success-500 bg-success-50 p-4 text-center">
                  <CheckCircle2 className="mx-auto size-8 text-success-600" />
                  <p className="mt-2 font-semibold text-success-700">Deposit Paid</p>
                  <p className="mt-1 text-sm text-success-600">
                    Thank you! Your deposit of {formatCurrency(quote.depositPaidAmount || (isSameDayDiscountEligible ? quote.onCallDeposit : quote.deposit))} has been received.
                  </p>
                </div>
              )}

              {/* Due Today - Only show if not paid */}
              {!isAlreadyPaid && (
                <div className={`${isSameDayDiscountEligible ? "mt-6" : ""} rounded-lg bg-success-50 p-6 text-center`}>
                  <p className="text-sm font-medium text-success-700">Due Today to Begin</p>
                  <p className="mt-2 text-4xl font-bold text-success-600">
                    {formatCurrency(isSameDayDiscountEligible ? quote.onCallDeposit : quote.deposit)}
                  </p>
                  <p className="mt-1 text-sm text-success-600">
                    20% of {formatCurrency(isSameDayDiscountEligible ? quote.onCallTotal : quote.total)}
                  </p>
                </div>
              )}

              {/* Balance on Delivery */}
              <div className="mt-4 rounded-lg bg-secondary-100 p-4 text-center">
                <p className="text-sm font-medium text-secondary-700">80% Due on Delivery</p>
                <p className="mt-1 text-2xl font-bold text-secondary-900">
                  {formatCurrency(isSameDayDiscountEligible ? quote.onCallBalance : quote.balance)}
                </p>
                <p className="mt-2 text-xs text-secondary-500">
                  Payment due for each item within 14 days of that item being delivered
                </p>
              </div>

              {/* Email Input - Only show if not paid */}
              {!isAlreadyPaid && (
                <div className="mt-6 space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-secondary-700">
                    Email for payment confirmation
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full"
                  />
                  <p className="text-xs text-secondary-500">
                    Bank transfer instructions will be sent to this email
                  </p>
                </div>
              )}

              {/* Payment Error */}
              {paymentError && (
                <div className="mt-4 rounded-lg border border-danger-300 bg-danger-50 p-3 text-center">
                  <p className="text-sm text-danger-700">{paymentError}</p>
                </div>
              )}

              {/* Accept Button - Only show if not paid */}
              {!isAlreadyPaid && (
                <Button 
                  className="mt-4 w-full" 
                  size="lg" 
                  onClick={handleAcceptQuote}
                  disabled={isProcessingPayment || !email}
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 size-4" />
                      Pay via Bank Transfer
                      <ArrowRight className="ml-2 size-4" />
                    </>
                  )}
                </Button>
              )}

              {/* Guarantees */}
              <ul className="mt-4 space-y-2">
                <li className="flex items-start gap-2 text-sm text-secondary-600">
                  <Rocket className="mt-0.5 size-4 shrink-0 text-primary-600" />
                  <span>As soon as the deposit payment is made, we begin work immediately</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-secondary-600">
                  <Shield className="mt-0.5 size-4 shrink-0 text-success-600" />
                  <span>7 day money back guarantee - if unsatisfied in first 7 days we return the full deposit, no questions asked</span>
                </li>
              </ul>

              {/* Questions */}
              <div className="mt-6 border-t border-secondary-200 pt-6 text-center">
                <p className="text-sm text-secondary-600">Questions about this quote?</p>
                <a
                  href={`mailto:me@jaro.dev?subject=Question about quote for ${quote.companyName}`}
                  className="mt-2 inline-flex items-center gap-1 font-medium text-primary-600 hover:text-primary-700"
                >
                  <Mail className="size-4" />
                  me@jaro.dev
                </a>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-secondary-200 bg-white py-8">
        <div className="mx-auto max-w-5xl px-6 text-center text-sm text-secondary-500">
          <p>
            This quote was prepared exclusively for {quote.companyName}.
          </p>
          <p className="mt-1">
            Valid until {formatDate(quote.expiresAt)}
          </p>
        </div>
      </footer>
    </div>
  );
}
