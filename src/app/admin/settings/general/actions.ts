"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { back } from "@/lib/data/flash";
import { generalSettingsSchema } from "@/lib/validation/settings";

const PATH = "/admin/settings/general";

export async function saveGeneralAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = generalSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "err", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const v = parsed.data;
  const rows = [
    { key: "company_name", value: v.company_name },
    { key: "voucher_prefix", value: v.voucher_prefix },
    { key: "voucher_start_number", value: v.voucher_start_number },
    { key: "voucher_required_above", value: v.voucher_required_above },
    { key: "max_amount", value: v.max_amount },
    { key: "tally_encoding", value: v.tally_encoding },
    { key: "reimbursement_voucher_type", value: v.reimbursement_voucher_type },
  ];
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert(rows, { onConflict: "key" });
  if (error) back(PATH, "err", "Could not save settings.");
  revalidatePath("/admin", "layout");
  back(PATH, "ok", "Settings saved.");
}
