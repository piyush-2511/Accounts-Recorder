/**
 * Creates the first admin (run once after the migrations):
 *   npm run create:admin -- you@example.org "Your Name" "a-long-password"
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

async function main() {
  config({ path: ".env.local" });
  config();

  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password) {
    console.error('Usage: npm run create:admin -- <email> "<full name>" "<password>"');
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Use a password of at least 10 characters.");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) {
    console.error("Failed:", error.message);
    process.exit(1);
  }
  const { error: roleError } = await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  if (roleError) {
    console.error("User created but promoting to admin failed:", roleError.message);
    process.exit(1);
  }
  console.log(`Admin created: ${data.user.email}. Sign in, then set up two-factor authentication when asked.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
