import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAvgExpense, getBudgetVsActual } from "@/lib/data/reports";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { budgetState, budgetUsedPct, forecastMonth, suggestBudget } from "@/lib/reports/forecast";
import { formatMonth, isValidISODate, monthEnd, monthStart, todayIST } from "@/lib/format/dates";
import { firstParam } from "@/lib/utils";

export const metadata = { title: "Budget vs actual" };

export default async function BudgetReport({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const today = todayIST();
  const monthParam = firstParam(sp.month);
  const month = monthParam && isValidISODate(`${monthParam}-01`) ? `${monthParam}-01` : monthStart(today);
  const includePending = firstParam(sp.pending) === "1";

  const supabase = await createClient();
  const [rows, avg] = await Promise.all([getBudgetVsActual(supabase, month, includePending), getAvgExpense(supabase, month)]);
  const isCurrent = month === monthStart(today);
  const totals = rows.reduce((t, r) => ({ budget: t.budget + (r.budget ?? 0), actual: t.actual + r.actual }), { budget: 0, actual: 0 });

  return (
    <>
      <PageHeader
        title="Budget vs actual"
        description={`${formatMonth(month)}. Warning from 80% of budget. Suggested = average of the previous 3 months, rounded up.`}
        actions={<Link href={`/admin/settings/budgets?month=${month.slice(0, 7)}`} className={buttonClass("primary", "sm")}>Edit budgets</Link>}
      />
      <form method="get" className="no-print mb-5 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <Field label="Month" htmlFor="month"><Input id="month" name="month" type="month" defaultValue={month.slice(0, 7)} /></Field>
        <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="pending" value="1" defaultChecked={includePending} className="h-4 w-4" /> Include pending entries</label>
        <Button type="submit">Apply</Button>
      </form>
      <Card>
        <TableWrap>
          <Table>
            <thead>
              <tr><Th>Category</Th><Th className="text-right">Budget</Th><Th className="text-right">Actual</Th><Th className="text-right">Remaining</Th><Th>Used</Th>{isCurrent ? <Th className="text-right">Forecast</Th> : null}<Th className="text-right">Suggested</Th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const state = budgetState(r.budget, r.actual);
                const pct = budgetUsedPct(r.budget, r.actual);
                const forecast = isCurrent ? forecastMonth(r.actual, month, today) : null;
                return (
                  <tr key={r.category_id}>
                    <Td>{r.label}</Td>
                    <Td className="text-right">{r.budget === null ? <span className="text-muted-foreground">not set</span> : <Money value={r.budget} />}</Td>
                    <Td className="text-right"><Money value={r.actual} /></Td>
                    <Td className="text-right">{r.budget === null ? "-" : <Money value={r.budget - r.actual} tone="auto" />}</Td>
                    <Td>
                      {pct === null ? "-" : <Badge tone={state === "over" ? "danger" : state === "warning" ? "warning" : "success"}>{pct.toFixed(0)}%{state === "over" ? " over" : ""}</Badge>}
                    </Td>
                    {forecast !== null ? <Td className="text-right">{<Money value={forecast} className={r.budget !== null && forecast > r.budget ? "text-danger" : undefined} />}</Td> : null}
                    <Td className="text-right"><Money value={suggestBudget(avg.get(r.category_id) ?? 0)} /></Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold"><Td>Total</Td><Td className="text-right"><Money value={totals.budget} /></Td><Td className="text-right"><Money value={totals.actual} /></Td><Td className="text-right"><Money value={totals.budget - totals.actual} tone="auto" /></Td><Td /><>{isCurrent ? <Td /> : null}</><Td /></tr>
            </tfoot>
          </Table>
        </TableWrap>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Month runs {monthStart(month)} to {monthEnd(month)}. The forecast projects the month from spending so far.</p>
    </>
  );
}
