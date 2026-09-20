"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Search, Camera, Trash2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { getEmployeeOrOwner } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";
import type { ScreenLogAction } from "@/lib/types";

const ALL = "all";
const actionOptions: ScreenLogAction[] = [
  "Login",
  "Logout",
  "Clock In",
  "Clock Out",
  "Page View",
  "Settings Change",
  "Payroll Run",
  "Payslip Email",
  "Failed Login",
];

const actionTone: Record<ScreenLogAction, "default" | "secondary" | "outline" | "destructive"> = {
  Login: "secondary",
  Logout: "outline",
  "Clock In": "default",
  "Clock Out": "outline",
  "Page View": "outline",
  "Settings Change": "secondary",
  "Payroll Run": "secondary",
  "Payslip Email": "default",
  "Failed Login": "destructive",
};

export default function ScreenLogsPage() {
  const employees = usePayrollStore((s) => s.employees);
  const screenLogs = usePayrollStore((s) => s.screenLogs);
  const screenshots = usePayrollStore((s) => s.screenshots);
  const session = usePayrollStore((s) => s.session);
  const activeEntry = usePayrollStore((s) =>
    session ? s.activeEntry(session.employeeId) : undefined,
  );
  const captureScreenshot = usePayrollStore((s) => s.captureScreenshot);
  const deleteScreenshot = usePayrollStore((s) => s.deleteScreenshot);
  const { requestOwnerAuth, ownerDialog } = useOwnerGate(
    "Deleting a screenshot permanently removes it. Enter the owner password to continue.",
  );

  const searchParams = useSearchParams();
  const [employeeFilter, setEmployeeFilter] = useState(() => searchParams.get("employee") ?? ALL);
  const [actionFilter, setActionFilter] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [screenshotEmployeeFilter, setScreenshotEmployeeFilter] = useState(
    () => searchParams.get("employee") ?? ALL,
  );

  const filtered = useMemo(() => {
    return screenLogs.filter((log) => {
      if (employeeFilter !== ALL && log.employeeId !== employeeFilter) return false;
      if (actionFilter !== ALL && log.action !== actionFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const employee = getEmployeeOrOwner(employees, log.employeeId);
        if (!log.detail.toLowerCase().includes(q) && !employee?.name.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [screenLogs, employeeFilter, actionFilter, query, employees]);

  const filteredScreenshots = useMemo(() => {
    return screenshots
      .filter((s) => screenshotEmployeeFilter === ALL || s.employeeId === screenshotEmployeeFilter)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }, [screenshots, screenshotEmployeeFilter]);

  const handleCaptureNow = () => {
    if (!session || !activeEntry) return;
    captureScreenshot(session.employeeId, activeEntry.id);
    toast.success("Screenshot captured.");
  };

  const handleDeleteScreenshot = (id: string) => {
    requestOwnerAuth(() => {
      deleteScreenshot(id);
      toast.success("Screenshot deleted.");
    });
  };

  return (
    <AppShell title="Screen Logs">
      <Card className="mb-4">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="size-4.5" /> Screenshot Records
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Captured automatically every 10 minutes while clocked in. Screenshots older than 3
              days are deleted automatically — {filteredScreenshots.length} on record.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={screenshotEmployeeFilter} onValueChange={(v) => setScreenshotEmployeeFilter(v ?? ALL)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue>
                  {(value: string) =>
                    value === ALL ? "All employees" : (employees.find((e) => e.id === value)?.name ?? value)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {session && activeEntry && (
              <Button variant="outline" size="sm" onClick={handleCaptureNow}>
                <RefreshCw className="size-3.5" /> Capture Now
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredScreenshots.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No screenshots on record.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filteredScreenshots.map((shot) => {
                const employee = getEmployeeOrOwner(employees, shot.employeeId);
                return (
                  <div key={shot.id} className="overflow-hidden rounded-lg border">
                    <Dialog>
                      <DialogTrigger render={<button type="button" className="block w-full" />}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- simulated data-URI images, next/image doesn't apply */}
                        <img
                          src={shot.imageDataUrl}
                          alt={`Screenshot of ${employee?.name ?? "employee"}`}
                          className="aspect-video w-full object-cover"
                        />
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle>{employee?.name ?? "Unknown"}</DialogTitle>
                          <DialogDescription>{formatDateTime(shot.capturedAt)}</DialogDescription>
                        </DialogHeader>
                        {/* eslint-disable-next-line @next/next/no-img-element -- simulated data-URI images, next/image doesn't apply */}
                        <img src={shot.imageDataUrl} alt="" className="w-full rounded-lg" />
                      </DialogContent>
                    </Dialog>
                    <div className="flex items-center justify-between gap-2 p-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{employee?.name ?? "Unknown"}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {formatDateTime(shot.capturedAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleDeleteScreenshot(shot.id)}
                      >
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Activity Audit Log</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Login sessions, clock events, and admin actions — {filtered.length} records
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search logs..."
                className="w-[180px] pl-8"
              />
            </div>
            <Select value={employeeFilter} onValueChange={(v) => setEmployeeFilter(v ?? ALL)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue>
                  {(value: string) =>
                    value === ALL ? "All employees" : (employees.find((e) => e.id === value)?.name ?? value)
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All employees</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v ?? ALL)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue>{(value: string) => (value === ALL ? "All actions" : value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All actions</SelectItem>
                {actionOptions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => {
                const employee = getEmployeeOrOwner(employees, log.employeeId);
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(log.timestamp)}
                    </TableCell>
                    <TableCell className="font-medium">{employee?.name ?? "Unknown"}</TableCell>
                    <TableCell>
                      <Badge variant={actionTone[log.action]}>{log.action}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate">{log.detail}</TableCell>
                    <TableCell className="text-muted-foreground">{log.device}</TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No activity matches your filters.
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
