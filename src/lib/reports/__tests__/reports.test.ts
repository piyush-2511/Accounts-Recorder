import { describe, expect, it } from "vitest";
import { budgetState, budgetUsedPct, forecastMonth, forecastYear, suggestBudget } from "../forecast";
import { toCsv } from "../csv";

describe("budget helpers", () => {
  it("suggests the trailing average rounded up to 100", () => {
    expect(suggestBudget(2310.5)).toBe(2400);
    expect(suggestBudget(2300)).toBe(2300);
    expect(suggestBudget(0)).toBe(0);
    expect(suggestBudget(Number.NaN)).toBe(0);
  });
  it("classifies usage: ok under 80%, warning from 80%, over above 100%", () => {
    expect(budgetState(null, 500)).toBe("none");
    expect(budgetState(0, 500)).toBe("none");
    expect(budgetState(1000, 799)).toBe("ok");
    expect(budgetState(1000, 800)).toBe("warning");
    expect(budgetState(1000, 1000)).toBe("warning");
    expect(budgetState(1000, 1001)).toBe("over");
    expect(budgetUsedPct(1000, 250)).toBe(25);
  });
});

describe("forecasts", () => {
  it("projects a month from the run rate", () => {
    // 10 days elapsed in a 30-day month, 1000 spent -> 3000
    expect(forecastMonth(1000, "2026-09-01", "2026-09-10")).toBeCloseTo(3000);
  });
  it("returns the actual once the month is over and 0 before it starts", () => {
    expect(forecastMonth(1234, "2026-09-01", "2026-10-05")).toBe(1234);
    expect(forecastMonth(0, "2026-09-01", "2026-08-31")).toBe(0);
  });
  it("projects the year from completed months", () => {
    expect(forecastYear([100, 200, 300], 9)).toBe(600 + 200 * 9);
    expect(forecastYear([], 12)).toBe(0);
  });
});

describe("toCsv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv([["a,b", 'say "hi"', "x\ny", 5, null]])).toBe('"a,b","say ""hi""","x\ny",5,\r\n');
  });
  it("neutralises spreadsheet formula injection", () => {
    expect(toCsv([["=HYPERLINK(\"http://evil\")", "+1", "-1", "@SUM(A1)", "safe"]])).toBe(
      `"'=HYPERLINK(""http://evil"")",'+1,'-1,'@SUM(A1),safe\r\n`,
    );
  });
});
