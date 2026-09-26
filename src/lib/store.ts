import { create } from "zustand";
import { getSupabaseBrowserClient } from "./supabase/client";
import type { Database } from "./supabase/database.types";
import { truncatedHoursBetween } from "./format";
import {
  defaultSettings,
  OWNER_EMAIL,
  OWNER_EMPLOYEE_ID,
  OWNER_USERNAME,
  ownerEmployee,
  SCREENSHOT_RETENTION_MS,
} from "./mock-data";
import type {
  CompanySettings,
  Employee,
  PayPeriodStatus,
  PayrollLine,
  PayrollRun,
  PayslipConfirmation,
  Role,
  ScreenLog,
  ScreenLogAction,
  Screenshot,
  TimeEntry,
} from "./types";

const supabase = getSupabaseBrowserClient();

type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"];
type TimeEntryRow = Database["public"]["Tables"]["time_entries"]["Row"];
type PayrollRunRow = Database["public"]["Tables"]["payroll_runs"]["Row"];
type PayrollLineRow = Database["public"]["Tables"]["payroll_lines"]["Row"];
type PayslipConfirmationRow = Database["public"]["Tables"]["payslip_confirmations"]["Row"];
type ScreenLogRow = Database["public"]["Tables"]["screen_logs"]["Row"];
type ScreenshotRow = Database["public"]["Tables"]["screenshots"]["Row"];
type CompanySettingsRow = Database["public"]["Tables"]["company_settings"]["Row"];

function mapEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    role: row.role,
    department: row.department,
    title: row.title,
    status: row.status,
    hourlyRate: Number(row.hourly_rate),
    avatarUrl: row.avatar_url ?? undefined,
    joinedAt: row.joined_at,
    scheduleIn: row.schedule_in ?? undefined,
    scheduleOut: row.schedule_out ?? undefined,
  };
}

function mapTimeEntry(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    employeeId: row.employee_id,
    clockIn: row.clock_in,
    clockOut: row.clock_out,
    note: row.note ?? undefined,
  };
}

function mapScreenLog(row: ScreenLogRow): ScreenLog {
  return {
    id: row.id,
    employeeId: row.employee_id,
    action: row.action,
    detail: row.detail,
    timestamp: row.timestamp,
    ip: row.ip ?? "",
    device: row.device ?? "",
  };
}

function mapPayslipConfirmation(row: PayslipConfirmationRow): PayslipConfirmation {
  return {
    id: row.id,
    payrollRunId: row.payroll_run_id,
    employeeId: row.employee_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    netPay: Number(row.net_pay),
    sentAt: row.sent_at,
    confirmedAt: row.confirmed_at,
  };
}

function mapPayrollLine(row: PayrollLineRow): PayrollLine {
  return {
    employeeId: row.employee_id,
    regularHours: Number(row.regular_hours),
    overtimeHours: Number(row.overtime_hours),
    hourlyRate: Number(row.hourly_rate),
    grossPay: Number(row.gross_pay),
    adjustment: Number(row.adjustment),
    addition: Number(row.addition),
    netPay: Number(row.net_pay),
    status: row.status,
  };
}

function mapSettings(row: CompanySettingsRow): CompanySettings {
  return {
    companyName: row.company_name,
    timezone: row.timezone,
    currency: row.currency,
    standardWorkHours: Number(row.standard_work_hours),
    overtimeMultiplier: Number(row.overtime_multiplier),
    overtimeThresholdHours: Number(row.overtime_threshold_hours),
    payFrequency: row.pay_frequency as CompanySettings["payFrequency"],
    defaultDeductionRate: Number(row.default_deduction_rate),
    requireGeoClockIn: row.require_geo_clock_in,
    notifyOnMissedClockOut: row.notify_on_missed_clock_out,
    notifyOnPayrollRun: row.notify_on_payroll_run,
  };
}

function buildPayrollRuns(runs: PayrollRunRow[], lines: PayrollLineRow[]): PayrollRun[] {
  return runs.map((run) => ({
    id: run.id,
    periodStart: run.period_start,
    periodEnd: run.period_end,
    status: run.status,
    createdAt: run.created_at,
    paidAt: run.paid_at,
    lines: lines.filter((l) => l.payroll_run_id === run.id).map(mapPayrollLine),
  }));
}

/** The run's overall status: uniform if every line agrees, otherwise "On Processing" (mixed). */
function deriveRunStatus(lines: { status: PayPeriodStatus }[]): PayPeriodStatus {
  if (lines.length === 0) return "Pending";
  const first = lines[0].status;
  return lines.every((l) => l.status === first) ? first : "On Processing";
}

/** Drops screenshots older than the 3-day retention window from local state (the server also enforces this via a cron job). */
function pruneScreenshots(screenshots: Screenshot[]): Screenshot[] {
  const cutoff = Date.now() - SCREENSHOT_RETENTION_MS;
  return screenshots.filter((s) => new Date(s.capturedAt).getTime() >= cutoff);
}

