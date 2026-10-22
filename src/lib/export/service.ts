import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExportEntry } from "@/lib/tally/types";

const SELECT =
  "id, entry_date, kind, amount, narration, party, programme, voucher_no, voucher_fy, created_at, " +
  "category:categories(label,tally_ledger,tally_group), source:payment_sources(label,tally_ledger,tally_group,voucher_mode)";

interface Row extends Omit<ExportEntry, "voucher_no"> {
  voucher_no: number | null;
  voucher_fy: number;
  created_at: string;
}

export interface ExportPreview {
  entries: ExportEntry[];
  /** Entry ids whose voucher number is only provisional (assigned for real when generating). */
  provisional: Set<string>;
}

/** Approved, non-deleted entries in a date range, with voucher numbers (provisional where not yet assigned). */
export async function loadApprovedForExport(
  supabase: SupabaseClient,
  from: string,
  to: string,
  startNumber: number,
): Promise<ExportPreview> {
  const { data, error } = await supabase
    .from("entries")
    .select(SELECT)
    .eq("status", "approved")
    .is("deleted_at", null)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .order("entry_date")
    .order("created_at")
    .order("id");
  if (error) throw new Error(`Could not load entries to export: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];

  // Mirror the database numbering for entries that do not have a number yet.
  const next = new Map<number, number>();
  for (const fy of new Set(rows.filter((r) => r.voucher_no === null).map((r) => r.voucher_fy))) {
    const { data: top } = await supabase.from("entries").select("voucher_no").eq("voucher_fy", fy).not("voucher_no", "is", null).order("voucher_no", { ascending: false }).limit(1);
    next.set(fy, ((top?.[0]?.voucher_no as number | undefined) ?? startNumber - 1) + 1);
  }

  const provisional = new Set<string>();
  const entries: ExportEntry[] = rows.map((r) => {
    let no = r.voucher_no;
    if (no === null) {
      no = next.get(r.voucher_fy) ?? startNumber;
      next.set(r.voucher_fy, no + 1);
      provisional.add(r.id);
    }
    return { ...r, voucher_no: no };
  });
  return { entries, provisional };
}
