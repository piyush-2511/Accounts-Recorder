import Link from "next/link";
import { requireUser } from "@/lib/auth/get-session";
import { createClient } from "@/lib/supabase/server";
import { getStaffStatement } from "@/lib/data/reimbursements";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { PrintButton } from "@/components/reports/print-button";
import { StatementView } from "@/components/reimbursement/statement-view";

export const metadata = { title: "My account" };

export default async function MyAccount() {
  const user = await requireUser();
  let statement;
  try {
    statement = await getStaffStatement(await createClient(), user.id);
  } catch {
    return <Alert tone="danger">Your account statement could not be loaded. Please try again, or ask your administrator to check that the latest database update has been applied.</Alert>;
  }

  return (
    <>
      <PageHeader
        title="My account"
        description="Money you paid for the organisation from your own pocket, and what has been paid back to you."
        actions={<><PrintButton /><Link href="/record/new" className={buttonClass("primary")}>New entry</Link></>}
      />
      <Alert tone="info" className="mb-5">
        Paid for something yourself? Record it and choose <strong>Paid by me (reimburse later)</strong> as the payment source. Once the admin approves it, it is added to the amount owed to you here.
      </Alert>
      <StatementView statement={statement} />
    </>
  );
}
