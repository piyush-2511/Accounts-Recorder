import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/format/money";

export function Money({ value, tone, className }: { value: number | string | null | undefined; tone?: "income" | "expense" | "auto"; className?: string }) {
  const n = Number(value ?? 0);
  return (
    <span
      className={cn(
        "whitespace-nowrap tabular-nums",
        tone === "income" && "text-success",
        tone === "expense" && "text-danger",
        tone === "auto" && (n < 0 ? "text-danger" : "text-success"),
        className,
      )}
    >
      {formatINR(n)}
    </span>
  );
}
