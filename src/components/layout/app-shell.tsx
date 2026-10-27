import * as React from "react";
import Link from "next/link";
import { LogOut, UserCircle } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Dropdown } from "./dropdown";
import { NavLinks, type NavItem } from "./nav-links";

interface Props {
  title: string;
  userName: string;
  roleLabel: string;
  nav: NavItem[];
  more?: NavItem[];
  homeHref?: string;
  children: React.ReactNode;
}

export function AppShell({ title, userName, roleLabel, nav, more, homeHref = "/", children }: Props) {
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
  return (
    <div className="min-h-screen bg-background">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow">Skip to content</a>
      <header className="no-print sticky top-0 z-30 border-b bg-card/90 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-14 items-center gap-4">
            <Link href={homeHref} className="flex shrink-0 items-center gap-2.5">
              <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">A</span>
              <span className="hidden text-[15px] font-semibold tracking-tight sm:block">{title}</span>
            </Link>
            <div className="hidden min-w-0 flex-1 md:block"><NavLinks items={nav} more={more} /></div>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <Dropdown
                align="right"
                buttonClassName="gap-2 border border-transparent px-2 hover:border-border"
                label={
                  <>
                    <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">{initials}</span>
                    <span className="hidden max-w-32 truncate sm:block">{userName}</span>
                  </>
                }
              >
                <div className="px-3 py-2">
                  <p className="flex items-center gap-2 text-sm font-medium"><UserCircle className="h-4 w-4 text-muted-foreground" aria-hidden />{userName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{roleLabel}</p>
                </div>
                <div className="my-1 border-t" />
                <form action="/logout" method="post">
                  <button type="submit" role="menuitem" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
                    <LogOut className="h-4 w-4" aria-hidden /> Sign out
                  </button>
                </form>
              </Dropdown>
            </div>
          </div>
          <div className="pb-2 md:hidden"><NavLinks items={nav} more={more} /></div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
