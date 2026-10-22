import { z } from "zod";
import { daysBetween, isValidISODate } from "../format/dates";

export const exportRangeSchema = z
  .object({
    from: z.string().refine(isValidISODate, "Enter a valid start date"),
    to: z.string().refine(isValidISODate, "Enter a valid end date"),
  })
  .refine((v) => v.to >= v.from, { path: ["to"], message: "End date must be on or after the start date" })
  .refine((v) => daysBetween(v.from, v.to) <= 400, { path: ["to"], message: "Choose a range of at most 13 months" });
