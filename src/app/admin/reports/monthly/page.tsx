import { createClient } from "@/lib/supabase/server";
import { getBudgetVsActual, getGroup, getSummary } from "@/lib/data/reports";
import { getSettings } from "@/lib/data/reference";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { Kpi } from "@/components/reports/charts";
import { PrintButton } from "@/components/reports/print-button";
import { formatINR } from "@/lib/format/money";
import { formatLong, formatMonth, isValidISODate, monthEnd, monthStart, todayIST } from "@/lib/format/dates";
import { firstParam } from "@/lib/utils";

export const metadata = { title: "Monthly report" };

export default async function MonthlyReport({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const today = todayIST();
  const m = firstParam(sp.month);
  const month = m && isValidISODate(`${m}-01`) ? `${m}-01` : monthStart(today);
  const to = monthEnd(month);
  const includePending = firstParam(sp.pending) === "1";

  const supabase = await createClient();
  const [settings, summary, categories, payees, programmes, budget] = await Promise.all([
    getSettings(supabase),
    getSummary(supabase, month, to, includePending),
    getGroup(supabase, "category", month, to, includePending),
    getGroup(supabase, "payee", month, to, includePending),
    getGroup(supabase, "programme", month, to, includePending),
    getBudgetVsActual(supabase, month, includePending),
  ]);

  return (
    <>
      <PageHeader title="Monthly report" description="Print this page or choose “Save as PDF” in the print dialog." actions={<PrintButton />} />
      <form method="get" className="no-print mb-5 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <Field label="Month" htmlFor="month"><Input id="month" name="month" type="month" defaultValue={month.slice(0, 7)} /></Field>
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="pending" value="1" defaultChecked={includePending} className="h-4 w-4" /> Include pending entries</label>
        <Button type="submit">Apply</Button>
      </form>

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">{settings.companyName || "Accounts report"}</h2>
          <p className="text-sm text-muted-foreground">Income and expense report for {formatMonth(month)} · generated {formatLong(today)}{includePending ? " · includes pending entries" : ""}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label="Income" value={formatINR(summary.income)} tone="income" />
          <Kpi label="Expense" value={formatINR(summary.expense)} tone="expense" />
          <Kpi label="Net" value={formatINR(summary.income - summary.expense)} tone={summary.income - summary.expense >= 0 ? "income" : "expense"} sub={`${summary.entry_count} entries`} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle>By category</CardTitle></CardHeader><TableWrap><Table><thead><tr><Th>Category</Th><Th className="text-right">Income</Th><Th className="text-right">Expense</Th></tr></thead><tbody>{categories.map((r) => <tr key={r.label}><Td>{r.label}</Td><Td className="text-right"><Money value={r.income} /></Td><Td className="text-right"><Money value={r.expense} /></Td></tr>)}</tbody></Table></TableWrap></Card>
          <Card><CardHeader><CardTitle>By programme</CardTitle></CardHeader><TableWrap><Table><thead><tr><Th>Programme</Th><Th className="text-right">Income</Th><Th className="text-right">Expense</Th></tr></thead><tbody>{programmes.map((r) => <tr key={r.label}><Td>{r.label}</Td><Td className="text-right"><Money value={r.income} /></Td><Td className="text-right"><Money value={r.expense} /></Td></tr>)}</tbody></Table></TableWrap></Card>
          <Card><CardHeader><CardTitle>Top payees</CardTitle></CardHeader><TableWrap><Table><thead><tr><Th>Payee</Th><Th className="text-right">Amount</Th></tr></thead><tbody>{payees.slice(0, 8).map((r) => <tr key={r.label}><Td>{r.label}</Td><Td className="text-right"><Money value={r.expense + r.income} /></Td></tr>)}</tbody></Table></TableWrap></Card>
          <Card><CardHeader><CardTitle>Budget vs actual</CardTitle></CardHeader><TableWrap><Table><thead><tr><Th>Category</Th><Th className="text-right">Budget</Th><Th className="text-right">Actual</Th></tr></thead><tbody>{budget.map((r) => <tr key={r.category_id}><Td>{r.label}</Td><Td className="text-right">{r.budget === null ? "-" : <Money value={r.budget} />}</Td><Td className="text-right"><Money value={r.actual} /></Td></tr>)}</tbody></Table></TableWrap></Card>
        </div>
      </div>
    </>
  );
}
