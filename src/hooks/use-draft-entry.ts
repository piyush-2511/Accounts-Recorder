"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

/** Keeps an unsaved form in localStorage so a dropped connection or closed tab does not lose it. */
export function useDraft(key: string, enabled: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((): Record<string, string> | null => {
    if (!enabled) return null;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as Record<string, string>) : null;
    } catch {
      return null;
    }
  }, [key, enabled]);

  const save = useCallback(
    (values: Record<string, string>) => {
      if (!enabled) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try {
          window.localStorage.setItem(key, JSON.stringify(values));
        } catch {
          /* storage unavailable (private mode) - ignore */
        }
      }, 400);
    },
    [key, enabled],
  );

  const clear = useCallback(
    (keep?: Record<string, string>) => {
      try {
        if (keep) window.localStorage.setItem(key, JSON.stringify(keep));
        else window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
    [key],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return useMemo(() => ({ load, save, clear }), [load, save, clear]);
}
