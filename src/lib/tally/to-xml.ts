import { plainAmount } from "../format/money";
import { toTallyDate } from "../format/dates";
import { escapeXml, singleLine } from "./escape";
import type { LedgerMaster, TallyEncoding, TallyVoucher } from "./types";

/**
 * Tally Prime XML import files.
 *
 * Two files are produced and imported in this order:
 *   1. ledgers.xml  - creates any missing ledgers (import once; existing ledgers are skipped)
 *   2. vouchers.xml - the vouchers themselves
 *
 * Conventions (same as Tally's own exports): a debit is a NEGATIVE amount with ISDEEMEDPOSITIVE = Yes,
 * a credit is a POSITIVE amount with ISDEEMEDPOSITIVE = No. Dates are YYYYMMDD.
 *
 * IMPORTANT: prove this layout once against a test company in your TallyPrime release before first use
 * (see docs/tally-import-runbook.md).
 */

const HEADER = `<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>`;

function envelope(reportName: string, company: string, messages: string): string {
  const companyVar = company.trim() ? `<SVCURRENTCOMPANY>${escapeXml(company.trim())}</SVCURRENTCOMPANY>` : "";
  return [
    `<ENVELOPE>`,
    ` ${HEADER}`,
    ` <BODY>`,
    `  <IMPORTDATA>`,
    `   <REQUESTDESC>`,
    `    <REPORTNAME>${reportName}</REPORTNAME>`,
    `    <STATICVARIABLES>${companyVar}</STATICVARIABLES>`,
    `   </REQUESTDESC>`,
    `   <REQUESTDATA>`,
    messages,
    `   </REQUESTDATA>`,
    `  </IMPORTDATA>`,
    ` </BODY>`,
    `</ENVELOPE>`,
    ``,
  ].join("\n");
}

function ledgerMessage(l: LedgerMaster): string {
  const name = escapeXml(singleLine(l.name));
  return [
    `    <TALLYMESSAGE xmlns:UDF="TallyUDF">`,
    `     <LEDGER NAME="${name}" ACTION="Create">`,
    `      <NAME.LIST><NAME>${name}</NAME></NAME.LIST>`,
    `      <PARENT>${escapeXml(singleLine(l.parent))}</PARENT>`,
    `     </LEDGER>`,
    `    </TALLYMESSAGE>`,
  ].join("\n");
}

function voucherMessage(v: TallyVoucher): string {
  const date = toTallyDate(v.date);
  const firstDebit = v.lines.find((l) => l.side === "Dr");
  const firstCredit = v.lines.find((l) => l.side === "Cr");
  // Party ledger: the non-cash/bank side. For Payment it is the debit; for Receipt the credit.
  const party = v.type === "Receipt" ? firstCredit : firstDebit;

  const lines = v.lines
    .map((l) =>
      [
        `      <ALLLEDGERENTRIES.LIST>`,
        `       <LEDGERNAME>${escapeXml(singleLine(l.ledger))}</LEDGERNAME>`,
        `       <ISDEEMEDPOSITIVE>${l.side === "Dr" ? "Yes" : "No"}</ISDEEMEDPOSITIVE>`,
        `       <AMOUNT>${l.side === "Dr" ? "-" : ""}${plainAmount(l.paise)}</AMOUNT>`,
        `      </ALLLEDGERENTRIES.LIST>`,
      ].join("\n"),
    )
    .join("\n");

  return [
    `    <TALLYMESSAGE xmlns:UDF="TallyUDF">`,
    `     <VOUCHER REMOTEID="${escapeXml(v.entryId)}" VCHTYPE="${v.type}" ACTION="Create" OBJVIEW="Accounting Voucher View">`,
    `      <DATE>${date}</DATE>`,
    `      <GUID>${escapeXml(v.entryId)}</GUID>`,
    `      <VOUCHERTYPENAME>${v.type}</VOUCHERTYPENAME>`,
    `      <VOUCHERNUMBER>${escapeXml(v.number)}</VOUCHERNUMBER>`,
    party ? `      <PARTYLEDGERNAME>${escapeXml(singleLine(party.ledger))}</PARTYLEDGERNAME>` : "",
    `      <NARRATION>${escapeXml(singleLine(v.narration))}</NARRATION>`,
    `      <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>`,
    `      <EFFECTIVEDATE>${date}</EFFECTIVEDATE>`,
    lines,
    `     </VOUCHER>`,
    `    </TALLYMESSAGE>`,
  ]
    .filter((s) => s !== "")
    .join("\n");
}

export function buildLedgersXml(ledgers: LedgerMaster[], company: string): string {
  return withDeclaration(envelope("All Masters", company, ledgers.map(ledgerMessage).join("\n")), "UTF-8");
}

export function buildVouchersXml(vouchers: TallyVoucher[], company: string): string {
  return withDeclaration(envelope("Vouchers", company, vouchers.map(voucherMessage).join("\n")), "UTF-8");
}

function withDeclaration(body: string, encoding: "UTF-8" | "UTF-16"): string {
  return `<?xml version="1.0" encoding="${encoding}"?>\n${body}`;
}

/** Encodes the XML text as bytes. UTF-16 (little endian with BOM) is the fallback for older Tally releases. */
export function encodeXml(xml: string, encoding: TallyEncoding): Uint8Array {
  if (encoding === "utf-16") {
    const text = xml.replace('encoding="UTF-8"', 'encoding="UTF-16"');
    const out = new Uint8Array(2 + text.length * 2);
    out[0] = 0xff;
    out[1] = 0xfe;
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      out[2 + i * 2] = code & 0xff;
      out[3 + i * 2] = code >> 8;
    }
    return out;
  }
  return new TextEncoder().encode(xml);
}
