import type { Metadata, Viewport } from "next";
import { AuthHashHandler } from "@/components/auth/auth-hash-handler";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Accounts Recorder", template: "%s | Accounts Recorder" },
  description: "Record income and expenses, review them, and export to Tally.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e3a8a" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1420" },
  ],
};

// Runs before first paint so there is no light flash for people who chose dark.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||((t===null||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AuthHashHandler />
        {children}
      </body>
    </html>
  );
}
