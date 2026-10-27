"use client";

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A small accessible menu: closes on outside click, Escape and navigation. */
export function Dropdown({
  label,
  children,
  align = "left",
  className,
  buttonClassName,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted", buttonClassName)}
      >
        {label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div id={id} role="menu" className={cn("absolute z-40 mt-1 min-w-52 rounded-lg border bg-card p-1 shadow-lg", align === "right" ? "right-0" : "left-0")}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
