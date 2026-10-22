import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { buttonClass } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/shared/page-header";
import { ENTRY_STATUSES, ENTRY_STATUS_LABEL } from "@/lib/constants/entry-status";

export const metadata = { title: "Home" };

export default async function RecordHome() {
  const user = await requireUser();
  const supabase = await createClient();
  const counts = await Promise.all(
    ENTRY_STATUSES.map(async (status) => {
      const { count } = await supabase.from("entries").select("id", { count: "exact", head: true }).eq("created_by", user.id).eq("status", status).is("deleted_at", null);
      return [status, count ?? 0] as const;
    }),
  );
  const byStatus = Object.fromEntries(counts) as Record<(typeof ENTRY_STATUSES)[number], number>;

  return (
    <>
      <PageHeader
        title={`Hello, ${user.profile.full_name.split(" ")[0]}`}
        description="Record income and expenses. The admin reviews every entry before it is final."
        actions={
          <Link href="/record/new" className={buttonClass("primary", "lg")}>
            <Plus className="h-4 w-4" aria-hidden /> New entry
          </Link>
        }
      />
      {byStatus.rejected > 0 ? (
        <Alert tone="danger" className="mb-4">
          {byStatus.rejected} {byStatus.rejected === 1 ? "entry was" : "entries were"} sent back for correction.{" "}
          <Link href="/record/entries?status=rejected" className="font-medium underline">Fix them now</Link>
        </Alert>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ENTRY_STATUSES.map((s) => (
          <Link key={s} href={`/record/entries?status=${s}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardContent className="py-4">
                <p className="text-2xl font-semibold tabular-nums">{byStatus[s]}</p>
                <p className="text-sm text-muted-foreground">{ENTRY_STATUS_LABEL[s]}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
