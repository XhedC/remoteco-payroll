"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePayrollStore } from "@/lib/store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const requestPasswordReset = usePayrollStore((s) => s.requestPasswordReset);
  const resetPassword = usePayrollStore((s) => s.resetPassword);

  const [step, setStep] = useState<"request" | "sent" | "recovery">("request");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setStep("recovery");
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await requestPasswordReset(email);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Unable to send a reset email.");
      return;
    }

    setStep("sent");
    toast.success("Reset email sent.");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const result = await resetPassword(newPassword);
    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Unable to reset your password.");
      return;
    }

    await getSupabaseBrowserClient().auth.signOut();
    toast.success("Password reset. You can now sign in.");
    router.replace("/login");
  };

  if (step === "recovery") {
    return (
      <AuthLayout title="Reset password" description="Choose a new password for your account.">
        <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
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
      </AuthLayout>
    );
  }

  if (step === "sent") {
    return (
      <AuthLayout title="Check your email" description={`We sent a reset link to ${email}.`}>
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-foreground" />
          <p>
            Click the link in that email to choose a new password. It&apos;ll bring you back to
            this page automatically.
          </p>
        </div>
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
    <AuthLayout title="Forgot password" description="Enter your account email to receive a reset link.">
      <form onSubmit={handleRequestReset} className="flex flex-col gap-4">
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
          Send reset link
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
