import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getEntry } from "@/lib/data/entries";
import { loadFormData } from "@/lib/data/form-data";
import { EntryForm } from "@/components/entry/entry-form";
import { EntryDetails } from "@/components/entry/entry-details";
import { VoucherViewer } from "@/components/review/voucher-viewer";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { adminUpdateEntryAction, adminDeleteEntryAction } from "../actions";
import { formatDMY } from "@/lib/format/dates";
import { firstParam } from "@/lib/utils";
import { uuid } from "@/lib/validation/common";
import type { AuditRow } from "@/types/db";

export const metadata = { title: "Entry" };

export default async function AdminEntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const sp = await searchParams;
  const from = firstParam(sp.from) === "review" ? "review" : "";

  const supabase = await createClient();
  const entry = await getEntry(supabase, id);
  if (!entry) notFound();

  const locked = entry.status === "exported";
  const [data, history] = await Promise.all([
    locked ? Promise.resolve(null) : loadFormData(),
    supabase.from("audit_log").select("*").eq("table_name", "entries").eq("row_id", id).order("at", { ascending: false }).limit(30),
  ]);
  const log = (history.data ?? []) as AuditRow[];

  return (
    <>
      <PageHeader
        title="Entry"
        description={`${entry.creator?.full_name ?? ""} · ${formatDMY(entry.entry_date)}`}
        actions={<StatusChip status={entry.status} />}
      />
      {firstParam(sp.error) ? <Alert tone="danger" className="mb-3">{firstParam(sp.error)}</Alert> : null}
      {locked ? <Alert tone="info" className="mb-4">This entry is part of an export batch and is locked. Unlock the batch on the Tally export page to change it.</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
        <Card>
          <CardContent className="pt-5">
            {data ? (
              <>
                <EntryForm
                  mode="admin"
                  action={adminUpdateEntryAction}
                  entry={entry}
                  canApprove={entry.status === "pending"}
                  backHref={from === "review" ? "/admin/review" : "/admin/entries"}
                  hidden={from ? { from } : undefined}
                  {...data}
                />
                <form action={adminDeleteEntryAction} className="mt-6 border-t pt-4">
                  <input type="hidden" name="id" value={entry.id} />
                  <Button type="submit" variant="ghost" className="text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" aria-hidden /> Delete entry</Button>
                </form>
              </>
            ) : (
              <EntryDetails entry={entry} />
            )}
          </CardContent>
        </Card>
        <div className="space-y-4">
          {entry.receipt_path ? (
            <Card>
              <CardHeader><CardTitle>Voucher</CardTitle></CardHeader>
              <CardContent><VoucherViewer entryId={entry.id} mime={entry.receipt_mime} size={entry.receipt_size} /></CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader><CardTitle>History</CardTitle></CardHeader>
            <CardContent>
              {log.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes recorded.</p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {log.map((l) => (
                    <li key={l.id} className="border-l-2 pl-3">
                      <span className="font-medium">{l.action.replace("status:", "Status: ")}</span>
                      <span className="block text-xs text-muted-foreground">{new Date(l.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
