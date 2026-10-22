import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/get-session";

export default async function RecordLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isAdmin = user.profile.role === "admin";
  return (
    <AppShell
      title="Accounts Recorder"
      userName={user.profile.full_name}
      roleLabel={isAdmin ? "Admin (recording)" : "Recorder"}
      nav={[
        { href: "/record", label: "Home", exact: true },
        { href: "/record/new", label: "New entry" },
        { href: "/record/entries", label: "My entries" },
        ...(isAdmin ? [{ href: "/admin", label: "Back to admin", exact: true }] : []),
      ]}
    >
      {children}
    </AppShell>
  );
}
