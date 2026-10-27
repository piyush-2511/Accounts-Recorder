"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Dropdown } from "./dropdown";

export interface NavItem {
  href: string;
  label: string;
  badge?: number;
  exact?: boolean;
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** Main navigation. `more` items go into a "More" menu so the bar never feels crowded. */
export function NavLinks({ items, more = [] }: { items: NavItem[]; more?: NavItem[] }) {
  const pathname = usePathname();
  const moreActive = more.some((m) => isActive(pathname, m));
  return (
    <nav aria-label="Main" className="flex items-center gap-0.5 overflow-x-auto md:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-primary/10 text-primary" : "text-foreground/75 hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
            {item.badge ? <span className="min-w-5 rounded-full bg-warning/20 px-1.5 text-center text-xs font-semibold text-warning">{item.badge}</span> : null}
          </Link>
        );
      })}
      {more.length > 0 ? (
        <Dropdown label="More" buttonClassName={cn(moreActive && "bg-primary/10 text-primary")} className="shrink-0">
          {more.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              aria-current={isActive(pathname, item) ? "page" : undefined}
              className={cn("flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted", isActive(pathname, item) && "font-semibold text-primary")}
            >
              {item.label}
              {item.badge ? <span className="rounded-full bg-warning/20 px-1.5 text-xs font-semibold text-warning">{item.badge}</span> : null}
            </Link>
          ))}
        </Dropdown>
      ) : null}
    </nav>
  );
}
