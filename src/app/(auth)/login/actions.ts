"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";
import { fieldErrors, type ActionState } from "@/lib/validation/common";
import { safeNext } from "@/lib/utils";
import { HOME_BY_ROLE, type Role } from "@/lib/constants/roles";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    // One generic message: never reveal whether an email exists.
    return { status: "error", message: "Incorrect email or password." };
  }

  const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", data.user.id).maybeSingle();
  if (!profile) {
    await supabase.auth.signOut();
    return { status: "error", message: "Your account is not set up in the app yet. Ask your administrator to invite you from Settings > Users." };
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    return { status: "error", message: "This account is disabled. Contact your administrator." };
  }

  const home = HOME_BY_ROLE[profile.role as Role];
  redirect(safeNext(String(formData.get("next") ?? ""), home));
}
