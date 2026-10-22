"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
  exact?: boolean;
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-muted",
            )}
          >
            {item.label}
            {item.badge ? (
              <span className={cn("rounded-full px-1.5 text-xs font-semibold", active ? "bg-white/25" : "bg-warning/20 text-warning")}>{item.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
