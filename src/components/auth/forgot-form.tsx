"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/shared/form-state";
import { idle } from "@/lib/validation/common";
import { forgotPasswordAction } from "@/app/(auth)/forgot-password/actions";

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, idle);
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Sending...">
        Send reset link
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
