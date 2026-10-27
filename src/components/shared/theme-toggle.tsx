"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Mode = "system" | "light" | "dark";
const ORDER: Mode[] = ["system", "light", "dark"];
const LABEL: Record<Mode, string> = { system: "Theme: follow device", light: "Theme: light", dark: "Theme: dark" };

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function readMode(): Mode {
  try {
    const v = localStorage.getItem("theme");
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

/** Cycles device default, light and dark. The choice is remembered in this browser. */
export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    setMode(readMode());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (readMode() === "system") apply("system"); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function next() {
    const m = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]!;
    setMode(m);
    try {
      if (m === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", m);
    } catch {
      /* storage blocked: the choice still applies for this visit */
    }
    // Also kept in a cookie so the server can render the right theme on the very first paint.
    try {
      document.cookie = m === "system" ? "theme=; Path=/; Max-Age=0; SameSite=Lax" : `theme=${m}; Path=/; Max-Age=31536000; SameSite=Lax`;
    } catch {
      /* cookies blocked */
    }
    apply(m);
  }

  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;
  return (
    <Button type="button" variant="ghost" size="sm" onClick={next} aria-label={`${LABEL[mode]}. Click to change.`} title={LABEL[mode]}>
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  );
}
