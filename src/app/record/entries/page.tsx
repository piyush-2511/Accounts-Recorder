import Link from "next/link";
import { Paperclip } from "lucide-react";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { listEntries, PAGE_SIZE } from "@/lib/data/entries";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { Pagination } from "@/components/shared/pagination";
import { StatusChip } from "@/components/shared/status-chip";
import { ENTRY_STATUSES, ENTRY_STATUS_LABEL, RECORDER_EDITABLE, type EntryStatus } from "@/lib/constants/entry-status";
import { formatDMY } from "@/lib/format/dates";
import { cn, firstParam } from "@/lib/utils";

export const metadata = { title: "My entries" };

export default async function MyEntriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const statusParam = firstParam(sp.status);
  const status = (ENTRY_STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as EntryStatus) : "all";
  const page = Math.max(1, Number(firstParam(sp.page)) || 1);

  const supabase = await createClient();
  const { rows, total } = await listEntries(supabase, { status, createdBy: user.id }, { page });

  return (
    <>
      <PageHeader title="My entries" actions={<Link href="/record/new" className={buttonClass("primary")}>New entry</Link>} />
      {firstParam(sp.deleted) ? <Alert tone="success" className="mb-3">Entry deleted.</Alert> : null}
      {firstParam(sp.error) ? <Alert tone="danger" className="mb-3">{firstParam(sp.error)}</Alert> : null}

      <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-2">
        {(["all", ...ENTRY_STATUSES] as const).map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/record/entries" : `/record/entries?status=${s}`}
            aria-current={status === s ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-sm", status === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}
          >
            {s === "all" ? "All" : ENTRY_STATUS_LABEL[s]}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState title="No entries here yet">Entries you save will appear in this list with their review status.</EmptyState>
      ) : (
        <Card>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Category</Th>
                  <Th>Details</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap">{formatDMY(e.entry_date)}</Td>
                    <Td>
                      {e.category?.label}
                      <span className="block text-xs text-muted-foreground">{e.kind === "income" ? "Income" : "Expense"} · {e.source?.label}</span>
                    </Td>
                    <Td className="max-w-xs">
                      <span className="line-clamp-2">{e.narration}</span>
                      {e.status === "rejected" && e.review_note ? <span className="mt-1 block text-xs font-medium text-danger">Admin note: {e.review_note}</span> : null}
                      {e.receipt_path ? (
                        <a href={`/api/vouchers/${e.id}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          <Paperclip className="h-3 w-3" aria-hidden /> Voucher
                        </a>
                      ) : null}
                    </Td>
                    <Td className="text-right"><Money value={e.amount} tone={e.kind === "income" ? "income" : "expense"} /></Td>
                    <Td><StatusChip status={e.status} /></Td>
                    <Td className="text-right">
                      <Link href={`/record/entries/${e.id}`} className={buttonClass(RECORDER_EDITABLE.includes(e.status) ? "secondary" : "ghost", "sm")}>
                        {RECORDER_EDITABLE.includes(e.status) ? "Edit" : "View"}
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}
      <Pagination page={page} total={total} pageSize={PAGE_SIZE} basePath="/record/entries" params={{ status: status === "all" ? undefined : status }} />
    </>
  );
}
