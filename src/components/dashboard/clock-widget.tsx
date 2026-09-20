"use client";

import { useSyncExternalStore } from "react";
import { Clock, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePayrollStore } from "@/lib/store";
import { formatTime } from "@/lib/format";

// A single module-level ticking value: useSyncExternalStore requires getSnapshot
// to return the same reference until the store actually changes.
let clockSnapshot = new Date();
function subscribeToClock(callback: () => void) {
  const id = setInterval(() => {
    clockSnapshot = new Date();
    callback();
  }, 1000);
  return () => clearInterval(id);
}
function getClockSnapshot() {
  return clockSnapshot;
}
function getServerClockSnapshot() {
  return null;
}

// null on the server/first paint (avoids a hydration mismatch), a live Date on the client.
function useNow(): Date | null {
  return useSyncExternalStore(subscribeToClock, getClockSnapshot, getServerClockSnapshot);
}

function elapsed(clockIn: string, now: Date): string {
  const ms = now.getTime() - new Date(clockIn).getTime();
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function ClockWidget() {
  const now = useNow();
  const currentUserId = usePayrollStore((s) => s.session?.employeeId ?? "");
  const employee = usePayrollStore((s) => s.getEmployee(currentUserId));
  const activeEntry = usePayrollStore((s) => s.activeEntry(currentUserId));
  const clockIn = usePayrollStore((s) => s.clockIn);
  const clockOut = usePayrollStore((s) => s.clockOut);

  const isClockedIn = !!activeEntry;

  const handleClockIn = () => {
    clockIn(currentUserId);
    toast.success(`Clocked in as ${employee?.name ?? "employee"}`);
  };

  const handleClockOut = () => {
    clockOut(currentUserId);
    toast.success(`Clocked out. Great work, ${employee?.name?.split(" ")[0] ?? ""}!`);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4 text-muted-foreground" />
          Time Clock
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-2 text-center">
        <div>
          <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight">
            {!now
              ? "--:--:--"
              : isClockedIn
                ? elapsed(activeEntry.clockIn, now)
                : now.toLocaleTimeString("en-US")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isClockedIn
              ? `Clocked in since ${formatTime(activeEntry.clockIn)}`
              : "You are currently clocked out"}
          </p>
        </div>

        {isClockedIn ? (
          <Button size="lg" variant="destructive" className="w-full" onClick={handleClockOut}>
            <LogOut className="size-4" /> Clock Out
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={handleClockIn}>
            <LogIn className="size-4" /> Clock In
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
