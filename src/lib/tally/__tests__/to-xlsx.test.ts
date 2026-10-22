import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVouchers } from "../build-vouchers";
import { buildXlsx, SHEET_HEADERS } from "../to-xlsx";
import type { ExportEntry } from "../types";

const entries: ExportEntry[] = [
  {
    id: "a", entry_date: "2026-04-01", kind: "expense", amount: 300, voucher_no: 1,
    narration: "Being Fuel Expense paid to Piyush for program activity",
    category: { label: "Fuel", tally_ledger: "Fuel Expense", tally_group: "Indirect Expenses" },
    source: { label: "Loan from Secretary", tally_ledger: "Loan from Secretary", tally_group: "Unsecured Loans", voucher_mode: "journal" },
  },
  {
    id: "b", entry_date: "2026-04-01", kind: "expense", amount: 250, voucher_no: 2,
    narration: "Being Fooding Expense paid to Mohit during program activity",
    category: { label: "Fooding", tally_ledger: "Fooding Expense", tally_group: "Indirect Expenses" },
    source: { label: "Loan from Secretary", tally_ledger: "Loan from Secretary", tally_group: "Unsecured Loans", voucher_mode: "journal" },
  },
];

async function load(bytes: Uint8Array | Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  return wb;
}

describe("Excel export", () => {
  it("matches the layout and rows of the organisation's Sample_Tally.xlsx exactly", async () => {
    const sample = await load(readFileSync(join(__dirname, "fixtures", "sample-tally.xlsx")));
    const expected = sample.worksheets[0]!;
    const out = await load(await buildXlsx(buildVouchers(entries, { voucherPrefix: "" }), entries));
    const ws = out.getWorksheet("Vouchers")!;

    const rowValues = (sheet: ExcelJS.Worksheet, n: number) => (sheet.getRow(n).values as ExcelJS.CellValue[]).slice(1);
    expect(rowValues(ws, 1)).toEqual([...SHEET_HEADERS]);
    expect(rowValues(ws, 1)).toEqual(rowValues(expected, 1));
    for (let r = 2; r <= 5; r++) expect(rowValues(ws, r)).toEqual(rowValues(expected, r));
  });

  it("includes a reference sheet of the original entries", async () => {
    const out = await load(await buildXlsx(buildVouchers(entries, { voucherPrefix: "" }), entries));
    const detail = out.getWorksheet("Entries")!;
    expect(detail.rowCount).toBe(3);
    expect(detail.getRow(2).getCell(4).value).toBe("Fuel");
  });
});
