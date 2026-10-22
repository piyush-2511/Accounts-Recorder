export const ENTRY_STATUSES = ["pending", "approved", "rejected", "exported"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  exported: "Exported",
};

export const ENTRY_KINDS = ["expense", "income"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const ENTRY_KIND_LABEL: Record<EntryKind, string> = { expense: "Expense", income: "Income" };

/** Statuses a recorder may still edit. */
export const RECORDER_EDITABLE: readonly EntryStatus[] = ["pending", "rejected"];
