import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { VOUCHER_BUCKET } from "@/lib/vouchers/storage";
import { uuid } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

/**
 * Redirects to a short-lived signed URL for an entry's voucher.
 * Access is decided by RLS: recorders get their own entries' files, admins get all.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  const { entryId } = await params;
  if (!uuid.safeParse(entryId).success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: entry } = await supabase.from("entries").select("receipt_path").eq("id", entryId).maybeSingle();
  if (!entry?.receipt_path) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase.storage.from(VOUCHER_BUCKET).createSignedUrl(entry.receipt_path, 120);
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const res = NextResponse.redirect(data.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
