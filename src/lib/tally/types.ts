export type EntryKind = "expense" | "income";
export type VoucherMode = "payment_receipt" | "journal";
export type VoucherType = "Payment" | "Receipt" | "Journal";

/** An approved entry joined with its category and payment source, ready for export. */
export interface ExportEntry {
  id: string;
  entry_date: string; // ISO yyyy-mm-dd
  kind: EntryKind;
  amount: number | string;
  narration: string;
  party?: string | null;
  programme?: string | null;
  voucher_no: number;
  category: { label: string; tally_ledger: string; tally_group: string };
  source: { label: string; tally_ledger: string; tally_group: string; voucher_mode: VoucherMode };
}

export interface VoucherLine {
  ledger: string;
  side: "Dr" | "Cr";
  paise: number;
}

export interface TallyVoucher {
  entryId: string;
  date: string; // ISO
  type: VoucherType;
  number: string; // prefix + voucher_no
  narration: string;
  lines: VoucherLine[]; // debit line(s) first
}

export interface LedgerMaster {
  name: string;
  parent: string;
}

export interface ExportSettings {
  companyName: string;
  voucherPrefix: string;
}

export type TallyEncoding = "utf-8" | "utf-16";
