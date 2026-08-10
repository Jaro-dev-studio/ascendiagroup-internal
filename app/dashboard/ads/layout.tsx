"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Image, BookMarked, Wand2 } from "lucide-react";

const tabs = [
  { href: "/dashboard/ads/my-ads", label: "Meta Ads", icon: Image },
  { href: "/dashboard/ads/library", label: "Ad Library", icon: BookMarked },
  { href: "/dashboard/ads/generator", label: "Ad Generator", icon: Wand2 },
];

export default function AdsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Navigation Bar */}
      <div className="flex items-center gap-2 rounded-lg border border-secondary-200 bg-secondary-50 p-1">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname?.startsWith(tab.href + "/");
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white text-secondary-900 shadow-sm"
                  : "text-secondary-600 hover:bg-white/50 hover:text-secondary-900"
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Content */}
      {children}
    </div>
  );
}
