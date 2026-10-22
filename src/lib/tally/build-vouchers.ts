import { toPaise } from "../format/money";
import type { ExportEntry, ExportSettings, LedgerMaster, TallyVoucher, VoucherType } from "./types";

/**
 * Maps one entry to a balanced Tally voucher.
 *
 *   Expense, cash/bank source  -> Payment : Dr category ledger / Cr source ledger
 *   Income,  cash/bank source  -> Receipt : Dr source ledger  / Cr category ledger
 *   Any entry, journal source  -> Journal : expense = Dr category / Cr source, income = Dr source / Cr category
 *
 * Pure function: no database or framework code, so it is exhaustively unit-tested.
 */
export function buildVoucher(entry: ExportEntry, settings: Pick<ExportSettings, "voucherPrefix">): TallyVoucher {
  const paise = toPaise(entry.amount);
  const category = entry.category.tally_ledger.trim();
  const source = entry.source.tally_ledger.trim();

  const type: VoucherType =
    entry.source.voucher_mode === "journal" ? "Journal" : entry.kind === "expense" ? "Payment" : "Receipt";

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

/** The distinct ledgers the vouchers touch, with the Tally group each should be created under. */
export function collectLedgers(entries: ExportEntry[]): LedgerMaster[] {
  const byName = new Map<string, LedgerMaster>();
  const add = (name: string, parent: string) => {
    const key = name.trim().toLowerCase(); // Tally ledger names are case-insensitive
    if (!byName.has(key)) byName.set(key, { name: name.trim(), parent: parent.trim() });
  };
  for (const e of entries) {
    add(e.category.tally_ledger, e.category.tally_group);
    add(e.source.tally_ledger, e.source.tally_group);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
