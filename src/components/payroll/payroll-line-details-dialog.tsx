"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePayrollStore } from "@/lib/store";
import {
  computeEntryMinutes,
  computePayrollLineAccurate,
  formatCurrency,
  formatDate,
  formatMinutes,
  formatTime,
  localDateStr,
} from "@/lib/format";
import type { PayrollRun } from "@/lib/types";

/**
 * Read-only payroll calculation transparency view for one employee's line in
 * one run: a per-entry breakdown (scheduled start, actual clock-in/out, early
 * arrival, actual overtime) plus the period's overtime/approval summary. This
 * never modifies the underlying time entries — it's sourced from the same
 * computeEntryMinutes calls already used for display elsewhere in the app.
 */
export function PayrollLineDetailsDialog({
  run,
  employeeName,
  computed,
}: {
  run: PayrollRun;
  employeeName: string;
  computed: ReturnType<typeof computePayrollLineAccurate> & {
    line: { employeeId: string; hourlyRate: number };
    employee?: { scheduleIn?: string; scheduleOut?: string };
  };
}) {
  const [open, setOpen] = useState(false);
  const timeEntries = usePayrollStore((s) => s.timeEntries);
  const settings = usePayrollStore((s) => s.settings);

  const { line, employee } = computed;
  const entries = [...timeEntries]
    .filter(
      (t) =>
        t.employeeId === line.employeeId &&
        localDateStr(t.clockIn) >= run.periodStart &&
        localDateStr(t.clockIn) <= run.periodEnd,
    )
    .sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <ListChecks className="size-3" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{employeeName} — Calculation Details</DialogTitle>
          <DialogDescription>
            {formatDate(run.periodStart)} — {formatDate(run.periodEnd)}. Attendance records shown
            here are unchanged; this is a read-only breakdown of how pay was calculated.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Scheduled Start</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Early Arrival</TableHead>
                <TableHead>Actual OT</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No time entries in this period.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((t) => {
                  const c = computeEntryMinutes(t.clockIn, t.clockOut, employee?.scheduleIn, employee?.scheduleOut);
                  const withinPolicy = c.earlyArrivalMinutes <= settings.unpaidEarlyClockinMinutes;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.clockIn)}</TableCell>
                      <TableCell className="text-muted-foreground">{employee?.scheduleIn ?? "—"}</TableCell>
                      <TableCell>{formatTime(t.clockIn)}</TableCell>
                      <TableCell>{t.clockOut ? formatTime(t.clockOut) : "—"}</TableCell>
                      <TableCell>
                        {c.earlyArrivalMinutes > 0 ? (
                          <span className={withinPolicy ? "text-muted-foreground" : "text-destructive"}>
                            {formatMinutes(c.earlyArrivalMinutes)}
                            {!withinPolicy && " (exceeds policy)"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{formatMinutes(c.overtime)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
            <span className="text-muted-foreground">Hourly rate</span>
            <span className="font-medium">{formatCurrency(line.hourlyRate)}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
            <span className="text-muted-foreground">OT multiplier</span>
            <span className="font-medium">{settings.overtimeMultiplier}x</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
            <span className="text-muted-foreground">Actual overtime</span>
            <span className="font-medium">{formatMinutes(computed.actualOvertimeMinutes)}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
            <span className="text-muted-foreground">Payable overtime</span>
            <span className="font-medium">{formatMinutes(computed.payableOvertimeMinutes)}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
            <span className="text-muted-foreground">Overtime pay amount</span>
            <span className="font-medium">{formatCurrency(computed.overtimePayAmount)}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
            <span className="text-muted-foreground">Status</span>
            <div className="flex gap-1">
              <Badge variant={computed.calculationStatus === "Eligible" ? "default" : "outline"}>
                {computed.calculationStatus}
              </Badge>
              <Badge variant={computed.approvalStatus === "Approved" ? "default" : "secondary"}>
                {computed.approvalStatus}
              </Badge>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
