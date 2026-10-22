import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { LoginForm } from "@/components/auth/login-form";
import { firstParam, safeNext } from "@/lib/utils";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const error = firstParam(sp.error);
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Accounts Recorder</h1>
      <p className="mb-6 text-sm text-muted-foreground">Sign in to record or review entries.</p>
      <Card>
        <CardContent className="space-y-4 pt-5">
          {error === "inactive" ? <Alert tone="warning">Your account is disabled. Contact your administrator.</Alert> : null}
          {error === "link" ? <Alert tone="warning">That link has expired or was already used. Ask for a new one.</Alert> : null}
          <LoginForm next={safeNext(firstParam(sp.next), "")} />
        </CardContent>
      </Card>
    </main>
  );
}
