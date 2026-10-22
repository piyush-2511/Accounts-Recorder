import { z } from "zod";
import { isValidISODate } from "../format/dates";
import { ENTRY_KINDS } from "../constants/entry-status";
import { optionalText } from "./common";

export interface EntryLimits {
  today: string; // ISO, India time
  minDate: string; // ISO
  maxAmount: number | null;
}

/** One schema shared by the form (client hints) and the server action (authority). */
export function buildEntrySchema(limits: EntryLimits) {
  return z.object({
    kind: z.enum(ENTRY_KINDS, { message: "Choose expense or income" }),
    entry_date: z
      .string()
      .refine(isValidISODate, "Enter a valid date")
      .refine((d) => d <= limits.today, "Date cannot be in the future")
      .refine((d) => d >= limits.minDate, "Date is before the allowed period"),
    category_id: z.coerce.number({ message: "Choose a category" }).int().positive("Choose a category"),
    source_id: z.coerce.number({ message: "Choose where it was paid from" }).int().positive("Choose where it was paid from"),
    amount: z.coerce
      .number({ message: "Enter an amount" })
      .positive("Amount must be greater than 0")
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Use at most 2 decimal places")
      .refine((v) => limits.maxAmount === null || v <= limits.maxAmount, `Amount cannot exceed ${limits.maxAmount ?? ""}`),
    party: optionalText(120),
    programme: optionalText(120),
    narration: z.string().trim().min(3, "Add a short narration").max(500, "Narration is too long"),
  });
}

export type EntryInput = z.infer<ReturnType<typeof buildEntrySchema>>;

/** Default narration, e.g. "Being Fuel Expense paid to Piyush for Health camp". */
export function defaultNarration(args: { kind: "expense" | "income"; categoryLabel: string; party?: string | null; programme?: string | null }): string {
  const { kind, categoryLabel, party, programme } = args;
  const base = kind === "expense" ? `Being ${categoryLabel} expense` : `Being ${categoryLabel} income`;
  const who = party?.trim() ? ` ${kind === "expense" ? "paid to" : "received from"} ${party.trim()}` : "";
  const what = programme?.trim() ? ` for ${programme.trim()}` : "";
  return `${base}${who}${what}`;
}
