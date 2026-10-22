/** Date helpers. Dates are ISO strings (YYYY-MM-DD) everywhere; never JS Date in business logic. */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidISODate(value: string): boolean {
  const m = ISO.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function parts(iso: string): [number, number, number] {
  const m = ISO.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's date in India (Asia/Kolkata) as ISO, regardless of server time zone. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  return toISO(new Date(Date.UTC(y, m - 1, d + days)));
}

export function monthStart(iso: string): string {
  const [y, m] = parts(iso);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

export function addMonths(iso: string, months: number): string {
  const [y, m] = parts(iso);
  return toISO(new Date(Date.UTC(y, m - 1 + months, 1)));
}

export function monthEnd(iso: string): string {
  return addDays(addMonths(iso, 1), -1);
}

/** "01-04-2026" (DD-MM-YYYY), the format used in the Tally export sheet. */
export function formatDMY(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
}

/** "20260401", the date format Tally XML expects. */
export function toTallyDate(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "1 Apr 2026" */
export function formatLong(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Apr 2026" */
export function formatMonth(iso: string): string {
  const [y, m] = parts(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

export function daysBetween(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = parts(fromIso);
  const [y2, m2, d2] = parts(toIso);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
