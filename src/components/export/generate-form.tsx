"use client";

import { useActionState } from "react";
import { Download } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/shared/form-state";
import { idle } from "@/lib/validation/common";
import { generateExportAction } from "@/app/admin/export/actions";

export function GenerateForm({ from, to, disabled, count }: { from: string; to: string; disabled: boolean; count: number }) {
  const [state, action] = useActionState(generateExportAction, idle);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <FormMessage state={state} />
      <SubmitButton size="lg" disabled={disabled} pendingText="Generating...">
        <Download className="h-4 w-4" aria-hidden /> Generate Tally files for {count} {count === 1 ? "entry" : "entries"}
      </SubmitButton>
      <p className="text-xs text-muted-foreground">This gives each entry its voucher number and locks the entries. If the Tally import fails you can unlock the batch.</p>
    </form>
  );
}
