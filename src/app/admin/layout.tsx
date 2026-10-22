import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { pendingCount } from "@/lib/data/entries";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const pending = await pendingCount(supabase);
  return (
    <AppShell
      title="Accounts Recorder"
      userName={user.profile.full_name}
      roleLabel="Admin"
      nav={[
        { href: "/admin", label: "Dashboard", exact: true },
        { href: "/admin/review", label: "Review", badge: pending },
        { href: "/admin/entries", label: "Entries" },
        { href: "/admin/reports", label: "Reports" },
        { href: "/admin/export", label: "Tally export" },
        { href: "/admin/settings", label: "Settings" },
        { href: "/admin/audit", label: "Audit" },
        { href: "/record/new", label: "Record entry" },
      ]}
    >
      {children}
    </AppShell>
  );
}
