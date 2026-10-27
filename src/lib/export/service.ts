import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExportEntry, ExportReimbursement } from "@/lib/tally/types";

const SELECT =
  "id, entry_date, kind, amount, narration, party, programme, voucher_no, voucher_fy, created_at, created_by, payable_ledger, " +
  "category:categories(label,tally_ledger,tally_group), source:payment_sources(label,tally_ledger,tally_group,voucher_mode)";

interface Row extends Omit<ExportEntry, "voucher_no"> {
  voucher_no: number | null;
  voucher_fy: number;
  created_at: string;
}

export interface ExportPreview {
  entries: ExportEntry[];
  /** Entry ids whose voucher number is only provisional (assigned for real when generating). */
  provisional: Set<string>;
}

/** Approved, non-deleted entries in a date range, with voucher numbers (provisional where not yet assigned). */
export async function loadApprovedForExport(
  supabase: SupabaseClient,
  from: string,
  to: string,
  startNumber: number,
): Promise<ExportPreview> {
  const { data, error } = await supabase
    .from("entries")
    .select(SELECT)
    .eq("status", "approved")
    .is("deleted_at", null)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date")
    .order("created_at")
    .order("id");
  if (error) throw new Error(`Could not load entries to export: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];

  // Mirror the database numbering for entries that do not have a number yet.
  const next = new Map<number, number>();
  for (const fy of new Set(rows.filter((r) => r.voucher_no === null).map((r) => r.voucher_fy))) {
    const { data: top } = await supabase.from("entries").select("voucher_no").eq("voucher_fy", fy).not("voucher_no", "is", null).order("voucher_no", { ascending: false }).limit(1);
    next.set(fy, ((top?.[0]?.voucher_no as number | undefined) ?? startNumber - 1) + 1);
  }

  const provisional = new Set<string>();
  const entries: ExportEntry[] = rows.map((r) => {
    let no = r.voucher_no;
    if (no === null) {
      no = next.get(r.voucher_fy) ?? startNumber;
      next.set(r.voucher_fy, no + 1);
      provisional.add(r.id);
    }
    return { ...r, voucher_no: no };
  });
  return { entries, provisional };
}

// ---- Reimbursements --------------------------------------------------------------------------------


const R_SELECT =
  "id, paid_on, amount, voucher_no, voucher_fy, reference, note, person_id, entry_count, created_at, " +
  "person:profiles!reimbursements_person_id_fkey(full_name), source:payment_sources(label,tally_ledger,tally_group), " +
  "entries(amount, payable_ledger, source:payment_sources(tally_group))";

interface RRow {
  id: string; paid_on: string; amount: number; voucher_no: number | null; voucher_fy: number; reference: string | null; note: string | null;
  person_id: string; entry_count: number; created_at: string;
  person: { full_name: string } | null;
  source: { label: string; tally_ledger: string; tally_group: string };
  entries: { amount: number; payable_ledger: string | null; source: { tally_group: string } | null }[];
}

export interface ReimbursementPreview {
  reimbursements: ExportReimbursement[];
  provisional: Set<string>;
}

/** Recorded (not yet exported) reimbursements paid in a date range, with numbers (provisional where not yet assigned). */
export async function loadRecordedReimbursements(supabase: SupabaseClient, from: string, to: string): Promise<ReimbursementPreview> {
  const { data, error } = await supabase
    .from("reimbursements")
    .select(R_SELECT)
    .eq("status", "recorded")
    .gte("paid_on", from)
    .lte("paid_on", to)
    .order("paid_on")
    .order("created_at")
    .order("id");
  if (error) throw new Error(`Could not load reimbursements to export: ${error.message}`);
  const rows = (data ?? []) as unknown as RRow[];

  const next = new Map<number, number>();
  for (const fy of new Set(rows.filter((r) => r.voucher_no === null).map((r) => r.voucher_fy))) {
    const { data: top } = await supabase.from("reimbursements").select("voucher_no").eq("voucher_fy", fy).not("voucher_no", "is", null).order("voucher_no", { ascending: false }).limit(1);
    next.set(fy, ((top?.[0]?.voucher_no as number | undefined) ?? 0) + 1);
  }

  const provisional = new Set<string>();
  const reimbursements: ExportReimbursement[] = rows.map((r) => {
    let no = r.voucher_no;
    if (no === null) {
      no = next.get(r.voucher_fy) ?? 1;
      next.set(r.voucher_fy, no + 1);
      provisional.add(r.id);
    }
    // One debit line per payable ledger (a person's ledger name is normally constant, but may differ if it was changed).
    const byLedger = new Map<string, { ledger: string; group: string; paise: number }>();
    for (const e of r.entries) {
      const ledger = (e.payable_ledger ?? "").trim();
      const key = ledger.toLowerCase();
      const cur = byLedger.get(key) ?? { ledger, group: e.source?.tally_group ?? "", paise: 0 };
      cur.paise += Math.round(Number(e.amount) * 100);
      byLedger.set(key, cur);
    }
    return {
      id: r.id, paid_on: r.paid_on, amount: r.amount, voucher_no: no, reference: r.reference, note: r.note,
      person_id: r.person_id, person_name: r.person?.full_name ?? "Unknown", entry_count: r.entry_count,
      source: r.source,
      lines: [...byLedger.values()].map((l) => ({ ledger: l.ledger, group: l.group, amount: l.paise / 100 })),
    };
  });
  return { reimbursements, provisional };
}
