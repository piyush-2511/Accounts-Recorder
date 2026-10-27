import { NextResponse, type NextRequest } from "next/server";
import { updateSession, redirectWithCookies } from "@/lib/supabase/middleware";

// /accept-invite is reachable without a session on purpose: invite emails land there with the session in the
// URL fragment (which the server cannot see), and the page signs the person in before showing the form.
const PUBLIC = ["/login", "/forgot-password", "/auth/confirm", "/accept-invite", "/api/health"];
const MFA_EXEMPT = ["/mfa", "/logout", "/auth/confirm", "/accept-invite", "/login", "/forgot-password", "/api/health"];

const isPublic = (p: string) => PUBLIC.some((x) => p === x || p.startsWith(`${x}/`));
const isExemptFromMfa = (p: string) => MFA_EXEMPT.some((x) => p === x || p.startsWith(`${x}/`));

export async function middleware(request: NextRequest) {
  const { supabase, user, getResponse } = await updateSession(request);
  const path = request.nextUrl.pathname;
  const isApi = path.startsWith("/api/");
  const res = getResponse();

  if (!user) {
    if (isPublic(path)) return res;
    if (isApi) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    const next = path + request.nextUrl.search;
    return redirectWithCookies(request, res, `/login?next=${encodeURIComponent(next)}`);
  }

  // Signed in: load the profile (role, active flag).
  const { data: profile } = await supabase.from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    if (isApi) return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    return redirectWithCookies(request, res, "/login?error=inactive");
  }

  const home = profile.role === "admin" ? "/admin" : "/record";

  // Invited (or reset) users have a session but no password yet: they can only choose one.
  const needsPassword = user.user_metadata?.needs_password === true;
  if (needsPassword && !["/accept-invite", "/logout", "/auth/confirm"].some((x) => path === x || path.startsWith(`${x}/`))) {
    return isApi ? NextResponse.json({ error: "Choose a password first" }, { status: 403 }) : redirectWithCookies(request, res, "/accept-invite");
  }

  if (path === "/" || path === "/login" || path === "/forgot-password") {
    return redirectWithCookies(request, res, home);
  }
  if (profile.role !== "admin" && (path.startsWith("/admin") || path.startsWith("/api/export") || path.startsWith("/api/reports"))) {
    return isApi ? NextResponse.json({ error: "Forbidden" }, { status: 403 }) : redirectWithCookies(request, res, "/record");
  }

  // Admins must complete TOTP two-factor sign-in (aal2) before reaching anything else.
  if (profile.role === "admin" && !isExemptFromMfa(path)) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.currentLevel !== "aal2") {
      if (isApi) return NextResponse.json({ error: "Two-factor sign-in required" }, { status: 401 });
      return redirectWithCookies(request, res, `/mfa?next=${encodeURIComponent(path + request.nextUrl.search)}`);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
