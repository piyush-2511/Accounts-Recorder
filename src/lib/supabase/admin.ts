import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "../env";

/**
 * Service-role client: BYPASSES row level security. Use only in server code for jobs that
 * genuinely need it (inviting users). Every caller must check `requireAdmin()` first.
 */
export function createAdminClient() {
  return createClient(publicEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
