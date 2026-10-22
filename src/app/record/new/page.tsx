import { requireUser } from "@/lib/auth/get-session";
import { loadFormData } from "@/lib/data/form-data";
import { EntryForm } from "@/components/entry/entry-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createEntryAction } from "./actions";

export const metadata = { title: "New entry" };

export default async function NewEntryPage() {
  await requireUser();
  const data = await loadFormData();
  return (
    <>
      <PageHeader title="New entry" description="Pick the type and category, enter the amount, and attach the bill if you have one." />
      <Card className="max-w-3xl">
        <CardContent className="pt-5">
          <EntryForm mode="create" action={createEntryAction} {...data} />
        </CardContent>
      </Card>
    </>
  );
}
