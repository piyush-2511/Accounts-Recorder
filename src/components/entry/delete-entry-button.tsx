"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Delete with a confirmation. The entry is hidden, not erased: it stays in the audit trail. */
export function DeleteEntryButton({ id, action, label = "Delete", size = "sm" }: { id: string; action: (formData: FormData) => void | Promise<void>; label?: string; size?: "sm" | "md" }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Delete this entry? It will be removed from lists and reports. This is recorded in the audit trail.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size={size} className="text-danger hover:bg-danger/10">
        <Trash2 className="h-4 w-4" aria-hidden /> {label}
      </Button>
    </form>
  );
}
