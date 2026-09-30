"use client";

import { useEffect, useRef } from "react";
import { usePayrollStore } from "@/lib/store";

/**
 * Logs "Idle" / "Active" transitions to the Activity Audit Log while an
 * employee is clocked in, based on mouse/keyboard/scroll activity in this
 * browser tab.
 *
 * Important scope limit: this can only observe events on this page, in this
 * tab. A website has no way to see the cursor anywhere else on the screen,
 * in another tab, or in another application — if the tab isn't focused or
 * visible, no events reach it here at all, which is reported as "idle"
 * rather than mistakenly assumed to be activity we can't actually see.
 */
const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes with no activity counts as idle
const CHECK_INTERVAL_MS = 30 * 1000; // how often to re-check

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "wheel", "touchstart"] as const;

export function IdleActivityMonitor() {
  const employeeId = usePayrollStore((s) => s.session?.employeeId);
  const isClockedIn = usePayrollStore((s) => (employeeId ? s.isClockedIn(employeeId) : false));
  const logAction = usePayrollStore((s) => s.logAction);

  // Set for real inside the effect below — Date.now() is impure and can't be
  // called during render, only as an initial ref value here.
  const lastActivityAt = useRef(0);
  const isIdle = useRef(false);

  useEffect(() => {
    if (!employeeId || !isClockedIn) return;

    const markActive = () => {
      lastActivityAt.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActive, { passive: true }));

    lastActivityAt.current = Date.now();
    isIdle.current = false;

    const interval = setInterval(() => {
      const idleForMs = Date.now() - lastActivityAt.current;

      if (idleForMs >= IDLE_THRESHOLD_MS && !isIdle.current) {
        isIdle.current = true;
        const minutes = Math.round(idleForMs / 60_000);
        const note = document.hidden ? " (this tab is not in focus)" : "";
        logAction(
          employeeId,
          "Idle",
          `No cursor/keyboard activity detected in the app for ${minutes}+ minute(s)${note}`,
        );
      } else if (idleForMs < IDLE_THRESHOLD_MS && isIdle.current) {
        isIdle.current = false;
        logAction(employeeId, "Active", "Cursor/keyboard activity resumed in the app");
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive));
      clearInterval(interval);
    };
  }, [employeeId, isClockedIn, logAction]);

  return null;
}
