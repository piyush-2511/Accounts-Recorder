/** Shown instantly while a page's data loads, so navigation feels immediate. */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5" role="status" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-md bg-muted" />
        <div className="h-4 w-80 max-w-full rounded bg-muted/70" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-lg border bg-card" />)}
      </div>
      <div className="h-72 rounded-lg border bg-card" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
