"use client";

import { useState } from "react";
import { ExternalLink, RotateCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shows an entry's voucher (via a signed-URL redirect) with zoom and rotate for photos. */
export function VoucherViewer({ entryId, mime, size }: { entryId: string; mime: string | null; size: number | null }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const src = `/api/vouchers/${entryId}`;
  const isPdf = mime === "application/pdf";

  return (
    <div className="space-y-2">
      <div className="no-print flex flex-wrap items-center gap-1">
        {!isPdf ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} aria-label="Zoom out"><ZoomOut className="h-4 w-4" aria-hidden /></Button>
            <Button variant="secondary" size="sm" onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))} aria-label="Zoom in"><ZoomIn className="h-4 w-4" aria-hidden /></Button>
            <Button variant="secondary" size="sm" onClick={() => setRotation((r) => (r + 90) % 360)} aria-label="Rotate"><RotateCw className="h-4 w-4" aria-hidden /></Button>
            <Button variant="secondary" size="sm" onClick={() => { setZoom(1); setRotation(0); }} aria-label="Reset view"><Maximize2 className="h-4 w-4" aria-hidden /></Button>
          </>
        ) : null}
        <a href={src} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm text-primary hover:underline">
          Open full size <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
        {size ? <span className="text-xs text-muted-foreground">{Math.round(size / 1024)} KB</span> : null}
      </div>
      <div className="max-h-[70vh] min-h-48 overflow-auto rounded-md border bg-muted/40">
        {isPdf ? (
          <iframe src={src} title="Voucher PDF" className="h-[70vh] w-full" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt="Voucher"
            style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transformOrigin: "center top" }}
            className="mx-auto block max-w-full transition-transform"
          />
        )}
      </div>
    </div>
  );
}
