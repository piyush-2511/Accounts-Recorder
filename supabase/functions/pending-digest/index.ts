// Deno edge function. Schedule daily. Emails admins a count of entries waiting for review.
// Needs secrets: CRON_SECRET, RESEND_API_KEY, DIGEST_FROM (verified sender). Optional: use any email API instead of Resend.
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.headers.get("authorization") !== `Bearer ${Deno.env.get("CRON_SECRET")}`) return new Response("Forbidden", { status: 403 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { count } = await db.from("entries").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null);
  if (!count) return Response.json({ sent: 0 });
  const { data: admins } = await db.from("profiles").select("email").eq("role", "admin").eq("is_active", true);
  const to = (admins ?? []).map((a) => a.email as string);
  if (!to.length) return Response.json({ sent: 0 });
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("DIGEST_FROM"), to, subject: `${count} accounts entries waiting for review`, text: `${count} entries are waiting for your review.` }),
  });
  return Response.json({ sent: to.length, ok: res.ok });
});
