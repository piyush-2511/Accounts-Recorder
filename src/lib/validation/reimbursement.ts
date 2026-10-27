import { z } from "zod";
import { isValidISODate } from "../format/dates";
import { optionalText, uuid } from "./common";

export const reimburseSchema = z.object({
  person_id: uuid,
  entry_ids: z.array(uuid).min(1, "Select at least one expense").max(500, "Select at most 500 expenses at a time"),
  source_id: z.coerce.number().int().positive("Choose where the money was paid from"),
  paid_on: z.string().refine(isValidISODate, "Enter the date the money was paid"),
  reference: optionalText(60),
  note: optionalText(300),
});

export const voidSchema = z.object({
  id: uuid,
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters").max(300),
});
