import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";

/**
 * Email links (invite, password reset) land here. Three shapes are supported:
 *  1. ?token_hash=...&type=invite|recovery   (recommended email templates, see README)
 *  2. ?code=...                              (PKCE links, e.g. from "Forgot password")
 *  3. neither: the session may be in the URL fragment, so hand over to the page that reads it.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"), "/accept-invite");

  const to = (pathname: string, search = "") => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = search;
    return NextResponse.redirect(url);
  };

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return error ? to("/login", "?error=link") : to(next);
  }
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? to("/login", "?error=link") : to(next);
  }
  // Fragment-style link: keep the fragment (browsers carry it across redirects) and let the client read it.
  return to(next);
}
