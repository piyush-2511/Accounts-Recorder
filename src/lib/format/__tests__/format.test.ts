import { describe, expect, it } from "vitest";
import { addDays, addMonths, formatDMY, isValidISODate, monthEnd, monthStart, todayIST, toTallyDate } from "../dates";
import { fyLabel, fyRange, fyStartYear, minEntryDate } from "../financial-year";
import { formatINR, formatNumberIN, plainAmount, toPaise } from "../money";

describe("money", () => {
  it("formats with Indian digit grouping", () => {
    expect(formatNumberIN(125000)).toBe("1,25,000.00");
    expect(formatINR(1234567.5)).toContain("12,34,567.50");
    expect(formatINR(null)).toContain("0.00");
  });
  it("converts to paise and back to plain strings", () => {
    expect(toPaise("1250.50")).toBe(125050);
    expect(toPaise(19.99)).toBe(1999);
    expect(plainAmount(30000)).toBe("300.00");
    expect(plainAmount(5)).toBe("0.05");
    expect(() => toPaise("abc")).toThrow();
  });
});

describe("dates", () => {
  it("validates ISO dates", () => {
    expect(isValidISODate("2026-02-28")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("26-02-28")).toBe(false);
  });
  it("formats for the sheet and for Tally", () => {
    expect(formatDMY("2026-04-01")).toBe("01-04-2026");
    expect(toTallyDate("2026-04-01")).toBe("20260401");
  });
  it("does date arithmetic without time zone drift", () => {
    expect(addDays("2026-03-31", 1)).toBe("2026-04-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-01");
    expect(monthStart("2026-10-21")).toBe("2026-10-01");
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
  });
  it("computes today in India time, not UTC", () => {
    // 20:00 UTC on 31 Mar is already 1:30 on 1 Apr in India
    expect(todayIST(new Date("2026-03-31T20:00:00Z"))).toBe("2026-04-01");
    expect(todayIST(new Date("2026-03-31T10:00:00Z"))).toBe("2026-03-31");
  });
});

describe("financial year", () => {
  it("runs April to March", () => {
    expect(fyStartYear("2026-04-01")).toBe(2026);
    expect(fyStartYear("2027-03-31")).toBe(2026);
    expect(fyStartYear("2026-03-31")).toBe(2025);
    expect(fyRange(2026)).toEqual({ from: "2026-04-01", to: "2027-03-31" });
    expect(fyLabel(2026)).toBe("2026-27");
    expect(fyLabel(2099)).toBe("2099-00");
  });
  it("allows 31 days of grace across the year boundary", () => {
    expect(minEntryDate("2026-04-05")).toBe("2026-03-05");
    expect(minEntryDate("2026-10-21")).toBe("2026-04-01");
  });
});
