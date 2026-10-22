"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage, fieldError } from "@/components/shared/form-state";
import { idle } from "@/lib/validation/common";
import { setPasswordAction } from "@/app/(auth)/accept-invite/actions";

export function SetPasswordForm() {
  const [state, action] = useActionState(setPasswordAction, idle);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="New password" htmlFor="password" error={fieldError(state, "password")} hint="At least 10 characters, with letters and numbers.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={fieldError(state, "confirm")}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Saving...">
        Save password and continue
      </SubmitButton>
    </form>
  );
}
