import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "../supabase/server";
import type { Profile } from "@/types/db";

export interface CurrentUser {
  id: string;
  email: string;
  profile: Profile;
}

/** The signed-in user and profile, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile || !profile.is_active) return null;
  return { id: user.id, email: user.email ?? profile.email, profile: profile as Profile };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.profile.role !== "admin") redirect("/record");
  return user;
}
