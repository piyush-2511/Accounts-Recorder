import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Settings" };

const ITEMS = [
  { href: "/admin/settings/general", title: "General", text: "Company name (exactly as in Tally), voucher numbering, limits, XML encoding." },
  { href: "/admin/settings/categories", title: "Categories", text: "Expense and income categories. Each carries the hidden Tally ledger it posts to." },
  { href: "/admin/settings/sources", title: "Payment sources", text: "Cash, bank and loan sources, and how each is posted in Tally." },
  { href: "/admin/settings/budgets", title: "Budgets", text: "Monthly budget per expense category." },
  { href: "/admin/settings/users", title: "Users", text: "Invite recorders and admins, change roles, deactivate accounts." },
];

export default function SettingsHub() {
  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-3 sm:grid-cols-2">
        {ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className="rounded-lg focus-visible:ring-2">
            <Card className="h-full transition-colors hover:bg-muted/50"><CardContent className="py-4"><p className="font-semibold">{i.title}</p><p className="mt-1 text-sm text-muted-foreground">{i.text}</p></CardContent></Card>
          </Link>
        ))}
      </div>
    </>
  );
}
