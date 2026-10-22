import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/reference";
import { loadApprovedForExport } from "@/lib/export/service";
import { buildVouchers } from "@/lib/tally/build-vouchers";
import { checkExport } from "@/lib/tally/checks";
import { GenerateForm } from "@/components/export/generate-form";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { Money } from "@/components/shared/money";
import { addDays, formatDMY, isValidISODate, todayIST } from "@/lib/format/dates";
import { fyRange, fyStartYear } from "@/lib/format/financial-year";
import { firstParam } from "@/lib/utils";
import { exportRangeSchema } from "@/lib/validation/export";

export const metadata = { title: "Tally export" };

export default async function ExportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const today = todayIST();
  const fy = fyRange(fyStartYear(today));
  const from = isValidISODate(firstParam(sp.from) ?? "") ? firstParam(sp.from)! : fy.from;
  const to = isValidISODate(firstParam(sp.to) ?? "") ? firstParam(sp.to)! : today;
  const rangeOk = exportRangeSchema.safeParse({ from, to });

  const supabase = await createClient();
  const settings = await getSettings(supabase);
  const { entries, provisional } = rangeOk.success ? await loadApprovedForExport(supabase, from, to, settings.voucherStartNumber) : { entries: [], provisional: new Set<string>() };
  const vouchers = buildVouchers(entries, { voucherPrefix: settings.voucherPrefix });
  const checks = checkExport(vouchers, entries);
  const byId = new Map(entries.map((e) => [e.id, e]));

  const { count: pendingInRange } = await supabase.from("entries").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null).gte("entry_date", from).lte("entry_date", to);
  const defaultCompany = settings.companyName.trim() === "" || settings.companyName === "Your Organisation";

  return (
    <>
      <PageHeader
        title="Tally export"
        description="Only approved entries are exported. Review the vouchers, then generate the files for TallyPrime."
        actions={<Link href="/admin/export/history" className={buttonClass("secondary")}>Past exports</Link>}
      />

      {defaultCompany ? (
        <Alert tone="warning" className="mb-4">
          Set the exact Tally company name in <Link href="/admin/settings" className="font-medium underline">Settings</Link> before exporting, so the import goes into the right company.
        </Alert>
      ) : null}

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <Field label="From" htmlFor="from"><Input id="from" name="from" type="date" defaultValue={from} /></Field>
        <Field label="To" htmlFor="to"><Input id="to" name="to" type="date" defaultValue={to} max={addDays(today, 0)} /></Field>
        <Button type="submit">Preview</Button>
      </form>

      {!rangeOk.success ? <Alert tone="danger" className="mb-4">{rangeOk.error.issues[0]?.message}</Alert> : null}
      {pendingInRange ? (
        <Alert tone="info" className="mb-4">
          {pendingInRange} pending {pendingInRange === 1 ? "entry" : "entries"} in this range {pendingInRange === 1 ? "is" : "are"} not included until approved.{" "}
          <Link href="/admin/review" className="font-medium underline">Open the review queue</Link>
        </Alert>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState title="No approved entries in this range">Approve entries in the review queue, or widen the dates.</EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card>
            <CardHeader>
              <CardTitle>Vouchers to export ({vouchers.length})</CardTitle>
              <CardDescription>Voucher numbers marked * are provisional and are fixed when you generate.</CardDescription>
            </CardHeader>
            <TableWrap>
              <Table>
                <thead><tr><Th>No.</Th><Th>Date</Th><Th>Type</Th><Th>Debit</Th><Th>Credit</Th><Th className="text-right">Amount</Th></tr></thead>
                <tbody>
                  {vouchers.map((v) => (
                    <tr key={v.entryId}>
                      <Td className="whitespace-nowrap">{v.number}{provisional.has(v.entryId) ? "*" : ""}</Td>
                      <Td className="whitespace-nowrap">{formatDMY(v.date)}</Td>
                      <Td>{v.type}</Td>
                      <Td>{v.lines.find((l) => l.side === "Dr")?.ledger}</Td>
                      <Td>{v.lines.find((l) => l.side === "Cr")?.ledger}</Td>
                      <Td className="text-right"><Money value={(v.lines[0]?.paise ?? 0) / 100} /></Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Checks</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="flex items-center gap-2">
                  {checks.ok ? <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> : <AlertTriangle className="h-4 w-4 text-danger" aria-hidden />}
                  {checks.ok ? "Every voucher balances and is ready." : `${checks.issues.length} problem${checks.issues.length === 1 ? "" : "s"} to fix`}
                </p>
                <dl className="grid grid-cols-2 gap-y-1">
                  <dt className="text-muted-foreground">Vouchers</dt><dd className="text-right tabular-nums">{checks.voucherCount}</dd>
                  <dt className="text-muted-foreground">Total debit</dt><dd className="text-right tabular-nums">{checks.totalDebit}</dd>
                  <dt className="text-muted-foreground">Total credit</dt><dd className="text-right tabular-nums">{checks.totalCredit}</dd>
                  <dt className="text-muted-foreground">Company</dt><dd className="truncate text-right">{settings.companyName || "-"}</dd>
                  <dt className="text-muted-foreground">Number prefix</dt><dd className="text-right">{settings.voucherPrefix || "none"}</dd>
                </dl>
                {checks.issues.length > 0 ? (
                  <ul className="list-disc space-y-1 pl-5 text-danger">
                    {checks.issues.slice(0, 8).map((i, n) => (
                      <li key={n}>{i.message} {i.entryId && byId.has(i.entryId) ? <Link href={`/admin/entries/${i.entryId}`} className="underline">Open</Link> : null}</li>
                    ))}
                  </ul>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <GenerateForm from={from} to={to} disabled={!checks.ok || !rangeOk.success} count={vouchers.length} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
