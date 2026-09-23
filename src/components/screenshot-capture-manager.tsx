"use client";

import { useEffect } from "react";
import { usePayrollStore } from "@/lib/store";
import { SCREENSHOT_INTERVAL_MS } from "@/lib/mock-data";
import { captureFrameFromStream } from "@/lib/screen-capture";

/**
 * While the current session is clocked in and screen sharing is active,
 * captures a real frame from the shared screen immediately and then every
 * 10 minutes, tied to the active shift. Mounted once at the root layout so
 * it keeps running across page navigation.
 */
export function ScreenshotCaptureManager() {
  const employeeId = usePayrollStore((s) => s.session?.employeeId);
  const activeEntryId = usePayrollStore((s) =>
    employeeId ? s.activeEntry(employeeId)?.id : undefined,
  );
  const screenStream = usePayrollStore((s) => s.screenStream);
  const captureScreenshot = usePayrollStore((s) => s.captureScreenshot);

  useEffect(() => {
    if (!employeeId || !activeEntryId || !screenStream) return;

    const capture = async () => {
      const blob = await captureFrameFromStream(screenStream);
      if (blob) captureScreenshot(employeeId, activeEntryId, blob);
    };

    capture();
    const id = setInterval(capture, SCREENSHOT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [employeeId, activeEntryId, screenStream, captureScreenshot]);

  return null;
}
