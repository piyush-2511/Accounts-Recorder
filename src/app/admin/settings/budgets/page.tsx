import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/data/reference";
import { getAvgExpense } from "@/lib/data/reports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { PageHeader } from "@/components/shared/page-header";
import { Flash } from "@/components/shared/flash";
import { formatINR } from "@/lib/format/money";
import { formatMonth, isValidISODate, monthStart, todayIST } from "@/lib/format/dates";
import { suggestBudget } from "@/lib/reports/forecast";
import { firstParam } from "@/lib/utils";
import { copyBudgetsAction, saveBudgetsAction } from "./actions";

export const metadata = { title: "Budgets" };

export default async function Budgets({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const m = firstParam(sp.month);
  const month = m && isValidISODate(`${m}-01`) ? `${m}-01` : monthStart(todayIST());
  const supabase = await createClient();
  const [cats, { data: rows }, avg] = await Promise.all([
    getCategories(supabase, { activeOnly: true }),
    supabase.from("budgets").select("category_id,amount").eq("month", month),
    getAvgExpense(supabase, month),
  ]);
  const budget = new Map((rows ?? []).map((r) => [r.category_id as number, Number(r.amount)]));
  const expense = cats.filter((c) => c.kind === "expense");

  return (
    <>
      <PageHeader title="Budgets" description={`Monthly budget per expense category for ${formatMonth(month)}. Leave a box empty for no budget.`} />
      <Flash sp={sp} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Month" htmlFor="month"><Input id="month" name="month" type="month" defaultValue={month.slice(0, 7)} /></Field>
        <Button type="submit" variant="secondary">Show</Button>
      </form>
      <Card>
        <CardContent className="pt-5">
          <form action={saveBudgetsAction} className="max-w-xl space-y-3">
            <input type="hidden" name="month" value={month.slice(0, 7)} />
            {expense.map((c) => (
              <div key={c.id} className="grid grid-cols-[1fr_9rem] items-center gap-3">
                <label htmlFor={`b_${c.id}`} className="text-sm">
                  {c.label}
                  <span className="block text-xs text-muted-foreground">Suggested {formatINR(suggestBudget(avg.get(c.id) ?? 0))} (3-month average)</span>
                </label>
                <Input id={`b_${c.id}`} name={`b_${c.id}`} inputMode="decimal" defaultValue={budget.get(c.id) ?? ""} placeholder="No budget" />
              </div>
            ))}
            <SubmitButton pendingText="Saving...">Save budgets</SubmitButton>
          </form>
          <form action={copyBudgetsAction} className="mt-4 border-t pt-4">
            <input type="hidden" name="month" value={month.slice(0, 7)} />
            <SubmitButton variant="secondary" pendingText="Copying...">Copy missing budgets from previous month</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
