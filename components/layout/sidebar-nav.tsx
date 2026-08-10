"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import * as icons from "lucide-react";
import { LogOut, Menu, X } from "lucide-react";
import type { UserRole } from "@prisma/client";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/role-labels";
import { navGroupsForRole } from "@/config/nav";
import { cn, initials } from "@/lib/utils";

interface SidebarNavProps {
  role: UserRole;
  name: string;
  email: string;
}

function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

export function SidebarNav({ role, name, email }: SidebarNavProps) {
  const pathname = usePathname() ?? "";
  const [isOpen, setIsOpen] = useState(false);
  const groups = navGroupsForRole(role);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/dashboard/onboarding") {
      return (
        pathname === "/dashboard/onboarding" ||
        pathname.startsWith("/dashboard/onboarding/forms")
      );
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const navigation = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4 scrollbar-thin">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-secondary-400">
            {group.label}
          </p>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-primary-50 text-primary-700"
                  : "text-secondary-600 hover:bg-secondary-50 hover:text-secondary-900"
              )}
            >
              <NavIcon name={item.icon} className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-border p-3">
      <div className="flex items-center gap-3 rounded-md px-2 py-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary-100 text-xs font-semibold text-secondary-700">
          {initials(name || email)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-secondary-900">
            {name || email}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {ROLE_LABELS[role]}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Sign out"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <Logo />
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Open navigation"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="size-4" />
        </Button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-secondary-900/40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 animate-slide-in-right flex-col bg-card shadow-popover">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <Logo />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close navigation"
                onClick={() => setIsOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            {navigation}
            {footer}
          </div>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:sticky lg:top-0 lg:flex lg:h-screen">
        <div className="border-b border-border px-4 py-4">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        {navigation}
        {footer}
      </aside>
    </>
  );
}
