import writeExcelFile from "write-excel-file/node";
import { formatDMY } from "../format/dates";
import { fromPaise } from "../format/money";
import type { ExportEntry, TallyVoucher } from "./types";

/** Header row of the Excel layout the organisation already uses with Tally. */
export const SHEET_HEADERS = ["Date", "Voucher Type", "Voucher No", "Ledger", "Amount", "Dr/Cr", "Narration"] as const;

type Cell = string | number | { value: string | number; fontWeight?: "bold"; format?: string };

const head = (labels: readonly string[]): Cell[] => labels.map((value) => ({ value, fontWeight: "bold" as const }));
const money = (n: number): Cell => ({ value: n, format: "#,##0.00" });
const voucherNo = (n: string): string | number => (/^\d+$/.test(n) ? Number(n) : n);

export async function buildXlsx(vouchers: TallyVoucher[], entries: ExportEntry[]): Promise<Uint8Array> {
  // Sheet 1: one row per Dr/Cr line, same columns as the Sample_Tally.xlsx layout.
  const lines: Cell[][] = [head(SHEET_HEADERS)];
  for (const v of vouchers) {
    for (const l of v.lines) {
      lines.push([formatDMY(v.date), v.type, voucherNo(v.number), l.ledger, money(fromPaise(l.paise)), l.side, v.narration]);
    }
  }

  // Sheet 2: the original entries, for reference and audit.
  const byId = new Map(vouchers.map((v) => [v.entryId, v]));
  const detail: Cell[][] = [head(["Voucher No", "Date", "Type", "Category", "Paid from / received in", "Party", "Programme", "Amount", "Narration"])];
  for (const e of entries) {
    const v = byId.get(e.id);
    detail.push([
      v ? voucherNo(v.number) : "",
      formatDMY(e.entry_date),
      e.kind === "expense" ? "Expense" : "Income",
      e.category.label,
      e.source.label,
      e.party ?? "",
      e.programme ?? "",
      money(Number(e.amount)),
      e.narration,
    ]);
  }

  const widths = (ws: number[]) => ws.map((width) => ({ width }));
  const buf = await writeExcelFile([
    { data: lines, sheet: "Vouchers", columns: widths([12, 14, 12, 28, 14, 7, 70]), stickyRowsCount: 1 },
    { data: detail, sheet: "Entries", columns: widths([12, 12, 10, 24, 22, 20, 20, 14, 60]), stickyRowsCount: 1 },
  ]).toBuffer();
  return new Uint8Array(buf);
}
