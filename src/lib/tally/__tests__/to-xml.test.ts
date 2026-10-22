import { XMLParser } from "fast-xml-parser";
import { describe, expect, it } from "vitest";
import { escapeXml } from "../escape";
import { buildVoucher } from "../build-vouchers";
import { buildLedgersXml, buildVouchersXml, encodeXml } from "../to-xml";
import type { ExportEntry } from "../types";

const entry: ExportEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  entry_date: "2026-04-01",
  kind: "expense",
  amount: 300,
  narration: "Being Fuel Expense paid to Piyush for program activity",
  voucher_no: 1,
  category: { label: "Fuel", tally_ledger: "Fuel Expense", tally_group: "Indirect Expenses" },
  source: { label: "Loan from Secretary", tally_ledger: "Loan from Secretary", tally_group: "Unsecured Loans", voucher_mode: "journal" },
};
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false });

describe("vouchers XML", () => {
  const xml = buildVouchersXml([buildVoucher(entry, { voucherPrefix: "" })], "My Org & Co");
  const doc = parser.parse(xml);
  const voucher = doc.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE.VOUCHER;

  it("is well-formed with the Tally import envelope", () => {
    expect(doc.ENVELOPE.HEADER.TALLYREQUEST).toBe("Import Data");
    expect(doc.ENVELOPE.BODY.IMPORTDATA.REQUESTDESC.REPORTNAME).toBe("Vouchers");
    expect(doc.ENVELOPE.BODY.IMPORTDATA.REQUESTDESC.STATICVARIABLES.SVCURRENTCOMPANY).toBe("My Org & Co");
  });

  it("writes the Journal voucher from the sample file", () => {
    expect(voucher["@_VCHTYPE"]).toBe("Journal");
    expect(voucher["@_ACTION"]).toBe("Create");
    expect(voucher.DATE).toBe("20260401");
    expect(voucher.VOUCHERNUMBER).toBe("1");
    expect(voucher.NARRATION).toBe("Being Fuel Expense paid to Piyush for program activity");
    expect(voucher.GUID).toBe(entry.id);
  });

  it("debit is negative with ISDEEMEDPOSITIVE Yes; credit positive with No", () => {
    const [dr, cr] = voucher["ALLLEDGERENTRIES.LIST"];
    expect(dr).toMatchObject({ LEDGERNAME: "Fuel Expense", ISDEEMEDPOSITIVE: "Yes", AMOUNT: "-300.00" });
    expect(cr).toMatchObject({ LEDGERNAME: "Loan from Secretary", ISDEEMEDPOSITIVE: "No", AMOUNT: "300.00" });
  });

  it("escapes special characters and strips illegal control characters in narration", () => {
    const tricky = buildVoucher({ ...entry, narration: `Tea & snacks <for> "staff" it's\u0001 ok\nnext line` }, { voucherPrefix: "" });
    const out = parser.parse(buildVouchersXml([tricky], "Org"));
    const n = out.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE.VOUCHER.NARRATION;
    expect(n).toBe(`Tea & snacks <for> "staff" it's ok next line`);
  });
});

describe("ledgers XML", () => {
  it("creates each ledger under its group", () => {
    const xml = buildLedgersXml([{ name: "Fuel Expense", parent: "Indirect Expenses" }, { name: "Cash", parent: "Cash-in-Hand" }], "Org");
    const doc = parser.parse(xml);
    expect(doc.ENVELOPE.BODY.IMPORTDATA.REQUESTDESC.REPORTNAME).toBe("All Masters");
    const messages = doc.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE;
    expect(messages).toHaveLength(2);
    expect(messages[0].LEDGER).toMatchObject({ "@_NAME": "Fuel Expense", PARENT: "Indirect Expenses" });
  });

  it("omits the company variable when no company is set", () => {
    expect(buildLedgersXml([], "")).not.toContain("SVCURRENTCOMPANY>");
  });
});

describe("escapeXml / encodeXml", () => {
  it("escapes the five XML entities", () => {
    expect(escapeXml(`<a href="x">Tom & 'Jerry'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; &apos;Jerry&apos;&lt;/a&gt;");
  });
  it("removes lone surrogates", () => {
    expect(escapeXml("ok\uD800bad")).toBe("okbad");
  });
  it("encodes UTF-16 with a BOM and the matching declaration", () => {
    const bytes = encodeXml(`<?xml version="1.0" encoding="UTF-8"?><A>é</A>`, "utf-16");
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xfe]);
    const text = new TextDecoder("utf-16le").decode(bytes.subarray(2));
    expect(text).toContain('encoding="UTF-16"');
    expect(text).toContain("<A>é</A>");
  });
  it("keeps Hindi text intact in UTF-8", () => {
    const x = buildVouchersXml([buildVoucher({ ...entry, narration: "ईंधन खर्च - कार्यक्रम" }, { voucherPrefix: "" })], "संस्था");
    expect(new TextDecoder().decode(encodeXml(x, "utf-8"))).toContain("ईंधन खर्च - कार्यक्रम");
  });
});
