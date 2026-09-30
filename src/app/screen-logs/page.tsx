"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { Search, Camera, Trash2, RefreshCw, Download, FileText } from "lucide-react";
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
import { captureFrameFromStream } from "@/lib/screen-capture";
import { formatDateTime } from "@/lib/format";
import type { ScreenLogAction } from "@/lib/types";

const ALL = "all";
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function DisplayChoices({
  value,
  onChange,
}: {
  value: PageSize;
  onChange: (size: PageSize) => void;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => v && onChange(Number(v) as PageSize)}>
      <SelectTrigger className="w-[110px]">
        <SelectValue>{(v: string) => `Show ${v}`}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PAGE_SIZE_OPTIONS.map((size) => (
          <SelectItem key={size} value={String(size)}>
            {size}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PaginationBar({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
        Previous
      </Button>
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
        Next
      </Button>
    </div>
  );
}

async function fetchImageDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetches an image and re-encodes it as JPEG via canvas. PDF exports embed
 * screenshots uncompressed as PNG otherwise, which can balloon a handful of
 * screenshots into a file tens of megabytes in size — JPEG at this quality
 * keeps it a faithful copy at a small fraction of that size.
 */
async function fetchImageAsJpeg(url: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const dataUrl = await fetchImageDataUrl(url);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("image load failed"));
    img.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");
  ctx.drawImage(img, 0, 0);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.72),
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}
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
  "Idle",
  "Active",
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
  Idle: "destructive",
  Active: "default",
};

export default function ScreenLogsPage() {
  return (
    <Suspense fallback={null}>
      <ScreenLogsPageContent />
    </Suspense>
  );
}

