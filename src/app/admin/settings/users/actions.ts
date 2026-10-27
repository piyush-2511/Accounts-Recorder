"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { back } from "@/lib/data/flash";
import { dbMessage } from "@/lib/data/entries";
import { uuid } from "@/lib/validation/common";
import { inviteUserSchema } from "@/lib/validation/settings";
import { ROLES } from "@/lib/constants/roles";

const PATH = "/admin/settings/users";

export async function inviteUserAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = inviteUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "err", parsed.error.issues[0]?.message ?? "Check the form.");
  const { email, full_name, role } = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name, needs_password: true },
    redirectTo: `${publicEnv.siteUrl}/accept-invite`,
  });
  if (error || !data.user) back(PATH, "err", error && /already|registered/i.test(error.message) ? "That email already has an account." : "Could not send the invitation.");
  // The signup trigger always creates a recorder; promote here, server-side, with the service role.
  if (role === "admin") {
    const { error: roleError } = await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
    if (roleError) back(PATH, "err", "Invitation sent, but making them an admin failed. Change the role below.");
  }
  revalidatePath(PATH);
  back(PATH, "ok", `Invitation sent to ${email}.`);
}

export async function updateUserAction(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  const role = String(formData.get("role"));
  const active = formData.get("is_active") === "on";
  if (!id.success || !(ROLES as readonly string[]).includes(role)) back(PATH, "err", "Invalid request.");
  if (id.data === me.profile.id && (!active || role !== "admin")) back(PATH, "err", "You cannot deactivate or demote your own account.");
  // The name of this person's payable ledger in Tally (used for expenses they pay personally). Blank = "<Name> - Reimbursable".
  const ledger = String(formData.get("reimbursement_ledger") ?? "").trim();
  if (ledger.length > 100 || /[\u0000-\u001f]/.test(ledger)) back(PATH, "err", "The reimbursement ledger name must be 100 characters or fewer, without special characters.");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role, is_active: active, reimbursement_ledger: ledger === "" ? null : ledger }).eq("id", id.data);
  if (error) back(PATH, "err", "Could not update the user.");
  revalidatePath(PATH);
  back(PATH, "ok", "User updated.");
}

/** Re-sends an invitation to someone who has never signed in (the old link is replaced). */
export async function resendInviteAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) back(PATH, "err", "Invalid request.");
  const admin = createAdminClient();
  const { data: found } = await admin.auth.admin.getUserById(id.data);
  const target = found?.user;
  if (!target?.email) back(PATH, "err", "User not found.");
  const stillPending = target.user_metadata?.needs_password === true || !target.last_sign_in_at;
  if (!stillPending) back(PATH, "err", "This person has already set a password. Ask them to use “Forgot password” on the sign-in page.");
  const { data: profile } = await admin.from("profiles").select("full_name,role").eq("id", id.data).maybeSingle();
  const fullName = profile?.full_name ?? String(target.user_metadata?.full_name ?? target.email);
  const role = profile?.role === "admin" ? "admin" : "recorder";

  // They have not set a password yet, so they own no entries: safe to recreate the pending account with a fresh link.
  const { error: delError } = await admin.auth.admin.deleteUser(id.data);
  if (delError) back(PATH, "err", "Could not reset the invitation. Try again.");
  // The profile no longer disappears with the login, so remove the old one before inviting again.
  await admin.from("profiles").delete().eq("id", id.data);
  const { data, error } = await admin.auth.admin.inviteUserByEmail(target.email, {
    data: { full_name: fullName, needs_password: true },
    redirectTo: `${publicEnv.siteUrl}/accept-invite`,
  });
  if (error || !data.user) back(PATH, "err", "The old invitation was removed but the new one failed to send. Invite them again.");
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  revalidatePath(PATH);
  back(PATH, "ok", `New invitation sent to ${target.email}.`);
}

/**
 * Removes a person (staff or admin). They can no longer sign in. Everything they recorded stays,
 * shown under their name only. Someone who never did anything (for example an unaccepted invitation)
 * is deleted completely. Blocked for yourself, for the last admin, and while the organisation still owes them money.
 */
export async function deleteUserAction(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) back(PATH, "err", "Invalid request.");
  if (formData.get("confirm") !== "yes") back(PATH, "err", "Tick the confirmation box to delete.");
  if (id.data === me.profile.id) back(PATH, "err", "You cannot delete your own account.");

  const supabase = await createClient();
  const { data: before } = await supabase.from("profiles").select("full_name").eq("id", id.data).maybeSingle();
  const { data: outcome, error } = await supabase.rpc("remove_user", { p_id: id.data });
  if (error) back(PATH, "err", dbMessage(error));

  // The profile is dealt with, so removing the login cannot orphan anything. A missing login is fine.
  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.deleteUser(id.data);
  if (authError && !/not found/i.test(authError.message)) {
    back(PATH, "err", "The person was removed from the app but their login could not be deleted. They cannot sign in. Try deleting again later.");
  }
  revalidatePath("/admin", "layout");
  const name = before?.full_name ?? "The person";
  back(PATH, "ok", outcome === "retired" ? `${name} removed. Their entries stay under their name.` : `${name} deleted.`);
}

/** Controls what a recorder may enter: switch recording off, limit payment sources, categories, income and amount. */
export async function saveControlsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) back(PATH, "err", "Invalid request.");
  const back_ = `${PATH}/${id.data}`;

  const supabase = await createClient();
  const [{ data: cats }, { data: srcs }] = await Promise.all([supabase.from("categories").select("id"), supabase.from("payment_sources").select("id")]);
  const allCats = (cats ?? []).map((c) => c.id as number);
  const allSrcs = (srcs ?? []).map((c) => c.id as number);

  // Ticked boxes only count if they are real ids. Everything ticked means "no restriction" (stored as null).
  const pick = (name: string, all: number[]) => {
    const chosen = [...new Set(formData.getAll(name).map(Number).filter((n) => Number.isInteger(n) && all.includes(n)))];
    return chosen.length === all.length ? null : chosen;
  };
  const sources = pick("source_ids", allSrcs);
  const categories = pick("category_ids", allCats);
  if ((sources && sources.length === 0) || (categories && categories.length === 0)) {
    back(back_, "err", "Choose at least one payment source and one category, or switch recording off.");
  }

  const rawMax = String(formData.get("max_entry_amount") ?? "").trim();
  const max = rawMax === "" ? null : Number(rawMax);
  if (max !== null && (!Number.isFinite(max) || max <= 0 || max > 100_000_000)) back(back_, "err", "Enter a valid amount limit, or leave it blank for no limit.");

  const { error } = await supabase
    .from("profiles")
    .update({
      can_record: formData.get("can_record") === "on",
      can_record_income: formData.get("can_record_income") === "on",
      allowed_source_ids: sources,
      allowed_category_ids: categories,
      max_entry_amount: max === null ? null : Math.round(max * 100) / 100,
    })
    .eq("id", id.data);
  if (error) back(back_, "err", "Could not save the controls.");
  revalidatePath(PATH);
  back(back_, "ok", "Controls saved. They apply from the next entry.");
}
