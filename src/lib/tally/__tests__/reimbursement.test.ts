import { XMLParser } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { buildReimbursementVoucher, buildVoucher, collectLedgers, reimbursementNarration } from "../build-vouchers";
import { checkExport } from "../checks";
import { buildVouchersXml } from "../to-xml";
import type { ExportEntry, ExportReimbursement } from "../types";

const personalSource = { label: "Paid by me (reimburse later)", tally_ledger: "Staff Reimbursement Payable", tally_group: "Sundry Creditors", voucher_mode: "reimbursable" as const };
const entry = (over: Partial<ExportEntry> = {}): ExportEntry => ({
  id: "e1", entry_date: "2026-10-01", kind: "expense", amount: 400, voucher_no: 7, narration: "Fuel for van", created_by: "u1",
  payable_ledger: "Asha Devi - Reimbursable",
  category: { label: "Fuel", tally_ledger: "Fuel Expense", tally_group: "Indirect Expenses" },
  source: personalSource, ...over,
});
const reimbursement = (over: Partial<ExportReimbursement> = {}): ExportReimbursement => ({
  id: "r1", paid_on: "2026-10-10", amount: 650, voucher_no: 3, reference: "UTR 123", note: null, person_id: "u1", person_name: "Asha Devi", entry_count: 2,
  source: { label: "Bank", tally_ledger: "Bank Account", tally_group: "Bank Accounts" },
  lines: [{ ledger: "Asha Devi - Reimbursable", group: "Sundry Creditors", amount: 650 }], ...over,
});

describe("expense paid personally", () => {
  it("is a Journal: Dr expense / Cr the person's payable ledger", () => {
    const v = buildVoucher(entry(), { voucherPrefix: "" });
    expect(v.type).toBe("Journal");
    expect(v.lines).toEqual([
      { ledger: "Fuel Expense", side: "Dr", paise: 40000 },
      { ledger: "Asha Devi - Reimbursable", side: "Cr", paise: 40000 },
    ]);
  });
  it("does not use the placeholder source ledger", () => {
    expect(collectLedgers([entry()]).map((l) => l.name)).toEqual(["Asha Devi - Reimbursable", "Fuel Expense"]);
    expect(collectLedgers([entry()]).find((l) => l.name.startsWith("Asha"))?.parent).toBe("Sundry Creditors");
  });
});

describe("reimbursement voucher", () => {
  it("is a Payment: Dr payable / Cr bank, numbered in its own R- series", () => {
    const v = buildReimbursementVoucher(reimbursement(), { voucherPrefix: "AF-", reimbursementVoucherType: "Payment" });
    expect(v.type).toBe("Payment");
    expect(v.number).toBe("AF-R-3");
    expect(v.lines).toEqual([
      { ledger: "Asha Devi - Reimbursable", side: "Dr", paise: 65000 },
      { ledger: "Bank Account", side: "Cr", paise: 65000 },
    ]);
  });
  it("can be a Journal when configured", () => {
    expect(buildReimbursementVoucher(reimbursement(), { voucherPrefix: "", reimbursementVoucherType: "Journal" }).type).toBe("Journal");
  });
  it("splits the debit when a person has two payable ledgers and still balances", () => {
    const r = reimbursement({ lines: [{ ledger: "Asha - Old", group: "Sundry Creditors", amount: 150.5 }, { ledger: "Asha - New", group: "Sundry Creditors", amount: 499.5 }] });
    const v = buildReimbursementVoucher(r, { voucherPrefix: "" });
    expect(v.lines.filter((l) => l.side === "Dr").reduce((s, l) => s + l.paise, 0)).toBe(65000);
    expect(checkExport([v], [], [r]).ok).toBe(true);
  });
  it("writes a readable narration", () => {
    expect(reimbursementNarration(reimbursement())).toBe("Being reimbursement paid to Asha Devi for 2 expenses (Ref UTR 123)");
    expect(reimbursementNarration(reimbursement({ entry_count: 1, reference: null, note: "October claim" }))).toBe("Being reimbursement paid to Asha Devi for 1 expense. October claim");
  });
  it("produces valid Tally XML with the debit negative and the credit positive", () => {
    const v = buildReimbursementVoucher(reimbursement(), { voucherPrefix: "" });
    const xml = new XMLParser({ ignoreAttributes: false }).parse(buildVouchersXml([v], "Test Co"));
    const voucher = xml.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE.VOUCHER;
    expect(voucher.VOUCHERTYPENAME).toBe("Payment");
    expect(voucher["ALLLEDGERENTRIES.LIST"].map((l: { AMOUNT: number }) => l.AMOUNT)).toEqual([-650, 650]);
  });
});

describe("export checks for reimbursements", () => {
  it("passes a normal export containing an expense and its reimbursement", () => {
    const e = entry();
    const r = reimbursement({ amount: 400, lines: [{ ledger: "Asha Devi - Reimbursable", group: "Sundry Creditors", amount: 400 }], entry_count: 1 });
    const vouchers = [buildVoucher(e, { voucherPrefix: "" }), buildReimbursementVoucher(r, { voucherPrefix: "" })];
    expect(checkExport(vouchers, [e], [r]).ok).toBe(true);
  });
  it("blocks two people sharing one payable ledger", () => {
    const a = entry({ id: "a", created_by: "u1" });
    const b = entry({ id: "b", created_by: "u2", voucher_no: 8 });
    const res = checkExport([buildVoucher(a, { voucherPrefix: "" }), buildVoucher(b, { voucherPrefix: "" })], [a, b]);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => /shared by 2 people/.test(i.message))).toBe(true);
  });
  it("blocks a reimbursable expense without a payable ledger", () => {
    const e = entry({ payable_ledger: null });
    expect(checkExport([buildVoucher(e, { voucherPrefix: "" })], [e]).ok).toBe(false);
  });
  it("blocks an unbalanced reimbursement", () => {
    const r = reimbursement({ amount: 700 });
    expect(checkExport([buildReimbursementVoucher(r, { voucherPrefix: "" })], [], [r]).ok).toBe(false);
  });
});
