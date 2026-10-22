import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { PRESET_LABEL, type Period } from "@/lib/data/reports";

/** GET form: changing it just reloads the page with new query parameters (no client JS needed). */
export function PeriodFilter({ period, extra }: { period: Period; extra?: Record<string, string> }) {
  return (
    <form method="get" className="no-print mb-5 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
      {Object.entries(extra ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Field label="Period" htmlFor="period">
        <Select id="period" name="period" defaultValue={period.preset}>
          {Object.entries(PRESET_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </Select>
      </Field>
      <Field label="From (custom)" htmlFor="from"><Input id="from" name="from" type="date" defaultValue={period.from} /></Field>
      <Field label="To (custom)" htmlFor="to"><Input id="to" name="to" type="date" defaultValue={period.to} /></Field>
      <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="pending" value="1" defaultChecked={period.includePending} className="h-4 w-4" /> Include pending entries</label>
      <Button type="submit">Apply</Button>
    </form>
  );
}
