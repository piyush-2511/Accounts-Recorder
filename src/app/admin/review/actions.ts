"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { bulkApproveSchema, reviewSchema } from "@/lib/validation/review";
import { fieldErrors, type ActionState } from "@/lib/validation/common";
import { dbMessage } from "@/lib/data/entries";

function backToQueue(raw: FormDataEntryValue | null, extra?: string): string {
  const value = typeof raw === "string" ? raw : "";
  // Only ever return to the review queue (never an arbitrary URL).
  const base = value.startsWith("/admin/review") && !value.startsWith("//") ? value.split("#")[0]! : "/admin/review";
  if (!extra) return base;
  return base + (base.includes("?") ? "&" : "?") + extra;
}

/** Approve or reject one entry. Success redirects back to the queue (the next entry appears first). */
export async function reviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid review.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_entry", {
    p_entry_id: parsed.data.entry_id,
    p_decision: parsed.data.decision,
    p_note: parsed.data.note || null,
  });
  if (error) return { status: "error", message: dbMessage(error) };

  revalidatePath("/admin", "layout");
  revalidatePath("/record", "layout");
  // Drop ?id= so the queue shows the next pending entry.
  const back = backToQueue(formData.get("return_to")).replace(/([?&])id=[^&]*&?/, "$1").replace(/[?&]$/, "");
  redirect(back);
}

export async function bulkApproveAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = bulkApproveSchema.safeParse({ ids: formData.getAll("ids").map(String) });
  if (!parsed.success) redirect(backToQueue(formData.get("return_to"), "error=" + encodeURIComponent("Select at least one entry.")));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_entries", { p_ids: parsed.data.ids });
  if (error) redirect(backToQueue(formData.get("return_to"), "error=" + encodeURIComponent(dbMessage(error))));

  revalidatePath("/admin", "layout");
  revalidatePath("/record", "layout");
  redirect(backToQueue("/admin/review", `approved=${typeof data === "number" ? data : 0}`));
}
