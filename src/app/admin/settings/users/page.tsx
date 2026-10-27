import Link from "next/link";
import { requireAdmin } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { PageHeader } from "@/components/shared/page-header";
import { Flash } from "@/components/shared/flash";
import type { Profile } from "@/types/db";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteUserAction, inviteUserAction, resendInviteAction, updateUserAction } from "./actions";

export const metadata = { title: "Users" };

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const me = await requireAdmin();
  const { data } = await (await createClient()).from("profiles").select("*").is("deleted_at", null).order("created_at");
  const users = (data ?? []) as Profile[];
  const { data: authList } = await createAdminClient().auth.admin.listUsers({ perPage: 200 });
  const pending = new Set((authList?.users ?? []).filter((u) => u.user_metadata?.needs_password === true || !u.last_sign_in_at).map((u) => u.id));
  return (
    <>
      <PageHeader title="Users" description="Invited people get an email link to set their password. Admins must also set up two-factor authentication on first sign-in." />
      <Flash sp={sp} />
      <Card className="mb-6">
        <CardHeader><CardTitle>Invite someone</CardTitle></CardHeader>
        <CardContent>
          <form action={inviteUserAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.4fr_0.8fr_auto]">
            <Field label="Full name" htmlFor="i-name"><Input id="i-name" name="full_name" required maxLength={120} autoComplete="off" /></Field>
            <Field label="Email" htmlFor="i-email"><Input id="i-email" name="email" type="email" required autoComplete="off" /></Field>
            <Field label="Role" htmlFor="i-role"><Select id="i-role" name="role" defaultValue="recorder"><option value="recorder">Recorder</option><option value="admin">Admin</option></Select></Field>
            <div className="flex items-end"><SubmitButton pendingText="Sending...">Send invite</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="py-3">
              <form action={updateUserAction} className="grid items-end gap-3 sm:grid-cols-[1.6fr_0.8fr_auto_auto]">
                <input type="hidden" name="id" value={u.id} />
                <div><p className="font-medium">{u.full_name} {u.id === me.profile.id ? <Badge tone="info">you</Badge> : null}{pending.has(u.id) ? <Badge tone="warning">invite pending</Badge> : null}</p><p className="text-sm text-muted-foreground">{u.email}</p></div>
                <Field label="Role" htmlFor={`r-${u.id}`}><Select id={`r-${u.id}`} name="role" defaultValue={u.role}><option value="recorder">Recorder</option><option value="admin">Admin</option></Select></Field>
                <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={u.is_active} className="h-4 w-4" /> Active</label>
                <SubmitButton variant="secondary" pendingText="Saving...">Save</SubmitButton>
                <div className="sm:col-span-4">
                  <Field label="Tally ledger for this person's reimbursements (optional)" htmlFor={`l-${u.id}`} hint={`Leave blank to use “${u.full_name} - Reimbursable”. Changing it only affects expenses recorded from now on.`}>
                    <Input id={`l-${u.id}`} name="reimbursement_ledger" defaultValue={u.reimbursement_ledger ?? ""} maxLength={100} autoComplete="off" />
                  </Field>
                </div>
              </form>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                {pending.has(u.id) ? (
                  <form action={resendInviteAction}>
                    <input type="hidden" name="id" value={u.id} />
                    <SubmitButton variant="ghost" size="sm" pendingText="Sending...">Resend invitation</SubmitButton>
                  </form>
                ) : null}
                {u.role !== "admin" ? (
                  <Link href={`/admin/settings/users/${u.id}`} className="text-sm font-medium text-primary hover:underline">
                    Entry controls{!u.can_record ? " (recording off)" : u.allowed_source_ids || u.allowed_category_ids || !u.can_record_income || u.max_entry_amount ? " (restricted)" : ""}
                  </Link>
                ) : null}
                {u.id !== me.profile.id ? (
                  <form action={deleteUserAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" name="confirm" value="yes" required className="h-4 w-4" /> Yes, remove {u.full_name}. Their entries stay under their name.</label>
                    <SubmitButton variant="ghost" size="sm" className="text-danger" pendingText="Removing...">Delete user</SubmitButton>
                  </form>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
