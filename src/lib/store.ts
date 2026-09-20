import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaultSettings,
  getEmployeeOrOwner,
  OWNER_EMPLOYEE_ID,
  OWNER_PASSWORD,
  OWNER_USERNAME,
  ownerEmployee,
  screenshotPlaceholder,
  SCREENSHOT_RETENTION_MS,
  seedCredentials,
  seedEmployees,
  seedPayrollRuns,
  seedPayslipConfirmations,
  seedScreenLogs,
  seedScreenshots,
  seedTimeEntries,
} from "./mock-data";
import type {
  CompanySettings,
  Employee,
  PayPeriodStatus,
  PayrollRun,
  PayslipConfirmation,
  ScreenLog,
  ScreenLogAction,
  Screenshot,
  TimeEntry,
} from "./types";

function nextId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${random}`;
}

function nextResetCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** The run's overall status: uniform if every line agrees, otherwise "On Processing" (mixed). */
function deriveRunStatus(lines: { status: PayPeriodStatus }[]): PayPeriodStatus {
  if (lines.length === 0) return "Pending";
  const first = lines[0].status;
  return lines.every((l) => l.status === first) ? first : "On Processing";
}

/** Drops screenshots older than the 3-day retention window, to keep storage clean. */
function pruneScreenshots(screenshots: Screenshot[]): Screenshot[] {
  const cutoff = Date.now() - SCREENSHOT_RETENTION_MS;
  return screenshots.filter((s) => new Date(s.capturedAt).getTime() >= cutoff);
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
  credentials: Record<string, string>;
  passwordResetCodes: Record<string, string>;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

  login: (identifier: string, password: string) => ActionResult;
  logout: () => void;
  requestPasswordReset: (email: string) => ActionResult & { code?: string };
  resetPassword: (email: string, code: string, newPassword: string) => ActionResult;
  /** Verifies the master owner password, required to confirm any edit or delete. */
  verifyOwnerPassword: (password: string) => boolean;

  // derived helpers
  getEmployee: (id: string) => Employee | undefined;
  isClockedIn: (employeeId: string) => boolean;
  activeEntry: (employeeId: string) => TimeEntry | undefined;

  // actions
  clockIn: (employeeId: string, note?: string) => void;
  clockOut: (employeeId: string, note?: string) => void;
  addManualTimeEntry: (entry: Omit<TimeEntry, "id">) => void;
  updateTimeEntry: (id: string, patch: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: string) => void;

  /** Captures a simulated screenshot for a clocked-in employee's shift, and prunes anything past 3 days old. */
  captureScreenshot: (employeeId: string, timeEntryId: string) => void;
  deleteScreenshot: (id: string) => void;
  /** Drops any screenshot older than the 3-day retention window. */
  pruneScreenshotsNow: () => void;

  addEmployee: (employee: Omit<Employee, "id">, password: string) => ActionResult;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;

  runPayroll: (periodStart: string, periodEnd: string) => ActionResult & { excludedHours: number };
  /** Bulk: sets every employee line in a run to the same status. */
  updatePayrollRunStatus: (id: string, status: PayPeriodStatus) => ActionResult;
  /** Sets a single employee's payment status within a run, independent of the others. */
  updatePayrollLineStatus: (runId: string, employeeId: string, status: PayPeriodStatus) => ActionResult;
  /** Employee acknowledges a payslip email ("Confirm" button). */
  confirmPayslip: (confirmationId: string) => void;

  logAction: (employeeId: string, action: ScreenLogAction, detail: string) => void;
  updateSettings: (patch: Partial<CompanySettings>) => void;
}

function addLog(
  logs: ScreenLog[],
  employeeId: string,
  action: ScreenLogAction,
  detail: string,
): ScreenLog[] {
  const entry: ScreenLog = {
    id: nextId("sl"),
    employeeId,
    action,
    detail,
    timestamp: new Date().toISOString(),
    ip: "127.0.0.1",
    device: typeof navigator !== "undefined" ? navigator.userAgent.split(") ")[0] + ")" : "Web",
  };
  return [entry, ...logs];
}

export const usePayrollStore = create<PayrollStore>()(
  persist(
    (set, get) => ({
      employees: seedEmployees,
      timeEntries: seedTimeEntries,
      screenLogs: seedScreenLogs,
      payrollRuns: seedPayrollRuns,
      payslipConfirmations: seedPayslipConfirmations,
      screenshots: pruneScreenshots(seedScreenshots),
      settings: defaultSettings,

      session: null,
      credentials: seedCredentials,
      passwordResetCodes: {},
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      login: (identifier, password) => {
        const normalized = identifier.trim().toLowerCase();

        if (normalized === OWNER_USERNAME.toLowerCase()) {
          if (password !== OWNER_PASSWORD) {
            return { success: false, error: "Incorrect email or password." };
          }
          set((state) => ({
            session: { employeeId: OWNER_EMPLOYEE_ID },
            screenLogs: addLog(
              state.screenLogs,
              OWNER_EMPLOYEE_ID,
              "Login",
              "Signed in via web dashboard",
            ),
          }));
          return { success: true };
        }

        const { credentials, employees } = get();
        const employee = employees.find((e) => e.email.toLowerCase() === normalized);

        if (!employee || credentials[normalized] !== password) {
          return { success: false, error: "Incorrect email or password." };
        }
        if (employee.status === "Inactive") {
          return { success: false, error: "This account has been deactivated." };
        }

        set((state) => ({
          session: { employeeId: employee.id },
          screenLogs: addLog(state.screenLogs, employee.id, "Login", "Signed in via web dashboard"),
        }));
        return { success: true };
      },

      logout: () => {
        const employeeId = get().session?.employeeId;
        set((state) => ({
          session: null,
          screenLogs: employeeId
            ? addLog(state.screenLogs, employeeId, "Logout", "Signed out")
            : state.screenLogs,
        }));
      },

      requestPasswordReset: (email) => {
        const normalized = email.trim().toLowerCase();
        const employee = get().employees.find((e) => e.email.toLowerCase() === normalized);
        if (!employee) {
          return { success: false, error: "No account found with that email." };
        }

        const code = nextResetCode();
        set((state) => ({
          passwordResetCodes: { ...state.passwordResetCodes, [normalized]: code },
        }));
        return { success: true, code };
      },

      resetPassword: (email, code, newPassword) => {
        const normalized = email.trim().toLowerCase();
        const expectedCode = get().passwordResetCodes[normalized];

        if (!expectedCode || expectedCode !== code.trim()) {
          return { success: false, error: "That reset code is invalid or expired." };
        }
        if (newPassword.length < 8) {
          return { success: false, error: "Password must be at least 8 characters." };
        }

        set((state) => {
          const resetCodes = { ...state.passwordResetCodes };
          delete resetCodes[normalized];
          return {
            credentials: { ...state.credentials, [normalized]: newPassword },
            passwordResetCodes: resetCodes,
          };
        });
        return { success: true };
      },

      verifyOwnerPassword: (password) => password === OWNER_PASSWORD,

      getEmployee: (id) => (id === OWNER_EMPLOYEE_ID ? ownerEmployee : get().employees.find((e) => e.id === id)),

      isClockedIn: (employeeId) =>
        get().timeEntries.some((t) => t.employeeId === employeeId && t.clockOut === null),

      activeEntry: (employeeId) =>
        get().timeEntries.find((t) => t.employeeId === employeeId && t.clockOut === null),

      clockIn: (employeeId, note) => {
        if (get().isClockedIn(employeeId)) return;
        const entry: TimeEntry = {
          id: nextId("te"),
          employeeId,
          clockIn: new Date().toISOString(),
          clockOut: null,
          note,
        };
        set((state) => ({
          timeEntries: [entry, ...state.timeEntries],
          screenLogs: addLog(state.screenLogs, employeeId, "Clock In", "Clocked in for shift"),
        }));
      },

      clockOut: (employeeId, note) => {
        const active = get().activeEntry(employeeId);
        if (!active) return;
        set((state) => ({
          timeEntries: state.timeEntries.map((t) =>
            t.id === active.id
              ? { ...t, clockOut: new Date().toISOString(), note: note ?? t.note }
              : t,
          ),
          screenLogs: addLog(state.screenLogs, employeeId, "Clock Out", "Clocked out for the day"),
        }));
      },

      addManualTimeEntry: (entry) => {
        set((state) => ({
          timeEntries: [{ ...entry, id: nextId("te") }, ...state.timeEntries],
        }));
      },

      updateTimeEntry: (id, patch) => {
        set((state) => ({
          timeEntries: state.timeEntries.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        }));
      },

      deleteTimeEntry: (id) => {
        set((state) => ({
          timeEntries: state.timeEntries.filter((t) => t.id !== id),
        }));
      },

      captureScreenshot: (employeeId, timeEntryId) => {
        const employee = get().getEmployee(employeeId);
        const capturedAt = new Date().toISOString();
        const shot: Screenshot = {
          id: nextId("ss"),
          employeeId,
          timeEntryId,
          capturedAt,
          imageDataUrl: screenshotPlaceholder(employee?.name ?? "Unknown", capturedAt),
        };
        set((state) => ({
          screenshots: pruneScreenshots([shot, ...state.screenshots]),
        }));
      },

      deleteScreenshot: (id) => {
        set((state) => ({
          screenshots: state.screenshots.filter((s) => s.id !== id),
        }));
      },

      pruneScreenshotsNow: () => {
        set((state) => ({ screenshots: pruneScreenshots(state.screenshots) }));
      },

      addEmployee: (employee, password) => {
        const normalized = employee.email.trim().toLowerCase();
        const { employees, credentials } = get();

        if (employees.some((e) => e.email.toLowerCase() === normalized)) {
          return { success: false, error: "An account with this email already exists." };
        }
        if (password.length < 8) {
          return { success: false, error: "Password must be at least 8 characters." };
        }

        const id = nextId("emp");
        set((state) => ({
          employees: [...state.employees, { ...employee, id }],
          credentials: { ...credentials, [normalized]: password },
          screenLogs: addLog(
            state.screenLogs,
            state.session?.employeeId ?? id,
            "Settings Change",
            `Added new employee: ${employee.name}`,
          ),
        }));
        return { success: true };
      },

      updateEmployee: (id, patch) => {
        set((state) => ({
          employees: state.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }));
      },

      deleteEmployee: (id) => {
        set((state) => ({
          employees: state.employees.filter((e) => e.id !== id),
        }));
      },

      runPayroll: (periodStart, periodEnd) => {
        const { employees, timeEntries, settings, session, payrollRuns } = get();
        const start = new Date(periodStart).getTime();
        const end = new Date(periodEnd).getTime();
        let excludedHours = 0;

        const lines = employees
          .filter((e) => e.status !== "Inactive")
          .map((employee) => {
            // Hours already covered by a line marked "Paid" for this employee can't be paid again.
            const paidRanges = payrollRuns
              .filter((r) => r.lines.some((l) => l.employeeId === employee.id && l.status === "Paid"))
              .map(
                (r) => [new Date(r.periodStart).getTime(), new Date(r.periodEnd).getTime()] as const,
              );

            const entries = timeEntries.filter((t) => {
              if (t.employeeId !== employee.id || !t.clockOut) return false;
              const inTime = new Date(t.clockIn).getTime();
              if (inTime < start || inTime > end) return false;
              const alreadyPaid = paidRanges.some(([ps, pe]) => inTime >= ps && inTime <= pe);
              if (alreadyPaid) {
                excludedHours +=
                  (new Date(t.clockOut as string).getTime() - inTime) / 3_600_000;
                return false;
              }
              return true;
            });

            const totalHours = entries.reduce((sum, t) => {
              const hrs =
                (new Date(t.clockOut as string).getTime() - new Date(t.clockIn).getTime()) /
                3_600_000;
              return sum + hrs;
            }, 0);

            const regularHours = Math.min(totalHours, settings.overtimeThresholdHours);
            const overtimeHours = Math.max(totalHours - settings.overtimeThresholdHours, 0);
            const grossPay =
              regularHours * employee.hourlyRate +
              overtimeHours * employee.hourlyRate * settings.overtimeMultiplier;
            const deductions = grossPay * settings.defaultDeductionRate;
            const netPay = grossPay - deductions;

            return {
              employeeId: employee.id,
              regularHours: Math.round(regularHours * 100) / 100,
              overtimeHours: Math.round(overtimeHours * 100) / 100,
              hourlyRate: employee.hourlyRate,
              grossPay: Math.round(grossPay * 100) / 100,
              deductions: Math.round(deductions * 100) / 100,
              netPay: Math.round(netPay * 100) / 100,
              status: "Pending" as PayPeriodStatus,
            };
          });

        const run: PayrollRun = {
          id: nextId("pr"),
          periodStart,
          periodEnd,
          status: "Pending",
          createdAt: new Date().toISOString(),
          paidAt: null,
          lines,
        };

        set((state) => ({
          payrollRuns: [run, ...state.payrollRuns],
          screenLogs: addLog(
            state.screenLogs,
            session?.employeeId ?? "system",
            "Payroll Run",
            `Ran payroll for ${new Date(periodStart).toLocaleDateString()} - ${new Date(
              periodEnd,
            ).toLocaleDateString()}`,
          ),
        }));

        return { success: true, excludedHours: Math.round(excludedHours * 100) / 100 };
      },

      updatePayrollRunStatus: (id, status) => {
        const run = get().payrollRuns.find((r) => r.id === id);
        if (!run) {
          return { success: false, error: "Payroll run not found." };
        }

        const periodLabel = `${new Date(run.periodStart).toLocaleDateString()} - ${new Date(
          run.periodEnd,
        ).toLocaleDateString()}`;
        // Lines not already Paid that are about to become Paid get a fresh payslip email.
        const newlyPaidLines = run.lines.filter((l) => l.status !== "Paid" && status === "Paid" && l.netPay > 0);

        set((state) => {
          const payrollRunsNext = state.payrollRuns.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status,
                  paidAt: status === "Paid" ? (r.paidAt ?? new Date().toISOString()) : r.paidAt,
                  lines: r.lines.map((l) => ({ ...l, status })),
                }
              : r,
          );

          let confirmations = state.payslipConfirmations;
          let logs = addLog(
            state.screenLogs,
            state.session?.employeeId ?? "system",
            "Payroll Run",
            `Changed payroll status to ${status} for all employees in ${periodLabel}`,
          );

          if (newlyPaidLines.length > 0) {
            const newConfirmations: PayslipConfirmation[] = newlyPaidLines.map((l) => ({
              id: nextId("pc"),
              payrollRunId: run.id,
              employeeId: l.employeeId,
              periodStart: run.periodStart,
              periodEnd: run.periodEnd,
              netPay: l.netPay,
              sentAt: new Date().toISOString(),
              confirmedAt: null,
            }));
            confirmations = [...newConfirmations, ...confirmations];
            for (const line of newlyPaidLines) {
              logs = addLog(
                logs,
                line.employeeId,
                "Payslip Email",
                `Payslip email sent for ${periodLabel}`,
              );
            }
          }

          return { payrollRuns: payrollRunsNext, payslipConfirmations: confirmations, screenLogs: logs };
        });

        return { success: true };
      },

      updatePayrollLineStatus: (runId, employeeId, status) => {
        const { payrollRuns, employees } = get();
        const run = payrollRuns.find((r) => r.id === runId);
        const line = run?.lines.find((l) => l.employeeId === employeeId);
        if (!run || !line) {
          return { success: false, error: "Payroll line not found." };
        }

        const periodLabel = `${new Date(run.periodStart).toLocaleDateString()} - ${new Date(
          run.periodEnd,
        ).toLocaleDateString()}`;
        const employeeName =
          getEmployeeOrOwner(employees, employeeId)?.name ?? "this employee";
        const becomingPaid = status === "Paid" && line.status !== "Paid" && line.netPay > 0;

        set((state) => {
          const payrollRunsNext = state.payrollRuns.map((r) => {
            if (r.id !== runId) return r;
            const linesNext = r.lines.map((l) =>
              l.employeeId === employeeId ? { ...l, status } : l,
            );
            return {
              ...r,
              lines: linesNext,
              status: deriveRunStatus(linesNext),
              paidAt: status === "Paid" ? (r.paidAt ?? new Date().toISOString()) : r.paidAt,
            };
          });

          let confirmations = state.payslipConfirmations;
          let logs = addLog(
            state.screenLogs,
            state.session?.employeeId ?? "system",
            "Payroll Run",
            `Changed ${employeeName}'s payroll status to ${status} for ${periodLabel}`,
          );

          if (becomingPaid) {
            confirmations = [
              {
                id: nextId("pc"),
                payrollRunId: run.id,
                employeeId,
                periodStart: run.periodStart,
                periodEnd: run.periodEnd,
                netPay: line.netPay,
                sentAt: new Date().toISOString(),
                confirmedAt: null,
              },
              ...confirmations,
            ];
            logs = addLog(logs, employeeId, "Payslip Email", `Payslip email sent for ${periodLabel}`);
          }

          return { payrollRuns: payrollRunsNext, payslipConfirmations: confirmations, screenLogs: logs };
        });

        return { success: true };
      },

      confirmPayslip: (confirmationId) => {
        const confirmation = get().payslipConfirmations.find((c) => c.id === confirmationId);
        if (!confirmation || confirmation.confirmedAt) return;

        const periodLabel = `${new Date(confirmation.periodStart).toLocaleDateString()} - ${new Date(
          confirmation.periodEnd,
        ).toLocaleDateString()}`;

        set((state) => ({
          payslipConfirmations: state.payslipConfirmations.map((c) =>
            c.id === confirmationId ? { ...c, confirmedAt: new Date().toISOString() } : c,
          ),
          screenLogs: addLog(
            state.screenLogs,
            confirmation.employeeId,
            "Payslip Email",
            `Confirmed receipt of salary for ${periodLabel}`,
          ),
        }));
      },

      logAction: (employeeId, action, detail) => {
        set((state) => ({ screenLogs: addLog(state.screenLogs, employeeId, action, detail) }));
      },

      updateSettings: (patch) => {
        set((state) => ({
          settings: { ...state.settings, ...patch },
          screenLogs: addLog(
            state.screenLogs,
            state.session?.employeeId ?? "system",
            "Settings Change",
            "Updated company settings",
          ),
        }));
      },
    }),
    {
      name: "payroll-management-store",
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // Runs after the persisted state is applied; prune via the store's own
        // setter so the update actually propagates (mutating this snapshot won't).
        state?.pruneScreenshotsNow();
      },
    },
  ),
);
