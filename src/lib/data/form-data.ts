import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getSettings, getSources } from "@/lib/data/reference";
import { todayIST } from "@/lib/format/dates";
import { minEntryDate } from "@/lib/format/financial-year";
import type { Profile } from "@/types/db";

/**
 * Everything the entry form needs: active categories and sources, limits, and autocomplete values.
 * For a recorder, the lists and limits follow the controls the admin set for that person
 * (the database enforces the same rules, this just keeps the form honest). `keep` retains the
 * current category and source when editing an older entry.
 */
export async function loadFormData(user?: Profile, keep: { categoryId?: number; sourceId?: number } = {}) {
  const supabase = await createClient();
  const [categories, sources, settings, parties, programmes] = await Promise.all([
    getCategories(supabase, { activeOnly: true }),
    getSources(supabase, { activeOnly: true }),
    getSettings(supabase),
    supabase.rpc("suggest_values", { p_field: "party", p_q: "" }),
    supabase.rpc("suggest_values", { p_field: "programme", p_q: "" }),
  ]);
  const today = todayIST();
  const restricted = user && user.role !== "admin" ? user : undefined;
  const allowedCategories = categories.filter((c) => {
    if (!restricted) return true;
    if (c.id === keep.categoryId) return true;
    if (c.kind === "income" && !restricted.can_record_income) return false;
    return !restricted.allowed_category_ids || restricted.allowed_category_ids.includes(c.id);
  });
  const allowedSources = sources.filter((s) => !restricted || s.id === keep.sourceId || !restricted.allowed_source_ids || restricted.allowed_source_ids.includes(s.id));
  const maxAmount = restricted?.max_entry_amount ? Math.min(settings.maxAmount, Number(restricted.max_entry_amount)) : settings.maxAmount;
  return {
    categories: allowedCategories,
    sources: allowedSources,
    limits: { today, minDate: minEntryDate(today), maxAmount, voucherRequiredAbove: settings.voucherRequiredAbove },
    suggestions: { parties: (parties.data ?? []) as string[], programmes: (programmes.data ?? []) as string[] },
  };
}

