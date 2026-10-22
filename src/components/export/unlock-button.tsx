"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Modal } from "@/components/ui/modal";
import { unlockBatchAction } from "@/app/admin/export/actions";

export function UnlockButton({ batchId, count }: { batchId: string; count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Unlock</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Unlock this batch?">
        <form action={unlockBatchAction} className="space-y-3 text-sm">
          <input type="hidden" name="batch_id" value={batchId} />
          <p>
            The {count} entries return to <strong>Approved</strong> so they can be corrected and exported again. They keep their voucher numbers.
            Only unlock a batch if the Tally import failed or was not done. If it was imported, delete those vouchers in Tally first.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton variant="danger" pendingText="Unlocking...">Unlock batch</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
