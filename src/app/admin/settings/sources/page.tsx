import { createClient } from "@/lib/supabase/server";
import { getSources } from "@/lib/data/reference";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { PageHeader } from "@/components/shared/page-header";
import { Flash } from "@/components/shared/flash";
import { saveSourceAction } from "./actions";

export const metadata = { title: "Payment sources" };

const MODES = (
  <>
    <option value="payment_receipt">Payment / Receipt voucher (cash or bank)</option>
    <option value="journal">Journal voucher (loan or adjustment)</option>
  </>
);

export default async function Sources({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const sources = await getSources(await createClient());
  return (
    <>
      <PageHeader title="Payment sources" description="How money moved. Cash and bank post as Payment or Receipt vouchers; a loan source such as “Loan from Secretary” posts as a Journal voucher." />
      <Flash sp={sp} />
      <Card className="mb-6">
        <CardHeader><CardTitle>Add a payment source</CardTitle></CardHeader>
        <CardContent>
          <form action={saveSourceAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Name" htmlFor="n-label"><Input id="n-label" name="label" required maxLength={60} /></Field>
            <Field label="Tally ledger" htmlFor="n-ledger"><Input id="n-ledger" name="tally_ledger" required maxLength={100} /></Field>
            <Field label="Tally group" htmlFor="n-group"><Input id="n-group" name="tally_group" required maxLength={100} defaultValue="Bank Accounts" /></Field>
            <Field label="Posting" htmlFor="n-mode"><Select id="n-mode" name="voucher_mode" defaultValue="payment_receipt">{MODES}</Select></Field>
            <input type="hidden" name="is_active" value="on" /><input type="hidden" name="sort_order" value="50" />
            <div className="flex items-end"><SubmitButton pendingText="Adding...">Add</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {sources.map((s) => (
          <Card key={s.id}>
            <CardContent className="py-3">
              <form action={saveSourceAction} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.2fr_1.2fr_1.4fr_0.5fr_auto_auto]">
                <input type="hidden" name="id" value={s.id} />
                <Field label="Name" htmlFor={`sl-${s.id}`}><Input id={`sl-${s.id}`} name="label" defaultValue={s.label} required /></Field>
                <Field label="Tally ledger" htmlFor={`st-${s.id}`}><Input id={`st-${s.id}`} name="tally_ledger" defaultValue={s.tally_ledger} required /></Field>
                <Field label="Tally group" htmlFor={`sg-${s.id}`}><Input id={`sg-${s.id}`} name="tally_group" defaultValue={s.tally_group} required /></Field>
                <Field label="Posting" htmlFor={`sm-${s.id}`}><Select id={`sm-${s.id}`} name="voucher_mode" defaultValue={s.voucher_mode}>{MODES}</Select></Field>
                <Field label="Order" htmlFor={`so-${s.id}`}><Input id={`so-${s.id}`} name="sort_order" type="number" min={0} defaultValue={s.sort_order} /></Field>
                <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={s.is_active} className="h-4 w-4" /> Active</label>
                <SubmitButton variant="secondary" pendingText="Saving...">Save</SubmitButton>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
