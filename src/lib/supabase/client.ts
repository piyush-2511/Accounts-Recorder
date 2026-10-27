import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. `detectSessionInUrl` is off on purpose: invite and reset links carry the session in the
 * URL fragment and AuthHashHandler is the one place that reads it. If the library also consumed the
 * fragment, the handler could find it already gone and leave the person stranded on the login page.
 */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { detectSessionInUrl: false },
  });
}
