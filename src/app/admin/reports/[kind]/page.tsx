import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getGroup, parsePeriod, type Dimension } from "@/lib/data/reports";
import { getSources } from "@/lib/data/reference";
import { buttonClass } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { BarList } from "@/components/reports/charts";
import { PeriodFilter } from "@/components/reports/period-filter";
import { todayIST } from "@/lib/format/dates";

const KINDS: Record<string, { dim: Dimension; title: string; blurb: string }> = {
  category: { dim: "category", title: "By category", blurb: "Where income comes from and where money is spent." },
  programme: { dim: "programme", title: "By programme", blurb: "Entries without a programme are grouped as (none)." },
  payee: { dim: "payee", title: "By payee", blurb: "Paid to / received from, as typed by recorders." },
  sources: { dim: "source", title: "Payment sources", blurb: "Money movement through cash, bank and journal (loan) sources." },
  recorders: { dim: "recorder", title: "By recorder", blurb: "Entries counted per person who recorded them." },
};

export default async function GroupReport({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { kind } = await params;
  const spec = KINDS[kind];
  if (!spec) notFound();
  const sp = await searchParams;
  const period = parsePeriod(sp, todayIST());

  const supabase = await createClient();
  const [rows, sources] = await Promise.all([getGroup(supabase, spec.dim, period.from, period.to, period.includePending), kind === "sources" ? getSources(supabase) : Promise.resolve([])]);
  const journal = new Set(sources.filter((s) => s.voucher_mode === "journal").map((s) => s.label));
  const totalExpense = rows.reduce((s, r) => s + r.expense, 0);
  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const qs = new URLSearchParams({ kind, from: period.from, to: period.to, ...(period.includePending ? { pending: "1" } : {}) }).toString();

  return (
    <>
      <PageHeader
        title={spec.title}
        description={`${period.label}. ${spec.blurb}`}
        actions={
          <>
            <a className={buttonClass("secondary", "sm")} href={`/api/reports/export?${qs}&format=csv`}>CSV</a>
            <a className={buttonClass("secondary", "sm")} href={`/api/reports/export?${qs}&format=xlsx`}>Excel</a>
          </>
        }
      />
      <PeriodFilter period={period} />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>{spec.title.replace("By ", "").replace(/^./, (c) => c.toUpperCase())}</Th>
                  <Th className="text-right">Income</Th>
                  <Th className="text-right">Expense</Th>
                  <Th className="text-right">Entries</Th>
                  {kind === "sources" ? <Th className="text-right">Owed (expense − income)</Th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? <tr><Td colSpan={5} className="py-8 text-center text-muted-foreground">No entries in this period.</Td></tr> : null}
                {rows.map((r) => (
                  <tr key={r.label}>
                    <Td>{r.label}</Td>
                    <Td className="text-right"><Money value={r.income} tone="income" /></Td>
                    <Td className="text-right"><Money value={r.expense} tone="expense" /></Td>
                    <Td className="text-right tabular-nums">{r.entry_count}</Td>
                    {kind === "sources" ? <Td className="text-right">{journal.has(r.label) ? <Money value={r.expense - r.income} /> : <span className="text-muted-foreground">-</span>}</Td> : null}
                  </tr>
                ))}
              </tbody>
              {rows.length > 0 ? (
                <tfoot>
                  <tr className="font-semibold">
                    <Td>Total</Td>
                    <Td className="text-right"><Money value={totalIncome} tone="income" /></Td>
                    <Td className="text-right"><Money value={totalExpense} tone="expense" /></Td>
                    <Td className="text-right tabular-nums">{rows.reduce((s, r) => s + r.entry_count, 0)}</Td>
                    {kind === "sources" ? <Td /> : null}
                  </tr>
                </tfoot>
              ) : null}
            </Table>
          </TableWrap>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Expense share</CardTitle></CardHeader>
            <CardContent><BarList rows={rows.filter((r) => r.expense > 0).map((r) => ({ label: r.label, value: r.expense }))} /></CardContent>
          </Card>
          {totalIncome > 0 ? (
            <Card>
              <CardHeader><CardTitle>Income share</CardTitle></CardHeader>
              <CardContent><BarList tone="income" rows={rows.filter((r) => r.income > 0).map((r) => ({ label: r.label, value: r.income }))} /></CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
