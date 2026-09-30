"use client";

import Link from "next/link";
import { Users, UserCheck, Clock3, Wallet, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { StatCard } from "@/components/dashboard/stat-card";
import { ClockWidget } from "@/components/dashboard/clock-widget";
import { PayslipNotification } from "@/components/dashboard/payslip-notification";
import { WeeklyHoursChart } from "@/components/dashboard/weekly-hours-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { usePayrollStore } from "@/lib/store";
import { getEmployeeOrOwner } from "@/lib/mock-data";
import { weeklyHours } from "@/lib/analytics";
import { computePayrollLineAccurate, formatCurrency, formatDateTime, hoursBetween, initials } from "@/lib/format";

export default function DashboardPage() {
  const employees = usePayrollStore((s) => s.employees);
  const timeEntries = usePayrollStore((s) => s.timeEntries);
  const screenLogs = usePayrollStore((s) => s.screenLogs);
  const payrollRuns = usePayrollStore((s) => s.payrollRuns);
  const settings = usePayrollStore((s) => s.settings);

  const activeEmployees = employees.filter((e) => e.status === "Active");
  const clockedInEntries = timeEntries.filter((t) => t.clockOut === null);
  const clockedInEmployees = clockedInEntries
    .map((t) => ({ entry: t, employee: employees.find((e) => e.id === t.employeeId) }))
    .filter((x) => x.employee);

  const weekData = weeklyHours(timeEntries);
  const weekTotalHours = weekData.reduce((sum, d) => sum + d.hours, 0);

  const latestRun = payrollRuns[0];
  const latestRunTotal = latestRun
    ? latestRun.lines.reduce((sum, l) => {
        const employee = employees.find((e) => e.id === l.employeeId);
        return (
          sum +
          computePayrollLineAccurate(
            latestRun.periodStart,
            latestRun.periodEnd,
            l.employeeId,
            employee?.hourlyRate ?? l.hourlyRate,
            l.adjustment,
            l.addition,
            timeEntries,
            employee?.scheduleIn,
            employee?.scheduleOut,
            settings.minimumPaidOtMinutes,
            settings.overtimeMultiplier,
            l.overtimeApproved,
          ).netPay
        );
      }, 0)
    : 0;

  const recentLogs = screenLogs.slice(0, 6);

  return (
    <AppShell title="Dashboard" contentClassName="bg-green-50 dark:bg-green-950/20">
      <PayslipNotification />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-2">
          <StatCard
            label="Active Employees"
            value={String(activeEmployees.length)}
            hint={`${employees.length} total on record`}
            icon={Users}
          />
          <StatCard
            label="Clocked In Now"
            value={String(clockedInEmployees.length)}
            hint={clockedInEmployees.length > 0 ? "Currently on the clock" : "Nobody clocked in"}
            icon={UserCheck}
            tone={clockedInEmployees.length > 0 ? "positive" : "default"}
          />
          <StatCard
            label="Hours This Week"
            value={weekTotalHours.toFixed(1)}
            hint="Across all employees"
            icon={Clock3}
          />
          <StatCard
            label="Last Payroll Run"
            value={latestRun ? formatCurrency(latestRunTotal) : "—"}
            hint={latestRun ? `${latestRun.status} • ${latestRun.lines.length} employees` : "No runs yet"}
            icon={Wallet}
          />
        </div>

        <ClockWidget />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Weekly Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyHoursChart data={weekData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Currently Clocked In</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {clockedInEmployees.length === 0 && (
              <p className="text-sm text-muted-foreground">No one is clocked in right now.</p>
            )}
            {clockedInEmployees.map(({ entry, employee }) => (
              <div key={entry.id} className="flex items-center gap-3">
                <Avatar size="sm">
                  <AvatarFallback>{initials(employee!.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{employee!.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{employee!.title}</p>
                </div>
                <Badge variant="secondary">
                  {hoursBetween(entry.clockIn, null).toFixed(1)}h
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Link
            href="/screen-logs"
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View all <ArrowUpRight className="size-3" />
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {recentLogs.map((log) => {
            const employee = getEmployeeOrOwner(employees, log.employeeId);
            return (
              <div key={log.id} className="flex items-start gap-3 text-sm">
                <Avatar size="sm">
                  <AvatarFallback>{employee ? initials(employee.name) : "??"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">{employee?.name ?? "Unknown"}</span>{" "}
                    <span className="text-muted-foreground">{log.detail}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {log.action}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </AppShell>
  );
}
