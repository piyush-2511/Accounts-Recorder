import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mb-6 text-sm text-muted-foreground">We will email you a link to choose a new password.</p>
      <Card>
        <CardContent className="pt-5">
          <ForgotForm />
        </CardContent>
      </Card>
    </main>
  );
}
