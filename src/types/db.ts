import type { EntryKind, EntryStatus } from "@/lib/constants/entry-status";
import type { Role } from "@/lib/constants/roles";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  reimbursement_ledger: string | null;
  created_at: string;
  deleted_at: string | null;
  /** Controls for recorders (admins are never restricted). Null lists mean "everything allowed". */
  can_record: boolean;
  can_record_income: boolean;
  allowed_source_ids: number[] | null;
  allowed_category_ids: number[] | null;
  max_entry_amount: number | null;
}

export interface Category {
  id: number;
  label: string;
  kind: EntryKind;
  tally_ledger: string;
  tally_group: string;
  sort_order: number;
  is_active: boolean;
}

export interface PaymentSource {
  id: number;
  label: string;
  tally_ledger: string;
  tally_group: string;
  voucher_mode: "payment_receipt" | "journal" | "reimbursable";
  sort_order: number;
  is_active: boolean;
}

export interface EntryRow {
  id: string;
  entry_date: string;
  kind: EntryKind;
  category_id: number;
  source_id: number;
  amount: number;
  party: string | null;
  programme: string | null;
  narration: string;
  receipt_path: string | null;
  receipt_size: number | null;
  receipt_mime: string | null;
  status: EntryStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  batch_id: string | null;
  voucher_no: number | null;
  voucher_fy: number;
  payable_ledger: string | null;
  reimbursement_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EntryWithRefs extends EntryRow {
  category: { label: string; kind: EntryKind } | null;
  source: { label: string } | null;
  creator: { full_name: string } | null;
}

export interface ExportBatch {
  id: string;
  created_by: string;
  created_at: string;
  date_from: string;
  date_to: string;
  entry_count: number;
  reimbursement_count: number;
  total_amount: number;
  ledgers_path: string;
  xml_path: string;
  xlsx_path: string;
  unlocked_at: string | null;
  unlocked_by: string | null;
}

export interface AuditRow {
  id: number;
  at: string;
  actor: string | null;
  table_name: string;
  row_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}

export interface AppSettings {
  companyName: string;
  voucherPrefix: string;
  voucherStartNumber: number;
  voucherRequiredAbove: number | null;
  maxAmount: number;
  tallyEncoding: "utf-8" | "utf-16";
  reimbursementVoucherType: "Payment" | "Journal";
}

export interface Reimbursement {
  id: string;
  person_id: string;
  source_id: number;
  paid_on: string;
  amount: number;
  entry_count: number;
  reference: string | null;
  note: string | null;
  status: "recorded" | "exported" | "voided";
  batch_id: string | null;
  voucher_no: number | null;
  created_by: string;
  created_at: string;
  voided_at: string | null;
  void_reason: string | null;
}

export interface FlagRow {
  entry_id: string;
  possible_duplicate: boolean;
  no_voucher: boolean;
  high_amount: boolean;
}
