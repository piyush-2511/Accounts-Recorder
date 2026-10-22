import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntryStatus } from "@/lib/constants/entry-status";
import type { EntryWithRefs, FlagRow } from "@/types/db";

export const ENTRY_SELECT =
  "*, category:categories(label,kind), source:payment_sources(label), creator:profiles!entries_created_by_fkey(full_name)";

export const PAGE_SIZE = 25;

export interface EntryFilters {
  status?: EntryStatus | "all";
  recorder?: string;
  category?: number;
  from?: string;
  to?: string;
  min?: number;
  max?: number;
  noVoucher?: boolean;
  q?: string;
  createdBy?: string;
}

export async function listEntries(
  supabase: SupabaseClient,
  filters: EntryFilters,
  opts: { page?: number; pageSize?: number; oldestFirst?: boolean } = {},
): Promise<{ rows: EntryWithRefs[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const size = opts.pageSize ?? PAGE_SIZE;
  let q = supabase.from("entries").select(ENTRY_SELECT, { count: "exact" }).is("deleted_at", null);

  if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
  if (filters.recorder) q = q.eq("created_by", filters.recorder);
  if (filters.createdBy) q = q.eq("created_by", filters.createdBy);
  if (filters.category) q = q.eq("category_id", filters.category);
  if (filters.from) q = q.gte("entry_date", filters.from);
  if (filters.to) q = q.lte("entry_date", filters.to);
  if (filters.min !== undefined) q = q.gte("amount", filters.min);
  if (filters.max !== undefined) q = q.lte("amount", filters.max);
  if (filters.noVoucher) q = q.is("receipt_path", null);
  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, " ").trim();
    if (term) q = q.or(`narration.ilike.%${term}%,party.ilike.%${term}%,programme.ilike.%${term}%`);
  }

  q = opts.oldestFirst
    ? q.order("created_at", { ascending: true })
    : q.order("entry_date", { ascending: false }).order("created_at", { ascending: false });

  const { data, error, count } = await q.range((page - 1) * size, page * size - 1);
  if (error) throw new Error(`Could not load entries: ${error.message}`);
  return { rows: (data ?? []) as unknown as EntryWithRefs[], total: count ?? 0 };
}

export async function getEntry(supabase: SupabaseClient, id: string): Promise<EntryWithRefs | null> {
  const { data, error } = await supabase.from("entries").select(ENTRY_SELECT).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new Error(`Could not load the entry: ${error.message}`);
  return (data as unknown as EntryWithRefs) ?? null;
}

export async function getFlags(supabase: SupabaseClient, ids: string[]): Promise<Map<string, FlagRow>> {
  const map = new Map<string, FlagRow>();
  if (ids.length === 0) return map;
  const { data } = await supabase.rpc("entry_flags", { p_ids: ids });
  for (const row of (data ?? []) as FlagRow[]) map.set(row.entry_id, row);
  return map;
}

export async function pendingCount(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase.from("entries").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null);
  return count ?? 0;
}

/** Friendly message from a Postgres/PostgREST error raised by our triggers and functions. */
export function dbMessage(error: { message: string; code?: string }): string {
  if (error.code === "23514" || error.code === "42501" || error.code === "P0002" || error.code === "22023") {
    return error.message.replace(/^new row for relation.*violates check constraint.*$/i, "That entry breaks a rule. Please check the values.");
  }
  if (error.code === "42P17" || /row-level security/i.test(error.message)) return "You do not have permission to do that.";
  return "Something went wrong. Please try again.";
}
