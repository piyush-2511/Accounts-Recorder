import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { getEntry } from "@/lib/data/entries";
import { loadFormData } from "@/lib/data/form-data";
import { EntryForm } from "@/components/entry/entry-form";
import { EntryDetails } from "@/components/entry/entry-details";
import { PageHeader } from "@/components/shared/page-header";
import { StatusChip } from "@/components/shared/status-chip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RECORDER_EDITABLE } from "@/lib/constants/entry-status";
import { updateEntryAction, deleteEntryAction } from "./actions";
import { uuid } from "@/lib/validation/common";

export const metadata = { title: "Entry" };

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const user = await requireUser();
  const supabase = await createClient();
  const entry = await getEntry(supabase, id);
  if (!entry || entry.created_by !== user.id) notFound();

  const editable = RECORDER_EDITABLE.includes(entry.status);
  const data = editable ? await loadFormData() : null;

  return (
    <>
      <PageHeader title={editable ? "Edit entry" : "Entry"} description={`Status: ${entry.status}`} actions={<StatusChip status={entry.status} />} />
      <Card className="max-w-3xl">
        <CardContent className="pt-5">
          {editable && data ? (
            <>
              <EntryForm mode="edit" action={updateEntryAction} entry={entry} backHref="/record/entries" {...data} />
              <form action={deleteEntryAction} className="mt-6 border-t pt-4">
                <input type="hidden" name="id" value={entry.id} />
                <Button type="submit" variant="ghost" className="text-danger hover:bg-danger/10">
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete this entry
                </Button>
              </form>
            </>
          ) : (
            <EntryDetails entry={entry} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
