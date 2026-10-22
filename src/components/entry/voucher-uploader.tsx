"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FileUp, FileText, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { prepareVoucherFile } from "@/lib/vouchers/compress-image";

interface Existing {
  entryId: string;
  mime: string | null;
  size: number | null;
}

type State =
  | { status: "idle" }
  | { status: "working" }
  | { status: "ready"; file: File; previewUrl: string | null; belowMinimum: boolean };

const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;

/**
 * Voucher / bill picker. Photos are compressed in the browser to 50-200 KB before upload; the compressed
 * file is placed in a hidden <input name="voucher"> so it travels with the normal form post.
 * The server re-validates size and real file type, and the bucket enforces the 200 KB cap a third time.
 */
export function VoucherUploader({
  existing,
  error,
  required,
  onBlockedChange,
}: {
  existing?: Existing | null;
  error?: string;
  required: boolean;
  onBlockedChange: (blocked: boolean) => void;
}) {
  const hidden = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const [confirmed, setConfirmed] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [removeExisting, setRemoveExisting] = useState(false);

  const blocked = state.status === "working" || (state.status === "ready" && state.belowMinimum && !confirmed);
  useEffect(() => onBlockedChange(blocked), [blocked, onBlockedChange]);

  useEffect(() => {
    return () => {
      if (state.status === "ready" && state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    };
  }, [state]);

  function clear() {
    if (hidden.current) hidden.current.value = "";
    setState({ status: "idle" });
    setConfirmed(false);
  }

  async function onPick(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    setLocalError(null);
    setConfirmed(false);
    setState({ status: "working" });
    try {
      const { file, belowMinimum } = await prepareVoucherFile(picked);
      const dt = new DataTransfer();
      dt.items.add(file);
      if (hidden.current) hidden.current.files = dt.files;
      setState({ status: "ready", file, belowMinimum, previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null });
      setRemoveExisting(false);
    } catch (e) {
      clear();
      setLocalError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  const showExisting = existing && existing.size !== null && !removeExisting && state.status === "idle";

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">
        Voucher / bill {required ? <span className="text-danger">(required for this amount)</span> : <span className="font-normal text-muted-foreground">(optional)</span>}
      </legend>

      <input ref={hidden} type="file" name="voucher" className="hidden" tabIndex={-1} aria-hidden />
      {removeExisting ? <input type="hidden" name="remove_voucher" value="1" /> : null}

      {state.status === "ready" ? (
        <div className="flex items-center gap-3 rounded-md border p-2">
          {state.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={state.previewUrl} alt="Voucher preview" className="h-16 w-16 rounded object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium">{state.file.name}</p>
            <p className="text-muted-foreground">{kb(state.file.size)} ready to upload</p>
          </div>
          <Button variant="ghost" size="sm" onClick={clear} aria-label="Remove voucher">
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      {showExisting ? (
        <div className="flex items-center gap-3 rounded-md border p-2 text-sm">
          <FileText className="h-5 w-5 text-muted-foreground" aria-hidden />
          <a href={`/api/vouchers/${existing.entryId}`} target="_blank" rel="noopener noreferrer" className="flex-1 text-primary hover:underline">
            Current voucher ({kb(existing.size ?? 0)})
          </a>
          <Button variant="ghost" size="sm" onClick={() => setRemoveExisting(true)}>
            Remove
          </Button>
        </div>
      ) : null}

      {state.status === "working" ? <p className="text-sm text-muted-foreground" role="status">Preparing the image...</p> : null}

      {state.status === "ready" && state.belowMinimum ? (
        <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-warning" aria-hidden /> This photo is very small and may be unreadable.
          </p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="h-4 w-4" />I checked it, the voucher is readable. Keep it.
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-muted">
          <Camera className="h-4 w-4" aria-hidden /> Take photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void onPick(e.target.files); e.target.value = ""; }} />
        </label>
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-muted">
          <FileUp className="h-4 w-4" aria-hidden /> Choose file
          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { void onPick(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Photos are shrunk to 50-200 KB automatically. PDFs must already be under 200 KB.</p>
      {localError || error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {localError ?? error}
        </p>
      ) : null}
    </fieldset>
  );
}
