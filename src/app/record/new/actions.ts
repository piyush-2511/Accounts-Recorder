"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { createEntry } from "@/lib/entries/save";
import type { ActionState } from "@/lib/validation/common";

export async function createEntryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const supabase = await createClient();
  const result = await createEntry(supabase, user.id, formData);
  if (result.status === "success") {
    revalidatePath("/record", "layout");
    revalidatePath("/admin/review");
  }
  return result;
}
