import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { MIME_EXTENSION } from "./constants";
import { validateVoucher } from "./validate-file";

export const VOUCHER_BUCKET = "vouchers";

export interface StoredVoucher {
  path: string;
  size: number;
  mime: "image/jpeg" | "image/webp" | "application/pdf";
  warning?: string;
}

/**
 * Validates (size, magic bytes) and uploads a voucher to the private bucket under the user's own folder.
 * The 200 KB cap is checked here again, and a third time by the bucket's file size limit.
 */
export async function storeVoucher(
  supabase: SupabaseClient,
  userId: string,
  entryId: string,
  file: File,
): Promise<{ ok: true; voucher: StoredVoucher } | { ok: false; error: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateVoucher(bytes.byteLength, bytes.subarray(0, 16));
  if (!check.ok) return check;

  const path = `${userId}/${entryId}/${randomUUID()}.${MIME_EXTENSION[check.mime]}`;
  const { error } = await supabase.storage.from(VOUCHER_BUCKET).upload(path, bytes, {
    contentType: check.mime,
    upsert: false,
    cacheControl: "3600",
  });
  if (error) return { ok: false, error: "Could not upload the voucher. Please try again." };
  return { ok: true, voucher: { path, size: check.size, mime: check.mime, warning: check.warning } };
}

export async function removeVoucher(supabase: SupabaseClient, path: string | null | undefined): Promise<void> {
  if (!path) return;
  await supabase.storage.from(VOUCHER_BUCKET).remove([path]);
}
