"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { back } from "@/lib/data/flash";
import { categorySchema } from "@/lib/validation/settings";

const PATH = "/admin/settings/categories";

export async function saveCategoryAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = Object.fromEntries(formData);
  const parsed = categorySchema.safeParse({ ...raw, id: raw.id || undefined, is_active: raw.is_active === "on" });
  if (!parsed.success) back(PATH, "err", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const { id, ...fields } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("categories").update(fields).eq("id", id)
    : await supabase.from("categories").insert(fields);
  if (error) back(PATH, "err", error.code === "23505" ? "A category with that name and type already exists." : "Could not save the category.");
  revalidatePath(PATH);
  back(PATH, "ok", id ? "Category updated." : "Category added.");
}
