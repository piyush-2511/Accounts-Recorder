"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/shared/money";
import { EntryFlags } from "./entry-flags";
import { cn } from "@/lib/utils";
import { formatDMY } from "@/lib/format/dates";
import { bulkApproveAction } from "@/app/admin/review/actions";
import type { FlagRow } from "@/types/db";

export interface QueueRow {
  id: string;
  entry_date: string;
  kind: "expense" | "income";
  category: string;
  party: string | null;
  recorder: string;
  amount: number;
  hasVoucher: boolean;
  flags?: FlagRow;
}

function isFlagged(f?: FlagRow): boolean {
  return !!f && (f.possible_duplicate || f.no_voucher || f.high_amount);
}

/**
 * The pending list. Keyboard: A approve, R reject, J / down = next, K / up = previous.
 * Bulk approve skips flagged rows; those must be opened and checked one by one.
 */
export function ReviewQueue({ rows, selectedId, query }: { rows: QueueRow[]; selectedId: string | null; query: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const selectable = useMemo(() => rows.filter((r) => !isFlagged(r.flags)), [rows]);
  const hrefFor = (id: string) => `/admin/review?${query ? `${query}&` : ""}id=${id}`;
  const returnTo = `/admin/review${query ? `?${query}` : ""}`;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = rows.findIndex((r) => r.id === selectedId);
      if (e.key === "a" || e.key === "A") document.getElementById("approve-btn")?.click();
      else if (e.key === "r" || e.key === "R") { e.preventDefault(); document.getElementById("reject-btn")?.click(); }
      else if (e.key === "ArrowDown" || e.key === "j") { const n = rows[idx + 1]; if (n) { e.preventDefault(); router.push(hrefFor(n.id)); } }
      else if (e.key === "ArrowUp" || e.key === "k") { const p = rows[idx - 1]; if (p) { e.preventDefault(); router.push(hrefFor(p.id)); } }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selectedId, query]);

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const allChecked = selectable.length > 0 && selectable.every((r) => checked.has(r.id));

  return (
    <form action={bulkApproveAction} className="flex min-h-0 flex-col">
      <input type="hidden" name="return_to" value={returnTo} />
      {[...checked].map((id) => (
        <input key={id} type="hidden" name="ids" value={id} />
      ))}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={allChecked}
            onChange={() => setChecked(allChecked ? new Set() : new Set(selectable.map((r) => r.id)))}
            aria-label="Select all entries without flags"
          />
          Select all unflagged
        </label>
        <Button type="submit" variant="success" size="sm" disabled={checked.size === 0}>
          Approve selected ({checked.size})
        </Button>
      </div>
      <ul className="divide-y overflow-y-auto" aria-label="Pending entries">
        {rows.map((r) => {
          const flagged = isFlagged(r.flags);
          const active = r.id === selectedId;
          return (
            <li key={r.id} className={cn("flex gap-2 px-3 py-2", active && "bg-primary/5")}>
              <input
                type="checkbox"
                className="mt-1.5 h-4 w-4 shrink-0"
                checked={checked.has(r.id)}
                disabled={flagged}
                onChange={() => toggle(r.id)}
                aria-label={flagged ? `${r.category} ${r.amount} has flags: open it to approve` : `Select ${r.category} ${r.amount}`}
                title={flagged ? "Flagged: open the entry to approve" : undefined}
              />
              <Link href={hrefFor(r.id)} aria-current={active ? "true" : undefined} className="min-w-0 flex-1 rounded-sm text-sm">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{r.category}</span>
                  <Money value={r.amount} tone={r.kind === "income" ? "income" : "expense"} className="font-semibold" />
                </span>
                <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{formatDMY(r.entry_date)} · {r.recorder}{r.party ? ` · ${r.party}` : ""}</span>
                  {r.hasVoucher ? <Paperclip className="h-3 w-3 shrink-0" aria-label="Has voucher" /> : null}
                </span>
                <EntryFlags flags={r.flags} compact />
              </Link>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
