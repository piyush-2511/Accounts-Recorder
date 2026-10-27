import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReimbursement } from "@/lib/data/reimbursements";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { PrintButton } from "@/components/reports/print-button";
import { formatDMY } from "@/lib/format/dates";
import { firstParam } from "@/lib/utils";
import { uuid } from "@/lib/validation/common";
import { voidReimbursementAction } from "../actions";
import { REIMBURSEMENT_STATUS_LABEL as STATUS_LABEL, REIMBURSEMENT_STATUS_TONE as STATUS_TONE } from "@/lib/constants/reimbursement-status";

export const metadata = { title: "Reimbursement" };

export default async function ReimbursementDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const sp = await searchParams;
  const found = await getReimbursement(await createClient(), id);
  if (!found) notFound();
  const { row: r, entries } = found;

  return (
    <>
      <PageHeader
        title={`Reimbursement to ${r.person?.full_name ?? "staff"}`}
        description={`Paid on ${formatDMY(r.paid_on)} from ${r.source?.label ?? "-"}`}
        actions={<><PrintButton /><Link href="/admin/reimbursements/history" className="text-sm text-primary hover:underline">All reimbursements</Link></>}
      />
      {firstParam(sp.done) ? <Alert tone="success" className="mb-4">Reimbursement recorded. It will be included in your next Tally export (Tally export &gt; choose a range that includes {formatDMY(r.paid_on)}).</Alert> : null}
      {firstParam(sp.voided) ? <Alert tone="success" className="mb-4">Reimbursement voided. The expenses are owed again.</Alert> : null}
      {firstParam(sp.error) ? <Alert tone="danger" className="mb-4">{firstParam(sp.error)}</Alert> : null}

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-1 pt-5 text-sm">
            <p className="text-2xl font-semibold tabular-nums"><Money value={r.amount} /></p>
            <p><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></p>
            <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-1">
              <dt className="text-muted-foreground">Expenses</dt><dd>{r.entry_count}</dd>
              <dt className="text-muted-foreground">Reference</dt><dd>{r.reference ?? "-"}</dd>
              <dt className="text-muted-foreground">Note</dt><dd>{r.note ?? "-"}</dd>
              <dt className="text-muted-foreground">Recorded</dt><dd>{new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</dd>
              <dt className="text-muted-foreground">Tally voucher</dt><dd>{r.voucher_no ? `R-${r.voucher_no}` : "not numbered yet"}</dd>
              {r.status === "voided" ? <><dt className="text-muted-foreground">Void reason</dt><dd>{r.void_reason}</dd></> : null}
            </dl>
          </CardContent>
        </Card>
        {r.status !== "voided" ? (
          <Card className="no-print">
            <CardHeader><CardTitle>Made a mistake?</CardTitle></CardHeader>
            <CardContent>
              {r.status === "exported" ? (
                <p className="text-sm text-muted-foreground">This is already in an export batch. Delete its voucher in Tally if it was imported, unlock the batch under Tally export &gt; Past exports, then void it here.</p>
              ) : (
                <form action={voidReimbursementAction} className="space-y-3">
                  <input type="hidden" name="id" value={r.id} />
                  <Field label="Reason for voiding" htmlFor="reason" hint="The expenses become “owed” again so you can reimburse them correctly."><Textarea id="reason" name="reason" required minLength={5} maxLength={300} rows={2} /></Field>
                  <SubmitButton variant="danger" pendingText="Voiding...">Void reimbursement</SubmitButton>
                </form>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader><CardTitle>Expenses covered</CardTitle></CardHeader>
        <TableWrap>
          <Table>
            <thead><tr><Th>Date</Th><Th>Category</Th><Th>Details</Th><Th className="text-right">Amount</Th></tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <Td className="whitespace-nowrap">{formatDMY(e.entry_date)}</Td>
                  <Td>{e.category?.label}</Td>
                  <Td>{e.narration}{e.party ? <span className="text-muted-foreground"> · {e.party}</span> : null}</Td>
                  <Td className="text-right"><Money value={e.amount} /></Td>
                </tr>
              ))}
              {entries.length === 0 ? <tr><Td colSpan={4} className="py-6 text-center text-muted-foreground">No expenses are linked (this reimbursement was voided).</Td></tr> : null}
            </tbody>
          </Table>
        </TableWrap>
      </Card>
    </>
  );
}
