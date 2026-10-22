/**
 * Optional demo data for a STAGING project (never production): 40 sample entries over 3 months.
 *   npm run seed:demo -- <recorder-email>
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

async function main() {
  config({ path: ".env.local" });
  const email = process.argv[2];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !url || !key) {
    console.error("Usage: npm run seed:demo -- <recorder-email> (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed demo data with NODE_ENV=production.");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data: user } = await db.from("profiles").select("id").eq("email", email.toLowerCase()).single();
  if (!user) { console.error("No such user. Invite them first."); process.exit(1); }
  const [{ data: cats }, { data: srcs }] = await Promise.all([
    db.from("categories").select("id,kind").eq("is_active", true),
    db.from("payment_sources").select("id").eq("is_active", true),
  ]);
  const payees = ["Sharma Petrol Pump", "Annapurna Caterers", "R. Kumar", "City Stationers", "Local Transport"];
  const rows = Array.from({ length: 40 }, (_, i) => {
    const c = cats![i % cats!.length]!;
    const d = new Date(Date.now() - (i * 2.2 + 1) * 86_400_000);
    return {
      entry_date: d.toISOString().slice(0, 10), kind: c.kind, category_id: c.id, source_id: srcs![i % srcs!.length]!.id,
      amount: 200 + ((i * 937) % 4800), party: payees[i % payees.length], narration: `Demo entry ${i + 1}`, created_by: user.id,
    };
  });
  const { error } = await db.from("entries").insert(rows);
  console.log(error ? `Failed: ${error.message}` : `Inserted ${rows.length} pending demo entries.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
