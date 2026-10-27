import Link from "next/link";
import { Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listEntries, PAGE_SIZE, type EntryFilters } from "@/lib/data/entries";
import { getCategories } from "@/lib/data/reference";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { DeleteEntryButton } from "@/components/entry/delete-entry-button";
import { adminDeleteEntryAction } from "./actions";
import { Money } from "@/components/shared/money";
import { Pagination } from "@/components/shared/pagination";
import { StatusChip } from "@/components/shared/status-chip";
import { ENTRY_STATUSES, ENTRY_STATUS_LABEL, type EntryStatus } from "@/lib/constants/entry-status";
import { formatDMY } from "@/lib/format/dates";
import { firstParam } from "@/lib/utils";
import type { Profile } from "@/types/db";

export const metadata = { title: "All entries" };

export default async function AdminEntriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Number(firstParam(sp.page)) || 1);
  const statusParam = firstParam(sp.status);
  const status = (ENTRY_STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as EntryStatus) : "all";
  const category = Number(firstParam(sp.category)) || undefined;
  const filters: EntryFilters = {
    status,
    recorder: firstParam(sp.recorder) || undefined,
    category,
    from: firstParam(sp.from) || undefined,
    to: firstParam(sp.to) || undefined,
    q: firstParam(sp.q) || undefined,
    noVoucher: firstParam(sp.novoucher) === "1",
  };

  const [{ rows, total }, categories, recorders] = await Promise.all([
    listEntries(supabase, filters, { page }),
    getCategories(supabase),
    supabase.from("profiles").select("id,full_name").order("full_name"),
  ]);

  const params = {
    status: status === "all" ? undefined : status,
    recorder: filters.recorder,
    category: category ? String(category) : undefined,
    from: filters.from,
    to: filters.to,
    q: filters.q,
    novoucher: filters.noVoucher ? "1" : undefined,
  };

  return (
    <>
      <PageHeader title="All entries" description="Every entry across recorders. Edit or delete any entry that has not been exported. Exported entries are locked until their export batch is unlocked." />
      {firstParam(sp.deleted) ? <Alert tone="success" className="mb-3">Entry deleted.</Alert> : null}
      <form method="get" className="mb-4 grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={status}>
            <option value="all">All</option>
            {ENTRY_STATUSES.map((s) => <option key={s} value={s}>{ENTRY_STATUS_LABEL[s]}</option>)}
          </Select>
        </Field>
        <Field label="Recorder" htmlFor="recorder">
          <Select id="recorder" name="recorder" defaultValue={filters.recorder ?? ""}>
            <option value="">Everyone</option>
            {((recorders.data ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
        </Field>
        <Field label="Category" htmlFor="category">
          <Select id="category" name="category" defaultValue={category ? String(category) : ""}>
            <option value="">All</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label="From" htmlFor="from"><Input id="from" name="from" type="date" defaultValue={filters.from} /></Field>
        <Field label="To" htmlFor="to"><Input id="to" name="to" type="date" defaultValue={filters.to} /></Field>
        <Field label="Search" htmlFor="q"><Input id="q" name="q" placeholder="Narration, party..." defaultValue={filters.q} /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-3 lg:col-span-4"><input type="checkbox" name="novoucher" value="1" defaultChecked={filters.noVoucher} className="h-4 w-4" /> Only entries without a voucher</label>
        <div className="flex gap-2 sm:col-span-3 sm:justify-end lg:col-span-2">
          <Link href="/admin/entries" className="inline-flex h-10 items-center rounded-md px-3 text-sm hover:bg-muted">Clear</Link>
          <Button type="submit">Filter</Button>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No entries match" />
      ) : (
        <Card>
          <TableWrap>
            <Table>
              <thead>
                <tr><Th>Date</Th><Th>Category</Th><Th>Recorder</Th><Th>Details</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th><span className="sr-only">Open</span></Th></tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap">{formatDMY(e.entry_date)}</Td>
                    <Td>{e.category?.label}<span className="block text-xs text-muted-foreground">{e.source?.label}</span></Td>
                    <Td>{e.creator?.full_name}</Td>
                    <Td className="max-w-xs"><span className="line-clamp-2">{e.narration}</span>{e.receipt_path ? <Paperclip className="mt-1 h-3 w-3 text-muted-foreground" aria-label="Has voucher" /> : null}</Td>
                    <Td className="text-right"><Money value={e.amount} tone={e.kind === "income" ? "income" : "expense"} /></Td>
                    <Td><StatusChip status={e.status} />{e.voucher_no ? <span className="mt-1 block text-xs text-muted-foreground">No. {e.voucher_no}</span> : null}</Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/entries/${e.id}`} className={buttonClass("secondary", "sm")}>{e.status === "exported" ? "View" : "Edit"}</Link>
                        {e.status !== "exported" && !e.reimbursement_id ? <DeleteEntryButton id={e.id} action={adminDeleteEntryAction} /> : null}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/admin/entries" params={params} />
    </>
  );
}
