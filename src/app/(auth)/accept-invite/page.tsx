import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a password" };

export default async function AcceptInvitePage() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Choose your password</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {user?.email ? <>Setting up <strong className="text-foreground">{user.email}</strong>. </> : null}You will use this password to sign in from now on.
      </p>
      <Card>
        <CardContent className="pt-5">
          <SetPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
