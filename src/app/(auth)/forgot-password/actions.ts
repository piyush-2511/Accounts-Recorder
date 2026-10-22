"use server";

import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import type { ActionState } from "@/lib/validation/common";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email") });

export async function forgotPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Enter a valid email" };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/accept-invite`,
  });
  // Same answer whether or not the email exists.
  return { status: "success", message: "If that email has an account, a reset link is on its way." };
}
