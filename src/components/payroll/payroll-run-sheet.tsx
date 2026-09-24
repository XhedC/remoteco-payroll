"use client";

import { useState } from "react";
import { Eye, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePayrollStore } from "@/lib/store";
import { useOwnerGate } from "@/lib/use-owner-gate";
import { computePayrollLineAccurate, formatCurrency, formatDate, formatHoursMinutes } from "@/lib/format";
import { EditPayrollLineDialog } from "./edit-payroll-line-dialog";
import type { PayPeriodStatus, PayrollRun } from "@/lib/types";

const STATUS_OPTIONS: PayPeriodStatus[] = ["Pending", "On Processing", "Paid", "Unpaid"];

export function PayrollRunSheet({ run }: { run: PayrollRun }) {
  const [open, setOpen] = useState(false);
  const employees = usePayrollStore((s) => s.employees);
  const timeEntries = usePayrollStore((s) => s.timeEntries);
  const payslipConfirmations = usePayrollStore((s) => s.payslipConfirmations);
  const updatePayrollRunStatus = usePayrollStore((s) => s.updatePayrollRunStatus);
  const updatePayrollLineStatus = usePayrollStore((s) => s.updatePayrollLineStatus);
  const deletePayrollLine = usePayrollStore((s) => s.deletePayrollLine);
  const currentEmployee = usePayrollStore((s) =>
    s.session ? s.getEmployee(s.session.employeeId) : undefined,
  );
  const canAdjustPayroll = currentEmployee?.role === "Admin";
  const { requestOwnerAuth, ownerDialog } = useOwnerGate(
    "Changing a payroll status affects a financial record. Enter the owner password to continue.",
  );

  const confirmationFor = (employeeId: string) =>
    payslipConfirmations.find((c) => c.payrollRunId === run.id && c.employeeId === employeeId);

  // Total Hours, Gross, Deduction, and Net are recomputed here (not read
  // straight off the stored line) via the shared computePayrollLineAccurate
  // helper, so they always reflect the employee's current rate and the same
  // accurate, late/overtime-netted hours shown everywhere else in the app.
  const computedLines = run.lines.map((line) => {
    const employee = employees.find((e) => e.id === line.employeeId);
    const { periodMinutes, grossPay, deduction, netPay } = computePayrollLineAccurate(
      run.periodStart,
      run.periodEnd,
      line.employeeId,
      employee?.hourlyRate ?? line.hourlyRate,
      line.adjustment,
      timeEntries,
      employee?.scheduleIn,
      employee?.scheduleOut,
    );
    return { line, employee, periodMinutes, grossPay, deduction, netPay };
  });

  const totalNet = computedLines.reduce((sum, l) => sum + l.netPay, 0);

  const handleBulkStatusChange = (nextStatus: string | null) => {
    if (!nextStatus) return;
    requestOwnerAuth(async () => {
      const result = await updatePayrollRunStatus(run.id, nextStatus as PayPeriodStatus);
      if (!result.success) {
        toast.error(result.error ?? "Unable to update payroll status.");
        return;
      }
      toast.success(`Set every employee to ${nextStatus} for this run.`);
    });
  };

  const handleLineStatusChange = (employeeId: string, employeeName: string, nextStatus: string | null) => {
    const line = run.lines.find((l) => l.employeeId === employeeId);
    if (!nextStatus || !line || nextStatus === line.status) return;
    requestOwnerAuth(async () => {
      const result = await updatePayrollLineStatus(run.id, employeeId, nextStatus as PayPeriodStatus);
      if (!result.success) {
        toast.error(result.error ?? "Unable to update payroll status.");
        return;
      }
      toast.success(`${employeeName} marked as ${nextStatus}.`);
    });
  };

  const handleDeleteLine = (employeeId: string, employeeName: string) => {
    requestOwnerAuth(async () => {
      const result = await deletePayrollLine(run.id, employeeId);
      if (!result.success) {
        toast.error(result.error ?? "Unable to remove this employee from the run.");
        return;
      }
      toast.success(`${employeeName} removed from this payroll run.`);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <Eye className="size-3.5" /> View
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 data-[side=right]:sm:max-w-4xl">
        <SheetHeader className="gap-3 border-b">
          <SheetTitle>
            {formatDate(run.periodStart)} — {formatDate(run.periodEnd)}
          </SheetTitle>
          <SheetDescription>
            Payroll run created {formatDate(run.createdAt)} • Overall status:{" "}
            <Badge variant="secondary" className="ml-1">
              {run.status}
            </Badge>
          </SheetDescription>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Set all employees to</span>
            <Select value="" onValueChange={handleBulkStatusChange}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Bulk update..." />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Total Hours</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deduction</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confirmation</TableHead>
                {canAdjustPayroll && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {computedLines.map(({ line, employee, periodMinutes, grossPay, deduction, netPay }) => {
                const employeeName = employee?.name ?? "Unknown";
                const confirmation = confirmationFor(line.employeeId);
                return (
                  <TableRow key={line.employeeId}>
                    <TableCell className="font-medium">{employeeName}</TableCell>
                    <TableCell className="text-muted-foreground">{formatHoursMinutes(periodMinutes)}</TableCell>
                    <TableCell>{formatCurrency(grossPay)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatCurrency(deduction)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(netPay)}</TableCell>
                    <TableCell>
                      <Select
                        value={line.status}
                        onValueChange={(v) => handleLineStatusChange(line.employeeId, employeeName, v)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {line.status !== "Paid" || !confirmation ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : confirmation.confirmedAt ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle2 className="size-3" /> Confirmed
                        </Badge>
                      ) : (
                        <Badge variant="outline">Awaiting confirmation</Badge>
                      )}
                    </TableCell>
                    {canAdjustPayroll && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <EditPayrollLineDialog
                            run={run}
                            line={line}
                            employeeName={employeeName}
                            grossPay={grossPay}
                          />
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDeleteLine(line.employeeId, employeeName)}
                          >
                            <Trash2 className="size-3 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <SheetFooter className="border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total net pay</span>
            <span className="font-semibold">{formatCurrency(totalNet)}</span>
          </div>
        </SheetFooter>
      </SheetContent>
      {ownerDialog}
    </Sheet>
  );
}
