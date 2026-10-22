import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFlagged, parsePeriod } from "@/lib/data/reports";
import { Card } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { StatusChip } from "@/components/shared/status-chip";
import { EntryFlags } from "@/components/review/entry-flags";
import { PeriodFilter } from "@/components/reports/period-filter";
import { formatDMY, todayIST } from "@/lib/format/dates";
import type { EntryStatus } from "@/lib/constants/entry-status";

export const metadata = { title: "Checks" };

export default async function ChecksReport({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp, todayIST());
  const supabase = await createClient();
  const rows = await getFlagged(supabase, period.from, period.to);
  const counts = { dup: rows.filter((r) => r.possible_duplicate).length, nov: rows.filter((r) => r.no_voucher).length, high: rows.filter((r) => r.high_amount).length };

  return (
    <>
      <PageHeader title="Checks" description={`${period.label}: ${counts.dup} possible duplicates, ${counts.nov} without a voucher, ${counts.high} unusually high.`} />
      <PeriodFilter period={period} />
      {rows.length === 0 ? (
        <EmptyState title="Nothing to check">No flagged entries in this period.</EmptyState>
      ) : (
        <Card>
          <TableWrap>
            <Table>
              <thead><tr><Th>Date</Th><Th>Category</Th><Th>Recorder</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th>Flags</Th><Th><span className="sr-only">Open</span></Th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.entry_id}>
                    <Td className="whitespace-nowrap">{formatDMY(r.entry_date)}</Td>
                    <Td>{r.category}{r.party ? <span className="block text-xs text-muted-foreground">{r.party}</span> : null}</Td>
                    <Td>{r.recorder}</Td>
                    <Td className="text-right"><Money value={r.amount} tone={r.kind === "income" ? "income" : "expense"} /></Td>
                    <Td><StatusChip status={r.status as EntryStatus} /></Td>
                    <Td><EntryFlags flags={{ entry_id: r.entry_id, possible_duplicate: r.possible_duplicate, no_voucher: r.no_voucher, high_amount: r.high_amount }} /></Td>
                    <Td className="text-right"><Link href={`/admin/entries/${r.entry_id}`} className={buttonClass("secondary", "sm")}>Open</Link></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}
    </>
  );
}
