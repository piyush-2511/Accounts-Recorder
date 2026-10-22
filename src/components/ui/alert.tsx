import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "info" | "success" | "warning" | "danger";
const tones: Record<Tone, { box: string; icon: React.ReactNode }> = {
  info: { box: "border-primary/30 bg-primary/5 text-foreground", icon: <Info className="h-4 w-4 text-primary" aria-hidden /> },
  success: { box: "border-success/30 bg-success/10 text-foreground", icon: <CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> },
  warning: { box: "border-warning/40 bg-warning/10 text-foreground", icon: <AlertTriangle className="h-4 w-4 text-warning" aria-hidden /> },
  danger: { box: "border-danger/30 bg-danger/10 text-foreground", icon: <XCircle className="h-4 w-4 text-danger" aria-hidden /> },
};

export function Alert({ tone = "info", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-2 rounded-md border px-3 py-2 text-sm", tones[tone].box, className)}>
      <span className="mt-0.5 shrink-0">{tones[tone].icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
