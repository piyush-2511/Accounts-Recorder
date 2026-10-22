import { z } from "zod";
import { passwordSchema } from "./settings";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export const setPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const totpSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code") });
