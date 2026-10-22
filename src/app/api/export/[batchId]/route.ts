import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/reference";
import { buildVoucherZip } from "@/lib/vouchers/zip";
import { MIME_EXTENSION, type VoucherMime } from "@/lib/vouchers/constants";
import { toCsv } from "@/lib/reports/csv";
import { formatDMY } from "@/lib/format/dates";
import { uuid } from "@/lib/validation/common";
import type { ExportBatch } from "@/types/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FILES = {
  ledgers: { column: "ledgers_path", type: "application/xml", name: (b: ExportBatch) => `ledgers_${b.date_from}_to_${b.date_to}.xml` },
  vouchers: { column: "xml_path", type: "application/xml", name: (b: ExportBatch) => `vouchers_${b.date_from}_to_${b.date_to}.xml` },
  xlsx: { column: "xlsx_path", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: (b: ExportBatch) => `vouchers_${b.date_from}_to_${b.date_to}.xlsx` },
} as const;

function download(body: BodyInit, type: string, name: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name.replace(/[^\w.\-]/g, "_")}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { batchId } = await params;
  const file = request.nextUrl.searchParams.get("file") ?? "";
  if (!uuid.safeParse(batchId).success || !["ledgers", "vouchers", "xlsx", "zip"].includes(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data } = await supabase.from("export_batches").select("*").eq("id", batchId).maybeSingle();
  const batch = data as ExportBatch | null;
  if (!batch) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (file !== "zip") {
    const spec = FILES[file as keyof typeof FILES];
    const { data: blob, error } = await supabase.storage.from("exports").download(batch[spec.column]);
    if (error || !blob) return NextResponse.json({ error: "File not found" }, { status: 404 });
    return download(await blob.arrayBuffer(), spec.type, spec.name(batch));
  }

  // ZIP of the batch's vouchers, named by Tally voucher number, plus a manifest.
  const settings = await getSettings(supabase);
  const { data: entries } = await supabase
    .from("entries")
    .select("id, entry_date, amount, narration, voucher_no, receipt_path, receipt_mime")
    .eq("batch_id", batchId)
    .order("voucher_no");
  type Row = { id: string; entry_date: string; amount: number; narration: string; voucher_no: number; receipt_path: string | null; receipt_mime: VoucherMime | null };
  const rows = (entries ?? []) as Row[];

  const files: { name: string; data: Uint8Array }[] = [];
  const queue = rows.filter((r) => r.receipt_path);
  for (let i = 0; i < queue.length; i += 5) {
    await Promise.all(
      queue.slice(i, i + 5).map(async (r) => {
        const { data: blob } = await supabase.storage.from("vouchers").download(r.receipt_path!);
        if (!blob) return;
        const ext = r.receipt_mime ? MIME_EXTENSION[r.receipt_mime] : "bin";
        files.push({ name: `${settings.voucherPrefix}${r.voucher_no}.${ext}`, data: new Uint8Array(await blob.arrayBuffer()) });
      }),
    );
  }
  files.push({
    name: "manifest.csv",
    data: new TextEncoder().encode(
      toCsv([["Voucher No", "Date", "Amount", "Narration", "Has voucher file"], ...rows.map((r) => [`${settings.voucherPrefix}${r.voucher_no}`, formatDMY(r.entry_date), r.amount, r.narration, r.receipt_path ? "yes" : "no"])]),
    ),
  });
  const zip = await buildVoucherZip(files);
  return download(zip as unknown as BodyInit, "application/zip", `vouchers_${batch.date_from}_to_${batch.date_to}.zip`);
}
