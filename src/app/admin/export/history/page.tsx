import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { UnlockButton } from "@/components/export/unlock-button";
import { formatDMY } from "@/lib/format/dates";
import { firstParam } from "@/lib/utils";
import type { ExportBatch } from "@/types/db";

export const metadata = { title: "Past exports" };

export default async function ExportHistoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("export_batches").select("*").order("created_at", { ascending: false }).limit(100);
  const batches = (data ?? []) as ExportBatch[];
  const newId = firstParam(sp.new);

  return (
    <>
      <PageHeader title="Past exports" description="Download any batch again. Files are kept even after unlocking." />
      {newId ? (
        <Alert tone="success" className="mb-4">
          Export created. Import <strong>ledgers.xml</strong> first (only needed when ledgers are new), then <strong>vouchers.xml</strong>, in TallyPrime: Import → choose the file.
        </Alert>
      ) : null}
      {firstParam(sp.unlocked) ? <Alert tone="success" className="mb-4">Batch unlocked. {firstParam(sp.unlocked)} entries are Approved again.</Alert> : null}
      {firstParam(sp.error) ? <Alert tone="danger" className="mb-4">{firstParam(sp.error)}</Alert> : null}

      {batches.length === 0 ? (
        <EmptyState title="No exports yet" />
      ) : (
        <Card>
          <TableWrap>
            <Table>
              <thead><tr><Th>Created</Th><Th>Period</Th><Th className="text-right">Vouchers</Th><Th className="text-right">Total</Th><Th>Files</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className={b.id === newId ? "bg-success/5" : undefined}>
                    <Td className="whitespace-nowrap">{new Date(b.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</Td>
                    <Td className="whitespace-nowrap">{formatDMY(b.date_from)} to {formatDMY(b.date_to)}</Td>
                    <Td className="text-right tabular-nums">{b.entry_count}</Td>
                    <Td className="text-right"><Money value={b.total_amount} /></Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {(["ledgers", "vouchers", "xlsx", "zip"] as const).map((f) => (
                          <a key={f} href={`/api/export/${b.id}?file=${f}`} className={buttonClass("secondary", "sm")}>
                            {f === "ledgers" ? "ledgers.xml" : f === "vouchers" ? "vouchers.xml" : f === "xlsx" ? "Excel" : "Vouchers ZIP"}
                          </a>
                        ))}
                      </div>
                    </Td>
                    <Td className="text-right">{b.unlocked_at ? <Badge tone="neutral">Unlocked</Badge> : <UnlockButton batchId={b.id} count={b.entry_count} />}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>How to import into TallyPrime</CardTitle></CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Open the correct company in TallyPrime.</li>
            <li>Go to <strong>Import</strong> (Alt+O) → <strong>Data</strong> (or Masters) and choose <strong>ledgers.xml</strong>. Set the option for existing masters to ignore/skip duplicates.</li>
            <li>Repeat with <strong>vouchers.xml</strong> (Import → Vouchers).</li>
            <li>Check the result summary shows 0 errors, and the voucher count and total match this screen.</li>
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">Full steps and troubleshooting are in docs/tally-import-runbook.md.</p>
        </CardContent>
      </Card>
    </>
  );
}
