import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOwedPeople } from "@/lib/data/reimbursements";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { Kpi } from "@/components/reports/charts";
import { daysBetween, formatDMY, todayIST } from "@/lib/format/dates";
import { formatINR } from "@/lib/format/money";

export const metadata = { title: "Reimbursements" };

export default async function ReimbursementsPage() {
  let people;
  try {
    people = await getOwedPeople(await createClient());
  } catch {
    return (
      <>
        <PageHeader title="Reimbursements" />
        <Alert tone="danger">
          Reimbursements are not available yet. The database is missing the latest update. In your project run <code className="rounded bg-muted px-1">npx supabase db push</code> to apply
          migrations 0011 and 0012, wait a few seconds, then refresh this page.
        </Alert>
      </>
    );
  }
  const today = todayIST();
  const owed = people.filter((p) => p.owed_count > 0);
  const waiting = people.filter((p) => p.awaiting_count > 0);
  const totalOwed = owed.reduce((s, p) => s + p.owed_total, 0);
  const totalWaiting = waiting.reduce((s, p) => s + p.awaiting_total, 0);

  return (
    <>
      <PageHeader
        title="Reimbursements"
        description="Staff who paid for the organisation from their own pocket. Pay them back here; the matching Tally voucher is created for you."
        actions={<Link href="/admin/reimbursements/history" className={buttonClass("secondary")}>History</Link>}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Kpi label="Owed to staff (approved)" value={formatINR(totalOwed)} tone={totalOwed > 0 ? "expense" : "neutral"} sub={`${owed.length} ${owed.length === 1 ? "person" : "people"}`} />
        <Kpi label="Waiting for your approval" value={formatINR(totalWaiting)} sub={`${waiting.reduce((s, p) => s + p.awaiting_count, 0)} entries`} />
      </div>

      {totalWaiting > 0 ? (
        <Alert tone="info" className="mb-4">
          {formatINR(totalWaiting)} of personally paid expenses are still pending review and cannot be reimbursed yet.{" "}
          <Link href="/admin/review" className="font-medium underline">Open the review queue</Link>
        </Alert>
      ) : null}

      {owed.length === 0 ? (
        <EmptyState title="Nobody is waiting to be reimbursed">Approved expenses recorded with “Paid by me (reimburse later)” will appear here.</EmptyState>
      ) : (
        <Card>
          <TableWrap>
            <Table>
              <thead><tr><Th>Person</Th><Th className="text-right">Expenses</Th><Th className="text-right">Owed</Th><Th>Oldest</Th><Th className="text-right">Still pending</Th><Th><span className="sr-only">Action</span></Th></tr></thead>
              <tbody>
                {owed.map((p) => {
                  const age = p.oldest ? daysBetween(p.oldest, today) : 0;
                  return (
                    <tr key={p.person_id}>
                      <Td><Link href={`/admin/reimbursements/staff/${p.person_id}`} className="font-medium text-primary hover:underline">{p.full_name}</Link><span className="block text-xs text-muted-foreground">{p.email}</span></Td>
                      <Td className="text-right tabular-nums">{p.owed_count}</Td>
                      <Td className="text-right font-medium"><Money value={p.owed_total} /></Td>
                      <Td className="whitespace-nowrap">{p.oldest ? formatDMY(p.oldest) : "-"}{age > 30 ? <span className="ml-1 text-xs text-warning">{age} days</span> : null}</Td>
                      <Td className="text-right text-muted-foreground">{p.awaiting_count ? `${p.awaiting_count} · ${formatINR(p.awaiting_total)}` : "-"}</Td>
                      <Td className="text-right"><Link href={`/admin/reimbursements/pay/${p.person_id}`} className={buttonClass("primary", "sm")}>Reimburse</Link></Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}
    </>
  );
}
