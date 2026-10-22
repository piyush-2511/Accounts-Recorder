"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { updateEntry } from "@/lib/entries/save";
import { getEntry, dbMessage } from "@/lib/data/entries";
import { removeVoucher } from "@/lib/vouchers/storage";
import { RECORDER_EDITABLE } from "@/lib/constants/entry-status";
import { uuid, type ActionState } from "@/lib/validation/common";

export async function updateEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return { status: "error", message: "Invalid entry." };

  const entry = await getEntry(supabase, id.data);
  if (!entry || entry.created_by !== user.id) return { status: "error", message: "Entry not found." };
  if (!RECORDER_EDITABLE.includes(entry.status)) return { status: "error", message: "This entry has been approved and can no longer be edited." };

  const result = await updateEntry(supabase, user.id, entry, formData, { resubmit: true });
  if (result.status === "success") {
    revalidatePath("/record", "layout");
    revalidatePath("/admin/review");
  }
  return result;
}

export async function deleteEntryAction(formData: FormData): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) redirect("/record/entries");

  const entry = await getEntry(supabase, id.data);
  const { error } = await supabase.rpc("soft_delete_entry", { p_id: id.data });
  if (error) redirect(`/record/entries?error=${encodeURIComponent(dbMessage(error))}`);
  // The entry stays in the database (soft delete); the voucher file can go for non-approved entries.
  if (entry?.receipt_path && ["pending", "rejected"].includes(entry.status)) await removeVoucher(supabase, entry.receipt_path);
  revalidatePath("/record", "layout");
  revalidatePath("/admin/review");
  redirect("/record/entries?deleted=1");
}
