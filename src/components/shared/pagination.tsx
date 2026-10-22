import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export function Pagination({ page, total, pageSize, params, basePath }: { page: number; total: number; pageSize: number; params: Record<string, string | undefined>; basePath: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <nav aria-label="Pagination" className="no-print mt-4 flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {pages} ({total} entries)
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={buttonClass("secondary", "sm")}>
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={href(page + 1)} className={buttonClass("secondary", "sm")}>
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
