import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { Kpi } from "@/components/reports/charts";
import { formatDMY } from "@/lib/format/dates";
import { formatINR } from "@/lib/format/money";
import type { Statement } from "@/lib/reimbursement/statement";

/** The account statement: summary figures plus every expense and repayment with a running balance. */
export function StatementView({ statement, name }: { statement: Statement; name?: string }) {
  const s = statement;
  return (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label={name ? `Owed to ${name}` : "Owed to you"} value={formatINR(s.owed)} tone={s.owed > 0 ? "expense" : "neutral"} sub="Approved, not yet paid back" />
        <Kpi label="Spent on behalf of the organisation" value={formatINR(s.totalSpent)} sub="Approved expenses" />
        <Kpi label="Paid back so far" value={formatINR(s.totalPaidBack)} tone={s.totalPaidBack > 0 ? "income" : "neutral"} />
        <Kpi label="Awaiting approval" value={formatINR(s.pending)} sub={s.rejected > 0 ? `${formatINR(s.rejected)} rejected` : "Not counted yet"} />
      </div>

      <Card>
        <CardHeader><CardTitle>Account statement</CardTitle></CardHeader>
        {s.rows.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState title="No activity yet">Expenses recorded with “Paid by me (reimburse later)” and the repayments made against them appear here.</EmptyState></div>
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr><Th>Date</Th><Th>Details</Th><Th>Status</Th><Th className="text-right">Spent</Th><Th className="text-right">Paid back</Th><Th className="text-right">Balance owed</Th></tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.key} className={r.status === "rejected" ? "opacity-60" : undefined}>
                    <Td className="whitespace-nowrap">{formatDMY(r.date)}</Td>
                    <Td>
                      {r.description}
                      {r.detail ? <span className="block text-xs text-muted-foreground">{r.detail}</span> : null}
                    </Td>
                    <Td>
                      {r.type === "paid" ? <Badge tone="success">Paid back</Badge>
                        : r.status === "pending" ? <Badge tone="warning">Awaiting approval</Badge>
                        : r.status === "rejected" ? <Badge tone="danger">Rejected</Badge>
                        : <Badge tone="info">Approved</Badge>}
                    </Td>
                    <Td className="text-right">{r.spent !== null ? <Money value={r.spent} /> : ""}</Td>
                    <Td className="text-right">{r.paidBack !== null ? <Money value={r.paidBack} tone="income" /> : ""}</Td>
                    <Td className="text-right font-medium tabular-nums">{r.balance !== null ? formatINR(r.balance) : <span className="text-muted-foreground">-</span>}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/40 font-semibold">
                  <Td colSpan={3}>Total</Td>
                  <Td className="text-right tabular-nums">{formatINR(s.totalSpent)}</Td>
                  <Td className="text-right tabular-nums">{formatINR(s.totalPaidBack)}</Td>
                  <Td className="text-right tabular-nums">{formatINR(s.owed)}</Td>
                </tr>
              </tfoot>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
