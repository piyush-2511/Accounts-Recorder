import { Alert } from "@/components/ui/alert";
import { requireUser } from "@/lib/auth/get-session";
import { loadFormData } from "@/lib/data/form-data";
import { EntryForm } from "@/components/entry/entry-form";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createEntryAction } from "./actions";

export const metadata = { title: "New entry" };

export default async function NewEntryPage() {
  const user = await requireUser();
  if (user.profile.role !== "admin" && !user.profile.can_record) {
    return (
      <>
        <PageHeader title="New entry" />
        <Alert tone="warning">Your account is not allowed to record new entries right now. Please contact your administrator.</Alert>
      </>
    );
  }
  const data = await loadFormData(user.profile);
  if (data.categories.length === 0 || data.sources.length === 0) {
    return (
      <>
        <PageHeader title="New entry" />
        <Alert tone="warning">No categories or payment sources are available for your account. Please contact your administrator.</Alert>
      </>
    );
  }
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
