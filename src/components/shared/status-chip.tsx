import { Badge } from "@/components/ui/badge";
import { ENTRY_STATUS_LABEL, type EntryStatus } from "@/lib/constants/entry-status";

const tone: Record<EntryStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  exported: "info",
};

export function StatusChip({ status }: { status: EntryStatus }) {
  return <Badge tone={tone[status]}>{ENTRY_STATUS_LABEL[status]}</Badge>;
}
