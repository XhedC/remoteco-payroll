"use client";

import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Trash2, X, CalendarRange, ChevronDown, Download, FileText } from "lucide-react";
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
  localDateStr,
} from "@/lib/format";

const ALL_EMPLOYEES = "all";

function datePreset(kind: "today" | "week" | "month" | "last7" | "last30"): [string, string] {
  const today = new Date();
  const to = localDateStr(today);

  if (kind === "today") return [to, to];

  if (kind === "week") {
    const start = new Date(today);
    const day = start.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diffToMonday);
    return [localDateStr(start), to];
  }

  if (kind === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return [localDateStr(start), to];
  }

  const days = kind === "last7" ? 6 : 29;
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  return [localDateStr(start), to];
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export default function TimeRecordPage() {
  const employees = usePayrollStore((s) => s.employees);
  const timeEntries = usePayrollStore((s) => s.timeEntries);
  const deleteTimeEntry = usePayrollStore((s) => s.deleteTimeEntry);
  const settings = usePayrollStore((s) => s.settings);
  const currentEmployee = usePayrollStore((s) =>
    s.session ? s.getEmployee(s.session.employeeId) : undefined,
  );
  const isSelfServiceOnly = !!currentEmployee && currentEmployee.role !== "Admin" && currentEmployee.role !== "Manager";
  const [filter, setFilter] = useState(ALL_EMPLOYEES);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [page, setPage] = useState(1);
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
      entries = entries.filter((t) => localDateStr(t.clockIn) >= dateFrom);
    }
    if (dateTo) {
      entries = entries.filter((t) => localDateStr(t.clockIn) <= dateTo);
    }
    return [...entries].sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime());
  }, [timeEntries, effectiveFilter, dateFrom, dateTo]);

  // "Display Choices" only limits how many rows are shown on screen — totals,
  // subtotals, and exports below all still cover every filtered record.
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedEntries = filteredEntries.slice((safePage - 1) * pageSize, safePage * pageSize);

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
    const mainSection = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");

    const subtotalHeader = ["Employee", "Records", "Subtotal Hours"];
    const subtotalRows = subtotals.map((row) => [
      row.name,
      String(row.records),
      formatHoursMinutes(row.totalMinutes),
    ]);
    subtotalRows.push(["Total", String(filteredEntries.length), formatHoursMinutes(totalMinutesAll)]);
    const subtotalSection = [subtotalHeader, ...subtotalRows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    const csv = `${mainSection}\n\nSubtotal by Employee\n${subtotalSection}`;
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

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 14;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(settings.companyName || "Company", marginX, 16);
    doc.text("Time Records", pageWidth - marginX, 16, { align: "right" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const subtitle = hasDateFilter
      ? `${dateFrom ? formatDate(`${dateFrom}T00:00:00`) : "Earliest"} – ${dateTo ? formatDate(`${dateTo}T00:00:00`) : "Latest"}`
      : "All dates";
    doc.text(
      `${filteredEntries.length} record(s) • ${formatHoursMinutes(totalMinutesAll)} total hours • ${subtitle}`,
      marginX,
      22,
    );

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

    autoTable(doc, {
      startY: 28,
      head: [["Employee", "Date", "Clock In", "Clock Out", "Hours", "Overtime", "Late", "Note"]],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [5, 150, 105] },
      margin: { left: marginX, right: marginX },
    });

    if (subtotals.length > 0) {
      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Subtotal by Employee", marginX, finalY + 10);

      autoTable(doc, {
        startY: finalY + 14,
        head: [["Employee", "Records", "Subtotal Hours"]],
        body: [
          ...subtotals.map((row) => [row.name, String(row.records), formatHoursMinutes(row.totalMinutes)]),
          ["Total", String(filteredEntries.length), formatHoursMinutes(totalMinutesAll)],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [5, 150, 105] },
        margin: { left: marginX, right: marginX },
      });
    }

    const suffix = hasDateFilter ? `_${dateFrom || "start"}_to_${dateTo || "now"}` : "";
    doc.save(`time-records${suffix}.pdf`);
    toast.success("Time records exported as PDF.");
  };

  return (
    <AppShell title="Time Record">
      {!isSelfServiceOnly && subtotals.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Subtotal by Employee</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Hours totaled per employee for the records shown below, based on each entry&apos;s
              actual clock-in and clock-out time.
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
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleDownload}
              >
                <Download className="size-3.5" /> Download
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleExportPdf}
              >
                <FileText className="size-3.5" /> Export as PDF
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tr-page-size" className="text-xs text-muted-foreground">
                Display
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  if (!v) return;
                  setPageSize(Number(v) as (typeof PAGE_SIZE_OPTIONS)[number]);
                  setPage(1);
                }}
              >
                <SelectTrigger id="tr-page-size" className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              {pagedEntries.map((entry) => {
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
          {filteredEntries.length > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Showing {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredEntries.length)} of {filteredEntries.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setPage(safePage - 1)}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage(safePage + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {ownerDialog}
    </AppShell>
  );
}
