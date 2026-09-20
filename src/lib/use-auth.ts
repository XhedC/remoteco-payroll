"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePayrollStore } from "./store";

/** Redirects to /login once hydration finishes and no session exists. */
export function useRequireAuth() {
  const router = useRouter();
  const hasHydrated = usePayrollStore((s) => s.hasHydrated);
  const session = usePayrollStore((s) => s.session);
  const employee = usePayrollStore((s) => (session ? s.getEmployee(session.employeeId) : undefined));

  useEffect(() => {
    if (hasHydrated && !session) {
      router.replace("/login");
    }
  }, [hasHydrated, session, router]);

  return { ready: hasHydrated && !!session && !!employee, employee };
}

/** Redirects already-authenticated users away from login/forgot-password. */
export function useRedirectIfAuthed() {
  const router = useRouter();
  const hasHydrated = usePayrollStore((s) => s.hasHydrated);
  const session = usePayrollStore((s) => s.session);

  useEffect(() => {
    if (hasHydrated && session) {
      router.replace("/");
    }
  }, [hasHydrated, session, router]);

  return { checking: !hasHydrated || !!session };
}
