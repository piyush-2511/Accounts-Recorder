import { AppShell } from "@/components/layout/app-shell";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { pendingCount } from "@/lib/data/entries";
import { getOwedPeople } from "@/lib/data/reimbursements";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const [pending, owed] = await Promise.all([pendingCount(supabase), getOwedPeople(supabase).catch(() => [])]);
  const peopleOwed = owed.filter((p) => p.owed_count > 0).length;
  return (
    <AppShell
      title="Accounts Recorder"
      userName={user.profile.full_name}
      roleLabel="Admin"
      nav={[
        { href: "/admin", label: "Dashboard", exact: true },
        { href: "/admin/review", label: "Review", badge: pending },
        { href: "/admin/entries", label: "Entries" },
        { href: "/admin/reimbursements", label: "Reimburse", badge: peopleOwed },
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