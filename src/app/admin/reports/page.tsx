import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = { title: "Reports" };

const REPORTS = [
  { href: "/admin/reports/category", title: "By category", text: "Fuel, fooding, staff and the rest: amount and share of spending." },
  { href: "/admin/reports/programme", title: "By programme", text: "Spend and income per programme, for donor and CSR utilisation reports." },
  { href: "/admin/reports/payee", title: "By payee", text: "Who received or paid the most money, with entry counts." },
  { href: "/admin/reports/sources", title: "Payment sources", text: "Cash, bank and loan movement, including how much is owed to loan ledgers." },
  { href: "/admin/reports/budget", title: "Budget vs actual", text: "Monthly budget per category with warnings, forecast and suggestions." },
  { href: "/admin/reports/recorders", title: "By recorder", text: "How many entries and how much each recorder has entered." },
  { href: "/admin/reports/checks", title: "Checks", text: "Missing vouchers, possible duplicates and unusually high amounts." },
  { href: "/admin/reports/monthly", title: "Monthly report", text: "A printable one-page summary you can save as PDF." },
];

export default function ReportsHub() {
  return (
    <>
      <PageHeader title="Reports" description="All reports work for any month, financial year (April to March) or custom dates." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="rounded-lg focus-visible:ring-2">
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardContent className="py-4">
                <p className="font-semibold">{r.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.text}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
