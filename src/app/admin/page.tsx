import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getGroup, getMonthly, getSummary, previousMonth } from "@/lib/data/reports";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { BarList, Delta, Kpi, TrendChart } from "@/components/reports/charts";
import { formatINR } from "@/lib/format/money";
import { daysBetween, formatMonth, monthStart, todayIST } from "@/lib/format/dates";
import { fyLabel, fyRange, fyStartYear } from "@/lib/format/financial-year";
import { firstParam } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const includePending = firstParam(sp.pending) === "1";
  const today = todayIST();
  const fy = fyRange(fyStartYear(today));
  const thisMonth = { from: monthStart(today), to: today };
  const prev = previousMonth(today);

  const supabase = await createClient();
  const [now, before, ytd, monthly, categories, pendingRes, oldest] = await Promise.all([
    getSummary(supabase, thisMonth.from, thisMonth.to, includePending),
    getSummary(supabase, prev.from, prev.to, includePending),
    getSummary(supabase, fy.from, today, includePending),
    getMonthly(supabase, fy.from, fy.to, includePending),
    getGroup(supabase, "category", fy.from, today, includePending),
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null),
    supabase.from("entries").select("created_at").eq("status", "pending").is("deleted_at", null).order("created_at").limit(1),
  ]);

  const pending = pendingRes.count ?? 0;
  const oldestAge = oldest.data?.[0]?.created_at ? daysBetween(String(oldest.data[0].created_at).slice(0, 10), today) : 0;
  const topExpense = categories.filter((c) => c.expense > 0).sort((a, b) => b.expense - a.expense).slice(0, 5).map((c) => ({ label: c.label, value: c.expense }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${formatMonth(thisMonth.from)} and financial year ${fyLabel(fyStartYear(today))}. ${includePending ? "Including pending entries." : "Approved and exported entries only."}`}
        actions={
          <Link href={includePending ? "/admin" : "/admin?pending=1"} className={buttonClass("secondary", "sm")}>
            {includePending ? "Approved only" : "Include pending"}
          </Link>
        }
      />

      {pending > 0 ? (
        <Alert tone="warning" className="mb-4">
          {pending} {pending === 1 ? "entry is" : "entries are"} waiting for review{oldestAge > 0 ? ` (oldest is ${oldestAge} ${oldestAge === 1 ? "day" : "days"} old)` : ""}.{" "}
          <Link href="/admin/review" className="font-medium underline">Review now</Link>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Income this month" value={formatINR(now.income)} tone="income" sub={<Delta current={now.income} previous={before.income} goodWhenUp />} />
        <Kpi label="Expense this month" value={formatINR(now.expense)} tone="expense" sub={<Delta current={now.expense} previous={before.expense} goodWhenUp={false} />} />
        <Kpi label="Net this month" value={formatINR(now.income - now.expense)} tone={now.income - now.expense >= 0 ? "income" : "expense"} sub={`${now.entry_count} entries`} />
        <Kpi label={`Net, FY ${fyLabel(fyStartYear(today))}`} value={formatINR(ytd.income - ytd.expense)} tone={ytd.income - ytd.expense >= 0 ? "income" : "expense"} sub={`${formatINR(ytd.income)} in, ${formatINR(ytd.expense)} out`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Income and expense by month</CardTitle></CardHeader>
          <CardContent><TrendChart data={monthly} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Where the money went (FY to date)</CardTitle></CardHeader>
          <CardContent>
            <BarList rows={topExpense} />
            <Link href="/admin/reports/category?period=fy" className="mt-3 inline-block text-sm text-primary hover:underline">Full category report</Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
