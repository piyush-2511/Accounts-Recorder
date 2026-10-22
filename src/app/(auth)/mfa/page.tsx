import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { MfaForm } from "@/components/auth/mfa-form";
import { firstParam, safeNext } from "@/lib/utils";

export const metadata: Metadata = { title: "Two-factor sign-in" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Two-factor sign-in</h1>
      <p className="mb-6 text-sm text-muted-foreground">Administrators must confirm a code from an authenticator app.</p>
      <Card>
        <CardContent className="pt-5">
          <MfaForm next={safeNext(firstParam(sp.next), "/admin")} />
        </CardContent>
      </Card>
    </main>
  );
}
