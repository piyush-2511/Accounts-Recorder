import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listReimbursements } from "@/lib/data/reimbursements";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { formatDMY } from "@/lib/format/dates";
import { REIMBURSEMENT_STATUS_LABEL as STATUS_LABEL, REIMBURSEMENT_STATUS_TONE as STATUS_TONE } from "@/lib/constants/reimbursement-status";
import { firstParam } from "@/lib/utils";

export const metadata = { title: "Reimbursement history" };

export default async function ReimbursementHistory({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = firstParam(sp.status) ?? "";
  const personId = firstParam(sp.person) ?? "";
  const supabase = await createClient();
  const [rows, { data: people }] = await Promise.all([
    listReimbursements(supabase, { status, personId: personId || undefined }),
    supabase.from("profiles").select("id, full_name").order("full_name"),
  ]);

  return (
    <>
      <PageHeader title="Reimbursement history" actions={<Link href="/admin/reimbursements" className={buttonClass("secondary")}>Back to reimbursements</Link>} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <Field label="Person" htmlFor="person"><Select id="person" name="person" defaultValue={personId}><option value="">Everyone</option>{(people ?? []).map((p) => <option key={p.id as string} value={p.id as string}>{p.full_name as string}</option>)}</Select></Field>
        <Field label="Status" htmlFor="status"><Select id="status" name="status" defaultValue={status}><option value="">All</option><option value="recorded">Recorded, not exported</option><option value="exported">Exported</option><option value="voided">Voided</option></Select></Field>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="No reimbursements yet" />
      ) : (
        <Card>
          <TableWrap>
            <Table>
              <thead><tr><Th>Paid on</Th><Th>Person</Th><Th className="text-right">Amount</Th><Th className="text-right">Expenses</Th><Th>Paid from</Th><Th>Reference</Th><Th>Status</Th><Th><span className="sr-only">Open</span></Th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={r.status === "voided" ? "opacity-60" : undefined}>
                    <Td className="whitespace-nowrap">{formatDMY(r.paid_on)}</Td>
                    <Td>{r.person?.full_name}</Td>
                    <Td className="text-right"><Money value={r.amount} /></Td>
                    <Td className="text-right tabular-nums">{r.entry_count}</Td>
                    <Td>{r.source?.label}</Td>
                    <Td>{r.reference ?? "-"}</Td>
                    <Td><Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge></Td>
                    <Td className="text-right"><Link href={`/admin/reimbursements/${r.id}`} className={buttonClass("secondary", "sm")}>Open</Link></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}
    </>
  );
}
