"use client";

import { useMemo, useState } from "react";
import { Trash2, X, CalendarRange, ChevronDown, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TimeEntryDialog } from "@/components/time-record/time-entry-dialog";
import { usePayrollStore } from "@/lib/store";
import { useOwnerGate } from "@/lib/use-owner-gate";
import { getEmployeeOrOwner } from "@/lib/mock-data";
import {
  computeEntryMinutes,
  formatDate,
  formatHoursMinutes,
  formatMinutes,
  formatTime,
} from "@/lib/format";

const ALL_EMPLOYEES = "all";

function toDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function datePreset(kind: "today" | "week" | "month" | "last7" | "last30"): [string, string] {
  const today = new Date();
  const to = toDateStr(today);

  if (kind === "today") return [to, to];

  if (kind === "week") {
    const start = new Date(today);
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diffToMonday);
    return [toDateStr(start), to];
  }

  if (kind === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return [toDateStr(start), to];
  }

  const days = kind === "last7" ? 6 : 29;
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  return [toDateStr(start), to];
}

export default function TimeRecordPage() {
  const employees = usePayrollStore((s) => s.employees);
  const timeEntries = usePayrollStore((s) => s.timeEntries);
  const deleteTimeEntry = usePayrollStore((s) => s.deleteTimeEntry);
  const currentEmployee = usePayrollStore((s) =>
    s.session ? s.getEmployee(s.session.employeeId) : undefined,
  );
  const isSelfServiceOnly = !!currentEmployee && currentEmployee.role !== "Admin" && currentEmployee.role !== "Manager";
  const [filter, setFilter] = useState(ALL_EMPLOYEES);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const hasDateFilter = !!dateFrom || !!dateTo;
  const effectiveFilter = isSelfServiceOnly ? (currentEmployee?.id ?? ALL_EMPLOYEES) : filter;

  const applyPreset = (kind: Parameters<typeof datePreset>[0]) => {
    const [from, to] = datePreset(kind);
    setDateFrom(from);
    setDateTo(to);
  };

  const clearDateFilter = () => {
    setDateFrom("");
    setDateTo("");
  };

  const filteredEntries = useMemo(() => {
    let entries =
      effectiveFilter === ALL_EMPLOYEES
        ? timeEntries
        : timeEntries.filter((t) => t.employeeId === effectiveFilter);
    if (dateFrom) {
      entries = entries.filter((t) => t.clockIn.slice(0, 10) >= dateFrom);
    }
    if (dateTo) {
      entries = entries.filter((t) => t.clockIn.slice(0, 10) <= dateTo);
    }
    return [...entries].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
  }, [timeEntries, effectiveFilter, dateFrom, dateTo]);

  const totalMinutesAll = filteredEntries.reduce((sum, t) => {
    const employee = getEmployeeOrOwner(employees, t.employeeId);
    return sum + computeEntryMinutes(t.clockIn, t.clockOut, employee?.scheduleIn, employee?.scheduleOut).totalMinutes;
  }, 0);

  const subtotals = useMemo(() => {
    const byEmployee = new Map<
      string,
      { employeeId: string; name: string; records: number; totalMinutes: number }
    >();
    for (const entry of filteredEntries) {
      const employee = getEmployeeOrOwner(employees, entry.employeeId);
      const key = entry.employeeId;
      const { totalMinutes } = computeEntryMinutes(
        entry.clockIn,
        entry.clockOut,
        employee?.scheduleIn,
        employee?.scheduleOut,
      );
      const existing = byEmployee.get(key);
      if (existing) {
        existing.records += 1;
        existing.totalMinutes += totalMinutes;
      } else {
        byEmployee.set(key, {
          employeeId: key,
          name: employee?.name ?? "Unknown",
          records: 1,
          totalMinutes,
        });
      }
    }
    return Array.from(byEmployee.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [filteredEntries, employees]);

  const { requestOwnerAuth, ownerDialog } = useOwnerGate(
    "Deleting a time record permanently removes it. Enter the owner password to continue.",
  );

  const handleDelete = async (id: string) => {
    await deleteTimeEntry(id);
    toast.success("Time record removed.");
  };

  const handleDownload = () => {
    const header = ["Employee", "Date", "Clock In", "Clock Out", "Hours", "Overtime", "Late", "Note"];
    const rows = filteredEntries.map((entry) => {
      const employee = getEmployeeOrOwner(employees, entry.employeeId);
      const { late, overtime, totalMinutes } = computeEntryMinutes(
        entry.clockIn,
        entry.clockOut,
        employee?.scheduleIn,
        employee?.scheduleOut,
      );
      return [
        employee?.name ?? "Unknown",
        formatDate(entry.clockIn),
        formatTime(entry.clockIn),
        entry.clockOut ? formatTime(entry.clockOut) : "In progress",
        formatHoursMinutes(totalMinutes),
        formatMinutes(overtime),
        formatMinutes(late),
        entry.note ?? "",
      ];
    });

    const escapeCsv = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const suffix = hasDateFilter ? `_${dateFrom || "start"}_to_${dateTo || "now"}` : "";
    a.download = `time-records${suffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Time records downloaded.");
  };

  return (
    <AppShell title="Time Record">
      {!isSelfServiceOnly && subtotals.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Subtotal by Employee</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Total Hours per employee for the records shown below: base hours (clock-in rounds to
              the nearest hour, clock-out rounds down), minus late minutes, plus overtime minutes.
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Subtotal Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subtotals.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.records}</TableCell>
                    <TableCell className="font-medium">{formatHoursMinutes(row.totalMinutes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-muted-foreground">{filteredEntries.length}</TableCell>
                  <TableCell>{formatHoursMinutes(totalMinutesAll)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>Time Records</CardTitle>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="size-3.5" /> Download
              </Button>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredEntries.length} record(s) • {formatHoursMinutes(totalMinutesAll)} total hours
              {hasDateFilter && (
                <>
                  {" • "}
                  {dateFrom ? formatDate(`${dateFrom}T00:00:00`) : "Earliest"}
                  {" – "}
                  {dateTo ? formatDate(`${dateTo}T00:00:00`) : "Latest"}
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tr-date-from" className="text-xs text-muted-foreground">
                From
              </Label>
              <Input
                id="tr-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tr-date-to" className="text-xs text-muted-foreground">
                To
              </Label>
              <Input
                id="tr-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" />}>
                <CalendarRange className="size-4" /> Period <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => applyPreset("today")}>Today</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyPreset("week")}>This week</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyPreset("month")}>This month</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyPreset("last7")}>Last 7 days</DropdownMenuItem>
                <DropdownMenuItem onClick={() => applyPreset("last30")}>Last 30 days</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {hasDateFilter && (
              <Button variant="ghost" size="icon" onClick={clearDateFilter} aria-label="Clear date filter">
                <X className="size-4" />
              </Button>
            )}

            {!isSelfServiceOnly && (
              <>
                <Select value={filter} onValueChange={(v) => setFilter(v ?? ALL_EMPLOYEES)}>
                  <SelectTrigger className="w-[180px]">
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
                <TimeEntryDialog />
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Login (Clock In)</TableHead>
                <TableHead>Logout (Clock Out)</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Overtime</TableHead>
                <TableHead>Late</TableHead>
                <TableHead>Note</TableHead>
                {!isSelfServiceOnly && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => {
                const employee = getEmployeeOrOwner(employees, entry.employeeId);
                const { late, overtime, totalMinutes } = computeEntryMinutes(
                  entry.clockIn,
                  entry.clockOut,
                  employee?.scheduleIn,
                  employee?.scheduleOut,
                );
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{employee?.name ?? "Unknown"}</TableCell>
                    <TableCell>{formatDate(entry.clockIn)}</TableCell>
                    <TableCell>{formatTime(entry.clockIn)}</TableCell>
                    <TableCell>
                      {entry.clockOut ? (
                        formatTime(entry.clockOut)
                      ) : (
                        <Badge variant="secondary">In progress</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{formatHoursMinutes(totalMinutes)}</TableCell>
                    <TableCell className={overtime > 0 ? "font-medium text-emerald-600" : "text-muted-foreground"}>
                      {formatMinutes(overtime)}
                    </TableCell>
                    <TableCell className={late > 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
                      {formatMinutes(late)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {entry.note || "—"}
                    </TableCell>
                    {!isSelfServiceOnly && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <TimeEntryDialog entry={entry} />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => requestOwnerAuth(() => handleDelete(entry.id))}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              {filteredEntries.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isSelfServiceOnly ? 8 : 9}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {hasDateFilter
                      ? "No time records found for the selected date period."
                      : "No time records found."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {ownerDialog}
    </AppShell>
  );
}
