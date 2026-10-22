import * as React from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { NavLinks, type NavItem } from "./nav-links";

export function AppShell({ title, userName, roleLabel, nav, children }: { title: string; userName: string; roleLabel: string; nav: NavItem[]; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold">{title}</span>
            <span className="hidden rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:inline">{roleLabel}</span>
          </div>
          <form action="/logout" method="post" className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
            <ThemeToggle />
            <Button type="submit" variant="ghost" size="sm" aria-label="Sign out">
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </form>
          <div className="w-full sm:w-auto sm:flex-1 sm:order-none">
            <NavLinks items={nav} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