async function signedScreenshotUrl(storagePath: string): Promise<string> {
  const { data } = await supabase.storage.from("screenshots").createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? "";
}

interface Session {
  employeeId: string;
}

interface ActionResult {
  success: boolean;
  error?: string;
}

interface PayrollStore {
  employees: Employee[];
  timeEntries: TimeEntry[];
  screenLogs: ScreenLog[];
  payrollRuns: PayrollRun[];
  payslipConfirmations: PayslipConfirmation[];
  screenshots: Screenshot[];
  settings: CompanySettings;

  // auth
  session: Session | null;
  hasHydrated: boolean;

  /** The live screen-share stream granted by the current user, if any (not persisted). */
  screenStream: MediaStream | null;
  /** Prompts the browser's native screen-share picker. Resolves false if denied/cancelled/unsupported. */
  requestScreenShare: () => Promise<boolean>;
  /** Stops all tracks of the active screen-share stream, if any. */
  stopScreenShare: () => void;

  /** Resolves the current Supabase session (if any) and loads all app data. Call once at app start. */
  bootstrap: () => Promise<void>;
  /** Refetches every table from Supabase into local state. */
  hydrate: () => Promise<void>;
  /** Subscribes to Realtime changes on the core tables and refetches on change. Idempotent. */
  subscribeRealtime: () => void;
  unsubscribeRealtime: () => void;

  login: (identifier: string, password: string) => Promise<ActionResult>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<ActionResult>;
  /** Sets a new password for the account currently authenticated via a recovery link. */
  resetPassword: (newPassword: string) => Promise<ActionResult>;
  /** Verifies the master owner password (checked server-side), required to confirm any edit or delete. */
  verifyOwnerPassword: (password: string) => Promise<boolean>;

  // derived helpers
  getEmployee: (id: string) => Employee | undefined;
  isClockedIn: (employeeId: string) => boolean;
  activeEntry: (employeeId: string) => TimeEntry | undefined;

  // actions
  clockIn: (employeeId: string, note?: string) => Promise<void>;
  clockOut: (employeeId: string, note?: string) => Promise<void>;
  addManualTimeEntry: (entry: Omit<TimeEntry, "id">) => Promise<void>;
  updateTimeEntry: (id: string, patch: Partial<TimeEntry>) => Promise<void>;
  deleteTimeEntry: (id: string) => Promise<void>;

  /** Captures a real frame from the active screen-share stream and uploads it to Storage. */
  captureScreenshot: (employeeId: string, timeEntryId: string, image: Blob) => Promise<void>;
  deleteScreenshot: (id: string) => Promise<void>;
  /** Drops any screenshot older than the 3-day retention window from local state. */
  pruneScreenshotsNow: () => void;

