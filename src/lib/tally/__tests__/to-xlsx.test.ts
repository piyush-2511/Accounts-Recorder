import { readSheet } from "read-excel-file/node";
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

const sheet = (bytes: Uint8Array | Buffer, name: string) => readSheet(Buffer.from(bytes), name);

describe("Excel export", () => {
  it("matches the layout and rows of the organisation's Sample_Tally.xlsx exactly", async () => {
    const expected = await readSheet(join(__dirname, "fixtures", "sample-tally.xlsx"), 1);
    const ws = await sheet(await buildXlsx(buildVouchers(entries, { voucherPrefix: "" }), entries), "Vouchers");
    expect(ws[0]).toEqual([...SHEET_HEADERS]);
    expect(ws[0]).toEqual(expected[0]);
    for (let r = 1; r <= 4; r++) expect(ws[r]).toEqual(expected[r]);
  });

  it("includes a reference sheet of the original entries", async () => {
    const detail = await sheet(await buildXlsx(buildVouchers(entries, { voucherPrefix: "" }), entries), "Entries");
    expect(detail.length).toBe(3);
    expect(detail[1]![3]).toBe("Fuel");
  });
});