function ScreenLogsPageContent() {
  const employees = usePayrollStore((s) => s.employees);
  const screenLogs = usePayrollStore((s) => s.screenLogs);
  const screenshots = usePayrollStore((s) => s.screenshots);
  const settings = usePayrollStore((s) => s.settings);
  const session = usePayrollStore((s) => s.session);
  const currentEmployee = usePayrollStore((s) =>
    session ? s.getEmployee(session.employeeId) : undefined,
  );
  const isSelfServiceOnly =
    !!currentEmployee && currentEmployee.role !== "Admin" && currentEmployee.role !== "Manager";
  const activeEntry = usePayrollStore((s) =>
    session ? s.activeEntry(session.employeeId) : undefined,
  );
  const captureScreenshot = usePayrollStore((s) => s.captureScreenshot);
  const deleteScreenshot = usePayrollStore((s) => s.deleteScreenshot);
  const screenStream = usePayrollStore((s) => s.screenStream);
  const requestScreenShare = usePayrollStore((s) => s.requestScreenShare);
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
  const [screenshotPageSize, setScreenshotPageSize] = useState<PageSize>(10);
  const [screenshotPage, setScreenshotPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState<PageSize>(10);
  const [logPage, setLogPage] = useState(1);

  // Self-service employees only ever see their own activity/screenshots —
  // other employees' records are blocked, regardless of what these filter
  // values are set to.
  const effectiveLogFilter = isSelfServiceOnly ? (currentEmployee?.id ?? ALL) : employeeFilter;
  const effectiveScreenshotFilter = isSelfServiceOnly
    ? (currentEmployee?.id ?? ALL)
    : screenshotEmployeeFilter;

  const filtered = useMemo(() => {
    return screenLogs.filter((log) => {
      if (effectiveLogFilter !== ALL && log.employeeId !== effectiveLogFilter) return false;
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
  }, [screenLogs, effectiveLogFilter, actionFilter, query, employees]);

  const filteredScreenshots = useMemo(() => {
    return screenshots
      .filter((s) => effectiveScreenshotFilter === ALL || s.employeeId === effectiveScreenshotFilter)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }, [screenshots, effectiveScreenshotFilter]);

  // "Display Choices" only limits how many rows/tiles render on screen —
  // Download and Export as PDF below still always cover every filtered record.
  const screenshotTotalPages = Math.max(1, Math.ceil(filteredScreenshots.length / screenshotPageSize));
  const screenshotSafePage = Math.min(screenshotPage, screenshotTotalPages);
  const pagedScreenshots = filteredScreenshots.slice(
    (screenshotSafePage - 1) * screenshotPageSize,
    screenshotSafePage * screenshotPageSize,
  );

  const logTotalPages = Math.max(1, Math.ceil(filtered.length / logPageSize));
  const logSafePage = Math.min(logPage, logTotalPages);
  const pagedLogs = filtered.slice((logSafePage - 1) * logPageSize, logSafePage * logPageSize);

  const handleCaptureNow = async () => {
    if (!session || !activeEntry) return;
    let stream = screenStream;
    if (!stream) {
      const granted = await requestScreenShare();
      if (!granted) {
        toast.error("Screen sharing wasn't granted, so a screenshot couldn't be captured.");
        return;
      }
      stream = usePayrollStore.getState().screenStream;
    }
    if (!stream) return;
    const blob = await captureFrameFromStream(stream);
    if (!blob) {
      toast.error("Unable to capture a frame from the shared screen.");
      return;
    }
    await captureScreenshot(session.employeeId, activeEntry.id, blob);
    toast.success("Screenshot captured.");
  };

  const handleDeleteScreenshot = (id: string) => {
    requestOwnerAuth(async () => {
      await deleteScreenshot(id);
      toast.success("Screenshot deleted.");
    });
  };

  const handleDownloadScreenshots = async () => {
    if (filteredScreenshots.length === 0) {
      toast.error("No screenshots to download.");
      return;
    }
    await toast.promise(
      (async () => {
        const zip = new JSZip();
        for (const shot of filteredScreenshots) {
          const employee = getEmployeeOrOwner(employees, shot.employeeId);
          const safeName = (employee?.name ?? "unknown").replace(/[^a-z0-9]+/gi, "_");
          const ts = shot.capturedAt.replace(/[^0-9]/g, "-");
          try {
            const res = await fetch(shot.imageDataUrl);
            const blob = await res.blob();
            zip.file(`${safeName}_${ts}.png`, blob);
          } catch {
            // Skip a screenshot whose signed URL has expired/failed rather than failing the whole export.
          }
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "screenshots.zip";
        a.click();
        URL.revokeObjectURL(url);
      })(),
      {
        loading: "Preparing screenshots for download...",
        success: "Screenshots downloaded.",
        error: "Unable to download screenshots.",
      },
    );
  };

  const handleExportScreenshotsPdf = async () => {
    if (filteredScreenshots.length === 0) {
      toast.error("No screenshots to export.");
      return;
    }
    await toast.promise(
      (async () => {
        const doc = new jsPDF({ orientation: "landscape" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 14;

        for (let i = 0; i < filteredScreenshots.length; i += 1) {
          const shot = filteredScreenshots[i];
          const employee = getEmployeeOrOwner(employees, shot.employeeId);
          if (i > 0) doc.addPage();

          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text(settings.companyName || "Company", marginX, 16);
          doc.text("Screenshot Records", pageWidth - marginX, 16, { align: "right" });

          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.text(`${employee?.name ?? "Unknown"} • ${formatDateTime(shot.capturedAt)}`, marginX, 24);

          try {
            const { dataUrl, width, height } = await fetchImageAsJpeg(shot.imageDataUrl);
            const availW = pageWidth - marginX * 2;
            const availH = pageHeight - 34;
            const scale = Math.min(availW / width, availH / height);
            const w = width * scale;
            const h = height * scale;
            const x = (pageWidth - w) / 2;
            doc.addImage(dataUrl, "JPEG", x, 30, w, h);
          } catch {
            doc.setFontSize(10);
            doc.text("Unable to load this screenshot.", marginX, 40);
          }
        }

        doc.save("screenshots.pdf");
      })(),
      {
        loading: "Preparing PDF export...",
        success: "Screenshots exported as PDF.",
        error: "Unable to export screenshots as PDF.",
      },
    );
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
            {!isSelfServiceOnly && (
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
            )}
            <DisplayChoices
              value={screenshotPageSize}
              onChange={(size) => {
                setScreenshotPageSize(size);
                setScreenshotPage(1);
              }}
            />
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleDownloadScreenshots}
            >
              <Download className="size-3.5" /> Download
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleExportScreenshotsPdf}
            >
              <FileText className="size-3.5" /> Export as PDF
            </Button>
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
              {pagedScreenshots.map((shot) => {
                const employee = getEmployeeOrOwner(employees, shot.employeeId);
                return (
                  <div key={shot.id} className="overflow-hidden rounded-lg border">
                    <Dialog>
                      <DialogTrigger render={<button type="button" className="block w-full" />}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URLs, next/image remote patterns not configured for this */}
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
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URLs, next/image remote patterns not configured for this */}
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
          {filteredScreenshots.length > 0 && (
            <PaginationBar
              page={screenshotSafePage}
              totalPages={screenshotTotalPages}
              onPrev={() => setScreenshotPage(screenshotSafePage - 1)}
              onNext={() => setScreenshotPage(screenshotSafePage + 1)}
            />
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
            {!isSelfServiceOnly && (
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
            )}
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
            <DisplayChoices
              value={logPageSize}
              onChange={(size) => {
                setLogPageSize(size);
                setLogPage(1);
              }}
            />
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
              {pagedLogs.map((log) => {
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
          {filtered.length > 0 && (
            <PaginationBar
              page={logSafePage}
              totalPages={logTotalPages}
              onPrev={() => setLogPage(logSafePage - 1)}
              onNext={() => setLogPage(logSafePage + 1)}
            />
          )}
        </CardContent>
      </Card>
      {ownerDialog}
    </AppShell>
  );
}
