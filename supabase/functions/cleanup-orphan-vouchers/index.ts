// Deno edge function. Schedule weekly (Supabase dashboard > Edge Functions > Schedules).
// Deletes voucher files in Storage that no entry references (left behind by abandoned uploads).
// Deploy: npx supabase functions deploy cleanup-orphan-vouchers
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) return new Response("Forbidden", { status: 403 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: used } = await db.from("entries").select("receipt_path").not("receipt_path", "is", null);
  const keep = new Set((used ?? []).map((r) => r.receipt_path as string));
  const cutoff = Date.now() - 24 * 3600 * 1000; // never touch files uploaded in the last day
  const doomed: string[] = [];
  const { data: folders } = await db.storage.from("vouchers").list("", { limit: 1000 });
  for (const f of folders ?? []) {
    const { data: files } = await db.storage.from("vouchers").list(f.name, { limit: 1000 });
    for (const file of files ?? []) {
      const path = `${f.name}/${file.name}`;
      if (!keep.has(path) && new Date(file.created_at ?? 0).getTime() < cutoff) doomed.push(path);
    }
  }
  if (doomed.length) await db.storage.from("vouchers").remove(doomed);
  return Response.json({ removed: doomed.length });
});
