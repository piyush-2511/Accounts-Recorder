import { addDays } from "./dates";

/** Indian financial year: 1 April to 31 March. FY "2026-27" has start year 2026. */

export function fyStartYear(iso: string): number {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7));
  return month >= 4 ? year : year - 1;
}

export function fyRange(startYear: number): { from: string; to: string } {
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

export function fyLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/**
 * Earliest date a recorder may enter: the start of the current financial year, or 31 days ago,
 * whichever is earlier. The grace window lets April entries for late-March spending through.
 */
export function minEntryDate(todayIso: string): string {
  const fyStart = fyRange(fyStartYear(todayIso)).from;
  const grace = addDays(todayIso, -31);
  return fyStart < grace ? fyStart : grace;
}
