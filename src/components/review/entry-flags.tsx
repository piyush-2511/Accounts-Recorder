import { Badge } from "@/components/ui/badge";
import type { FlagRow } from "@/types/db";

export function EntryFlags({ flags, compact }: { flags?: FlagRow; compact?: boolean }) {
  if (!flags) return null;
  const items: { key: string; label: string; short: string; tone: "warning" | "danger" }[] = [];
  if (flags.possible_duplicate) items.push({ key: "dup", label: "Possible duplicate", short: "Dup", tone: "danger" });
  if (flags.no_voucher) items.push({ key: "nov", label: "No voucher", short: "No voucher", tone: "warning" });
  if (flags.high_amount) items.push({ key: "high", label: "Unusually high for this category", short: "High", tone: "warning" });
  if (items.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {items.map((i) => (
        <Badge key={i.key} tone={i.tone} title={i.label}>
          {compact ? i.short : i.label}
        </Badge>
      ))}
    </span>
  );
}
