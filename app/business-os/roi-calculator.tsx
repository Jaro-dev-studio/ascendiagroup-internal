"use client";

import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import * as SliderPrimitive from "@radix-ui/react-slider";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Custom beautiful slider with glow effects
interface ROISliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  variant?: "default" | "primary";
  lightMode?: boolean;
}

function ROISlider({ value, onValueChange, min, max, step, disabled, variant = "default", lightMode = false }: ROISliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "group relative flex w-full touch-none select-none items-center py-2",
        disabled && "pointer-events-none opacity-50"
      )}
      value={value}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
    >
      <SliderPrimitive.Track className={cn(
        "relative h-2 w-full grow overflow-hidden rounded-full transition-colors",
        lightMode 
          ? "bg-neutral-200 group-hover:bg-neutral-300"
          : "bg-neutral-800 group-hover:bg-neutral-700"
      )}>
        <SliderPrimitive.Range 
          className={cn(
            "absolute h-full transition-all duration-200",
            variant === "primary" 
              ? "bg-primary-500 group-hover:bg-primary-400" 
              : "bg-primary-500 group-hover:bg-primary-400"
          )} 
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb 
        className={cn(
          "group/thumb relative block size-6 cursor-grab rounded-full border-2 transition-all duration-200",
          lightMode
            ? "bg-white border-primary-500 shadow-md"
            : "bg-neutral-900 border-primary-500",
          "hover:scale-110 hover:border-primary-400 hover:shadow-[0_0_20px_rgba(14,165,233,0.6)]",
          lightMode
            ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            : "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900",
          "active:cursor-grabbing active:scale-105 active:shadow-[0_0_25px_rgba(14,165,233,0.8)]",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        {/* Drag handle lines */}
        <div className="absolute inset-0 flex items-center justify-center gap-0.5 opacity-0 transition-opacity group-hover/thumb:opacity-100">
          <div className="h-2.5 w-0.5 rounded-full bg-primary-400" />
          <div className="h-2.5 w-0.5 rounded-full bg-primary-400" />
        </div>
        {/* Glow effect */}
        <div className="absolute -inset-1 rounded-full bg-primary-500/0 blur-md transition-all duration-200 group-hover/thumb:bg-primary-500/30 group-active/thumb:bg-primary-500/50" />
      </SliderPrimitive.Thumb>
    </SliderPrimitive.Root>
  );
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  type: "time" | "cost"; // time = employee hours, cost = direct monthly spend
  defaultEmployeeHours?: number; // Total employee-hours per week (for time type)
  defaultMonthlyCost?: number; // Monthly spend in dollars (for cost type)
  defaultAutomation: number;
}

interface WorkflowState {
  employeeHours: number; // Total employee-hours per week (for time type)
  monthlyCost: number; // Monthly spend in dollars (for cost type)
  automation: number;
}

const WEEKS_PER_MONTH = 4.3;
const WORKING_HOURS_PER_YEAR = 2080; // 40 hours/week × 52 weeks
const AUTOMATION_PERCENTAGE = 75; // Fixed automation rate assumption

