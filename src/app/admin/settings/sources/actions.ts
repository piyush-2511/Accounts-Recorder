"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { back } from "@/lib/data/flash";
import { paymentSourceSchema } from "@/lib/validation/settings";

const PATH = "/admin/settings/sources";

export async function saveSourceAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = Object.fromEntries(formData);
  const parsed = paymentSourceSchema.safeParse({ ...raw, id: raw.id || undefined, is_active: raw.is_active === "on" });
  if (!parsed.success) back(PATH, "err", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const { id, ...fields } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("payment_sources").update(fields).eq("id", id)
    : await supabase.from("payment_sources").insert(fields);
  if (error) back(PATH, "err", error.code === "23505" ? "A payment source with that name already exists." : "Could not save the payment source.");
  revalidatePath(PATH);
  back(PATH, "ok", id ? "Payment source updated." : "Payment source added.");
}
