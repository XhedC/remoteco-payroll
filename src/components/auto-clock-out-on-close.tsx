"use client";

import { useEffect } from "react";
import { usePayrollStore } from "@/lib/store";
import { getLatestAccessToken } from "@/lib/supabase/client";

/**
 * Best-effort auto clock-out/logout when the app is actually closed (tab or
 * browser close, or navigating to a different site) rather than an explicit
 * "Log out" click — via pagehide + sendBeacon, since by the time the page is
 * gone there's no chance to await a normal API call.
 *
 * Known limitation: pagehide also fires on an ordinary page refresh, which
 * looks identical to a real close from inside the page, so a refresh will
 * also trigger this. There's no reliable browser-level way to tell the two
 * apart at unload time.
 */
export function AutoClockOutOnClose() {
  const employeeId = usePayrollStore((s) => s.session?.employeeId);
  const isClockedIn = usePayrollStore((s) => (employeeId ? s.isClockedIn(employeeId) : false));

  useEffect(() => {
    if (!employeeId || !isClockedIn) return;

    const handlePageHide = () => {
      const accessToken = getLatestAccessToken();
      if (!accessToken) return;
      const blob = new Blob([JSON.stringify({ accessToken })], { type: "application/json" });
      navigator.sendBeacon("/api/beacon-clock-out", blob);
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [employeeId, isClockedIn]);

  return null;
}
