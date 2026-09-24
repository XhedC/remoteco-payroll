"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Mail, Phone, Wallet, Clock3, CalendarDays } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePayrollStore } from "@/lib/store";
import { getEmployeeOrOwner } from "@/lib/mock-data";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  initials,
  truncatedHoursBetween,
} from "@/lib/format";
import type { EmployeeStatus, PayPeriodStatus } from "@/lib/types";

const statusVariant: Record<EmployeeStatus, "default" | "secondary" | "outline"> = {
  Active: "default",
  "On Leave": "secondary",
  Inactive: "outline",
};

const payStatusVariant: Record<PayPeriodStatus, "default" | "secondary" | "outline" | "destructive"> = {
  Paid: "default",
  "On Processing": "secondary",
  Pending: "outline",
  Unpaid: "destructive",
};

export default function EmployeeHistoryPage() {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;

  const employees = usePayrollStore((s) => s.employees);
  const timeEntries = usePayrollStore((s) => s.timeEntries);
  const payrollRuns = usePayrollStore((s) => s.payrollRuns);
  const screenLogs = usePayrollStore((s) => s.screenLogs);
  const isClockedIn = usePayrollStore((s) => s.isClockedIn);

  const employee = getEmployeeOrOwner(employees, employeeId);

  const entries = [...timeEntries]
    .filter((t) => t.employeeId === employeeId)
    .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());

  const totalHours = entries.reduce(
    (sum, t) => sum + truncatedHoursBetween(t.clockIn, t.clockOut),
    0,
  );

  const payrollHistory = payrollRuns
    .flatMap((run) => {
      const line = run.lines.find((l) => l.employeeId === employeeId);
      return line ? [{ run, line }] : [];
    })
    .sort((a, b) => new Date(b.run.periodStart).getTime() - new Date(a.run.periodStart).getTime());

  const totalNetPaid = payrollHistory
    .filter((x) => x.line.status === "Paid")
    .reduce((sum, x) => sum + x.line.netPay, 0);

  const logs = screenLogs.filter((l) => l.employeeId === employeeId).slice(0, 8);

  if (!employee) {
    return (
      <AppShell title="Employee Not Found">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              This employee doesn&apos;t exist or may have been removed.
            </p>
            <Link
              href="/employees"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Back to Employee Directory
            </Link>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="Employee History">
      <Link
        href="/employees"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Back to Employee Directory
      </Link>

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar size="lg">
            <AvatarFallback>{initials(employee.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{employee.name}</h2>
              {isClockedIn(employee.id) && (
                <Badge variant="secondary" className="gap-1">
                  <span className="size-1.5 rounded-full bg-emerald-500" /> Clocked in
                </Badge>
              )}
              <Badge variant={statusVariant[employee.status]}>{employee.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {employee.title} • {employee.department} • {employee.role}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="size-3" /> {employee.email}
            </p>
            {employee.phone && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="size-3" /> {employee.phone}
              </p>
            )}
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Hourly Rate</p>
              <p className="font-medium">{formatCurrency(employee.hourlyRate)}/hr</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Joined</p>
              <p className="font-medium">{formatDate(employee.joinedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Hours Logged"
          value={`${Math.round(totalHours)}h`}
          hint={`${entries.length} time records`}
          icon={Clock3}
        />
        <StatCard
          label="Payroll Runs"
          value={String(payrollHistory.length)}
          hint="Pay periods on record"
          icon={CalendarDays}
        />
        <StatCard
          label="Total Net Paid"
          value={formatCurrency(totalNetPaid)}
          hint="Lifetime, paid runs only"
          icon={Wallet}
        />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Time Record History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Login (Clock In)</TableHead>
                <TableHead>Logout (Clock Out)</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const hours = truncatedHoursBetween(entry.clockIn, entry.clockOut);
                return (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.clockIn)}</TableCell>
                    <TableCell>{formatTime(entry.clockIn)}</TableCell>
                    <TableCell>
                      {entry.clockOut ? (
                        formatTime(entry.clockOut)
                      ) : (
                        <Badge variant="secondary">In progress</Badge>
                      )}
                    </TableCell>
                    <TableCell>{Math.round(hours)}h</TableCell>
                    <TableCell className="max-w-[240px] truncate text-muted-foreground">
                      {entry.note || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No time records yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {entries.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell>{Math.round(totalHours)}h</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Payroll History</CardTitle>
        </CardHeader>
        <CardContent>
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
              {payrollHistory.map(({ run, line }) => (
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
                    <Badge variant={payStatusVariant[line.status]}>{line.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {payrollHistory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No payroll history yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Link
            href={`/screen-logs?employee=${employee.id}`}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View full log →
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">{log.detail}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {log.action}
              </Badge>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
