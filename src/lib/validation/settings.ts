import { z } from "zod";
import { ENTRY_KINDS } from "../constants/entry-status";
import { ROLES } from "../constants/roles";

const ledgerName = z
  .string()
  .trim()
  .min(1, "Required")
  .max(100, "Too long")
  .refine((v) => !/[\u0000-\u001f]/.test(v), "Contains invalid characters");

export const categorySchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  label: z.string().trim().min(2, "At least 2 characters").max(60),
  kind: z.enum(ENTRY_KINDS),
  tally_ledger: ledgerName,
  tally_group: ledgerName,
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  is_active: z.coerce.boolean().default(true),
});

export const paymentSourceSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  label: z.string().trim().min(2, "At least 2 characters").max(60),
  tally_ledger: ledgerName,
  tally_group: ledgerName,
  voucher_mode: z.enum(["payment_receipt", "journal"]),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  is_active: z.coerce.boolean().default(true),
});

export const generalSettingsSchema = z.object({
  company_name: z.string().trim().min(1, "Enter the exact company name used in Tally").max(100),
  voucher_prefix: z.string().trim().max(10).regex(/^[A-Za-z0-9-]*$/, "Letters, numbers and dashes only").default(""),
  voucher_start_number: z.coerce.number().int().min(1).max(1_000_000),
  voucher_required_above: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Enter an amount or leave blank"),
  max_amount: z.coerce.number().positive().max(100_000_000),
  tally_encoding: z.enum(["utf-8", "utf-16"]),
});

export const inviteUserSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the person's name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(ROLES),
});

export const budgetRowSchema = z.object({
  category_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().min(0).max(100_000_000),
});

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72, "Use at most 72 characters")
  .refine((v) => /[a-z]/i.test(v) && /\d/.test(v), "Include letters and numbers");
