export type EntryKind = "expense" | "income";
export type VoucherMode = "payment_receipt" | "journal" | "reimbursable";
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
  /** Who recorded it. Used to make sure two people never share one payable ledger. */
  created_by?: string;
  /** For "reimbursable" sources: the recorder's own payable ledger (snapshotted when the expense was recorded). */
  payable_ledger?: string | null;
  category: { label: string; tally_ledger: string; tally_group: string };
  source: { label: string; tally_ledger: string; tally_group: string; voucher_mode: VoucherMode };
}

/** A recorded reimbursement joined with its payer and the expenses it settles, ready for export. */
export interface ExportReimbursement {
  id: string;
  paid_on: string; // ISO yyyy-mm-dd
  amount: number | string;
  voucher_no: number;
  reference: string | null;
  note: string | null;
  person_id: string;
  person_name: string;
  entry_count: number;
  /** The cash/bank account the money left. */
  source: { label: string; tally_ledger: string; tally_group: string };
  /** One debit per payable ledger being settled (normally exactly one). */
  lines: { ledger: string; group: string; amount: number | string }[];
}

export type ReimbursementVoucherType = "Payment" | "Journal";

export interface VoucherLine {
  ledger: string;
  side: "Dr" | "Cr";
  paise: number;
}

export interface TallyVoucher {
  /** The entry id, or the reimbursement id: becomes the voucher's GUID in Tally. */
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
  reimbursementVoucherType?: ReimbursementVoucherType;
}

export type TallyEncoding = "utf-8" | "utf-16";
