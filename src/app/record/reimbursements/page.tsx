import Link from "next/link";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { getUnreimbursed, listReimbursements } from "@/lib/data/reimbursements";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { Kpi } from "@/components/reports/charts";
import { REIMBURSEMENT_STATUS_LABEL } from "@/lib/constants/reimbursement-status";
import { formatDMY } from "@/lib/format/dates";
import { formatINR } from "@/lib/format/money";

export const metadata = { title: "My reimbursements" };

export default async function MyReimbursements() {
  const user = await requireUser();
  const supabase = await createClient();
  const [owed, waiting, paid] = await Promise.all([
    getUnreimbursed(supabase, user.id, "approved"),
    getUnreimbursed(supabase, user.id, "pending"),
    listReimbursements(supabase, { personId: user.id, limit: 50 }),
  ]);
  const owedTotal = owed.reduce((s, e) => s + e.amount, 0);
  const waitingTotal = waiting.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <PageHeader
        title="My reimbursements"
        description="Money you paid for the organisation from your own pocket, and what has been paid back."
        actions={<Link href="/record/new" className={buttonClass("primary")}>New entry</Link>}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Kpi label="Waiting to be paid back" value={formatINR(owedTotal)} tone={owedTotal > 0 ? "expense" : "neutral"} sub={`${owed.length} approved ${owed.length === 1 ? "expense" : "expenses"}`} />
        <Kpi label="Waiting for admin approval" value={formatINR(waitingTotal)} sub={`${waiting.length} ${waiting.length === 1 ? "expense" : "expenses"}`} />
      </div>
      <Alert tone="info" className="mb-5">
        Paid for something yourself? When you record it, choose <strong>Paid by me (reimburse later)</strong> as the payment source. Once the admin approves it, it shows here until you are paid back.
      </Alert>

      {owed.length + waiting.length > 0 ? (
        <Card className="mb-6">
          <CardHeader><CardTitle>Not yet paid back</CardTitle></CardHeader>
          <TableWrap>
            <Table>
              <thead><tr><Th>Date</Th><Th>Category</Th><Th>Details</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {[...owed, ...waiting].map((e) => (
                  <tr key={e.id}>
                    <Td className="whitespace-nowrap">{formatDMY(e.entry_date)}</Td>
                    <Td>{e.category?.label}</Td>
                    <Td>{e.narration}</Td>
                    <Td><Badge tone={e.status === "pending" ? "warning" : "info"}>{e.status === "pending" ? "Awaiting approval" : "Approved, awaiting payment"}</Badge></Td>
                    <Td className="text-right"><Money value={e.amount} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>Paid back to you</CardTitle></CardHeader>
        {paid.filter((r) => r.status !== "voided").length === 0 ? (
          <div className="px-5 pb-5"><EmptyState title="Nothing paid back yet" /></div>
        ) : (
          <TableWrap>
            <Table>
              <thead><tr><Th>Paid on</Th><Th className="text-right">Amount</Th><Th className="text-right">Expenses</Th><Th>Paid from</Th><Th>Reference</Th></tr></thead>
              <tbody>
                {paid.filter((r) => r.status !== "voided").map((r) => (
                  <tr key={r.id} title={REIMBURSEMENT_STATUS_LABEL[r.status]}>
                    <Td className="whitespace-nowrap">{formatDMY(r.paid_on)}</Td>
                    <Td className="text-right"><Money value={r.amount} tone="income" /></Td>
                    <Td className="text-right tabular-nums">{r.entry_count}</Td>
                    <Td>{r.source?.label}</Td>
                    <Td>{r.reference ?? "-"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
