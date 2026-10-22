import { describe, expect, it } from "vitest";
import { buildEntrySchema, defaultNarration } from "../entry";
import { fieldErrors } from "../common";
import { reviewSchema } from "../review";
import { generalSettingsSchema } from "../settings";

const schema = buildEntrySchema({ today: "2026-10-21", minDate: "2026-04-01", maxAmount: 1_000_000 });
const valid = { kind: "expense", entry_date: "2026-10-20", category_id: "1", source_id: "3", amount: "300", party: " Piyush ", programme: "", narration: "Being Fuel Expense paid to Piyush" };

describe("entry schema", () => {
  it("accepts a valid form post and normalises optional text", () => {
    const r = schema.parse(valid);
    expect(r.amount).toBe(300);
    expect(r.category_id).toBe(1);
    expect(r.party).toBe("Piyush");
    expect(r.programme).toBeNull();
  });

  it.each([
    ["future date", { entry_date: "2026-10-22" }, "entry_date"],
    ["date before the allowed period", { entry_date: "2026-03-01" }, "entry_date"],
    ["impossible date", { entry_date: "2026-02-31" }, "entry_date"],
    ["zero amount", { amount: "0" }, "amount"],
    ["negative amount", { amount: "-5" }, "amount"],
    ["three decimals", { amount: "10.005" }, "amount"],
    ["over the limit", { amount: "1000000.01" }, "amount"],
    ["non-numeric amount", { amount: "abc" }, "amount"],
    ["missing category", { category_id: "" }, "category_id"],
    ["short narration", { narration: "ab" }, "narration"],
    ["bad kind", { kind: "refund" }, "kind"],
  ])("rejects %s", (_name, patch, field) => {
    const r = schema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    if (!r.success) expect(Object.keys(fieldErrors(r.error))).toContain(field);
  });

  it("allows any amount when no limit is set", () => {
    const s = buildEntrySchema({ today: "2026-10-21", minDate: "2026-04-01", maxAmount: null });
    expect(s.safeParse({ ...valid, amount: "99999999" }).success).toBe(true);
  });
});

describe("defaultNarration", () => {
  it("matches the sample style", () => {
    expect(defaultNarration({ kind: "expense", categoryLabel: "Fuel", party: "Piyush", programme: "program activity" })).toBe(
      "Being Fuel expense paid to Piyush for program activity",
    );
  });
  it("handles income and missing parts", () => {
    expect(defaultNarration({ kind: "income", categoryLabel: "Donation", party: "A. Donor" })).toBe("Being Donation income received from A. Donor");
    expect(defaultNarration({ kind: "expense", categoryLabel: "Staff" })).toBe("Being Staff expense");
  });
});

describe("review and settings schemas", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  it("requires a 5+ character note to reject", () => {
    expect(reviewSchema.safeParse({ entry_id: id, decision: "reject", note: "bad" }).success).toBe(false);
    expect(reviewSchema.safeParse({ entry_id: id, decision: "reject", note: "Blurry voucher" }).success).toBe(true);
    expect(reviewSchema.safeParse({ entry_id: id, decision: "approve" }).success).toBe(true);
  });
  it("parses the voucher-required limit (blank = none)", () => {
    const base = { company_name: "Org", voucher_prefix: "", voucher_start_number: "1", max_amount: "100000", tally_encoding: "utf-8" };
    expect(generalSettingsSchema.parse({ ...base, voucher_required_above: "" }).voucher_required_above).toBeNull();
    expect(generalSettingsSchema.parse({ ...base, voucher_required_above: "1000" }).voucher_required_above).toBe(1000);
    expect(generalSettingsSchema.safeParse({ ...base, voucher_required_above: "-1" }).success).toBe(false);
    expect(generalSettingsSchema.safeParse({ ...base, voucher_required_above: "", voucher_prefix: "A B" }).success).toBe(false);
  });
});
