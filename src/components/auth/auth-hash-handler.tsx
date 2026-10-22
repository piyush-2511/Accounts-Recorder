"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase's default invite and reset emails send people back with the session in the URL
 * fragment (#access_token=...), which servers never see. This turns that into a normal
 * signed-in session, then sends the person to choose their password.
 * Runs on every page so it works wherever the email link lands (home, login, accept-invite).
 */
export function AuthHashHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.length < 2) return;
    const params = new URLSearchParams(hash.slice(1));
    const clean = window.location.pathname + window.location.search;

    if (params.get("error") || params.get("error_code")) {
      window.history.replaceState(null, "", clean);
      router.replace("/login?error=link");
      return;
    }
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    const type = params.get("type");
    void createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        window.history.replaceState(null, "", clean);
        if (error) return router.replace("/login?error=link");
        router.replace(type === "invite" || type === "recovery" ? "/accept-invite" : "/");
        router.refresh();
      });
  }, [router]);

  return null;
}
