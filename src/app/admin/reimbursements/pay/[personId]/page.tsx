import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSources } from "@/lib/data/reference";
import { getUnreimbursed } from "@/lib/data/reimbursements";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { ReimburseForm } from "@/components/reimbursement/reimburse-form";
import { todayIST } from "@/lib/format/dates";
import { formatINR } from "@/lib/format/money";
import { uuid } from "@/lib/validation/common";

export const metadata = { title: "Reimburse" };

export default async function PayPage({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  if (!uuid.safeParse(personId).success) notFound();
  const supabase = await createClient();
  const { data: person } = await supabase.from("profiles").select("id, full_name, email").eq("id", personId).maybeSingle();
  if (!person) notFound();

  const [entries, awaiting, sources] = await Promise.all([
    getUnreimbursed(supabase, personId, "approved"),
    getUnreimbursed(supabase, personId, "pending"),
    getSources(supabase, { activeOnly: true }),
  ]);
  const payFrom = sources.filter((s) => s.voucher_mode === "payment_receipt").map((s) => ({ id: s.id, label: s.label }));
  const awaitingTotal = awaiting.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <PageHeader title={`Reimburse ${person.full_name}`} description={person.email} actions={<Link href="/admin/reimbursements" className="text-sm text-primary hover:underline">All reimbursements</Link>} />
      {awaiting.length > 0 ? (
        <Alert tone="info" className="mb-4">
          {awaiting.length} more {awaiting.length === 1 ? "expense" : "expenses"} ({formatINR(awaitingTotal)}) from {person.full_name} {awaiting.length === 1 ? "is" : "are"} pending review and not listed.{" "}
          <Link href="/admin/review" className="font-medium underline">Review them</Link>
        </Alert>
      ) : null}
      {entries.length === 0 ? (
        <EmptyState title="Nothing to reimburse">There are no approved, unreimbursed expenses for this person.</EmptyState>
      ) : payFrom.length === 0 ? (
        <Alert tone="danger">There is no active cash or bank payment source. Add one in Settings &gt; Payment sources.</Alert>
      ) : (
        <Card>
          <CardContent className="pt-5">
            <ReimburseForm personId={person.id} personName={person.full_name} entries={entries} sources={payFrom} today={todayIST()} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
