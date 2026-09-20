"use client";

import type { ReactNode } from "react";
import { Wallet2 } from "lucide-react";
import { useRedirectIfAuthed } from "@/lib/use-auth";

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { checking } = useRedirectIfAuthed();

  if (checking) {
    return <div className="min-h-svh bg-muted/30" />;
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Wallet2 className="size-5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">RemoteCo Payroll</h1>
        </div>

        <div className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
          <div className="mb-5 flex flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
