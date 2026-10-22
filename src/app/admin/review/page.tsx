import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getEntry, getFlags, listEntries } from "@/lib/data/entries";
import { getCategories } from "@/lib/data/reference";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { EntryDetails } from "@/components/entry/entry-details";
import { EntryFlags } from "@/components/review/entry-flags";
import { ReviewActions } from "@/components/review/review-actions";
import { ReviewQueue, type QueueRow } from "@/components/review/review-queue";
import { VoucherViewer } from "@/components/review/voucher-viewer";
import { firstParam } from "@/lib/utils";
import { uuid } from "@/lib/validation/common";
import type { Profile } from "@/types/db";

export const metadata = { title: "Review queue" };

const FILTER_KEYS = ["recorder", "category", "from", "to", "min", "max", "novoucher"] as const;

export default async function ReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  const num = (k: string) => {
    const v = firstParam(sp[k]);
    return v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
  };
  const filters = {
    status: "pending" as const,
    recorder: firstParam(sp.recorder) || undefined,
    category: num("category"),
    from: firstParam(sp.from) || undefined,
    to: firstParam(sp.to) || undefined,
    min: num("min"),
    max: num("max"),
    noVoucher: firstParam(sp.novoucher) === "1",
  };

  const [{ rows, total }, categories, recorders] = await Promise.all([
    listEntries(supabase, filters, { oldestFirst: true, pageSize: 50 }),
    getCategories(supabase),
    supabase.from("profiles").select("id,full_name").eq("is_active", true).order("full_name"),
  ]);
  const flags = await getFlags(supabase, rows.map((r) => r.id));

  const queueRows: QueueRow[] = rows.map((r) => ({
    id: r.id,
    entry_date: r.entry_date,
    kind: r.kind,
    category: r.category?.label ?? "-",
    party: r.party,
    recorder: r.creator?.full_name ?? "-",
    amount: r.amount,
    hasVoucher: !!r.receipt_path,
    flags: flags.get(r.id),
  }));

  const wantedId = firstParam(sp.id);
  const selectedRow = (wantedId && uuid.safeParse(wantedId).success ? rows.find((r) => r.id === wantedId) : undefined) ?? rows[0] ?? null;
  const selected = selectedRow ? await getEntry(supabase, selectedRow.id) : null;

  const query = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = firstParam(sp[k]);
    if (v) query.set(k, v);
  }
  const queryString = query.toString();
  const returnTo = `/admin/review${queryString ? `?${queryString}` : ""}`;
  const hasFilters = queryString.length > 0;

  return (
    <>
      <PageHeader title="Review queue" description={`${total} pending ${total === 1 ? "entry" : "entries"}, oldest first. Keys: A approve, R reject, J/K next and previous.`} />
      {firstParam(sp.approved) ? <Alert tone="success" className="mb-3">{firstParam(sp.approved)} {firstParam(sp.approved) === "1" ? "entry" : "entries"} approved.</Alert> : null}
      {firstParam(sp.error) ? <Alert tone="danger" className="mb-3">{firstParam(sp.error)}</Alert> : null}

      <details className="mb-4 rounded-lg border bg-card" open={hasFilters}>
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium">Filters{hasFilters ? " (active)" : ""}</summary>
        <form className="grid gap-3 border-t p-4 sm:grid-cols-3 lg:grid-cols-6" method="get">
          <Field label="Recorder" htmlFor="recorder">
            <Select id="recorder" name="recorder" defaultValue={filters.recorder ?? ""}>
              <option value="">Everyone</option>
              {((recorders.data ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </Select>
          </Field>
          <Field label="Category" htmlFor="category">
            <Select id="category" name="category" defaultValue={filters.category ? String(filters.category) : ""}>
              <option value="">All</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <Field label="From" htmlFor="from"><Input id="from" name="from" type="date" defaultValue={filters.from} /></Field>
          <Field label="To" htmlFor="to"><Input id="to" name="to" type="date" defaultValue={filters.to} /></Field>
          <Field label="Min ₹" htmlFor="min"><Input id="min" name="min" inputMode="decimal" defaultValue={filters.min} /></Field>
          <Field label="Max ₹" htmlFor="max"><Input id="max" name="max" inputMode="decimal" defaultValue={filters.max} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="novoucher" value="1" defaultChecked={filters.noVoucher} className="h-4 w-4" /> Only entries without a voucher</label>
          <div className="flex gap-2 sm:col-span-4 sm:justify-end">
            <Link href="/admin/review" className="inline-flex h-10 items-center rounded-md px-3 text-sm hover:bg-muted">Clear</Link>
            <Button type="submit">Apply</Button>
          </div>
        </form>
      </details>

      {queueRows.length === 0 ? (
        <EmptyState title={hasFilters ? "No pending entries match these filters" : "All caught up"}>
          <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> Nothing is waiting for review.</span>
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
          <Card className="max-h-[75vh] overflow-hidden lg:sticky lg:top-24">
            <ReviewQueue rows={queueRows} selectedId={selected?.id ?? null} query={queryString} />
          </Card>
          {selected ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-2">
                  <CardTitle>Entry details</CardTitle>
                  <EntryFlags flags={flags.get(selected.id)} />
                </CardHeader>
                <CardContent className="space-y-5">
                  <EntryDetails entry={selected} />
                  <ReviewActions entryId={selected.id} returnTo={returnTo} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Voucher</CardTitle></CardHeader>
                <CardContent>
                  {selected.receipt_path ? (
                    <VoucherViewer entryId={selected.id} mime={selected.receipt_mime} size={selected.receipt_size} />
                  ) : (
                    <p className="text-sm text-muted-foreground">The recorder did not attach a voucher.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
