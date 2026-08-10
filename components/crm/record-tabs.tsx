"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecordTab {
  id: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface RecordTabsProps {
  tabs: RecordTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function RecordTabs({ tabs, activeTab, onChange }: RecordTabsProps) {
  return (
    <div
      role="tablist"
      className="flex flex-row gap-1 overflow-x-auto border-b border-border"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex shrink-0 flex-row items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-primary"
                : "hover:text-text-dark border-transparent text-text-secondary"
            )}
          >
            <Icon className="size-4" aria-hidden />
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-secondary-100 px-1.5 text-xs text-secondary-600">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
