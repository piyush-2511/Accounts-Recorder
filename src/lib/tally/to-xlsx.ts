import ExcelJS from "exceljs";
import { formatDMY } from "../format/dates";
import { fromPaise } from "../format/money";
import type { ExportEntry, TallyVoucher } from "./types";

/** Header row of the Excel layout the organisation already uses with Tally. */
export const SHEET_HEADERS = ["Date", "Voucher Type", "Voucher No", "Ledger", "Amount", "Dr/Cr", "Narration"] as const;

export async function buildXlsx(vouchers: TallyVoucher[], entries: ExportEntry[]): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Accounts Recorder";
  wb.created = new Date();

  // Sheet 1: one row per Dr/Cr line, same columns as the Sample_Tally.xlsx layout.
  const ws = wb.addWorksheet("Vouchers");
  ws.addRow([...SHEET_HEADERS]);
  for (const v of vouchers) {
    for (const l of v.lines) {
      const numeric = /^\d+$/.test(v.number) ? Number(v.number) : v.number;
      ws.addRow([formatDMY(v.date), v.type, numeric, l.ledger, fromPaise(l.paise), l.side, v.narration]);
    }
  }
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.columns = [
    { width: 12 }, { width: 14 }, { width: 12 }, { width: 28 }, { width: 14, style: { numFmt: "#,##0.00" } }, { width: 7 }, { width: 70 },
  ];

  // Sheet 2: the original entries, for reference and audit.
  const detail = wb.addWorksheet("Entries");
  detail.addRow(["Voucher No", "Date", "Type", "Category", "Paid from / received in", "Party", "Programme", "Amount", "Narration"]);
  const byId = new Map(vouchers.map((v) => [v.entryId, v]));
  for (const e of entries) {
    const v = byId.get(e.id);
    detail.addRow([
      v ? (/^\d+$/.test(v.number) ? Number(v.number) : v.number) : "",
      formatDMY(e.entry_date),
      e.kind === "expense" ? "Expense" : "Income",
      e.category.label,
      e.source.label,
      e.party ?? "",
      e.programme ?? "",
      Number(e.amount),
      e.narration,
    ]);
  }
  detail.getRow(1).font = { bold: true };
  detail.views = [{ state: "frozen", ySplit: 1 }];
  detail.getColumn(8).numFmt = "#,##0.00";
  detail.columns.forEach((c, i) => (c.width = [12, 12, 10, 24, 22, 20, 20, 14, 60][i] ?? 14));

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
