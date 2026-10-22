/** Money helpers. All arithmetic is done in integer paise to avoid floating point drift. */

export function toPaise(value: number | string): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${String(value)}`);
  return Math.round(n * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

/** "300.00" - fixed 2 decimals, no grouping. Used for Tally XML and Excel. */
export function plainAmount(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const inrNumber = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inrCompact = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });

/** "₹1,25,000.00" */
export function formatINR(value: number | string | null | undefined): string {
  return inr.format(Number(value ?? 0));
}

/** "1,25,000.00" */
export function formatNumberIN(value: number | string | null | undefined): string {
  return inrNumber.format(Number(value ?? 0));
}

/** "1.3L" style short form for chart axes. */
export function formatCompactIN(value: number): string {
  return inrCompact.format(value);
}
