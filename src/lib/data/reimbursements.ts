import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Reimbursement } from "@/types/db";

export interface OwedPerson {
  person_id: string;
  full_name: string;
  email: string;
  owed_count: number;
  owed_total: number;
  oldest: string | null;
  awaiting_count: number;
  awaiting_total: number;
}

export interface OwedEntry {
  id: string;
  entry_date: string;
  amount: number;
  narration: string;
  party: string | null;
  status: "pending" | "approved" | "exported";
  receipt_path: string | null;
  category: { label: string } | null;
}

const n = (v: unknown) => Number(v ?? 0);

/** Admin: everyone with money owed (approved) or waiting for approval. */
export async function getOwedPeople(supabase: SupabaseClient): Promise<OwedPerson[]> {
  const { data, error } = await supabase.rpc("reimbursement_summary");
  if (error) throw new Error(`Could not load reimbursements: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    person_id: String(r.person_id), full_name: String(r.full_name), email: String(r.email),
    owed_count: n(r.owed_count), owed_total: n(r.owed_total), oldest: (r.oldest as string | null) ?? null,
    awaiting_count: n(r.awaiting_count), awaiting_total: n(r.awaiting_total),
  }));
}

/** Expenses a person paid personally that are not reimbursed yet. RLS limits recorders to their own. */
export async function getUnreimbursed(supabase: SupabaseClient, personId: string, status: "approved" | "pending"): Promise<OwedEntry[]> {
  let q = supabase
    .from("entries")
    .select("id, entry_date, amount, narration, party, status, receipt_path, category:categories(label), source:payment_sources!inner(voucher_mode)")
    .eq("created_by", personId)
    .eq("kind", "expense")
    .eq("source.voucher_mode", "reimbursable")
    .is("reimbursement_id", null)
    .is("deleted_at", null)
    .order("entry_date")
    .order("created_at");
  q = status === "approved" ? q.in("status", ["approved", "exported"]) : q.eq("status", "pending");
  const { data, error } = await q;
  if (error) throw new Error(`Could not load expenses: ${error.message}`);
  return ((data ?? []) as unknown as OwedEntry[]).map((e) => ({ ...e, amount: n(e.amount) }));
}

export interface ReimbursementRow extends Reimbursement {
  person: { full_name: string } | null;
  source: { label: string } | null;
}

const R_COLUMNS = "*, person:profiles!reimbursements_person_id_fkey(full_name), source:payment_sources(label)";

export async function listReimbursements(
  supabase: SupabaseClient,
  opts: { personId?: string; status?: string; limit?: number } = {},
): Promise<ReimbursementRow[]> {
  let q = supabase.from("reimbursements").select(R_COLUMNS).order("paid_on", { ascending: false }).order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.personId) q = q.eq("person_id", opts.personId);
  if (opts.status && ["recorded", "exported", "voided"].includes(opts.status)) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw new Error(`Could not load reimbursements: ${error.message}`);
  return ((data ?? []) as unknown as ReimbursementRow[]).map((r) => ({ ...r, amount: n(r.amount) }));
}

export async function getReimbursement(supabase: SupabaseClient, id: string): Promise<{ row: ReimbursementRow; entries: OwedEntry[] } | null> {
  const { data } = await supabase.from("reimbursements").select(R_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: entries } = await supabase
    .from("entries")
    .select("id, entry_date, amount, narration, party, status, receipt_path, category:categories(label)")
    .eq("reimbursement_id", id)
    .order("entry_date");
  const row = data as unknown as ReimbursementRow;
  return { row: { ...row, amount: n(row.amount) }, entries: ((entries ?? []) as unknown as OwedEntry[]).map((e) => ({ ...e, amount: n(e.amount) })) };
}
