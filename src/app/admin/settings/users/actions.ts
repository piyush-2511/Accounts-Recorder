"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { back } from "@/lib/data/flash";
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
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role, is_active: active }).eq("id", id.data);
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

  // Never signed in, so they own no entries: safe to recreate the pending account with a fresh link.
  const { error: delError } = await admin.auth.admin.deleteUser(id.data);
  if (delError) back(PATH, "err", "Could not reset the invitation. Try again.");
  const { data, error } = await admin.auth.admin.inviteUserByEmail(target.email, {
    data: { full_name: fullName, needs_password: true },
    redirectTo: `${publicEnv.siteUrl}/accept-invite`,
  });
  if (error || !data.user) back(PATH, "err", "The old invitation was removed but the new one failed to send. Invite them again.");
  if (role === "admin") await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  revalidatePath(PATH);
  back(PATH, "ok", `New invitation sent to ${target.email}.`);
}

/** Permanently removes an invited person who has never signed in. Anyone who has signed in is deactivated instead, to keep history. */
// export async function deleteInviteAction(formData: FormData): Promise<void> {
//   const me = await requireAdmin();
//   const id = uuid.safeParse(formData.get("id"));
//   if (!id.success) back(PATH, "err", "Invalid request.");
//   if (id.data === me.profile.id) back(PATH, "err", "You cannot delete your own account.");
//   const admin = createAdminClient();
//   const { data: found } = await admin.auth.admin.getUserById(id.data);
//   if (!found?.user) back(PATH, "err", "User not found.");
//   if (found.user.last_sign_in_at) back(PATH, "err", "This person has already signed in. Untick Active to disable them instead; their history is kept.");
//   const { count } = await admin.from("entries").select("id", { count: "exact", head: true }).eq("created_by", id.data);
//   if (count) back(PATH, "err", "This person has recorded entries, so they cannot be deleted. Untick Active instead.");
//   const { error } = await admin.auth.admin.deleteUser(id.data);
//   if (error) back(PATH, "err", "Could not delete the invitation.");
//   revalidatePath(PATH);
//   back(PATH, "ok", `Invitation for ${found.user.email} deleted.`);
// }

/**
 * Permanently deletes a user who has no history (no entries recorded, nothing reviewed or exported).
 * People with history must be disabled instead (untick Active) so records stay intact.
 */
export async function deleteUserAction(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) back(PATH, "err", "Invalid request.");
  if (formData.get("confirm") !== "yes") back(PATH, "err", "Tick the confirmation box to delete.");
  if (id.data === me.profile.id) back(PATH, "err", "You cannot delete your own account.");
  const admin = createAdminClient();
  const { data: found } = await admin.auth.admin.getUserById(id.data);
  if (!found?.user) back(PATH, "err", "User not found.");
  const { count } = await admin.from("entries").select("id", { count: "exact", head: true }).eq("created_by", id.data);
  if (count) back(PATH, "err", "This person has recorded entries, so they cannot be deleted. Untick Active to disable them instead.");
  const { error } = await admin.auth.admin.deleteUser(id.data);
  if (error) back(PATH, "err", "This person has review or export history, so they cannot be deleted. Untick Active to disable them instead.");
  revalidatePath(PATH);
  back(PATH, "ok", `${found.user.email} deleted.`);
}