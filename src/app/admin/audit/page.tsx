import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Field, Select } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { firstParam } from "@/lib/utils";
import type { AuditRow } from "@/types/db";

export const metadata = { title: "Audit trail" };
const PAGE = 50;
const TABLES = ["entries", "categories", "payment_sources", "profiles", "budgets", "app_settings", "export_batches"];

export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(firstParam(sp.page)) || 1);
  const table = TABLES.includes(firstParam(sp.table) ?? "") ? firstParam(sp.table)! : "";
  const supabase = await createClient();
  let q = supabase.from("audit_log").select("*", { count: "exact" }).order("at", { ascending: false }).range((page - 1) * PAGE, page * PAGE - 1);
  if (table) q = q.eq("table_name", table);
  const { data, count } = await q;
  const rows = (data ?? []) as AuditRow[];
  const ids = [...new Set(rows.map((r) => r.actor).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id as string, p.full_name as string]));

  const summary = (r: AuditRow) => {
    if (r.action === "insert") return "Created";
    if (r.action === "delete") return "Deleted";
    const o = r.old_data ?? {}; const n = r.new_data ?? {};
    const changed = Object.keys(n).filter((k) => k !== "updated_at" && JSON.stringify(o[k]) !== JSON.stringify(n[k]));
    return changed.length ? `Changed ${changed.map((k) => `${k}: ${fmt(o[k])} → ${fmt(n[k])}`).join(", ")}` : "Updated";
  };

  return (
    <>
      <PageHeader title="Audit trail" description="Every change to entries, settings and users. Records cannot be edited or deleted." />
      <form method="get" className="mb-4 flex items-end gap-3">
        <Field label="Show" htmlFor="table"><Select id="table" name="table" defaultValue={table}><option value="">Everything</option>{TABLES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      {rows.length === 0 ? <EmptyState title="No records" /> : (
        <Card>
          <TableWrap>
            <Table>
              <thead><tr><Th>When</Th><Th>Who</Th><Th>Where</Th><Th>What</Th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap">{new Date(r.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</Td>
                    <Td>{r.actor ? names.get(r.actor) ?? "Unknown" : "System"}</Td>
                    <Td className="whitespace-nowrap">{r.table_name} <span className="text-xs text-muted-foreground">{r.row_id.slice(0, 8)}</span></Td>
                    <Td className="max-w-[28rem] break-words text-sm">{summary(r)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      )}
      <Pagination page={page} total={count ?? 0} pageSize={PAGE} params={table ? { table } : {}} basePath="/admin/audit" />
    </>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "empty";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}
