import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getSettings, getSources } from "@/lib/data/reference";
import { todayIST } from "@/lib/format/dates";
import { minEntryDate } from "@/lib/format/financial-year";

/** Everything the entry form needs: active categories and sources, limits, and autocomplete values. */
export async function loadFormData() {
  const supabase = await createClient();
  const [categories, sources, settings, parties, programmes] = await Promise.all([
    getCategories(supabase, { activeOnly: true }),
    getSources(supabase, { activeOnly: true }),
    getSettings(supabase),
    supabase.rpc("suggest_values", { p_field: "party", p_q: "" }),
    supabase.rpc("suggest_values", { p_field: "programme", p_q: "" }),
  ]);
  const today = todayIST();
  return {
    categories,
    sources,
    limits: { today, minDate: minEntryDate(today), maxAmount: settings.maxAmount, voucherRequiredAbove: settings.voucherRequiredAbove },
    suggestions: { parties: (parties.data ?? []) as string[], programmes: (programmes.data ?? []) as string[] },
  };
}

