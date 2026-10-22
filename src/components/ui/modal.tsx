"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

/** Accessible modal built on the native <dialog> element (focus trap and Esc handling come free). */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="w-[min(32rem,calc(100vw-2rem))] rounded-lg border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/40"
      aria-labelledby="modal-title"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 id="modal-title" className="text-base font-semibold">
          {title}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <div className="p-4">{open ? children : null}</div>
    </dialog>
  );
}
