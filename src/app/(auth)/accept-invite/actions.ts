"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setPasswordSchema } from "@/lib/validation/auth";
import { fieldErrors, type ActionState } from "@/lib/validation/common";
import { HOME_BY_ROLE, type Role } from "@/lib/constants/roles";

export async function setPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = setPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Your link has expired. Ask your administrator to send a new invite." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password, data: { needs_password: false } });
  if (error) return { status: "error", message: error.message.includes("same") ? "Choose a different password from your current one." : "Could not set the password. Please try again." };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  redirect(HOME_BY_ROLE[(profile?.role as Role | undefined) ?? "recorder"]);
}
