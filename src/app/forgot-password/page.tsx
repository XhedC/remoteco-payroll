"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePayrollStore } from "@/lib/store";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const requestPasswordReset = usePayrollStore((s) => s.requestPasswordReset);
  const resetPassword = usePayrollStore((s) => s.resetPassword);

  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRequestCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = requestPasswordReset(email);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Unable to send a reset code.");
      return;
    }

    setDemoCode(result.code ?? null);
    setStep("reset");
    toast.success("Reset code generated.");
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const result = resetPassword(email, code, newPassword);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Unable to reset your password.");
      return;
    }

    toast.success("Password reset. You can now sign in.");
    router.replace("/login");
  };

  if (step === "email") {
    return (
      <AuthLayout
        title="Forgot password"
        description="Enter your account email to receive a reset code."
      >
        <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fp-email">Email</Label>
            <Input
              id="fp-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@remoteco.com"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            Send reset code
          </Button>
        </form>

        <Link
          href="/login"
          className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset password" description={`Enter the code sent to ${email}.`}>
      {demoCode && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-foreground" />
          <p>
            This demo has no email delivery yet, so here&apos;s your code directly:{" "}
            <span className="font-semibold text-foreground">{demoCode}</span>
          </p>
        </div>
      )}

      <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fp-code">Reset Code</Label>
          <Input
            id="fp-code"
            inputMode="numeric"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fp-password">New Password</Label>
          <Input
            id="fp-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fp-confirm">Confirm New Password</Label>
          <Input
            id="fp-confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          Reset password
        </Button>
      </form>

      <button
        type="button"
        onClick={() => setStep("email")}
        className="mt-5 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Use a different email
      </button>
    </AuthLayout>
  );
}
