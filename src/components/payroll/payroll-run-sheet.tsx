"use client";

import { useState } from "react";
import { Eye, CheckCircle2 } from "lucide-react";
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
import { formatCurrency, formatDate } from "@/lib/format";
import type { PayPeriodStatus, PayrollRun } from "@/lib/types";

const STATUS_OPTIONS: PayPeriodStatus[] = ["Pending", "On Processing", "Paid", "Unpaid"];

export function PayrollRunSheet({ run }: { run: PayrollRun }) {
  const [open, setOpen] = useState(false);
  const employees = usePayrollStore((s) => s.employees);
  const payslipConfirmations = usePayrollStore((s) => s.payslipConfirmations);
  const updatePayrollRunStatus = usePayrollStore((s) => s.updatePayrollRunStatus);
  const updatePayrollLineStatus = usePayrollStore((s) => s.updatePayrollLineStatus);
  const { requestOwnerAuth, ownerDialog } = useOwnerGate(
    "Changing a payroll status affects a financial record. Enter the owner password to continue.",
  );

  const totalNet = run.lines.reduce((sum, l) => sum + l.netPay, 0);

  const confirmationFor = (employeeId: string) =>
    payslipConfirmations.find((c) => c.payrollRunId === run.id && c.employeeId === employeeId);

  const handleBulkStatusChange = (nextStatus: string | null) => {
    if (!nextStatus) return;
    requestOwnerAuth(() => {
      const result = updatePayrollRunStatus(run.id, nextStatus as PayPeriodStatus);
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
    requestOwnerAuth(() => {
      const result = updatePayrollLineStatus(run.id, employeeId, nextStatus as PayPeriodStatus);
      if (!result.success) {
        toast.error(result.error ?? "Unable to update payroll status.");
        return;
      }
      toast.success(`${employeeName} marked as ${nextStatus}.`);
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="outline" size="sm" />}>
        <Eye className="size-3.5" /> View
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
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
                <TableHead>Reg / OT</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Confirmation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.lines.map((line) => {
                const employee = employees.find((e) => e.id === line.employeeId);
                const employeeName = employee?.name ?? "Unknown";
                const confirmation = confirmationFor(line.employeeId);
                return (
                  <TableRow key={line.employeeId}>
                    <TableCell className="font-medium">{employeeName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {line.regularHours}h / {line.overtimeHours}h
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(line.netPay)}</TableCell>
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
