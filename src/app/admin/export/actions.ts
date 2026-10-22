"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/reference";
import { dbMessage } from "@/lib/data/entries";
import { loadApprovedForExport } from "@/lib/export/service";
import { buildVouchers, collectLedgers } from "@/lib/tally/build-vouchers";
import { checkExport } from "@/lib/tally/checks";
import { buildLedgersXml, buildVouchersXml, encodeXml } from "@/lib/tally/to-xml";
import { buildXlsx } from "@/lib/tally/to-xlsx";
import { exportRangeSchema } from "@/lib/validation/export";
import { uuid, type ActionState } from "@/lib/validation/common";

const XML = "application/xml";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Generate an export batch:
 *  1. give approved entries their (gap-free) voucher numbers
 *  2. build ledgers.xml, vouchers.xml and the Excel sheet
 *  3. store the files, then atomically mark the entries Exported
 */
export async function generateExportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const range = exportRangeSchema.safeParse({ from: formData.get("from"), to: formData.get("to") });
  if (!range.success) return { status: "error", message: range.error.issues[0]?.message ?? "Choose a valid date range." };
  const { from, to } = range.data;

  const supabase = await createClient();
  const settings = await getSettings(supabase);

  const assigned = await supabase.rpc("assign_voucher_numbers", { p_from: from, p_to: to });
  if (assigned.error) return { status: "error", message: dbMessage(assigned.error) };

  const { entries } = await loadApprovedForExport(supabase, from, to, settings.voucherStartNumber);
  const vouchers = buildVouchers(entries, { voucherPrefix: settings.voucherPrefix });
  const checks = checkExport(vouchers, entries);
  if (!checks.ok) return { status: "error", message: `Fix these before exporting: ${checks.issues.slice(0, 3).map((i) => i.message).join(" ")}` };

  const ledgersXml = encodeXml(buildLedgersXml(collectLedgers(entries), settings.companyName), settings.tallyEncoding);
  const vouchersXml = encodeXml(buildVouchersXml(vouchers, settings.companyName), settings.tallyEncoding);
  const xlsx = await buildXlsx(vouchers, entries);

  const folder = `${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const paths = { ledgers: `${folder}/ledgers.xml`, vouchers: `${folder}/vouchers.xml`, xlsx: `${folder}/vouchers.xlsx` };
  const uploads = await Promise.all([
    supabase.storage.from("exports").upload(paths.ledgers, ledgersXml, { contentType: XML, upsert: false }),
    supabase.storage.from("exports").upload(paths.vouchers, vouchersXml, { contentType: XML, upsert: false }),
    supabase.storage.from("exports").upload(paths.xlsx, xlsx, { contentType: XLSX, upsert: false }),
  ]);
  if (uploads.some((u) => u.error)) {
    await supabase.storage.from("exports").remove(Object.values(paths));
    return { status: "error", message: "Could not store the export files. Please try again." };
  }

  const { data: batchId, error } = await supabase.rpc("finalize_export_batch", {
    p_entry_ids: entries.map((e) => e.id),
    p_date_from: from,
    p_date_to: to,
    p_ledgers_path: paths.ledgers,
    p_xml_path: paths.vouchers,
    p_xlsx_path: paths.xlsx,
  });
  if (error || !uuid.safeParse(batchId).success) {
    await supabase.storage.from("exports").remove(Object.values(paths));
    return { status: "error", message: error ? dbMessage(error) : "Could not finish the export." };
  }

  revalidatePath("/admin", "layout");
  redirect(`/admin/export/history?new=${batchId as string}`);
}

export async function unlockBatchAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = uuid.safeParse(formData.get("batch_id"));
  if (!id.success) redirect("/admin/export/history");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unlock_batch", { p_batch_id: id.data });
  if (error) redirect(`/admin/export/history?error=${encodeURIComponent(dbMessage(error))}`);
  revalidatePath("/admin", "layout");
  redirect(`/admin/export/history?unlocked=${typeof data === "number" ? data : 0}`);
}
