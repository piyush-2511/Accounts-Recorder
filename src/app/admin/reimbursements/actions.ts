"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { dbMessage } from "@/lib/data/entries";
import { reimburseSchema, voidSchema } from "@/lib/validation/reimbursement";
import { fieldErrors, type ActionState } from "@/lib/validation/common";

/** Records that the organisation paid a person back for the selected expenses. */
export async function reimburseAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = reimburseSchema.safeParse({
    person_id: formData.get("person_id"),
    entry_ids: formData.getAll("entry_ids"),
    source_id: formData.get("source_id"),
    paid_on: formData.get("paid_on"),
    reference: formData.get("reference") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Please check the form.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reimburse_entries", {
    p_person: v.person_id,
    p_entry_ids: v.entry_ids,
    p_source_id: v.source_id,
    p_paid_on: v.paid_on,
    p_reference: v.reference,
    p_note: v.note,
  });
  if (error || typeof data !== "string") return { status: "error", message: error ? dbMessage(error) : "Could not record the reimbursement." };

  revalidatePath("/admin", "layout");
  redirect(`/admin/reimbursements/${data}?done=1`);
}

export async function voidReimbursementAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = voidSchema.safeParse({ id: formData.get("id"), reason: formData.get("reason") });
  const base = parsed.success ? `/admin/reimbursements/${parsed.data.id}` : "/admin/reimbursements/history";
  if (!parsed.success) redirect(`${base}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid request")}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("void_reimbursement", { p_id: parsed.data.id, p_reason: parsed.data.reason });
  if (error) redirect(`${base}?error=${encodeURIComponent(dbMessage(error))}`);
  revalidatePath("/admin", "layout");
  redirect(`${base}?voided=1`);
}
