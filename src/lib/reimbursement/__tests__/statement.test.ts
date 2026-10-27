import { describe, expect, it } from "vitest";
import { buildStatement, type StatementEntry, type StatementPayment } from "../statement";

const e = (id: string, date: string, amount: number, status: StatementEntry["status"] = "approved"): StatementEntry => ({
  id, entry_date: date, amount, narration: `Expense ${id}`, status, reimbursement_id: null, category: "Fuel Expenses", review_note: null,
});
const p = (id: string, date: string, amount: number, status: StatementPayment["status"] = "recorded"): StatementPayment => ({
  id, paid_on: date, amount, reference: "UTR1", source: "Bank", status,
});

describe("buildStatement", () => {
  it("keeps a running balance of what is still owed", () => {
    const s = buildStatement([e("a", "2026-10-01", 400), e("b", "2026-10-03", 250.5)], [p("r1", "2026-10-05", 400)]);
    expect(s.rows.map((r) => r.balance)).toEqual([400, 650.5, 250.5]);
    expect(s).toMatchObject({ totalSpent: 650.5, totalPaidBack: 400, owed: 250.5 });
  });

  it("lists pending and rejected expenses without counting them", () => {
    const s = buildStatement([e("a", "2026-10-01", 100), e("b", "2026-10-02", 70, "pending"), e("c", "2026-10-02", 30, "rejected")], []);
    expect(s.owed).toBe(100);
    expect(s.pending).toBe(70);
    expect(s.rejected).toBe(30);
    expect(s.rows.find((r) => r.entryId === "b")?.balance).toBeNull();
  });

  it("ignores voided reimbursements", () => {
    const s = buildStatement([e("a", "2026-10-01", 500)], [p("r1", "2026-10-02", 500, "voided")]);
    expect(s.owed).toBe(500);
    expect(s.rows).toHaveLength(1);
  });

  it("puts expenses before payments on the same day and avoids float drift", () => {
    const s = buildStatement([e("a", "2026-10-02", 0.1), e("b", "2026-10-02", 0.2)], [p("r", "2026-10-02", 0.3)]);
    expect(s.rows.map((r) => r.type)).toEqual(["spent", "spent", "paid"]);
    expect(s.owed).toBe(0);
    expect(s.rows[2]!.balance).toBe(0);
  });
});
