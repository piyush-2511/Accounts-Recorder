import { daysBetween, monthEnd, monthStart } from "../format/dates";

/** Suggested monthly budget = trailing average, rounded up to the next 100. */
export function suggestBudget(avg: number): number {
  if (!Number.isFinite(avg) || avg <= 0) return 0;
  return Math.ceil(avg / 100) * 100;
}

/** Share of budget used, as a percentage. null when there is no budget. */
export function budgetUsedPct(budget: number | null, actual: number): number | null {
  if (budget === null || budget <= 0) return null;
  return (actual / budget) * 100;
}

export type BudgetState = "none" | "ok" | "warning" | "over";

export function budgetState(budget: number | null, actual: number): BudgetState {
  const pct = budgetUsedPct(budget, actual);
  if (pct === null) return "none";
  if (pct > 100) return "over";
  if (pct >= 80) return "warning";
  return "ok";
}

/**
 * Run-rate forecast of a month's total spend from spend so far.
 * `today` is clamped inside the month; before day 1 or after the month it returns the actual.
 */
export function forecastMonth(spentSoFar: number, monthIso: string, todayIso: string): number {
  const start = monthStart(monthIso);
  const end = monthEnd(monthIso);
  if (todayIso >= end) return spentSoFar;
  if (todayIso < start) return 0;
  const elapsed = daysBetween(start, todayIso) + 1;
  const total = daysBetween(start, end) + 1;
  return (spentSoFar / elapsed) * total;
}

/** Projected full-year spend from months completed so far (simple average of completed months). */
export function forecastYear(completedMonths: number[], remainingMonths: number): number {
  const done = completedMonths.reduce((s, v) => s + v, 0);
  if (completedMonths.length === 0) return 0;
  return done + (done / completedMonths.length) * remainingMonths;
}
