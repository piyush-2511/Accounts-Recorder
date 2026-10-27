import { plainAmount } from "../format/money";
import { creditAccount, ledgerPairs } from "./build-vouchers";
import type { ExportEntry, ExportReimbursement, TallyVoucher } from "./types";

export interface ExportIssue {
  entryId: string | null;
  message: string;
}

export interface ExportChecks {
  ok: boolean;
  issues: ExportIssue[];
  voucherCount: number;
  totalDebit: string;
  totalCredit: string;
}

const CONTROL = /[\u0000-\u001f]/;

/** Pre-flight checks shown on the export preview. Any issue blocks Generate. */
export function checkExport(vouchers: TallyVoucher[], entries: ExportEntry[], reimbursements: ExportReimbursement[] = []): ExportChecks {
  const issues: ExportIssue[] = [];
  let debit = 0;
  let credit = 0;
  const numbers = new Map<string, string>();

  for (const v of vouchers) {
    const dr = v.lines.filter((l) => l.side === "Dr").reduce((s, l) => s + l.paise, 0);
    const cr = v.lines.filter((l) => l.side === "Cr").reduce((s, l) => s + l.paise, 0);
    debit += dr;
    credit += cr;

    if (dr !== cr) issues.push({ entryId: v.entryId, message: `Voucher ${v.number} does not balance (Dr ${plainAmount(dr)} vs Cr ${plainAmount(cr)}).` });
    if (dr <= 0) issues.push({ entryId: v.entryId, message: `Voucher ${v.number} has a zero or negative amount.` });
    if (v.lines.some((l) => l.ledger.trim() === "")) issues.push({ entryId: v.entryId, message: `Voucher ${v.number} has a blank ledger name.` });
    if (v.lines.some((l) => CONTROL.test(l.ledger))) issues.push({ entryId: v.entryId, message: `Voucher ${v.number} has an invalid character in a ledger name.` });
    if (v.narration === "") issues.push({ entryId: v.entryId, message: `Voucher ${v.number} has no narration.` });
    if (/undefined|NaN/.test(v.number) || v.number.trim() === "") issues.push({ entryId: v.entryId, message: "A voucher has no number." });

    const key = `${v.type}:${v.number}`;
    const seen = numbers.get(key);
    if (seen) issues.push({ entryId: v.entryId, message: `Voucher number ${v.number} is used more than once.` });
    numbers.set(key, v.entryId);
  }

  // The same ledger name must always sit under the same Tally group.
  const parents = new Map<string, string>();
  for (const { name, parent } of ledgerPairs(entries, reimbursements)) {
    const key = name.trim().toLowerCase();
    const existing = parents.get(key);
    if (existing && existing.toLowerCase() !== parent.trim().toLowerCase()) {
      issues.push({ entryId: null, message: `Ledger "${name}" is configured under two different groups ("${existing}" and "${parent}"). Fix it in Settings.` });
    }
    parents.set(key, parent.trim());
  }

  // One payable ledger must belong to exactly one person, or two people's balances would be mixed in Tally.
  const owners = new Map<string, Set<string>>();
  for (const e of entries) {
    if (e.source.voucher_mode !== "reimbursable" || !e.created_by) continue;
    const key = creditAccount(e).ledger.toLowerCase();
    owners.set(key, (owners.get(key) ?? new Set()).add(e.created_by));
  }
  for (const [ledger, people] of owners) {
    if (people.size > 1) issues.push({ entryId: null, message: `Payable ledger "${ledger}" is shared by ${people.size} people. Give each person a different ledger name in Settings > Users.` });
  }
  for (const e of entries) {
    if (e.source.voucher_mode === "reimbursable" && creditAccount(e).ledger === "") {
      issues.push({ entryId: e.id, message: "A reimbursable expense has no payable ledger name." });
    }
  }

  if (debit !== credit) issues.push({ entryId: null, message: "Total debits do not equal total credits." });
  if (vouchers.length === 0) issues.push({ entryId: null, message: "There are no approved entries or reimbursements in this date range." });

  return { ok: issues.length === 0, issues, voucherCount: vouchers.length, totalDebit: plainAmount(debit), totalCredit: plainAmount(credit) };
}
