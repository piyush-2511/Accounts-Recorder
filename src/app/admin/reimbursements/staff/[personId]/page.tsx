import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStaffStatement } from "@/lib/data/reimbursements";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "@/components/reports/print-button";
import { StatementView } from "@/components/reimbursement/statement-view";
import { uuid } from "@/lib/validation/common";

export const metadata = { title: "Staff account" };

export default async function StaffAccount({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = await params;
  if (!uuid.safeParse(personId).success) notFound();
  const supabase = await createClient();
  const { data: person } = await supabase.from("profiles").select("id, full_name, email").eq("id", personId).maybeSingle();
  if (!person) notFound();

  let statement;
  try {
    statement = await getStaffStatement(supabase, personId);
  } catch {
    return <Alert tone="danger">This account could not be loaded. Apply the latest database migrations (0011 and 0012) and try again.</Alert>;
  }

  return (
    <>
      <PageHeader
        title={`${person.full_name}: account`}
        description={person.email}
        actions={
          <>
            <PrintButton />
            {statement.owed > 0 ? <Link href={`/admin/reimbursements/pay/${person.id}`} className={buttonClass("primary")}>Reimburse</Link> : null}
            <Link href="/admin/reimbursements" className="text-sm text-primary hover:underline">All reimbursements</Link>
          </>
        }
      />
      <StatementView statement={statement} name={person.full_name} />
    </>
  );
}
