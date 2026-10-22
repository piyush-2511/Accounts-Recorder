import { describe, expect, it } from "vitest";
import { buildVoucher, buildVouchers, collectLedgers } from "../build-vouchers";
import { checkExport } from "../checks";
import type { ExportEntry } from "../types";

const base: ExportEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  entry_date: "2026-04-01",
  kind: "expense",
  amount: 300,
  narration: "Being Fuel Expense paid to Piyush for program activity",
  voucher_no: 1,
  category: { label: "Fuel", tally_ledger: "Fuel Expense", tally_group: "Indirect Expenses" },
  source: { label: "Loan from Secretary", tally_ledger: "Loan from Secretary", tally_group: "Unsecured Loans", voucher_mode: "journal" },
};
const cash = { label: "Cash", tally_ledger: "Cash", tally_group: "Cash-in-Hand", voucher_mode: "payment_receipt" as const };

describe("buildVoucher mapping", () => {
  it("reproduces the sample Journal voucher (Dr Fuel Expense / Cr Loan from Secretary)", () => {
    const v = buildVoucher(base, { voucherPrefix: "" });
    expect(v.type).toBe("Journal");
    expect(v.number).toBe("1");
    expect(v.narration).toBe("Being Fuel Expense paid to Piyush for program activity");
    expect(v.lines).toEqual([
      { ledger: "Fuel Expense", side: "Dr", paise: 30000 },
      { ledger: "Loan from Secretary", side: "Cr", paise: 30000 },
    ]);
  });

  it("expense paid from cash/bank is a Payment: Dr category, Cr source", () => {
    const v = buildVoucher({ ...base, source: cash }, { voucherPrefix: "" });
    expect(v.type).toBe("Payment");
    expect(v.lines.map((l) => [l.ledger, l.side])).toEqual([["Fuel Expense", "Dr"], ["Cash", "Cr"]]);
  });

  it("income into cash/bank is a Receipt: Dr source, Cr category", () => {
    const v = buildVoucher(
      { ...base, kind: "income", source: cash, category: { label: "Donation", tally_ledger: "Donation Received", tally_group: "Direct Incomes" } },
      { voucherPrefix: "" },
    );
    expect(v.type).toBe("Receipt");
    expect(v.lines.map((l) => [l.ledger, l.side])).toEqual([["Cash", "Dr"], ["Donation Received", "Cr"]]);
  });

  it("income through a journal source is a Journal: Dr source, Cr category", () => {
    const v = buildVoucher({ ...base, kind: "income" }, { voucherPrefix: "" });
    expect(v.type).toBe("Journal");
    expect(v.lines.map((l) => [l.ledger, l.side])).toEqual([["Loan from Secretary", "Dr"], ["Fuel Expense", "Cr"]]);
  });

  it("applies the voucher prefix and handles numeric strings from Postgres", () => {
    const v = buildVoucher({ ...base, amount: "1250.50", voucher_no: 42 }, { voucherPrefix: "APP-" });
    expect(v.number).toBe("APP-42");
    expect(v.lines[0]?.paise).toBe(125050);
  });

  it("avoids floating point drift (0.1 + 0.2 style amounts)", () => {
    const v = buildVoucher({ ...base, amount: 19.99 }, { voucherPrefix: "" });
    expect(v.lines[0]?.paise).toBe(1999);
    const w = buildVoucher({ ...base, amount: 1.005 }, { voucherPrefix: "" });
    expect([100, 101]).toContain(w.lines[0]?.paise);
  });

  it("every voucher balances", () => {
    for (const kind of ["expense", "income"] as const) {
      for (const source of [base.source, cash]) {
        const v = buildVoucher({ ...base, kind, source }, { voucherPrefix: "" });
        const dr = v.lines.filter((l) => l.side === "Dr").reduce((s, l) => s + l.paise, 0);
        const cr = v.lines.filter((l) => l.side === "Cr").reduce((s, l) => s + l.paise, 0);
        expect(dr).toBe(cr);
      }
    }
  });
});

describe("buildVouchers / collectLedgers / checkExport", () => {
  const entries: ExportEntry[] = [
    { ...base, id: "a", entry_date: "2026-04-02", voucher_no: 2, amount: 250, category: { label: "Fooding", tally_ledger: "Fooding Expense", tally_group: "Indirect Expenses" } },
    { ...base, id: "b", entry_date: "2026-04-01", voucher_no: 1 },
  ];

  it("orders by date then voucher number", () => {
    expect(buildVouchers(entries, { voucherPrefix: "" }).map((v) => v.entryId)).toEqual(["b", "a"]);
  });

  it("collects distinct ledgers case-insensitively with their groups", () => {
    const l = collectLedgers([...entries, { ...base, id: "c", source: { ...base.source, tally_ledger: "loan from secretary" } }]);
    expect(l.map((x) => x.name)).toEqual(["Fooding Expense", "Fuel Expense", "Loan from Secretary"]);
  });

  it("passes a clean export and totals correctly", () => {
    const v = buildVouchers(entries, { voucherPrefix: "" });
    const c = checkExport(v, entries);
    expect(c.ok).toBe(true);
    expect(c.voucherCount).toBe(2);
    expect(c.totalDebit).toBe("550.00");
    expect(c.totalCredit).toBe("550.00");
  });

  it("flags blank ledgers, empty narration, duplicates and conflicting groups", () => {
    const bad: ExportEntry[] = [
      { ...base, id: "x", category: { ...base.category, tally_ledger: " " }, narration: " " },
      { ...base, id: "y", voucher_no: 1, source: { ...base.source, tally_group: "Secured Loans" } },
    ];
    const c = checkExport(buildVouchers(bad, { voucherPrefix: "" }), bad);
    expect(c.ok).toBe(false);
    const text = c.issues.map((i) => i.message).join(" | ");
    expect(text).toMatch(/blank ledger/);
    expect(text).toMatch(/no narration/);
    expect(text).toMatch(/more than once/);
    expect(text).toMatch(/two different groups/);
  });

  it("blocks an empty export", () => {
    expect(checkExport([], []).ok).toBe(false);
  });
});
