import { z } from "zod";
import { uuid } from "./common";

export const reviewSchema = z
  .object({
    entry_id: uuid,
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(500).optional().default(""),
  })
  .refine((v) => v.decision !== "reject" || v.note.length >= 5, {
    path: ["note"],
    message: "Add a note of at least 5 characters so the recorder knows what to fix",
  });

export const bulkApproveSchema = z.object({ ids: z.array(uuid).min(1, "Select at least one entry").max(200) });
