import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppSettings, Category, PaymentSource } from "@/types/db";

export async function getCategories(supabase: SupabaseClient, opts: { activeOnly?: boolean } = {}): Promise<Category[]> {
  let q = supabase.from("categories").select("*").order("kind").order("sort_order").order("label");
  if (opts.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(`Could not load categories: ${error.message}`);
  return (data ?? []) as Category[];
}

export async function getSources(supabase: SupabaseClient, opts: { activeOnly?: boolean } = {}): Promise<PaymentSource[]> {
  let q = supabase.from("payment_sources").select("*").order("sort_order").order("label");
  if (opts.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(`Could not load payment sources: ${error.message}`);
  return (data ?? []) as PaymentSource[];
}

export async function getSettings(supabase: SupabaseClient): Promise<AppSettings> {
  const { data, error } = await supabase.from("app_settings").select("key,value");
  if (error) throw new Error(`Could not load settings: ${error.message}`);
  const m = new Map((data ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value]));
  const num = (k: string, d: number) => (typeof m.get(k) === "number" ? (m.get(k) as number) : d);
  const str = (k: string, d: string) => (typeof m.get(k) === "string" ? (m.get(k) as string) : d);
  const required = m.get("voucher_required_above");
  return {
    companyName: str("company_name", ""),
    voucherPrefix: str("voucher_prefix", ""),
    voucherStartNumber: num("voucher_start_number", 1),
    voucherRequiredAbove: typeof required === "number" ? required : null,
    maxAmount: num("max_amount", 1_000_000),
    tallyEncoding: str("tally_encoding", "utf-8") === "utf-16" ? "utf-16" : "utf-8",
    reimbursementVoucherType: str("reimbursement_voucher_type", "Payment") === "Journal" ? "Journal" : "Payment",
  };
}
