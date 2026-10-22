import { z } from "zod";

export type FieldErrors = Record<string, string>;

/** Flattens Zod issues to { field: first message }. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/** Optional trimmed text: empty string becomes null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null);

export const uuid = z.string().uuid("Invalid id");

export type ActionState<T = unknown> =
  | { status: "idle" }
  | { status: "success"; message?: string; data?: T }
  | { status: "error"; message: string; fieldErrors?: FieldErrors }
  | { status: "duplicate"; message: string };

export const idle: ActionState = { status: "idle" };
