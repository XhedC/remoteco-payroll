"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { StatCard } from "@/components/dashboard/stat-card";
import { RunPayrollDialog } from "@/components/payroll/run-payroll-dialog";
import { PayrollRunSheet } from "@/components/payroll/payroll-run-sheet";
import { usePayrollStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/format";
import { Wallet, Users2, Clock4, DollarSign } from "lucide-react";
import type { PayPeriodStatus } from "@/lib/types";

const ALL_EMPLOYEES = "all";

const statusVariant: Record<PayPeriodStatus, "default" | "secondary" | "outline" | "destructive"> = {
  Paid: "default",
  "On Processing": "secondary",
  Pending: "outline",
  Unpaid: "destructive",
};

export default function PayrollPage() {
  const payrollRuns = usePayrollStore((s) => s.payrollRuns);
  const employees = usePayrollStore((s) => s.employees);
  const currentEmployee = usePayrollStore((s) =>
    s.session ? s.getEmployee(s.session.employeeId) : undefined,
  );
  const isSelfServiceOnly = !!currentEmployee && currentEmployee.role !== "Admin" && currentEmployee.role !== "Manager";
  const [employeeFilter, setEmployeeFilter] = useState(ALL_EMPLOYEES);

  const effectiveFilter = isSelfServiceOnly ? (currentEmployee?.id ?? ALL_EMPLOYEES) : employeeFilter;
  const selectedEmployee =
    effectiveFilter === ALL_EMPLOYEES ? null : employees.find((e) => e.id === effectiveFilter);

  // Runs (optionally scoped to the selected employee's own payroll line)
  const scopedRuns = useMemo(() => {
    if (!selectedEmployee) return payrollRuns;
    return payrollRuns.filter((run) => run.lines.some((l) => l.employeeId === selectedEmployee.id));
  }, [payrollRuns, selectedEmployee]);

  const lineFor = (runId: string) =>
    payrollRuns.find((r) => r.id === runId)?.lines.find((l) => l.employeeId === selectedEmployee?.id);

  const netTotalFor = (run: (typeof payrollRuns)[number]) =>
    selectedEmployee
      ? (lineFor(run.id)?.netPay ?? 0)
      : run.lines.reduce((sum, l) => sum + l.netPay, 0);

  const statusFor = (run: (typeof payrollRuns)[number]) =>
    selectedEmployee ? (lineFor(run.id)?.status ?? run.status) : run.status;

  const totalPaidYtd = scopedRuns
    .filter((r) => statusFor(r) === "Paid")
    .reduce((sum, r) => sum + netTotalFor(r), 0);

  const pendingRuns = scopedRuns.filter((r) => {
    const s = statusFor(r);
    return s === "Pending" || s === "On Processing";
  });
  const pendingTotal = pendingRuns.reduce((sum, r) => sum + netTotalFor(r), 0);

  return (
    <AppShell title="Payroll">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={selectedEmployee ? `Paid to ${selectedEmployee.name.split(" ")[0]}` : "Paid to Date"}
          value={formatCurrency(totalPaidYtd)}
          icon={Wallet}
        />
        <StatCard
          label="Pending Payouts"
          value={formatCurrency(pendingTotal)}
          hint={`${pendingRuns.length} run(s) awaiting payment`}
          icon={Clock4}
          tone={pendingRuns.length > 0 ? "warning" : "default"}
        />
        {selectedEmployee ? (
          <StatCard
            label="Hourly Rate"
            value={`${formatCurrency(selectedEmployee.hourlyRate)}/hr`}
            hint={selectedEmployee.title}
            icon={DollarSign}
          />
        ) : (
          <StatCard label="Employees on Payroll" value={String(employees.length)} icon={Users2} />
        )}
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>{selectedEmployee ? `${selectedEmployee.name}'s Payroll` : "Payroll Runs"}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedEmployee
                ? `${scopedRuns.length} pay period(s) on record`
                : `${payrollRuns.length} run(s) total`}
            </p>
          </div>
          {!isSelfServiceOnly && (
            <div className="flex items-center gap-2">
              <Select
                value={employeeFilter}
                onValueChange={(v) => setEmployeeFilter(v ?? ALL_EMPLOYEES)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_EMPLOYEES}>All employees</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <RunPayrollDialog />
            </div>
          )}
        </CardHeader>
        <CardContent>
          {selectedEmployee ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pay Period</TableHead>
                  <TableHead>Reg / OT Hours</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Adjustment</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scopedRuns.map((run) => {
                  const line = lineFor(run.id)!;
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {formatDate(run.periodStart)} — {formatDate(run.periodEnd)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {line.regularHours}h / {line.overtimeHours}h
                      </TableCell>
                      <TableCell>{formatCurrency(line.grossPay)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {line.adjustment >= 0 ? "+" : "-"}
                        {formatCurrency(Math.abs(line.adjustment))}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(line.netPay)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[line.status]}>{line.status}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {scopedRuns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No payroll history for {selectedEmployee.name} yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pay Period</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Net Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollRuns.map((run) => {
                  const netTotal = run.lines.reduce((sum, l) => sum + l.netPay, 0);
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {formatDate(run.periodStart)} — {formatDate(run.periodEnd)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(run.createdAt)}
                      </TableCell>
                      <TableCell>{run.lines.length}</TableCell>
                      <TableCell>{formatCurrency(netTotal)}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[run.status]}>{run.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <PayrollRunSheet run={run} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {payrollRuns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No payroll runs yet. Run your first payroll to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
