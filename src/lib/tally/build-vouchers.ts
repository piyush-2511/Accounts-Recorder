import { toPaise } from "../format/money";
import type {
  ExportEntry, ExportReimbursement, ExportSettings, LedgerMaster, TallyVoucher, VoucherType,
} from "./types";

/**
 * The account on the "money side" of an entry. Normally the payment source's ledger; for
 * "Paid by me (reimburse later)" it is the recorder's own payable ledger instead.
 */
export function creditAccount(entry: Pick<ExportEntry, "source" | "payable_ledger">): { ledger: string; group: string } {
  if (entry.source.voucher_mode === "reimbursable") {
    return { ledger: (entry.payable_ledger ?? "").trim(), group: entry.source.tally_group.trim() };
  }
  return { ledger: entry.source.tally_ledger.trim(), group: entry.source.tally_group.trim() };
}

/**
 * Maps one entry to a balanced Tally voucher.
 *
 *   Expense, cash/bank source        -> Payment : Dr category ledger / Cr source ledger
 *   Income,  cash/bank source        -> Receipt : Dr source ledger  / Cr category ledger
 *   Any entry, journal source        -> Journal : expense = Dr category / Cr source, income = Dr source / Cr category
 *   Expense paid personally by staff -> Journal : Dr category ledger / Cr that person's payable ledger
 *
 * Pure function: no database or framework code, so it is exhaustively unit-tested.
 */
export function buildVoucher(entry: ExportEntry, settings: Pick<ExportSettings, "voucherPrefix">): TallyVoucher {
  const paise = toPaise(entry.amount);
  const category = entry.category.tally_ledger.trim();
  const source = creditAccount(entry).ledger;

  const type: VoucherType =
    entry.source.voucher_mode === "payment_receipt" ? (entry.kind === "expense" ? "Payment" : "Receipt") : "Journal";

  const [debit, credit] = entry.kind === "expense" ? [category, source] : [source, category];

  return {
    entryId: entry.id,
    date: entry.entry_date,
    type,
    number: `${settings.voucherPrefix}${entry.voucher_no}`,
    narration: entry.narration.trim(),
    lines: [
      { ledger: debit, side: "Dr", paise },
      { ledger: credit, side: "Cr", paise },
    ],
  };
}

/** Builds vouchers ordered by date, then voucher number. */
export function buildVouchers(entries: ExportEntry[], settings: Pick<ExportSettings, "voucherPrefix">): TallyVoucher[] {
  return [...entries]
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.voucher_no - b.voucher_no)
    .map((e) => buildVoucher(e, settings));
}

/** Reimbursement vouchers have their own numbering series, shown in Tally as R-1, R-2 ... */
export const reimbursementNumber = (prefix: string, no: number) => `${prefix}R-${no}`;

export function reimbursementNarration(r: Pick<ExportReimbursement, "person_name" | "entry_count" | "reference" | "note">): string {
  const base = `Being reimbursement paid to ${r.person_name.trim()} for ${r.entry_count} ${r.entry_count === 1 ? "expense" : "expenses"}`;
  const ref = r.reference?.trim() ? ` (Ref ${r.reference.trim()})` : "";
  const note = r.note?.trim() ? `. ${r.note.trim()}` : "";
  return `${base}${ref}${note}`.slice(0, 300);
}

/**
 * A reimbursement settles the person's payable:  Dr payable ledger(s) / Cr cash or bank.
 * Voucher type is Payment by default (Tally does not allow cash/bank ledgers in a Journal), or Journal if configured.
 */
export function buildReimbursementVoucher(r: ExportReimbursement, settings: Pick<ExportSettings, "voucherPrefix" | "reimbursementVoucherType">): TallyVoucher {
  const total = toPaise(r.amount);
  return {
    entryId: r.id,
    date: r.paid_on,
    type: settings.reimbursementVoucherType === "Journal" ? "Journal" : "Payment",
    number: reimbursementNumber(settings.voucherPrefix, r.voucher_no),
    narration: reimbursementNarration(r),
    lines: [
      ...r.lines.map((l) => ({ ledger: l.ledger.trim(), side: "Dr" as const, paise: toPaise(l.amount) })),
      { ledger: r.source.tally_ledger.trim(), side: "Cr" as const, paise: total },
    ],
  };
}

export function buildReimbursementVouchers(rs: ExportReimbursement[], settings: Pick<ExportSettings, "voucherPrefix" | "reimbursementVoucherType">): TallyVoucher[] {
  return [...rs]
    .sort((a, b) => a.paid_on.localeCompare(b.paid_on) || a.voucher_no - b.voucher_no)
    .map((r) => buildReimbursementVoucher(r, settings));
}

/** Every (ledger, Tally group) pair the export touches, in one place for both the ledger file and the checks. */
export function ledgerPairs(entries: ExportEntry[], reimbursements: ExportReimbursement[] = []): { name: string; parent: string }[] {
  const out: { name: string; parent: string }[] = [];
  for (const e of entries) {
    out.push({ name: e.category.tally_ledger, parent: e.category.tally_group });
    const c = creditAccount(e);
    out.push({ name: c.ledger, parent: c.group });
  }
  for (const r of reimbursements) {
    out.push({ name: r.source.tally_ledger, parent: r.source.tally_group });
    for (const l of r.lines) out.push({ name: l.ledger, parent: l.group });
  }
  return out;
}

/** The distinct ledgers the vouchers touch, with the Tally group each should be created under. */
export function collectLedgers(entries: ExportEntry[], reimbursements: ExportReimbursement[] = []): LedgerMaster[] {
  const byName = new Map<string, LedgerMaster>();
  for (const { name, parent } of ledgerPairs(entries, reimbursements)) {
    const key = name.trim().toLowerCase(); // Tally ledger names are case-insensitive
    if (key !== "" && !byName.has(key)) byName.set(key, { name: name.trim(), parent: parent.trim() });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
