import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/reference";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { PageHeader } from "@/components/shared/page-header";
import { Flash } from "@/components/shared/flash";
import { saveGeneralAction } from "./actions";

export const metadata = { title: "General settings" };

export default async function GeneralSettings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const s = await getSettings(await createClient());
  return (
    <>
      <PageHeader title="General settings" />
      <Flash sp={sp} />
      <Card>
        <CardContent className="pt-5">
          <form action={saveGeneralAction} className="grid max-w-2xl gap-4 sm:grid-cols-2">
            <Field label="Company name in Tally" htmlFor="company_name" hint="Must match the Tally company exactly, or the import goes to the wrong company." className="sm:col-span-2">
              <Input id="company_name" name="company_name" defaultValue={s.companyName} required maxLength={100} />
            </Field>
            <Field label="Voucher number prefix" htmlFor="voucher_prefix" hint="Optional, e.g. AF-"><Input id="voucher_prefix" name="voucher_prefix" defaultValue={s.voucherPrefix} maxLength={10} /></Field>
            <Field label="First voucher number each financial year" htmlFor="voucher_start_number"><Input id="voucher_start_number" name="voucher_start_number" type="number" min={1} defaultValue={s.voucherStartNumber} required /></Field>
            <Field label="Voucher required above (₹)" htmlFor="voucher_required_above" hint="Leave blank if a voucher is never mandatory."><Input id="voucher_required_above" name="voucher_required_above" inputMode="decimal" defaultValue={s.voucherRequiredAbove ?? ""} /></Field>
            <Field label="Maximum amount per entry (₹)" htmlFor="max_amount"><Input id="max_amount" name="max_amount" type="number" min={1} step="0.01" defaultValue={s.maxAmount} required /></Field>
            <Field label="XML file encoding" htmlFor="tally_encoding" hint="UTF-8 works on current TallyPrime. Choose UTF-16 only if your Tally rejects UTF-8.">
              <Select id="tally_encoding" name="tally_encoding" defaultValue={s.tallyEncoding}><option value="utf-8">UTF-8</option><option value="utf-16">UTF-16</option></Select>
            </Field>
            <Field label="Voucher type for reimbursements" htmlFor="reimbursement_voucher_type" hint="Payment is recommended: TallyPrime does not allow cash or bank ledgers in a Journal voucher.">
              <Select id="reimbursement_voucher_type" name="reimbursement_voucher_type" defaultValue={s.reimbursementVoucherType}><option value="Payment">Payment voucher</option><option value="Journal">Journal voucher</option></Select>
            </Field>
            <div className="sm:col-span-2"><SubmitButton pendingText="Saving...">Save settings</SubmitButton></div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
