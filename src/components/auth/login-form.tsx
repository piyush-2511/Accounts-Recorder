"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage, fieldError } from "@/components/shared/form-state";
import { idle } from "@/lib/validation/common";
import { loginAction } from "@/app/(auth)/login/actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, idle);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <Field label="Email" htmlFor="email" error={fieldError(state, "email")}>
        <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password" error={fieldError(state, "password")}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Signing in...">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/forgot-password" className="text-primary underline-offset-2 hover:underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
