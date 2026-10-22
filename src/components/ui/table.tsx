import * as React from "react";
import { cn } from "@/lib/utils";

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-full overflow-x-auto", className)}>{children}</div>;
}
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full min-w-[32rem] border-collapse text-sm", className)} {...props} />;
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" className={cn("whitespace-nowrap border-b bg-muted/50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)} {...props} />;
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b px-3 py-2 align-top", className)} {...props} />;
}
