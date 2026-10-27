import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { getCategories, getSettings, getSources } from "@/lib/data/reference";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { PageHeader } from "@/components/shared/page-header";
import { Flash } from "@/components/shared/flash";
import { uuid } from "@/lib/validation/common";
import type { Profile } from "@/types/db";
import { saveControlsAction } from "../actions";

export const metadata = { title: "Entry controls" };

function Check({ name, value, label, checked, hint }: { name: string; value?: string | number; label: string; checked: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={checked} className="mt-0.5 h-4 w-4" />
      <span>{label}{hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}</span>
    </label>
  );
}

export default async function EntryControls({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!data) notFound();
  const u = data as Profile;
  const [categories, sources, settings] = await Promise.all([getCategories(supabase, { activeOnly: true }), getSources(supabase, { activeOnly: true }), getSettings(supabase)]);
  const srcOn = (sid: number) => !u.allowed_source_ids || u.allowed_source_ids.includes(sid);
  const catOn = (cid: number) => !u.allowed_category_ids || u.allowed_category_ids.includes(cid);

  return (
    <>
      <PageHeader
        title={`Entry controls: ${u.full_name}`}
        description="Decide what this person can record. The rules are enforced by the database, so they cannot be bypassed."
        actions={<Link href="/admin/settings/users" className="text-sm text-primary hover:underline">All users</Link>}
      />
      <Flash sp={sp} />
      {u.role === "admin" ? <Alert tone="info" className="mb-4">Admins are never restricted. These controls only apply to recorders.</Alert> : null}
      <form action={saveControlsAction} className="max-w-3xl space-y-4">
        <input type="hidden" name="id" value={u.id} />
        <Card>
          <CardHeader><CardTitle>New entries page</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Check name="can_record" label="Can record new entries" checked={u.can_record} hint="Switch off to stop this person adding entries (they can still see their old ones)." />
            <Check name="can_record_income" label="Can record income" checked={u.can_record_income} hint="Off: they can only record expenses." />
            <Field label="Highest amount per entry (optional)" htmlFor="max_entry_amount" hint={`Leave blank for the organisation limit (${settings.maxAmount.toLocaleString("en-IN")}). Larger amounts must be entered by an admin.`}>
              <Input id="max_entry_amount" name="max_entry_amount" type="number" min="1" step="0.01" inputMode="decimal" defaultValue={u.max_entry_amount ?? ""} className="max-w-48" />
            </Field>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payment sources they may use</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {sources.map((s) => <Check key={s.id} name="source_ids" value={s.id} label={s.label} checked={srcOn(s.id)} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Categories they may use</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {(["expense", "income"] as const).map((kind) => (
              <div key={kind}>
                <p className="mb-2 text-sm font-medium">{kind === "expense" ? "Expense categories" : "Income categories"}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {categories.filter((c) => c.kind === kind).map((c) => <Check key={c.id} name="category_ids" value={c.id} label={c.label} checked={catOn(c.id)} />)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <SubmitButton size="lg" pendingText="Saving...">Save controls</SubmitButton>
      </form>
    </>
  );
}
