import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addMonths, formatLong, formatMonth, monthEnd, monthStart } from "@/lib/format/dates";
import { fyLabel, fyRange, fyStartYear } from "@/lib/format/financial-year";

export interface Period {
  preset: "month" | "last-month" | "fy" | "last-fy" | "custom";
  from: string;
  to: string;
  includePending: boolean;
  label: string;
}

export const PRESET_LABEL: Record<Period["preset"], string> = {
  month: "This month",
  "last-month": "Last month",
  fy: "This financial year",
  "last-fy": "Last financial year",
  custom: "Custom dates",
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Reads ?period=&from=&to=&pending= into a validated reporting period. */
export function parsePeriod(sp: Record<string, string | string[] | undefined>, today: string): Period {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const includePending = one("pending") === "1";
  const preset = (["month", "last-month", "fy", "last-fy", "custom"] as const).find((p) => p === one("period")) ?? "month";
  const fy = fyStartYear(today);

  let from: string;
  let to: string;
  switch (preset) {
    case "last-month":
      from = addMonths(monthStart(today), -1);
      to = monthEnd(from);
      break;
    case "fy":
      ({ from } = fyRange(fy));
      to = today;
      break;
    case "last-fy":
      ({ from, to } = fyRange(fy - 1));
      break;
    case "custom": {
      const f = one("from");
      const t = one("to");
      from = f && ISO.test(f) ? f : monthStart(today);
      to = t && ISO.test(t) ? t : today;
      if (to < from) to = from;
      break;
    }
    default:
      from = monthStart(today);
      to = today;
  }

  const label =
    preset === "month" || preset === "last-month"
      ? formatMonth(from)
      : preset === "fy" || preset === "last-fy"
        ? `FY ${fyLabel(preset === "fy" ? fy : fy - 1)}`
        : `${formatLong(from)} to ${formatLong(to)}`;
  return { preset, from, to, includePending, label };
}

export interface Summary { income: number; expense: number; entry_count: number }
export interface MonthRow { month: string; income: number; expense: number }
export interface GroupRow { label: string; income: number; expense: number; entry_count: number }
export interface BudgetRow { category_id: number; label: string; budget: number | null; actual: number }
export interface FlaggedRow {
  entry_id: string; entry_date: string; amount: number; kind: "expense" | "income"; category: string; party: string | null;
  recorder: string; status: string; possible_duplicate: boolean; no_voucher: boolean; high_amount: boolean;
}

const n = (v: unknown) => Number(v ?? 0);

export async function getSummary(supabase: SupabaseClient, from: string, to: string, includePending: boolean): Promise<Summary> {
  const { data, error } = await supabase.rpc("report_summary", { p_from: from, p_to: to, p_include_pending: includePending });
  if (error) throw new Error(`Report failed: ${error.message}`);
  const r = (data as Record<string, unknown>[] | null)?.[0] ?? {};
  return { income: n(r.income), expense: n(r.expense), entry_count: n(r.entry_count) };
}

export async function getMonthly(supabase: SupabaseClient, from: string, to: string, includePending: boolean): Promise<MonthRow[]> {
  const { data, error } = await supabase.rpc("report_monthly", { p_from: from, p_to: to, p_include_pending: includePending });
  if (error) throw new Error(`Report failed: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ month: String(r.month), income: n(r.income), expense: n(r.expense) }));
}

export type Dimension = "category" | "programme" | "payee" | "source" | "recorder";

export async function getGroup(supabase: SupabaseClient, dim: Dimension, from: string, to: string, includePending: boolean): Promise<GroupRow[]> {
  const { data, error } = await supabase.rpc("report_group", { p_dim: dim, p_from: from, p_to: to, p_include_pending: includePending });
  if (error) throw new Error(`Report failed: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ label: String(r.label), income: n(r.income), expense: n(r.expense), entry_count: n(r.entry_count) }));
}

export async function getBudgetVsActual(supabase: SupabaseClient, month: string, includePending: boolean): Promise<BudgetRow[]> {
  const { data, error } = await supabase.rpc("report_budget_vs_actual", { p_month: month, p_include_pending: includePending });
  if (error) throw new Error(`Report failed: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ category_id: n(r.category_id), label: String(r.label), budget: r.budget === null ? null : n(r.budget), actual: n(r.actual) }));
}

export async function getAvgExpense(supabase: SupabaseClient, refMonth: string): Promise<Map<number, number>> {
  const { data } = await supabase.rpc("report_avg_expense", { p_ref: refMonth, p_months: 3 });
  return new Map(((data ?? []) as Record<string, unknown>[]).map((r) => [n(r.category_id), n(r.avg_amount)]));
}

export async function getFlagged(supabase: SupabaseClient, from: string, to: string): Promise<FlaggedRow[]> {
  const { data, error } = await supabase.rpc("report_flagged_entries", { p_from: from, p_to: to });
  if (error) throw new Error(`Report failed: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    entry_id: String(r.entry_id), entry_date: String(r.entry_date), amount: n(r.amount), kind: r.kind as "expense" | "income",
    category: String(r.category), party: (r.party as string | null) ?? null, recorder: String(r.recorder), status: String(r.status),
    possible_duplicate: !!r.possible_duplicate, no_voucher: !!r.no_voucher, high_amount: !!r.high_amount,
  }));
}

/** Previous period of the same length, for "vs last month" style comparisons. */
export function previousMonth(today: string): { from: string; to: string } {
  const from = addMonths(monthStart(today), -1);
  return { from, to: monthEnd(from) };
}

export { addDays };
