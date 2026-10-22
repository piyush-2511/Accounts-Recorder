import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/lib/data/reference";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { PageHeader } from "@/components/shared/page-header";
import { Flash } from "@/components/shared/flash";
import { saveCategoryAction } from "./actions";

export const metadata = { title: "Categories" };

export default async function Categories({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const cats = await getCategories(await createClient());
  return (
    <>
      <PageHeader title="Categories" description="Recorders only see the category name. The Tally ledger and group are used when you export, so they must match Tally (or will be created by the ledgers.xml import)." />
      <Flash sp={sp} />
      <Card className="mb-6">
        <CardHeader><CardTitle>Add a category</CardTitle></CardHeader>
        <CardContent>
          <form action={saveCategoryAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Name" htmlFor="new-label"><Input id="new-label" name="label" required maxLength={60} /></Field>
            <Field label="Type" htmlFor="new-kind"><Select id="new-kind" name="kind" defaultValue="expense"><option value="expense">Expense</option><option value="income">Income</option></Select></Field>
            <Field label="Tally ledger" htmlFor="new-ledger"><Input id="new-ledger" name="tally_ledger" required maxLength={100} /></Field>
            <Field label="Tally group" htmlFor="new-group"><Input id="new-group" name="tally_group" required maxLength={100} defaultValue="Indirect Expenses" /></Field>
            <input type="hidden" name="is_active" value="on" /><input type="hidden" name="sort_order" value="50" />
            <div className="flex items-end"><SubmitButton pendingText="Adding...">Add</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {cats.map((c) => (
          <Card key={c.id}>
            <CardContent className="py-3">
              <form action={saveCategoryAction} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_0.7fr_1.2fr_1.2fr_0.5fr_auto_auto]">
                <input type="hidden" name="id" value={c.id} />
                <Field label="Name" htmlFor={`l-${c.id}`}><Input id={`l-${c.id}`} name="label" defaultValue={c.label} required /></Field>
                <Field label="Type" htmlFor={`k-${c.id}`}><Select id={`k-${c.id}`} name="kind" defaultValue={c.kind}><option value="expense">Expense</option><option value="income">Income</option></Select></Field>
                <Field label="Tally ledger" htmlFor={`t-${c.id}`}><Input id={`t-${c.id}`} name="tally_ledger" defaultValue={c.tally_ledger} required /></Field>
                <Field label="Tally group" htmlFor={`g-${c.id}`}><Input id={`g-${c.id}`} name="tally_group" defaultValue={c.tally_group} required /></Field>
                <Field label="Order" htmlFor={`o-${c.id}`}><Input id={`o-${c.id}`} name="sort_order" type="number" min={0} defaultValue={c.sort_order} /></Field>
                <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={c.is_active} className="h-4 w-4" /> Active {!c.is_active ? <Badge tone="neutral">hidden</Badge> : null}</label>
                <SubmitButton variant="secondary" pendingText="Saving...">Save</SubmitButton>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
