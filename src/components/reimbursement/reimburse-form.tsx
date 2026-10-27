"use client";

import { useActionState, useMemo, useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage, fieldError } from "@/components/shared/form-state";
import { formatDMY } from "@/lib/format/dates";
import { formatINR, toPaise } from "@/lib/format/money";
import { idle } from "@/lib/validation/common";
import { reimburseAction } from "@/app/admin/reimbursements/actions";
import type { OwedEntry } from "@/lib/data/reimbursements";

interface Props {
  personId: string;
  personName: string;
  entries: OwedEntry[];
  sources: { id: number; label: string }[];
  today: string;
}

/** Pick the expenses being paid back, see the live total, and record the payment. */
export function ReimburseForm({ personId, personName, entries, sources, today }: Props) {
  const [state, action] = useActionState(reimburseAction, idle);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(entries.map((e) => e.id)));

  const { totalPaise, latest } = useMemo(() => {
    let total = 0;
    let last = "";
    for (const e of entries) if (selected.has(e.id)) { total += toPaise(e.amount); if (e.entry_date > last) last = e.entry_date; }
    return { totalPaise: total, latest: last };
  }, [entries, selected]);

  const toggle = (id: string) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const allSelected = selected.size === entries.length;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="person_id" value={personId} />
      <FormMessage state={state} />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="w-10 px-3 py-2">
                <input type="checkbox" className="h-4 w-4" aria-label="Select all expenses" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(entries.map((e) => e.id)))} />
              </th>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Details</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="px-3 py-2"><input type="checkbox" name="entry_ids" value={e.id} className="h-4 w-4" checked={selected.has(e.id)} onChange={() => toggle(e.id)} aria-label={`Include expense of ${formatINR(e.amount)} on ${formatDMY(e.entry_date)}`} /></td>
                <td className="whitespace-nowrap px-3 py-2">{formatDMY(e.entry_date)}</td>
                <td className="px-3 py-2">{e.category?.label}</td>
                <td className="px-3 py-2">
                  {e.narration}{e.party ? <span className="text-muted-foreground"> · {e.party}</span> : null}
                  {e.receipt_path ? <a href={`/api/vouchers/${e.id}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary underline">voucher</a> : <span className="ml-2 text-xs text-warning">no voucher</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatINR(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {fieldError(state, "entry_ids") ? <p className="text-sm text-danger">{fieldError(state, "entry_ids")}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paid from" htmlFor="source_id" error={fieldError(state, "source_id")}>
          <Select id="source_id" name="source_id" defaultValue={sources[0]?.id}>{sources.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
        </Field>
        <Field label="Date paid" htmlFor="paid_on" error={fieldError(state, "paid_on")} hint={latest ? `Not earlier than the latest expense (${formatDMY(latest)}).` : undefined}>
          <Input id="paid_on" name="paid_on" type="date" defaultValue={today} min={latest || undefined} max={today} required />
        </Field>
        <Field label="Reference (optional)" htmlFor="reference" error={fieldError(state, "reference")} hint="Bank UTR, cheque number or receipt number.">
          <Input id="reference" name="reference" maxLength={60} autoComplete="off" />
        </Field>
        <Field label="Note (optional)" htmlFor="note" error={fieldError(state, "note")}>
          <Textarea id="note" name="note" maxLength={300} rows={2} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
        <p className="text-sm">
          Paying <strong>{personName}</strong> for <strong>{selected.size}</strong> {selected.size === 1 ? "expense" : "expenses"}:{" "}
          <strong className="text-base tabular-nums">{formatINR(totalPaise / 100)}</strong>
        </p>
        <SubmitButton size="lg" disabled={selected.size === 0} pendingText="Recording...">Record reimbursement</SubmitButton>
      </div>
      <p className="text-xs text-muted-foreground">This records that you have paid the money. It then appears in the next Tally export as a voucher that clears {personName}&apos;s payable.</p>
    </form>
  );
}
