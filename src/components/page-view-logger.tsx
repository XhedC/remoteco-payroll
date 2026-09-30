"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { usePayrollStore } from "@/lib/store";

/**
 * Logs every in-app page an employee visits (Dashboard, Time Record,
 * Employees, Payroll, Screen Logs, Settings) as a "Page View" activity
 * entry. Scoped to what a website can actually observe: pages within this
 * app, in this tab. It cannot see other browser tabs, other websites, or
 * anything outside this page — no web app can.
 */
const PAGE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/time-record": "Time Record",
  "/employees": "Employees",
  "/payroll": "Payroll",
  "/screen-logs": "Screen Logs",
  "/settings": "Settings",
};

function labelForPath(pathname: string): string {
  if (PAGE_LABELS[pathname]) return PAGE_LABELS[pathname];
  if (pathname.startsWith("/employees/")) return "Employee Profile";
  return pathname;
}

export function PageViewLogger() {
  const employeeId = usePayrollStore((s) => s.session?.employeeId);
  const logAction = usePayrollStore((s) => s.logAction);
  const pathname = usePathname();
  const lastLogged = useRef<string | null>(null);

  useEffect(() => {
    if (!employeeId) {
      lastLogged.current = null;
      return;
    }
    // Skip the auth pages (no session yet when they're visited) and avoid
    // logging the same page twice in a row (e.g. a re-render with no real
    // navigation).
    if (pathname === "/login" || pathname === "/forgot-password") return;
    if (lastLogged.current === pathname) return;
    lastLogged.current = pathname;

    logAction(employeeId, "Page View", `Visited ${labelForPath(pathname)}`);
  }, [employeeId, pathname, logAction]);

  return null;
}
