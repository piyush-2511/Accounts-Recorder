"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Pencil, X } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { FormMessage, fieldError } from "@/components/shared/form-state";
import { idle } from "@/lib/validation/common";
import { reviewAction } from "@/app/admin/review/actions";

export function ReviewActions({ entryId, returnTo }: { entryId: string; returnTo: string }) {
  const [approveState, approve] = useActionState(reviewAction, idle);
  const [rejectState, reject] = useActionState(reviewAction, idle);
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      <FormMessage state={approveState} />
      <div className="flex flex-wrap gap-2">
        <form action={approve}>
          <input type="hidden" name="entry_id" value={entryId} />
          <input type="hidden" name="decision" value="approve" />
          <input type="hidden" name="return_to" value={returnTo} />
          <SubmitButton id="approve-btn" variant="success" size="lg" pendingText="Approving..." title="Shortcut: A">
            <Check className="h-4 w-4" aria-hidden /> Approve
          </SubmitButton>
        </form>
        <Button id="reject-btn" variant="danger" size="lg" onClick={() => setOpen(true)} title="Shortcut: R">
          <X className="h-4 w-4" aria-hidden /> Reject
        </Button>
        <Link href={`/admin/entries/${entryId}?from=review`} className={buttonClass("secondary", "lg")}>
          <Pencil className="h-4 w-4" aria-hidden /> Edit
        </Link>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Reject this entry">
        <form action={reject} className="space-y-3">
          <input type="hidden" name="entry_id" value={entryId} />
          <input type="hidden" name="decision" value="reject" />
          <input type="hidden" name="return_to" value={returnTo} />
          <FormMessage state={rejectState} />
          <Field label="What needs to be fixed?" htmlFor="note" error={fieldError(rejectState, "note")} hint="The recorder sees this note and can correct and resubmit.">
            <Textarea id="note" name="note" rows={3} maxLength={500} required minLength={5} autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton variant="danger" pendingText="Rejecting...">Reject entry</SubmitButton>
          </div>
        </form>
      </Modal>
    </div>
  );
}