const workflowIcons = {
  leadRouting: (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  reporting: (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  onboarding: (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  ),
  followUp: (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  handoffs: (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
  approvals: (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  customerSupport: (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  saasRedundancy: (
    <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
};

const defaultWorkflows: Workflow[] = [
  {
    id: "leadRouting",
    name: "Lead Routing & Assignment",
    description: "Manually assigning leads to sales reps based on territory, availability, or expertise",
    icon: workflowIcons.leadRouting,
    type: "time",
    defaultEmployeeHours: 15, // 5 hours × 3 employees
    defaultAutomation: 80,
  },
  {
    id: "reporting",
    name: "Weekly Reporting",
    description: "Compiling data from multiple sources into reports and dashboards",
    icon: workflowIcons.reporting,
    type: "time",
    defaultEmployeeHours: 40, // 10 hours × 4 employees
    defaultAutomation: 95,
  },
  {
    id: "onboarding",
    name: "Client Onboarding",
    description: "Setting up new clients with accounts, access, and initial configurations",
    icon: workflowIcons.onboarding,
    type: "time",
    defaultEmployeeHours: 40,
    defaultAutomation: 75,
  },
  {
    id: "followUp",
    name: "Missed Lead Follow-Up",
    description: "Tracking and following up with leads that fell through the cracks",
    icon: workflowIcons.followUp,
    type: "time",
    defaultEmployeeHours: 40,
    defaultAutomation: 85,
  },
  {
    id: "handoffs",
    name: "Internal Handoffs",
    description: "Transferring information between Sales → Ops → Customer Success",
    icon: workflowIcons.handoffs,
    type: "time",
    defaultEmployeeHours: 42, // 7 hours × 6 employees
    defaultAutomation: 80,
  },
  {
    id: "approvals",
    name: "Approval Flows",
    description: "Routing requests through Finance, HR, Legal for approval",
    icon: workflowIcons.approvals,
    type: "time",
    defaultEmployeeHours: 20, // 5 hours × 4 employees
    defaultAutomation: 90,
  },
  {
    id: "customerSupport",
    name: "Customer Support",
    description: "Answering common questions, routing tickets, and resolving issues",
    icon: workflowIcons.customerSupport,
    type: "time",
    defaultEmployeeHours: 80,
    defaultAutomation: 90,
  },
  {
    id: "saasRedundancy",
    name: "SaaS Tool Redundancy",
    description: "Monthly spend on redundant SaaS tools that BusinessOS can replace",
    icon: workflowIcons.saasRedundancy,
    type: "cost",
    defaultMonthlyCost: 5000, // $5,000/month default
    defaultAutomation: 80,
  },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

interface WorkflowCardProps {
  workflow: Workflow;
  state: WorkflowState;
  hourlyCost: number;
  onUpdate: (updates: Partial<WorkflowState>) => void;
  lightMode?: boolean;
}

function WorkflowCard({ workflow, state, hourlyCost, onUpdate, lightMode = false }: WorkflowCardProps) {
  const isCostType = workflow.type === "cost";
  
  // Calculate costs differently based on type (using fixed 75% automation rate)
  const monthlyManualCost = isCostType 
    ? state.monthlyCost 
    : state.employeeHours * hourlyCost * WEEKS_PER_MONTH;
  const monthlySavings = monthlyManualCost * (AUTOMATION_PERCENTAGE / 100);
  
  // Check if this workflow has any value (not zeroed out)
  const hasValue = isCostType ? state.monthlyCost > 0 : state.employeeHours > 0;

  return (
    <div
      className={cn(
        "workflow-card group relative overflow-hidden rounded-2xl border transition-all duration-300",
        lightMode
          ? hasValue
            ? "border-primary-200 bg-white shadow-md"
            : "border-neutral-200 bg-neutral-50"
          : hasValue
            ? "border-primary-500/30 bg-neutral-900/80 shadow-[0_0_30px_rgba(14,165,233,0.05)]"
            : "border-neutral-800 bg-neutral-900/50"
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-start gap-3 border-b p-4",
        lightMode ? "border-neutral-200" : "border-neutral-800"
      )}>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300",
            lightMode
              ? hasValue
                ? "bg-primary-100 text-primary-600"
                : "bg-neutral-200 text-neutral-500"
              : hasValue
                ? "bg-primary-500/20 text-primary-400 shadow-[0_0_15px_rgba(14,165,233,0.2)]"
                : "bg-neutral-800 text-neutral-500"
          )}
        >
          {workflow.icon}
        </div>
        <div>
          <h3 className={cn(
            "font-semibold transition-colors",
            lightMode
              ? hasValue ? "text-neutral-900" : "text-neutral-500"
              : hasValue ? "text-white" : "text-neutral-400"
          )}>{workflow.name}</h3>
          <p className={cn(
            "text-xs",
            lightMode ? "text-neutral-500" : "text-neutral-500"
          )}>{workflow.description}</p>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-4 p-4">
        {/* Show different slider based on workflow type */}
        {isCostType ? (
          // Monthly SaaS spend slider
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className={cn(
                "text-sm",
                lightMode ? "text-neutral-600" : "text-neutral-400"
              )}>Monthly SaaS spend</label>
              <span className={cn(
                "rounded-md px-2 py-0.5 text-sm font-medium transition-colors",
                lightMode
                  ? state.monthlyCost > 0 
                    ? "bg-warning-100 text-warning-700" 
                    : "bg-neutral-200 text-neutral-500"
                  : state.monthlyCost > 0 
                    ? "bg-warning-500/20 text-warning-400" 
                    : "bg-neutral-800 text-neutral-500"
              )}>
                {formatCurrency(state.monthlyCost)}/mo
              </span>
            </div>
            <ROISlider
              value={[state.monthlyCost]}
              onValueChange={([value]) => onUpdate({ monthlyCost: value })}
              min={0}
              max={25000}
              step={500}
              lightMode={lightMode}
            />
          </div>
        ) : (
          // Employee hours per week slider
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className={cn(
                "text-sm",
                lightMode ? "text-neutral-600" : "text-neutral-400"
              )}>Employee hours/week</label>
              <span className={cn(
                "rounded-md px-2 py-0.5 text-sm font-medium transition-colors",
                lightMode
                  ? state.employeeHours > 0 
                    ? "bg-neutral-200 text-neutral-900" 
                    : "bg-neutral-200 text-neutral-500"
                  : state.employeeHours > 0 
                    ? "bg-neutral-700 text-white" 
                    : "bg-neutral-800 text-neutral-500"
              )}>
                {state.employeeHours}h
              </span>
            </div>
            <ROISlider
              value={[state.employeeHours]}
              onValueChange={([value]) => onUpdate({ employeeHours: value })}
              min={0}
              max={200}
              step={5}
              lightMode={lightMode}
            />
          </div>
        )}

      </div>

      {/* Summary */}
      <div className={cn(
        "border-t p-4",
        lightMode
          ? "border-neutral-200 bg-neutral-50"
          : "border-neutral-800 bg-neutral-950/50"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <p className={cn(
              "text-xs",
              lightMode ? "text-neutral-500" : "text-neutral-500"
            )}>Monthly manual cost</p>
            <p className={cn(
              "text-sm",
              lightMode ? "text-neutral-600" : "text-neutral-400"
            )}>{formatCurrency(monthlyManualCost)}</p>
          </div>
          <div className="text-right">
            <p className={cn(
              "text-xs",
              lightMode ? "text-neutral-500" : "text-neutral-500"
            )}>Monthly savings</p>
            <p className={cn(
              "text-lg font-bold transition-all duration-300",
              monthlySavings > 0 
                ? lightMode
                  ? "text-success-600"
                  : "text-success-400 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                : lightMode
                  ? "text-neutral-400"
                  : "text-neutral-500"
            )}>
              {formatCurrency(monthlySavings)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ROICalculatorProps {
  lightMode?: boolean;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

export default function ROICalculator({ 
  lightMode = false,
  utmSource,
  utmMedium,
  utmCampaign,
  utmTerm,
  utmContent,
}: ROICalculatorProps) {
  const [annualCost, setAnnualCost] = useState(75000); // Annual cost per employee in dollars
  const hourlyCost = annualCost / WORKING_HOURS_PER_YEAR; // Convert to hourly for calculations
  const [workflowStates, setWorkflowStates] = useState<Record<string, WorkflowState>>(() => {
    const initial: Record<string, WorkflowState> = {};
    defaultWorkflows.forEach((workflow) => {
      initial[workflow.id] = {
        employeeHours: workflow.defaultEmployeeHours || 0,
        monthlyCost: workflow.defaultMonthlyCost || 0,
        automation: workflow.defaultAutomation,
      };
    });
    return initial;
  });

  const updateWorkflow = useCallback((id: string, updates: Partial<WorkflowState>) => {
    setWorkflowStates((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...updates },
    }));
  }, []);

  const calculations = useMemo(() => {
    let totalMonthlyCost = 0;
    let totalMonthlySavings = 0;
    let totalHoursAutomated = 0;
    let activeWorkflowCount = 0;

    defaultWorkflows.forEach((workflow) => {
      const state = workflowStates[workflow.id];
      const isCostType = workflow.type === "cost";
      
      // Check if workflow has any value (not zeroed out)
      const hasValue = isCostType ? state.monthlyCost > 0 : state.employeeHours > 0;
      
      if (hasValue) {
        // Calculate monthly cost based on workflow type (using fixed 75% automation rate)
        const monthlyCost = isCostType 
          ? state.monthlyCost 
          : state.employeeHours * hourlyCost * WEEKS_PER_MONTH;
        const savings = monthlyCost * (AUTOMATION_PERCENTAGE / 100);
        
        // Only count hours for time-based workflows
        if (!isCostType) {
          const hoursAutomated = state.employeeHours * (AUTOMATION_PERCENTAGE / 100) * WEEKS_PER_MONTH;
          totalHoursAutomated += hoursAutomated;
        }
        
        totalMonthlyCost += monthlyCost;
        totalMonthlySavings += savings;
        activeWorkflowCount++;
      }
    });

    // Annual calculations
    const annualSavings = totalMonthlySavings * 12;

    // 3-year projection
    const threeYearSavings = annualSavings * 3;

    return {
      totalMonthlyCost,
      totalMonthlySavings,
      totalHoursAutomated,
      activeWorkflowCount,
      annualSavings,
      threeYearSavings,
    };
  }, [workflowStates, annualCost, hourlyCost]);

  const ctaUrl = useMemo(() => {
    const params = new URLSearchParams({
      source: "roi-calculator",
      three_year_savings: Math.round(calculations.threeYearSavings).toString(),
      annual_savings: Math.round(calculations.annualSavings).toString(),
      workflows: calculations.activeWorkflowCount.toString(),
      annual_employee_cost: annualCost.toString(),
    });
    // Add UTM params if provided
    if (utmSource) params.set("utm_source", utmSource);
    if (utmMedium) params.set("utm_medium", utmMedium);
    if (utmCampaign) params.set("utm_campaign", utmCampaign);
    if (utmTerm) params.set("utm_term", utmTerm);
    if (utmContent) params.set("utm_content", utmContent);
    return `https://jaro.dev/contact-businessos?${params.toString()}`;
  }, [calculations, annualCost, utmSource, utmMedium, utmCampaign, utmTerm, utmContent]);

  return (
    <section 
      className={cn(
        "calculator-section relative min-h-screen px-4 py-20 md:px-6",
        lightMode ? "bg-neutral-50" : "bg-black"
      )} 
      id="calculator"
    >
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        {lightMode ? (
          <>
            <div className="absolute left-1/4 top-1/4 size-[500px] rounded-full bg-primary-100/50 blur-[200px]" />
            <div className="absolute bottom-1/4 right-1/4 size-[500px] rounded-full bg-success-100/50 blur-[200px]" />
          </>
        ) : (
          <>
            <div className="absolute left-1/4 top-1/4 size-[500px] rounded-full bg-primary-500/10 blur-[200px]" />
            <div className="absolute bottom-1/4 right-1/4 size-[500px] rounded-full bg-success-500/10 blur-[200px]" />
          </>
        )}
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Header */}
        <div className="calculator-header mb-12 text-center">
          <h2 className={cn(
            "mb-4 text-3xl font-bold md:text-4xl lg:text-5xl",
            lightMode ? "text-neutral-900" : "text-white"
          )}>
            Calculate Your <span className={lightMode ? "text-primary-600" : "text-primary-400"}>ROI</span>
          </h2>
          <p className={cn(
            "mx-auto max-w-2xl text-lg",
            lightMode ? "text-neutral-600" : "text-neutral-400"
          )}>
            See how much time and money BusinessOS could save you by automating these common operational workflows.
          </p>
        </div>

        {/* Global Settings */}
        <div className={cn(
          "calculator-settings mb-8 rounded-2xl border p-6",
          lightMode
            ? "border-neutral-200 bg-white shadow-sm"
            : "border-neutral-800 bg-neutral-900/50"
        )}>
          <div className="mb-1 flex items-center justify-between">
            <label className={cn(
              "text-sm font-medium",
              lightMode ? "text-neutral-900" : "text-white"
            )}>Average Cost per Employee (per year)</label>
            <span className={cn(
              "rounded-lg px-3 py-1 text-lg font-bold",
              lightMode
                ? "bg-primary-100 text-primary-700"
                : "bg-primary-500/20 text-primary-400"
            )}>
              {formatCurrency(annualCost)}/yr
            </span>
          </div>
          <ROISlider
            value={[annualCost]}
            onValueChange={([value]) => setAnnualCost(value)}
            min={50000}
            max={300000}
            step={5000}
            lightMode={lightMode}
          />
          <p className={cn(
            "mt-1 text-xs",
            lightMode ? "text-neutral-500" : "text-neutral-500"
          )}>
            Include salary, benefits, and overhead (~{formatCurrency(hourlyCost)}/hr)
          </p>
        </div>

        {/* Workflow Grid */}
        <div className="calculator-grid mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2">
          {defaultWorkflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              state={workflowStates[workflow.id]}
              hourlyCost={hourlyCost}
              onUpdate={(updates) => updateWorkflow(workflow.id, updates)}
              lightMode={lightMode}
            />
          ))}
        </div>

        {/* Results Summary */}
        <div className={cn(
          "calculator-results overflow-hidden rounded-3xl border backdrop-blur-sm",
          lightMode
            ? "border-primary-200 bg-white shadow-lg"
            : "border-primary-500/30 bg-neutral-900/80"
        )}>
          {/* Stats Grid */}
          <div className={cn(
            "grid gap-px md:grid-cols-3",
            lightMode ? "bg-neutral-200" : "bg-neutral-800"
          )}>
            <div className={cn(
              "p-6 text-center",
              lightMode ? "bg-white" : "bg-neutral-900"
            )}>
              <p className={cn(
                "mb-1 text-sm",
                lightMode ? "text-neutral-500" : "text-neutral-500"
              )}>Workflows Automated</p>
              <p className={cn(
                "text-3xl font-bold",
                lightMode ? "text-neutral-900" : "text-white"
              )}>{calculations.activeWorkflowCount}</p>
            </div>
            <div className={cn(
              "p-6 text-center",
              lightMode ? "bg-white" : "bg-neutral-900"
            )}>
              <p className={cn(
                "mb-1 text-sm",
                lightMode ? "text-neutral-500" : "text-neutral-500"
              )}>Hours Saved/Month</p>
              <p className={cn(
                "text-3xl font-bold",
                lightMode ? "text-neutral-900" : "text-white"
              )}>{formatNumber(calculations.totalHoursAutomated)}</p>
            </div>
            <div className={cn(
              "p-6 text-center",
              lightMode ? "bg-white" : "bg-neutral-900"
            )}>
              <p className={cn(
                "mb-1 text-sm",
                lightMode ? "text-neutral-500" : "text-neutral-500"
              )}>3-Year Value Created</p>
              <p className={cn(
                "text-3xl font-bold",
                lightMode ? "text-success-600" : "text-success-400"
              )}>{formatCurrency(calculations.threeYearSavings)}</p>
            </div>
          </div>

          {/* Savings Highlight */}
          <div className={cn(
            "relative border-t p-8 text-center",
            lightMode
              ? "border-neutral-200 bg-neutral-50"
              : "border-neutral-800 bg-neutral-950/50"
          )}>
            <div className="mb-6">
              <p className={cn(
                "mb-2 text-lg",
                lightMode ? "text-neutral-600" : "text-neutral-400"
              )}>3-Year Savings</p>
              <p className={cn(
                "text-5xl font-bold md:text-6xl",
                lightMode ? "text-success-600" : "text-success-400"
              )}>
                +{formatCurrency(calculations.threeYearSavings)}
              </p>
              {/*               <p className={cn(
                "mt-2 text-xs",
                lightMode ? "text-neutral-400" : "text-neutral-500"
              )}>
                * Assumes {AUTOMATION_PERCENTAGE}% of each workflow is automatable
              </p> */}
            </div>
            
            <div className="mb-8 flex justify-center">
              <div className={cn(
                "rounded-xl border px-6 py-3",
                lightMode
                  ? "border-success-200 bg-success-50"
                  : "border-success-500/30 bg-success-500/10"
              )}>
                <p className={cn(
                  "text-sm",
                  lightMode ? "text-neutral-600" : "text-neutral-400"
                )}>Annual Savings</p>
                <p className={cn(
                  "text-2xl font-bold",
                  lightMode ? "text-success-600" : "text-success-400"
                )}>{formatCurrency(calculations.annualSavings)}</p>
              </div>
            </div>

            <div className={cn(
              "mb-8 rounded-xl p-6",
              lightMode ? "bg-white shadow-sm" : "bg-neutral-800/50"
            )}>
              <p className={cn(
                "text-lg md:text-xl",
                lightMode ? "text-neutral-900" : "text-white"
              )}>
                Based on your inputs, <span className={cn(
                  "font-bold",
                  lightMode ? "text-primary-600" : "text-primary-400"
                )}>BusinessOS</span> could save you{" "}
                <span className={cn(
                  "font-bold",
                  lightMode ? "text-success-600" : "text-success-400"
                )}>{formatCurrency(calculations.threeYearSavings)}</span> over 3 years.
              </p>
            </div>

            {/* CTA */}
            <motion.div
              id="calculator-cta"
              animate={{
                x: [0, -4, 4, -4, 4, 0],
              }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                repeatDelay: 3,
                ease: "easeInOut",
              }}
            >
              <Link
                href={ctaUrl}
                className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-primary-500 px-10 py-5 text-xl font-bold text-white transition-all hover:bg-primary-600 hover:shadow-glow-lg"
              >
                <span>Book My Free Consultation</span>
                <svg
                  className="size-6 transition-transform group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
            </motion.div>

            <p className={cn(
              "mt-4 text-sm",
              lightMode ? "text-neutral-500" : "text-neutral-500"
            )}>
              Free 30-minute consultation • No commitment
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
