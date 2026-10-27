"use client";

import { Button } from "@/components/ui/button";

// Keeps the navigation bar on screen when one page fails, instead of replacing the whole app.
export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">This page could not be loaded</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Please try again. If it keeps happening, tell your administrator.
        {error.digest ? <span className="mt-1 block text-xs">Reference: {error.digest}</span> : null}
      </p>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}
