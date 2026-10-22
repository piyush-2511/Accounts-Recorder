import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildEntrySchema } from "@/lib/validation/entry";
import { fieldErrors, type ActionState } from "@/lib/validation/common";
import { todayIST } from "@/lib/format/dates";
import { minEntryDate } from "@/lib/format/financial-year";
import { getSettings } from "@/lib/data/reference";
import { dbMessage } from "@/lib/data/entries";
import { removeVoucher, storeVoucher } from "@/lib/vouchers/storage";
import type { EntryRow } from "@/types/db";

type Result = ActionState<{ id: string }>;

async function parse(supabase: SupabaseClient, formData: FormData) {
  const settings = await getSettings(supabase);
  const today = todayIST();
  const schema = buildEntrySchema({ today, minDate: minEntryDate(today), maxAmount: settings.maxAmount });
  return { settings, result: schema.safeParse(Object.fromEntries(formData)) };
}

function uploadedFile(formData: FormData): File | null {
  const f = formData.get("voucher");
  return f instanceof File && f.size > 0 ? f : null;
}

/** Create an entry (always Pending). Voucher is validated again here: size, real file type. */
export async function createEntry(supabase: SupabaseClient, userId: string, formData: FormData): Promise<Result> {
  const { settings, result } = await parse(supabase, formData);
  if (!result.success) return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(result.error) };
  const input = result.data;

  const file = uploadedFile(formData);
  if (settings.voucherRequiredAbove !== null && input.amount > settings.voucherRequiredAbove && !file) {
    return { status: "error", message: "A voucher is required for this amount.", fieldErrors: { voucher: `Attach the voucher for amounts above ${settings.voucherRequiredAbove}.` } };
  }

  if (formData.get("confirm_duplicate") !== "1") {
    const { data: dup } = await supabase.rpc("possible_duplicate_count", {
      p_date: input.entry_date,
      p_amount: input.amount,
      p_category_id: input.category_id,
      p_party: input.party,
    });
    if (typeof dup === "number" && dup > 0) {
      return { status: "duplicate", message: "An entry with the same date, amount, category and party already exists. Save it anyway?" };
    }
  }

  const id = randomUUID();
  let voucher: { path: string; size: number; mime: string } | null = null;
  if (file) {
    const stored = await storeVoucher(supabase, userId, id, file);
    if (!stored.ok) return { status: "error", message: stored.error, fieldErrors: { voucher: stored.error } };
    voucher = stored.voucher;
  }

  const { error } = await supabase.from("entries").insert({
    id,
    entry_date: input.entry_date,
    kind: input.kind,
    category_id: input.category_id,
    source_id: input.source_id,
    amount: input.amount,
    party: input.party,
    programme: input.programme,
    narration: input.narration,
    receipt_path: voucher?.path ?? null,
    receipt_size: voucher?.size ?? null,
    receipt_mime: voucher?.mime ?? null,
  });
  if (error) {
    await removeVoucher(supabase, voucher?.path);
    return { status: "error", message: dbMessage(error) };
  }
  return { status: "success", message: "Entry saved and sent for review.", data: { id } };
}

/**
 * Update an entry. `resubmit` moves a Rejected entry back to Pending (recorder flow);
 * admins pass false and keep the status unchanged.
 */
export async function updateEntry(
  supabase: SupabaseClient,
  userId: string,
  entry: EntryRow,
  formData: FormData,
  opts: { resubmit: boolean },
): Promise<Result> {
  const { settings, result } = await parse(supabase, formData);
  if (!result.success) return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(result.error) };
  const input = result.data;

  const file = uploadedFile(formData);
  const removing = formData.get("remove_voucher") === "1" && !file;
  const willHaveVoucher = file !== null || (entry.receipt_path !== null && !removing);
  if (settings.voucherRequiredAbove !== null && input.amount > settings.voucherRequiredAbove && !willHaveVoucher) {
    return { status: "error", message: "A voucher is required for this amount.", fieldErrors: { voucher: `Attach the voucher for amounts above ${settings.voucherRequiredAbove}.` } };
  }

  let stored: { path: string; size: number; mime: string } | null = null;
  if (file) {
    const r = await storeVoucher(supabase, userId, entry.id, file);
    if (!r.ok) return { status: "error", message: r.error, fieldErrors: { voucher: r.error } };
    stored = r.voucher;
  }

  const patch: Record<string, unknown> = {
    entry_date: input.entry_date,
    kind: input.kind,
    category_id: input.category_id,
    source_id: input.source_id,
    amount: input.amount,
    party: input.party,
    programme: input.programme,
    narration: input.narration,
  };
  if (stored) Object.assign(patch, { receipt_path: stored.path, receipt_size: stored.size, receipt_mime: stored.mime });
  else if (removing) Object.assign(patch, { receipt_path: null, receipt_size: null, receipt_mime: null });
  if (opts.resubmit && entry.status === "rejected") patch.status = "pending";

  const { data, error } = await supabase.from("entries").update(patch).eq("id", entry.id).select("id").maybeSingle();
  if (error || !data) {
    await removeVoucher(supabase, stored?.path);
    return { status: "error", message: error ? dbMessage(error) : "You can no longer edit this entry." };
  }
  if ((stored || removing) && entry.receipt_path) await removeVoucher(supabase, entry.receipt_path);
  return { status: "success", message: opts.resubmit && entry.status === "rejected" ? "Entry corrected and sent for review again." : "Entry updated.", data: { id: entry.id } };
}
