"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { updateEntry } from "@/lib/entries/save";
import { getEntry, dbMessage } from "@/lib/data/entries";
import { removeVoucher } from "@/lib/vouchers/storage";
import { uuid, type ActionState } from "@/lib/validation/common";

/** Admin edit. Status is untouched; "Save and approve" also approves a pending entry. */
export async function adminUpdateEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "Invalid entry." };

  const entry = await getEntry(supabase, id.data);
  if (!entry) return { status: "error", message: "Entry not found." };
  if (entry.status === "exported") return { status: "error", message: "Exported entries are locked. Unlock the export batch first." };

  const result = await updateEntry(supabase, admin.id, entry, formData, { resubmit: false });
  if (result.status !== "success") return result;

  if (formData.get("then") === "approve" && entry.status === "pending") {
    const { error } = await supabase.rpc("review_entry", { p_entry_id: entry.id, p_decision: "approve", p_note: null });
    if (error) return { status: "error", message: `Saved, but approval failed: ${dbMessage(error)}` };
  }

  revalidatePath("/admin", "layout");
  revalidatePath("/record", "layout");
  if (formData.get("from") === "review") redirect("/admin/review");
  return { status: "success", message: formData.get("then") === "approve" ? "Saved and approved." : "Entry updated." };
}

export async function adminDeleteEntryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/entries");

  const entry = await getEntry(supabase, id.data);
  const { error } = await supabase.rpc("soft_delete_entry", { p_id: id.data });
  if (error) redirect(`/admin/entries/${id.data}?error=${encodeURIComponent(dbMessage(error))}`);
  // Keep the voucher file as evidence once an entry has been approved.
  if (entry?.receipt_path && entry.status !== "approved") await removeVoucher(supabase, entry.receipt_path);
  revalidatePath("/admin", "layout");
  revalidatePath("/record", "layout");
  redirect("/admin/entries?deleted=1");
}
