"use client";

import { useEffect } from "react";
import { usePayrollStore } from "@/lib/store";
import { SCREENSHOT_INTERVAL_MS } from "@/lib/mock-data";

/**
 * While the current session is clocked in, captures a (simulated) screenshot
 * immediately and then every 10 minutes, tied to the active shift. Mounted
 * once at the root layout so it keeps running across page navigation.
 */
export function ScreenshotCaptureManager() {
  const employeeId = usePayrollStore((s) => s.session?.employeeId);
  const activeEntryId = usePayrollStore((s) =>
    employeeId ? s.activeEntry(employeeId)?.id : undefined,
  );
  const captureScreenshot = usePayrollStore((s) => s.captureScreenshot);

  useEffect(() => {
    if (!employeeId || !activeEntryId) return;

    captureScreenshot(employeeId, activeEntryId);
    const id = setInterval(() => {
      captureScreenshot(employeeId, activeEntryId);
    }, SCREENSHOT_INTERVAL_MS);

    return () => clearInterval(id);
  }, [employeeId, activeEntryId, captureScreenshot]);

  return null;
}
