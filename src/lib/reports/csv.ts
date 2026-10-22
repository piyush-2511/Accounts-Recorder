/** Minimal RFC 4180 CSV writer with protection against spreadsheet formula injection. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined): string => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    // Cells starting with = + - @ are interpreted as formulas by Excel/Sheets.
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
