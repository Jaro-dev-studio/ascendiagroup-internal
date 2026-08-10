"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitBusinessOSForm, validateEmail } from "./actions";
import { businessOSFormSchema, type BusinessOSFormData } from "./schema";

interface AnimatedOptionProps {
  children: React.ReactNode;
  isSelected?: boolean;
  onClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
}

function AnimatedOption({ children, isSelected, onClick, onKeyDown, className = "" }: AnimatedOptionProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative rounded-lg ${className}`}
    >
      <div className={`pointer-events-none absolute inset-0 rounded-lg border ${isSelected ? "border-transparent" : "border-[#E5E5E5]"}`} />
      {!isSelected && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-lg border-[1.5px] border-[#8B8B8B]"
          initial={{ clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: isHovered ? "inset(0 50% 0 0)" : "inset(0 100% 0 0)" }}
          transition={{ duration: 0.25, ease: "easeOut", delay: isHovered ? 0.1 : 0 }}
        />
      )}
      {!isSelected && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-lg border-[1.5px] border-[#8B8B8B]"
          initial={{ clipPath: "inset(0 0 0 100%)" }}
          animate={{ clipPath: isHovered ? "inset(0 0 0 50%)" : "inset(0 0 0 100%)" }}
          transition={{ duration: 0.25, ease: "easeOut", delay: isHovered ? 0.1 : 0 }}
        />
      )}
      <div className="relative">
        {children}
      </div>
    </motion.button>
  );
}

const FORM_STORAGE_KEY = "jaro-businessos-form-data";
const STORAGE_EXPIRY_DAYS = 7;

interface StoredFormData {
  data: Partial<BusinessOSFormData>;
  step: number;
  timestamp: number;
}

interface BusinessOSFormClientProps {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

const TOTAL_STEPS = 4;

const revenueOptions = [
  { value: "under-20k", label: "Under $20k/mo" },
  { value: "21-70k", label: "$21-70k/mo" },
  { value: "71-150k", label: "$71-150k/mo" },
  { value: "150-300k", label: "$150-300k/mo" },
  { value: "301-600k", label: "$301-600k/mo" },
  { value: "601k+", label: "$601k+/mo" },
] as const;

const serviceOptions = [
  { value: "custom-software-autopilot", label: "Custom Software That Runs My Business on Autopilot" },
  { value: "ai-automation", label: "AI & Automation" },
  { value: "high-volume-scraping", label: "High-volume Scraping" },
  { value: "web-to-native-mobile", label: "Web App to Native Mobile App Conversion" },
  { value: "other", label: "Other" },
] as const;

export function BusinessOSFormClient({
  utmSource,
  utmMedium,
  utmCampaign,
  utmTerm,
  utmContent,
}: BusinessOSFormClientProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const [emailValidationError, setEmailValidationError] = useState<string | null>(null);
  const [showLowBudgetMessage, setShowLowBudgetMessage] = useState(false);
  const [direction, setDirection] = useState(1);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<BusinessOSFormData>({
    resolver: zodResolver(businessOSFormSchema),
    mode: "onSubmit",
    defaultValues: {
      name: "",
      email: "",
      monthlyRevenue: undefined,
      servicesNeeded: [],
      otherServiceDescription: "",
    },
  });

  const watchedValues = watch();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(FORM_STORAGE_KEY);
      if (stored) {
        const parsed: StoredFormData = JSON.parse(stored);
        const expiryTime = STORAGE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp > expiryTime) {
          localStorage.removeItem(FORM_STORAGE_KEY);
          return;
        }
        if (parsed.data.name) setValue("name", parsed.data.name);
        if (parsed.data.email) setValue("email", parsed.data.email);
        if (parsed.data.monthlyRevenue) setValue("monthlyRevenue", parsed.data.monthlyRevenue);
        if (parsed.data.servicesNeeded) setValue("servicesNeeded", parsed.data.servicesNeeded);
        if (parsed.data.otherServiceDescription) setValue("otherServiceDescription", parsed.data.otherServiceDescription);
        if (parsed.step > 1 && parsed.step <= TOTAL_STEPS) {
          setCurrentStep(parsed.step);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [setValue]);

  useEffect(() => {
    try {
      const dataToStore: StoredFormData = {
        data: watchedValues,
        step: currentStep,
        timestamp: Date.now(),
      };
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(dataToStore));
    } catch {
      // Ignore localStorage errors
    }
  }, [watchedValues, currentStep]);

  const clearStoredFormData = () => {
    try {
      localStorage.removeItem(FORM_STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 1:
        return watchedValues.name?.length >= 2;
      case 2:
        return !!watchedValues.email && watchedValues.email.includes("@");
      case 3:
        return !!watchedValues.monthlyRevenue;
      case 4: {
        const hasServices = watchedValues.servicesNeeded?.length > 0;
        const needsOtherDescription = watchedValues.servicesNeeded?.includes("other");
        if (needsOtherDescription) {
          return hasServices && !!watchedValues.otherServiceDescription?.trim();
        }
        return hasServices;
      }
      default:
        return false;
    }
  };

  const goToNextStep = async () => {
    const isValid = await trigger(getFieldsForStep(currentStep));
    if (!isValid) return;

    if (currentStep === 2) {
      setIsValidatingEmail(true);
      setEmailValidationError(null);
      try {
        const result = await validateEmail(watchedValues.email);
        if (result.data && !result.data.isValid) {
          setIsValidatingEmail(false);
          const errorMessage = result.data.result === "disposable"
            ? "Please use a non-disposable email address"
            : "This email address appears to be invalid. Please check and try again.";
          setEmailValidationError(errorMessage);
          return;
        }
      } catch {
        console.error("[EmailValidation] Error during validation");
      }
      setIsValidatingEmail(false);
    }

    if (currentStep < TOTAL_STEPS) {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
    }
  };

  const goToPrevStep = () => {
    if (currentStep > 1) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
    }
  };

  const getFieldsForStep = (step: number): (keyof BusinessOSFormData)[] => {
    switch (step) {
      case 1:
        return ["name"];
      case 2:
        return ["email"];
      case 3:
        return ["monthlyRevenue"];
      case 4:
        return ["servicesNeeded", "otherServiceDescription"];
      default:
        return [];
    }
  };

  const toggleService = (value: string) => {
    const current = watchedValues.servicesNeeded || [];
    if (current.includes(value as (typeof current)[number])) {
      setValue(
        "servicesNeeded",
        current.filter((s) => s !== value) as typeof current
      );
    } else {
      setValue("servicesNeeded", [...current, value] as typeof current);
    }
  };

  const onSubmit = async (data: BusinessOSFormData) => {
    if (
      data.servicesNeeded.includes("other") &&
      !data.otherServiceDescription?.trim()
    ) {
      return;
    }

    setIsSubmitting(true);

    const result = await submitBusinessOSForm({
      formData: data,
      utmParams: {
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
      },
      metadata: {
        userAgent:
          typeof window !== "undefined" ? navigator.userAgent : undefined,
        referrer:
          typeof document !== "undefined" ? document.referrer : undefined,
      },
    });

    if (result.error) {
      setIsSubmitting(false);
      return;
    }

    clearStoredFormData();

    if (result.data?.showLowBudgetMessage) {
      setShowLowBudgetMessage(true);
      setIsSubmitting(false);
    } else if (result.data?.redirectUrl) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      window.top?.location.replace(result.data.redirectUrl);
    }
  };

  const slideVariants = {
    enter: (direction: number) => ({
      y: direction > 0 ? 40 : -40,
      opacity: 0,
    }),
    center: {
      y: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      y: direction > 0 ? -40 : 40,
      opacity: 0,
    }),
  };

  const getSkewedProgress = (step: number): number => {
    const progressMap: Record<number, number> = {
      1: 25,
      2: 50,
      3: 75,
      4: 100,
    };
    return progressMap[step] || 0;
  };

  if (showLowBudgetMessage) {
    const handleGoBack = () => {
      setShowLowBudgetMessage(false);
      setCurrentStep(3);
    };

    const handleContinueToFreelancer = () => {
      window.top?.location.replace("https://realgreatdevs.com");
    };

    return (
      <div className="flex h-full items-center justify-center bg-[#F7F7F7] p-6">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-md text-center"
        >
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mb-8 flex size-20 items-center justify-center rounded-2xl bg-[#2E2E2E]"
          >
            <svg
              className="size-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </motion.div>
          <motion.h2
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mb-4 text-3xl font-semibold text-[#2E2E2E]"
          >
            We can help you find a freelancer
          </motion.h2>
          <motion.p
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-[#2E2E2E]/60"
          >
            For companies under $20k/mo in revenue, we recommend working with a top freelancer.
            We can help you find the right one.
          </motion.p>
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleContinueToFreelancer}
              className="inline-flex items-center gap-2 rounded-lg bg-[#2E2E2E] px-5 py-3 text-sm font-medium text-white transition-all hover:bg-[#1a1a1a]"
            >
              Find a freelancer
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGoBack}
              className="inline-flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-5 py-3 text-sm font-medium text-[#2E2E2E] transition-all hover:border-[#2E2E2E]/30"
            >
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Edit my responses
            </motion.button>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col bg-[#F7F7F7]">
      <div className="absolute inset-x-0 top-0 z-10 h-1 bg-[#E5E5E5]">
        <motion.div
          className="h-full bg-[#2E2E2E]"
          initial={{ width: 0 }}
          animate={{ width: `${getSkewedProgress(currentStep)}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      <div className="absolute right-6 top-6 z-10">
        <span className="text-sm font-medium text-[#2E2E2E]/40">
          {getSkewedProgress(currentStep)}% completed
        </span>
      </div>

      <div className="absolute left-6 top-6 z-10">
        <Image src="/logo.png" alt="Logo" width={40} height={40} className="size-10" />
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex h-full flex-1 items-center justify-center px-6 py-20"
        onKeyDown={(e) => {
          if (e.key === "Enter" && currentStep === TOTAL_STEPS) {
            e.preventDefault();
            e.stopPropagation();
            if (canProceed()) {
              handleSubmit(onSubmit)();
            }
          }
        }}
      >
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={direction}>
            {/* Step 1: Name */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <p className="mb-2 text-sm font-medium text-[#2E2E2E]/40">1 →</p>
                <h2 className="mb-8 text-2xl font-semibold text-[#2E2E2E] sm:text-3xl">
                  What&apos;s your name?
                </h2>
                <input
                  {...register("name")}
                  type="text"
                  placeholder="Type your full name..."
                  autoFocus
                  autoComplete="name"
                  className="w-full rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 text-lg text-[#2E2E2E] placeholder-[#2E2E2E]/30 outline-none ring-0 transition-colors focus:border-[#2E2E2E] focus:outline-none focus:ring-0 sm:text-xl"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canProceed()) {
                      e.preventDefault();
                      goToNextStep();
                    }
                  }}
                />
                {errors.name && (
                  <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-sm text-danger-500">
                    {errors.name.message}
                  </motion.p>
                )}
              </motion.div>
            )}

            {/* Step 2: Email */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <p className="mb-2 text-sm font-medium text-[#2E2E2E]/40">2 →</p>
                <h2 className="mb-8 text-2xl font-semibold text-[#2E2E2E] sm:text-3xl">
                  What&apos;s your business email?
                </h2>
                <input
                  {...register("email", {
                    onChange: () => {
                      if (emailValidationError) {
                        setEmailValidationError(null);
                      }
                    },
                  })}
                  type="email"
                  placeholder="name@company.com"
                  autoFocus
                  autoComplete="email"
                  disabled={isValidatingEmail}
                  className="w-full rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 text-lg text-[#2E2E2E] placeholder-[#2E2E2E]/30 outline-none ring-0 transition-colors focus:border-[#2E2E2E] focus:outline-none focus:ring-0 disabled:opacity-50 sm:text-xl"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canProceed() && !isValidatingEmail) {
                      e.preventDefault();
                      goToNextStep();
                    }
                  }}
                />
                {errors.email && (
                  <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-sm text-danger-500">
                    {errors.email.message}
                  </motion.p>
                )}
                {emailValidationError && (
                  <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-sm text-danger-500">
                    {emailValidationError}
                  </motion.p>
                )}
              </motion.div>
            )}

            {/* Step 3: Monthly Revenue */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <p className="mb-2 text-sm font-medium text-[#2E2E2E]/40">3 →</p>
                <h2 className="mb-8 text-2xl font-semibold text-[#2E2E2E] sm:text-3xl">
                  What is your current monthly revenue?
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {revenueOptions.map((option, index) => (
                    <AnimatedOption
                      key={option.value}
                      isSelected={watchedValues.monthlyRevenue === option.value}
                      onClick={() => {
                        setValue("monthlyRevenue", option.value);
                        setTimeout(goToNextStep, 150);
                      }}
                      className={watchedValues.monthlyRevenue === option.value
                        ? "bg-[#2E2E2E] text-white"
                        : "bg-white text-[#2E2E2E]"
                      }
                    >
                      <div className="flex items-center gap-2 px-4 py-3 text-left">
                        <span
                          className={`flex size-5 shrink-0 items-center justify-center rounded text-[10px] font-medium ${
                            watchedValues.monthlyRevenue === option.value
                              ? "bg-white text-[#2E2E2E]"
                              : "bg-[#F7F7F7] text-[#2E2E2E]/50"
                          }`}
                        >
                          {String.fromCharCode(65 + index)}
                        </span>
                        <span className="text-sm font-medium">{option.label}</span>
                      </div>
                    </AnimatedOption>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 4: Services */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeOut" }}
              >
                <p className="mb-2 text-sm font-medium text-[#2E2E2E]/40">4 →</p>
                <h2 className="mb-2 text-2xl font-semibold text-[#2E2E2E] sm:text-3xl">
                  What services are you interested in learning about?
                </h2>
                <p className="mb-8 text-[#2E2E2E]/50">Select all that apply</p>
                <div className="flex flex-col gap-3">
                  {serviceOptions.map((option) => {
                    const isSelected = watchedValues.servicesNeeded?.includes(
                      option.value as (typeof watchedValues.servicesNeeded)[number]
                    );
                    return (
                      <AnimatedOption
                        key={option.value}
                        isSelected={isSelected}
                        onClick={() => toggleService(option.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (canProceed()) {
                              handleSubmit(onSubmit)();
                            }
                          }
                        }}
                        className={isSelected ? "bg-[#2E2E2E]/5" : "bg-white"}
                      >
                        <div className="flex items-center gap-4 px-5 py-4 text-left">
                          <div
                            className={`flex size-5 shrink-0 items-center justify-center rounded border-2 transition-all ${
                              isSelected
                                ? "border-[#2E2E2E] bg-[#2E2E2E]"
                                : "border-[#D4D4D4] bg-white"
                            }`}
                          >
                            {isSelected && (
                              <motion.svg
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="size-3 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </motion.svg>
                            )}
                          </div>
                          <span className="font-medium text-[#2E2E2E]">{option.label}</span>
                        </div>
                      </AnimatedOption>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {watchedValues.servicesNeeded?.includes("other") && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4">
                        <textarea
                          {...register("otherServiceDescription")}
                          placeholder="Please describe what you need..."
                          rows={3}
                          autoFocus
                          className="w-full resize-none rounded-lg border border-[#E5E5E5] bg-white px-4 py-3 text-[#2E2E2E] placeholder-[#2E2E2E]/30 outline-none ring-0 transition-colors focus:border-[#2E2E2E] focus:outline-none focus:ring-0"
                        />
                        {watchedValues.servicesNeeded?.includes("other") &&
                          !watchedValues.otherServiceDescription?.trim() && (
                          <p className="mt-2 text-sm text-danger-500">
                            Please describe what you need
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {errors.servicesNeeded && (
                  <p className="mt-3 text-sm text-danger-500">
                    {errors.servicesNeeded.message}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex items-center gap-3"
          >
            {currentStep > 1 && (
              <motion.button
                type="button"
                tabIndex={-1}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={goToPrevStep}
                className="flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-4 py-2.5 text-sm font-medium text-[#2E2E2E] transition-all hover:border-[#2E2E2E]/30"
              >
                <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
            )}

            {currentStep === TOTAL_STEPS ? (
              <motion.button
                type="submit"
                whileHover={{ scale: canProceed() && !isSubmitting ? 1.02 : 1 }}
                whileTap={{ scale: canProceed() && !isSubmitting ? 0.98 : 1 }}
                disabled={!canProceed() || isSubmitting}
                className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
                  canProceed() && !isSubmitting
                    ? "bg-[#2E2E2E] text-white hover:bg-[#1a1a1a]"
                    : "cursor-not-allowed bg-[#E5E5E5] text-[#2E2E2E]/40"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="size-4 rounded-full border-2 border-white/20 border-t-white"
                    />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit
                    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </motion.button>
            ) : (
              <motion.button
                type="button"
                whileHover={{ scale: canProceed() && !isValidatingEmail ? 1.02 : 1 }}
                whileTap={{ scale: canProceed() && !isValidatingEmail ? 0.98 : 1 }}
                onClick={goToNextStep}
                disabled={!canProceed() || isValidatingEmail}
                className={`flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium transition-all ${
                  canProceed() && !isValidatingEmail
                    ? "bg-[#2E2E2E] text-white hover:bg-[#1a1a1a]"
                    : "cursor-not-allowed bg-[#E5E5E5] text-[#2E2E2E]/40"
                }`}
              >
                {isValidatingEmail ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="size-4 rounded-full border-2 border-white/20 border-t-white"
                    />
                    Verifying...
                  </>
                ) : (
                  <>
                    OK
                    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </>
                )}
              </motion.button>
            )}

            <span className="text-xs text-[#2E2E2E]/40">
              press <strong>Enter ↵</strong>
            </span>
          </motion.div>
        </div>
      </form>
    </div>
  );
}
