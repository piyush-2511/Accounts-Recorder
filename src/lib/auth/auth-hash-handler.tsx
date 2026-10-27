"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase's invite and reset emails send people back with the session in the URL fragment
 * (#access_token=...), which servers never see. This turns it into a signed-in session and then
 * does a full page load of the password page, so the new cookies are always sent and no cached
 * page can get in the way. Runs on every page, so it works wherever the email link lands.
 */
export function AuthHashHandler() {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.length < 2) return;
    const params = new URLSearchParams(hash.slice(1));
    const clean = window.location.pathname + window.location.search;

    if (params.get("error") || params.get("error_code")) {
      window.history.replaceState(null, "", clean);
      window.location.replace("/login?error=link");
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
        if (error) return window.location.replace("/login?error=link");
        window.location.replace(type === "invite" || type === "recovery" ? "/accept-invite" : "/");
      });
  }, []);

  return null;
}
