import { Paperclip } from "lucide-react";
import { Money } from "@/components/shared/money";
import { StatusChip } from "@/components/shared/status-chip";
import { formatDMY } from "@/lib/format/dates";
import type { EntryWithRefs } from "@/types/db";

/** Read-only summary of an entry (used for locked entries and in the review panel). */
export function EntryDetails({ entry }: { entry: EntryWithRefs }) {
  const rows: [string, React.ReactNode][] = [
    ["Date", formatDMY(entry.entry_date)],
    ["Type", entry.kind === "income" ? "Income" : "Expense"],
    ["Category", entry.category?.label ?? "-"],
    ["Amount", <Money key="a" value={entry.amount} tone={entry.kind === "income" ? "income" : "expense"} className="text-base font-semibold" />],
    [entry.kind === "income" ? "Received in" : "Paid from", entry.source?.label ?? "-"],
    [entry.kind === "income" ? "Received from" : "Paid to", entry.party || "-"],
    ["Programme", entry.programme || "-"],
    ["Narration", entry.narration],
    ["Recorded by", entry.creator?.full_name ?? "-"],
    ["Status", <StatusChip key="s" status={entry.status} />],
  ];
  if (entry.voucher_no) rows.push(["Voucher no.", String(entry.voucher_no)]);
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
      {rows.map(([k, val]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 break-words">{val}</dd>
        </div>
      ))}
      {entry.review_note ? (
        <>
          <dt className="text-muted-foreground">Admin note</dt>
          <dd>{entry.review_note}</dd>
        </>
      ) : null}
      {entry.receipt_path ? (
        <>
          <dt className="text-muted-foreground">Voucher</dt>
          <dd>
            <a href={`/api/vouchers/${entry.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <Paperclip className="h-4 w-4" aria-hidden /> Open voucher
            </a>
          </dd>
        </>
      ) : null}
    </dl>
  );
}