  addEmployee: (
    employee: Omit<Employee, "id">,
    password: string,
  ) => Promise<ActionResult>;
  updateEmployee: (id: string, patch: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;

  runPayroll: (
    periodStart: string,
    periodEnd: string,
  ) => Promise<ActionResult & { excludedHours: number }>;
  /** Bulk: sets every employee line in a run to the same status. */
  updatePayrollRunStatus: (id: string, status: PayPeriodStatus) => Promise<ActionResult>;
  /** Sets a single employee's payment status within a run, independent of the others. */
  updatePayrollLineStatus: (
    runId: string,
    employeeId: string,
    status: PayPeriodStatus,
  ) => Promise<ActionResult>;
  /** Manually adjusts an employee's hours/gross pay/deduction/addition for a run; net pay is always recomputed as grossPay + addition + adjustment. */
  updatePayrollLine: (
    runId: string,
    employeeId: string,
    patch: Partial<Pick<PayrollLine, "regularHours" | "overtimeHours" | "grossPay" | "adjustment" | "addition">>,
  ) => Promise<ActionResult>;
  /** Removes a single employee's line (and any payslip confirmation) from a run. */
  deletePayrollLine: (runId: string, employeeId: string) => Promise<ActionResult>;
  /** Deletes an entire payroll run, along with all of its lines and payslip confirmations. */
  deletePayrollRun: (runId: string) => Promise<ActionResult>;
  /** Employee acknowledges a payslip email ("Confirm" button). */
  confirmPayslip: (confirmationId: string) => Promise<void>;

  logAction: (employeeId: string, action: ScreenLogAction, detail: string) => Promise<void>;
  updateSettings: (patch: Partial<CompanySettings>) => Promise<void>;
}

async function insertLog(
  employeeId: string,
  action: ScreenLogAction,
  detail: string,
): Promise<ScreenLog | null> {
  const { data, error } = await supabase
    .from("screen_logs")
    .insert({
      employee_id: employeeId,
      action,
      detail,
      device: typeof navigator !== "undefined" ? navigator.userAgent.split(") ")[0] + ")" : "Web",
    })
    .select()
    .single();
  if (error || !data) return null;
  return mapScreenLog(data);
}

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let realtimeDebounce: ReturnType<typeof setTimeout> | null = null;

export const usePayrollStore = create<PayrollStore>()((set, get) => ({
  employees: [],
  timeEntries: [],
  screenLogs: [],
  payrollRuns: [],
  payslipConfirmations: [],
  screenshots: [],
  settings: defaultSettings,

  session: null,
  hasHydrated: false,
  screenStream: null,

  requestScreenShare: async () => {
    if (get().screenStream) return true;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) return false;
    try {
      // Hints the browser's picker to default to "Entire Screen" (Chrome/Edge respect this;
      // the employee still confirms the native prompt once — browsers never allow silent capture).
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as MediaTrackConstraints,
      });
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (get().screenStream === stream) set({ screenStream: null });
      });
      set({ screenStream: stream });
      return true;
    } catch {
      return false;
    }
  },

  stopScreenShare: () => {
    get().screenStream?.getTracks().forEach((t) => t.stop());
    set({ screenStream: null });
  },

  bootstrap: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      set({ session: null, hasHydrated: true });
      return;
    }

    const { data: employee } = await supabase
      .from("employees")
      .select("*")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!employee || employee.status === "Inactive") {
      await supabase.auth.signOut();
      set({ session: null, hasHydrated: true });
      return;
    }

    set({ session: { employeeId: session.user.id } });
    await get().hydrate();
    get().subscribeRealtime();
  },

  hydrate: async () => {
    const [
      employeesRes,
      timeEntriesRes,
      payrollRunsRes,
      payrollLinesRes,
      payslipConfirmationsRes,
      screenLogsRes,
      screenshotsRes,
      settingsRes,
    ] = await Promise.all([
      supabase.from("employees").select("*").neq("id", OWNER_EMPLOYEE_ID).order("joined_at"),
      supabase.from("time_entries").select("*").order("clock_in", { ascending: false }),
      supabase.from("payroll_runs").select("*").order("created_at", { ascending: false }),
      supabase.from("payroll_lines").select("*"),
      supabase.from("payslip_confirmations").select("*").order("sent_at", { ascending: false }),
      supabase.from("screen_logs").select("*").order("timestamp", { ascending: false }).limit(200),
      supabase.from("screenshots").select("*").order("captured_at", { ascending: false }),
      supabase.from("company_settings").select("*").eq("id", 1).maybeSingle(),
    ]);

    const screenshotRows = screenshotsRes.data ?? [];
    const screenshots = await Promise.all(
      screenshotRows.map(async (row: ScreenshotRow) => ({
        id: row.id,
        employeeId: row.employee_id,
        timeEntryId: row.time_entry_id ?? "",
        capturedAt: row.captured_at,
        imageDataUrl: await signedScreenshotUrl(row.storage_path),
      })),
    );

    set({
      employees: (employeesRes.data ?? []).map(mapEmployee),
      timeEntries: (timeEntriesRes.data ?? []).map(mapTimeEntry),
      payrollRuns: buildPayrollRuns(payrollRunsRes.data ?? [], payrollLinesRes.data ?? []),
      payslipConfirmations: (payslipConfirmationsRes.data ?? []).map(mapPayslipConfirmation),
      screenLogs: (screenLogsRes.data ?? []).map(mapScreenLog),
      screenshots: pruneScreenshots(screenshots),
      settings: settingsRes.data ? mapSettings(settingsRes.data) : defaultSettings,
      hasHydrated: true,
    });
  },

  subscribeRealtime: () => {
    if (realtimeChannel) return;
    const scheduleRefetch = () => {
      if (realtimeDebounce) clearTimeout(realtimeDebounce);
      realtimeDebounce = setTimeout(() => {
        if (get().session) get().hydrate();
      }, 500);
    };
    const tables = [
      "employees",
      "time_entries",
      "payroll_runs",
      "payroll_lines",
      "payslip_confirmations",
      "screen_logs",
      "screenshots",
      "company_settings",
    ] as const;
    let channel = supabase.channel("payroll-realtime");
    for (const table of tables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleRefetch,
      );
    }
    channel.subscribe();
    realtimeChannel = channel;
  },

  unsubscribeRealtime: () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    if (realtimeDebounce) {
      clearTimeout(realtimeDebounce);
      realtimeDebounce = null;
    }
  },

  login: async (identifier, password) => {
    const normalized = identifier.trim().toLowerCase();
    const email = normalized === OWNER_USERNAME.toLowerCase() ? OWNER_EMAIL : normalized;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { success: false, error: "Incorrect email or password." };
    }

    const { data: employee } = await supabase
      .from("employees")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!employee) {
      await supabase.auth.signOut();
      return { success: false, error: "This account no longer exists." };
    }
    if (employee.status === "Inactive") {
      await supabase.auth.signOut();
      return { success: false, error: "This account has been deactivated." };
    }

    set({ session: { employeeId: data.user.id } });
    await insertLog(data.user.id, "Login", "Signed in via web dashboard");
    await get().hydrate();
    get().subscribeRealtime();
    return { success: true };
  },

  logout: async () => {
    const employeeId = get().session?.employeeId;
    if (employeeId) {
      // Logging out shouldn't leave a shift running — clock out first if
      // one's active, same as if they'd clicked "Clock Out" themselves.
      if (get().isClockedIn(employeeId)) {
        await get().clockOut(employeeId);
      }
      await insertLog(employeeId, "Logout", "Signed out");
    }
    get().unsubscribeRealtime();
    get().stopScreenShare();
    await supabase.auth.signOut();
    set({
      session: null,
      employees: [],
      timeEntries: [],
      screenLogs: [],
      payrollRuns: [],
      payslipConfirmations: [],
      screenshots: [],
      settings: defaultSettings,
    });
  },

  requestPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/forgot-password` : undefined,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  resetPassword: async (newPassword) => {
    if (newPassword.length < 8) {
      return { success: false, error: "Password must be at least 8 characters." };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  verifyOwnerPassword: async (password) => {
    const { data, error } = await supabase.rpc("verify_owner_password", { password });
    return !error && data === true;
  },

  getEmployee: (id) => (id === OWNER_EMPLOYEE_ID ? ownerEmployee : get().employees.find((e) => e.id === id)),

  isClockedIn: (employeeId) =>
    get().timeEntries.some((t) => t.employeeId === employeeId && t.clockOut === null),

  activeEntry: (employeeId) =>
    get().timeEntries.find((t) => t.employeeId === employeeId && t.clockOut === null),

  clockIn: async (employeeId, note) => {
    if (get().isClockedIn(employeeId)) return;
    const { data, error } = await supabase
      .from("time_entries")
      .insert({ employee_id: employeeId, clock_in: new Date().toISOString(), clock_out: null, note })
      .select()
      .single();
    if (error || !data) return;

    const log = await insertLog(employeeId, "Clock In", "Clocked in for shift");
    set((state) => ({
      timeEntries: [mapTimeEntry(data), ...state.timeEntries],
      screenLogs: log ? [log, ...state.screenLogs] : state.screenLogs,
    }));
  },

  clockOut: async (employeeId, note) => {
    const active = get().activeEntry(employeeId);
    if (!active) return;
    const { data, error } = await supabase
      .from("time_entries")
      .update({ clock_out: new Date().toISOString(), note: note ?? active.note })
      .eq("id", active.id)
      .select()
      .single();
    if (error || !data) return;

    const log = await insertLog(employeeId, "Clock Out", "Clocked out for the day");
    get().stopScreenShare();
    set((state) => ({
      timeEntries: state.timeEntries.map((t) => (t.id === active.id ? mapTimeEntry(data) : t)),
      screenLogs: log ? [log, ...state.screenLogs] : state.screenLogs,
    }));
  },

  addManualTimeEntry: async (entry) => {
    const { data, error } = await supabase
      .from("time_entries")
      .insert({
        employee_id: entry.employeeId,
        clock_in: entry.clockIn,
        clock_out: entry.clockOut,
        note: entry.note,
      })
      .select()
      .single();
    if (error || !data) return;
    set((state) => ({ timeEntries: [mapTimeEntry(data), ...state.timeEntries] }));
  },

  updateTimeEntry: async (id, patch) => {
    const { data, error } = await supabase
      .from("time_entries")
      .update({
        ...(patch.employeeId !== undefined && { employee_id: patch.employeeId }),
        ...(patch.clockIn !== undefined && { clock_in: patch.clockIn }),
        ...(patch.clockOut !== undefined && { clock_out: patch.clockOut }),
        ...(patch.note !== undefined && { note: patch.note }),
      })
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return;
    set((state) => ({
      timeEntries: state.timeEntries.map((t) => (t.id === id ? mapTimeEntry(data) : t)),
    }));
  },

  deleteTimeEntry: async (id) => {
    const { error } = await supabase.from("time_entries").delete().eq("id", id);
    if (error) return;
    set((state) => ({ timeEntries: state.timeEntries.filter((t) => t.id !== id) }));
  },

  captureScreenshot: async (employeeId, timeEntryId, image) => {
    const capturedAt = new Date().toISOString();
    const id = crypto.randomUUID();
    const storagePath = `${employeeId}/${id}.png`;

    const { error: uploadError } = await supabase.storage
      .from("screenshots")
      .upload(storagePath, image, { contentType: "image/png" });
    if (uploadError) return;

    const { data, error } = await supabase
      .from("screenshots")
      .insert({
        id,
        employee_id: employeeId,
        time_entry_id: timeEntryId,
        captured_at: capturedAt,
        storage_path: storagePath,
      })
      .select()
      .single();
    if (error || !data) return;

    const imageDataUrl = await signedScreenshotUrl(storagePath);
    set((state) => ({
      screenshots: pruneScreenshots([
        { id: data.id, employeeId, timeEntryId, capturedAt, imageDataUrl },
        ...state.screenshots,
      ]),
    }));
  },

  deleteScreenshot: async (id) => {
    const shot = get().screenshots.find((s) => s.id === id);
    if (!shot) return;
    // Look up the storage path from the DB row (not kept in local state) before deleting.
    const { data: row } = await supabase
      .from("screenshots")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();
    if (row?.storage_path) {
      await supabase.storage.from("screenshots").remove([row.storage_path]);
    }
    const { error } = await supabase.from("screenshots").delete().eq("id", id);
    if (error) return;
    set((state) => ({ screenshots: state.screenshots.filter((s) => s.id !== id) }));
  },

  pruneScreenshotsNow: () => {
    set((state) => ({ screenshots: pruneScreenshots(state.screenshots) }));
  },

  addEmployee: async (employee, password) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { success: false, error: "Not authenticated." };

    const res = await fetch("/api/admin/create-employee", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name: employee.name,
        email: employee.email,
        phone: employee.phone,
        role: employee.role,
        department: employee.department,
        title: employee.title,
        status: employee.status,
        hourlyRate: employee.hourlyRate,
        scheduleIn: employee.scheduleIn,
        scheduleOut: employee.scheduleOut,
        password,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      return { success: false, error: body.error ?? "Unable to create this account." };
    }

    const log = await insertLog(
      get().session?.employeeId ?? body.employee.id,
      "Settings Change",
      `Added new employee: ${employee.name}`,
    );
    set((state) => ({
      employees: [...state.employees, mapEmployee(body.employee)],
      screenLogs: log ? [log, ...state.screenLogs] : state.screenLogs,
    }));
    return { success: true };
  },

  updateEmployee: async (id, patch) => {
    const { data, error } = await supabase
      .from("employees")
      .update({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.email !== undefined && { email: patch.email }),
        ...(patch.phone !== undefined && { phone: patch.phone || null }),
        ...(patch.role !== undefined && { role: patch.role as Role }),
        ...(patch.department !== undefined && { department: patch.department }),
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.status !== undefined && { status: patch.status }),
        ...(patch.hourlyRate !== undefined && { hourly_rate: patch.hourlyRate }),
        ...(patch.scheduleIn !== undefined && { schedule_in: patch.scheduleIn || null }),
        ...(patch.scheduleOut !== undefined && { schedule_out: patch.scheduleOut || null }),
      })
      .eq("id", id)
      .select()
      .single();
    if (error || !data) return;
    set((state) => ({
      employees: state.employees.map((e) => (e.id === id ? mapEmployee(data) : e)),
    }));
  },

  deleteEmployee: async (id) => {
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) return;
    set((state) => ({ employees: state.employees.filter((e) => e.id !== id) }));
  },

  runPayroll: async (periodStart, periodEnd) => {
    const { employees, timeEntries, settings, session, payrollRuns } = get();
    const start = new Date(periodStart).getTime();
    const end = new Date(periodEnd).getTime();
    let excludedHours = 0;

    const lines = employees
      .filter((e) => e.status !== "Inactive")
      .map((employee) => {
        const paidRanges = payrollRuns
          .filter((r) => r.lines.some((l) => l.employeeId === employee.id && l.status === "Paid"))
          .map((r) => [new Date(r.periodStart).getTime(), new Date(r.periodEnd).getTime()] as const);

        const entries = timeEntries.filter((t) => {
          if (t.employeeId !== employee.id || !t.clockOut) return false;
          const inTime = new Date(t.clockIn).getTime();
          if (inTime < start || inTime > end) return false;
          const alreadyPaid = paidRanges.some(([ps, pe]) => inTime >= ps && inTime <= pe);
          if (alreadyPaid) {
            excludedHours += truncatedHoursBetween(t.clockIn, t.clockOut);
            return false;
          }
          return true;
        });

        // Same whole-hour rule as the Time Record page: a late clock-in doesn't get paid
        // from its real/exact minute — it rounds to the nearest hour (30+ min rounds up),
        // so lateness reduces paid hours instead of being counted at its precise time.
        const totalHours = entries.reduce(
          (sum, t) => sum + truncatedHoursBetween(t.clockIn, t.clockOut),
          0,
        );

        const regularHours = Math.min(totalHours, settings.overtimeThresholdHours);
        const overtimeHours = Math.max(totalHours - settings.overtimeThresholdHours, 0);
        const grossPay =
          regularHours * employee.hourlyRate + overtimeHours * employee.hourlyRate * settings.overtimeMultiplier;
        // No deduction or addition is applied automatically — both default
        // to 0 until an Admin/Owner explicitly sets one via Edit Deduction.
        const adjustment = 0;
        const addition = 0;
        const netPay = grossPay + addition + adjustment;

        return {
          employeeId: employee.id,
          regularHours: Math.round(regularHours * 100) / 100,
          overtimeHours: Math.round(overtimeHours * 100) / 100,
          hourlyRate: employee.hourlyRate,
          grossPay: Math.round(grossPay * 100) / 100,
          adjustment: Math.round(adjustment * 100) / 100,
          addition: Math.round(addition * 100) / 100,
          netPay: Math.round(netPay * 100) / 100,
          status: "Pending" as PayPeriodStatus,
        };
      });

    const { data: run, error: runError } = await supabase
      .from("payroll_runs")
      .insert({
        period_start: periodStart.slice(0, 10),
        period_end: periodEnd.slice(0, 10),
        status: "Pending",
        paid_at: null,
      })
      .select()
      .single();
    if (runError || !run) {
      return { success: false, error: runError?.message ?? "Unable to run payroll.", excludedHours: 0 };
    }

    const { data: lineRows, error: linesError } = await supabase
      .from("payroll_lines")
      .insert(
        lines.map((l) => ({
          payroll_run_id: run.id,
          employee_id: l.employeeId,
          regular_hours: l.regularHours,
          overtime_hours: l.overtimeHours,
          hourly_rate: l.hourlyRate,
          gross_pay: l.grossPay,
          adjustment: l.adjustment,
          addition: l.addition,
          net_pay: l.netPay,
          status: l.status,
        })),
      )
      .select();
    if (linesError) {
      return { success: false, error: linesError.message, excludedHours: 0 };
    }

    const log = await insertLog(
      session?.employeeId ?? "system",
      "Payroll Run",
      `Ran payroll for ${new Date(periodStart).toLocaleDateString()} - ${new Date(periodEnd).toLocaleDateString()}`,
    );

    const newRun: PayrollRun = {
      id: run.id,
      periodStart: run.period_start,
      periodEnd: run.period_end,
      status: run.status,
      createdAt: run.created_at,
      paidAt: run.paid_at,
      lines: (lineRows ?? []).map(mapPayrollLine),
    };

    set((state) => ({
      payrollRuns: [newRun, ...state.payrollRuns],
      screenLogs: log ? [log, ...state.screenLogs] : state.screenLogs,
    }));

    return { success: true, excludedHours: Math.round(excludedHours * 100) / 100 };
  },

  updatePayrollRunStatus: async (id, status) => {
    const run = get().payrollRuns.find((r) => r.id === id);
    if (!run) return { success: false, error: "Payroll run not found." };

    const periodLabel = `${new Date(run.periodStart).toLocaleDateString()} - ${new Date(run.periodEnd).toLocaleDateString()}`;
    const newlyPaidLines = run.lines.filter((l) => l.status !== "Paid" && status === "Paid" && l.netPay > 0);
    const paidAt = status === "Paid" ? (run.paidAt ?? new Date().toISOString()) : run.paidAt;

    const { error: runUpdateError } = await supabase
      .from("payroll_runs")
      .update({ status, paid_at: paidAt })
      .eq("id", id);
    if (runUpdateError) return { success: false, error: runUpdateError.message };

    const { error: linesUpdateError } = await supabase
      .from("payroll_lines")
      .update({ status })
      .eq("payroll_run_id", id);
    if (linesUpdateError) return { success: false, error: linesUpdateError.message };

    let newConfirmations: PayslipConfirmation[] = [];
    if (newlyPaidLines.length > 0) {
      const { data: confirmationRows } = await supabase
        .from("payslip_confirmations")
        .insert(
          newlyPaidLines.map((l) => ({
            payroll_run_id: run.id,
            employee_id: l.employeeId,
            period_start: run.periodStart,
            period_end: run.periodEnd,
            net_pay: l.netPay,
          })),
        )
        .select();
      newConfirmations = (confirmationRows ?? []).map(mapPayslipConfirmation);

      await supabase.from("screen_logs").insert(
        newlyPaidLines.map((l) => ({
          employee_id: l.employeeId,
          action: "Payslip Email" as const,
          detail: `Payslip email sent for ${periodLabel}`,
        })),
      );
    }

    const log = await insertLog(
      get().session?.employeeId ?? "system",
      "Payroll Run",
      `Changed payroll status to ${status} for all employees in ${periodLabel}`,
    );

    set((state) => ({
      payrollRuns: state.payrollRuns.map((r) =>
        r.id === id
          ? { ...r, status, paidAt, lines: r.lines.map((l) => ({ ...l, status })) }
          : r,
      ),
      payslipConfirmations: [...newConfirmations, ...state.payslipConfirmations],
      screenLogs: log ? [log, ...state.screenLogs] : state.screenLogs,
    }));

    return { success: true };
  },

  updatePayrollLineStatus: async (runId, employeeId, status) => {
    const { payrollRuns, employees } = get();
    const run = payrollRuns.find((r) => r.id === runId);
    const line = run?.lines.find((l) => l.employeeId === employeeId);
    if (!run || !line) return { success: false, error: "Payroll line not found." };

    const periodLabel = `${new Date(run.periodStart).toLocaleDateString()} - ${new Date(run.periodEnd).toLocaleDateString()}`;
    const employeeName =
      (employeeId === OWNER_EMPLOYEE_ID ? ownerEmployee : employees.find((e) => e.id === employeeId))?.name ??
      "this employee";
    const becomingPaid = status === "Paid" && line.status !== "Paid" && line.netPay > 0;
    const linesNext = run.lines.map((l) => (l.employeeId === employeeId ? { ...l, status } : l));
    const runStatus = deriveRunStatus(linesNext);
    const paidAt = status === "Paid" ? (run.paidAt ?? new Date().toISOString()) : run.paidAt;

    const { error: lineUpdateError } = await supabase
      .from("payroll_lines")
      .update({ status })
      .eq("payroll_run_id", runId)
      .eq("employee_id", employeeId);
    if (lineUpdateError) return { success: false, error: lineUpdateError.message };

    const { error: runUpdateError } = await supabase
      .from("payroll_runs")
      .update({ status: runStatus, paid_at: paidAt })
      .eq("id", runId);
    if (runUpdateError) return { success: false, error: runUpdateError.message };

    let newConfirmation: PayslipConfirmation | null = null;
    if (becomingPaid) {
      const { data } = await supabase
        .from("payslip_confirmations")
        .insert({
          payroll_run_id: run.id,
          employee_id: employeeId,
          period_start: run.periodStart,
          period_end: run.periodEnd,
          net_pay: line.netPay,
        })
        .select()
        .single();
      if (data) newConfirmation = mapPayslipConfirmation(data);
      await insertLog(employeeId, "Payslip Email", `Payslip email sent for ${periodLabel}`);
    }

    const log = await insertLog(
      get().session?.employeeId ?? "system",
      "Payroll Run",
      `Changed ${employeeName}'s payroll status to ${status} for ${periodLabel}`,
    );

    set((state) => ({
      payrollRuns: state.payrollRuns.map((r) =>
        r.id === runId ? { ...r, status: runStatus, paidAt, lines: linesNext } : r,
      ),
      payslipConfirmations: newConfirmation
        ? [newConfirmation, ...state.payslipConfirmations]
        : state.payslipConfirmations,
      screenLogs: log ? [log, ...state.screenLogs] : state.screenLogs,
    }));

    return { success: true };
  },

  updatePayrollLine: async (runId, employeeId, patch) => {
    const { payrollRuns, employees } = get();
    const run = payrollRuns.find((r) => r.id === runId);
    const line = run?.lines.find((l) => l.employeeId === employeeId);
    if (!run || !line) return { success: false, error: "Payroll line not found." };

    const regularHours = patch.regularHours ?? line.regularHours;
    const overtimeHours = patch.overtimeHours ?? line.overtimeHours;
    const grossPay = patch.grossPay ?? line.grossPay;
    const adjustment = patch.adjustment ?? line.adjustment;
    const addition = patch.addition ?? line.addition;
    const netPay = Math.round((grossPay + addition + adjustment) * 100) / 100;

    const { error } = await supabase
      .from("payroll_lines")
      .update({
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        gross_pay: grossPay,
        adjustment,
        addition,
        net_pay: netPay,
      })
      .eq("payroll_run_id", runId)
      .eq("employee_id", employeeId);
    if (error) return { success: false, error: error.message };

    const periodLabel = `${new Date(run.periodStart).toLocaleDateString()} - ${new Date(run.periodEnd).toLocaleDateString()}`;
    const employeeName =
      (employeeId === OWNER_EMPLOYEE_ID ? ownerEmployee : employees.find((e) => e.id === employeeId))?.name ??
      "this employee";
    const log = await insertLog(
      get().session?.employeeId ?? "system",
      "Payroll Run",
      `Adjusted ${employeeName}'s payroll for ${periodLabel}`,
    );

    set((state) => ({
      payrollRuns: state.payrollRuns.map((r) =>
        r.id !== runId
          ? r
          : {
              ...r,
              lines: r.lines.map((l) =>
                l.employeeId === employeeId
                  ? { ...l, regularHours, overtimeHours, grossPay, adjustment, addition, netPay }
                  : l,
              ),
            },
      ),
      screenLogs: log ? [log, ...state.screenLogs] : state.screenLogs,
    }));

    return { success: true };
  },

  deletePayrollLine: async (runId, employeeId) => {
    const { payrollRuns, employees } = get();
    const run = payrollRuns.find((r) => r.id === runId);
    const line = run?.lines.find((l) => l.employeeId === employeeId);
    if (!run || !line) return { success: false, error: "Payroll line not found." };

    const { error } = await supabase
      .from("payroll_lines")
      .delete()
      .eq("payroll_run_id", runId)
      .eq("employee_id", employeeId);
    if (error) return { success: false, error: error.message };

    await supabase
      .from("payslip_confirmations")
      .delete()
      .eq("payroll_run_id", runId)
      .eq("employee_id", employeeId);

    const linesNext = run.lines.filter((l) => l.employeeId !== employeeId);
    const runStatus = deriveRunStatus(linesNext);
    await supabase.from("payroll_runs").update({ status: runStatus }).eq("id", runId);

    const periodLabel = `${new Date(run.periodStart).toLocaleDateString()} - ${new Date(run.periodEnd).toLocaleDateString()}`;
    const employeeName =
      (employeeId === OWNER_EMPLOYEE_ID ? ownerEmployee : employees.find((e) => e.id === employeeId))?.name ??
      "this employee";
    const log = await insertLog(
      get().session?.employeeId ?? "system",
      "Payroll Run",
      `Removed ${employeeName} from payroll for ${periodLabel}`,
    );

    set((state) => ({
      payrollRuns: state.payrollRuns.map((r) =>
        r.id === runId ? { ...r, status: runStatus, lines: linesNext } : r,
      ),
      payslipConfirmations: state.payslipConfirmations.filter(
        (c) => !(c.payrollRunId === runId && c.employeeId === employeeId),
      ),
      screenLogs: log ? [log, ...state.screenLogs] : state.screenLogs,
    }));

    return { success: true };
  },

  deletePayrollRun: async (runId) => {
    const { payrollRuns } = get();
    const run = payrollRuns.find((r) => r.id === runId);
    if (!run) return { success: false, error: "Payroll run not found." };

    // payroll_lines and payslip_confirmations cascade-delete with the run.
    const { error } = await supabase.from("payroll_runs").delete().eq("id", runId);
    if (error) return { success: false, error: error.message };

    const periodLabel = `${new Date(run.periodStart).toLocaleDateString()} - ${new Date(run.periodEnd).toLocaleDateString()}`;
    const log = await insertLog(
      get().session?.employeeId ?? "system",
      "Payroll Run",
      `Deleted payroll run for ${periodLabel}`,
    );

    set((state) => ({
      payrollRuns: state.payrollRuns.filter((r) => r.id !== runId),
      payslipConfirmations: state.payslipConfirmations.filter((c) => c.payrollRunId !== runId),
      screenLogs: log ? [log, ...state.screenLogs] : state.screenLogs,
    }));

    return { success: true };
  },

  confirmPayslip: async (confirmationId) => {
    const confirmation = get().payslipConfirmations.find((c) => c.id === confirmationId);
    if (!confirmation || confirmation.confirmedAt) return;

    const confirmedAt = new Date().toISOString();
    const { error } = await supabase
      .from("payslip_confirmations")
      .update({ confirmed_at: confirmedAt })
      .eq("id", confirmationId);
    if (error) return;

    const periodLabel = `${new Date(confirmation.periodStart).toLocaleDateString()} - ${new Date(confirmation.periodEnd).toLocaleDateString()}`;
    const log = await insertLog(
      confirmation.employeeId,
      "Payslip Email",
      `Confirmed receipt of salary for ${periodLabel}`,
    );

    set((state) => ({
      payslipConfirmations: state.payslipConfirmations.map((c) =>
        c.id === confirmationId ? { ...c, confirmedAt } : c,
      ),
      screenLogs: log ? [log, ...state.screenLogs] : state.screenLogs,
    }));
  },

  logAction: async (employeeId, action, detail) => {
    const log = await insertLog(employeeId, action, detail);
    if (log) set((state) => ({ screenLogs: [log, ...state.screenLogs] }));
  },

  updateSettings: async (patch) => {
    const { data, error } = await supabase
      .from("company_settings")
      .update({
        ...(patch.companyName !== undefined && { company_name: patch.companyName }),
        ...(patch.timezone !== undefined && { timezone: patch.timezone }),
        ...(patch.currency !== undefined && { currency: patch.currency }),
        ...(patch.standardWorkHours !== undefined && { standard_work_hours: patch.standardWorkHours }),
        ...(patch.overtimeMultiplier !== undefined && { overtime_multiplier: patch.overtimeMultiplier }),
        ...(patch.overtimeThresholdHours !== undefined && {
          overtime_threshold_hours: patch.overtimeThresholdHours,
        }),
        ...(patch.payFrequency !== undefined && { pay_frequency: patch.payFrequency }),
        ...(patch.defaultDeductionRate !== undefined && {
          default_deduction_rate: patch.defaultDeductionRate,
        }),
        ...(patch.requireGeoClockIn !== undefined && { require_geo_clock_in: patch.requireGeoClockIn }),
        ...(patch.notifyOnMissedClockOut !== undefined && {
          notify_on_missed_clock_out: patch.notifyOnMissedClockOut,
        }),
        ...(patch.notifyOnPayrollRun !== undefined && { notify_on_payroll_run: patch.notifyOnPayrollRun }),
      })
      .eq("id", 1)
      .select()
      .single();
    if (error || !data) return;

    const log = await insertLog(
      get().session?.employeeId ?? "system",
      "Settings Change",
      "Updated company settings",
    );
    set((state) => ({
      settings: mapSettings(data),
      screenLogs: log ? [log, ...state.screenLogs] : state.screenLogs,
    }));
  },
}));
