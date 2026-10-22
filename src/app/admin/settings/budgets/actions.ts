"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { back } from "@/lib/data/flash";
import { isValidISODate } from "@/lib/format/dates";
import { budgetRowSchema } from "@/lib/validation/settings";

/** Saves one month's budgets. A blank amount removes that category's budget for the month. */
export async function saveBudgetsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const month = String(formData.get("month") ?? "");
  const path = "/admin/settings/budgets";
  if (!isValidISODate(`${month}-01`)) back(path, "err", "Choose a valid month.");
  const monthDate = `${month}-01`;
  const upserts: { category_id: number; month: string; amount: number }[] = [];
  const removes: number[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("b_")) continue;
    const categoryId = Number(key.slice(2));
    const text = String(value).trim();
    if (text === "") { removes.push(categoryId); continue; }
    const parsed = budgetRowSchema.safeParse({ category_id: categoryId, amount: text });
    if (!parsed.success) back(`${path}?month=${month}`, "err", `Invalid amount for a category: ${parsed.error.issues[0]?.message ?? ""}`);
    upserts.push({ category_id: parsed.data.category_id, month: monthDate, amount: parsed.data.amount });
  }
  const supabase = await createClient();
  if (upserts.length) {
    const { error } = await supabase.from("budgets").upsert(upserts, { onConflict: "category_id,month" });
    if (error) back(`${path}?month=${month}`, "err", "Could not save budgets.");
  }
  if (removes.length) await supabase.from("budgets").delete().eq("month", monthDate).in("category_id", removes);
  revalidatePath("/admin/reports/budget");
  back(`${path}?month=${month}`, "ok", "Budgets saved.");
}

/** Copies the previous month's budgets into this month, only for categories that have none yet. */
export async function copyBudgetsAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const month = String(formData.get("month") ?? "");
  const path = `/admin/settings/budgets?month=${month}`;
  if (!isValidISODate(`${month}-01`)) back("/admin/settings/budgets", "err", "Choose a valid month.");
  const supabase = await createClient();
  const [y, m] = month.split("-").map(Number) as [number, number];
  const prev = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
  const [{ data: prevRows }, { data: existing }] = await Promise.all([
    supabase.from("budgets").select("category_id,amount").eq("month", prev),
    supabase.from("budgets").select("category_id").eq("month", `${month}-01`),
  ]);
  const have = new Set((existing ?? []).map((r) => r.category_id as number));
  const rows = (prevRows ?? []).filter((r) => !have.has(r.category_id as number)).map((r) => ({ category_id: r.category_id, month: `${month}-01`, amount: r.amount }));
  if (!rows.length) back(path, "err", "Nothing to copy from the previous month.");
  const { error } = await supabase.from("budgets").insert(rows);
  if (error) back(path, "err", "Could not copy budgets.");
  back(path, "ok", `Copied ${rows.length} budgets from the previous month.`);
}
