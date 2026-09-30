export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function hoursBetween(startIso: string, endIso: string | null): number {
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const start = new Date(startIso).getTime();
  return (end - start) / 3_600_000;
}

/**
 * Local (not UTC) calendar date as "YYYY-MM-DD", from a Date or an ISO
 * string. Use this for date-range filtering/grouping so it matches the day
 * the user actually sees displayed (formatDate/formatTime use local time
 * too) — slicing an ISO string directly reads the UTC date, which silently
 * shifts to the wrong day for any timestamp near local midnight in a
 * timezone offset from UTC.
 */
export function localDateStr(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Rounds a clock-in time to the nearest hour: 30+ minutes into the hour
 * rounds up to the next hour (e.g. 4:30 or 4:50 -> 5:00), otherwise it
 * rounds down to the start of the current hour (e.g. 4:10 -> 4:00).
 */
function roundClockInToHour(date: Date): Date {
  const rounded = new Date(date);
  if (rounded.getMinutes() >= 30) {
    rounded.setHours(rounded.getHours() + 1);
  }
  rounded.setMinutes(0, 0, 0);
  return rounded;
}

/**
 * Whole-hour duration between two timestamps: the clock-in time rounds to
 * the nearest hour (30+ minutes rounds up to the next hour, e.g. 4:50 ->
 * 5:00) and the clock-out time is truncated down to the start of its hour.
 * e.g. clock in 4:50, clock out 9:10 -> 5:00 to 9:00 = 4 hours.
 */
export function truncatedHoursBetween(startIso: string, endIso: string | null): number {
  const start = roundClockInToHour(new Date(startIso));
  const end = endIso ? new Date(endIso) : new Date();
  end.setMinutes(0, 0, 0);
  return Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
}

function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map((v) => Number(v) || 0);
  return h * 60 + m;
}

/**
 * Minutes a clock-in is late relative to the employee's designated schedule-in
 * time (same calendar day as the clock-in). Returns 0 if on time/early or if
 * no schedule-in is set.
 */
export function minutesLate(clockInIso: string, scheduleIn?: string): number {
  if (!scheduleIn) return 0;
  const clockIn = new Date(clockInIso);
  const scheduled = new Date(clockIn);
  scheduled.setHours(0, 0, 0, 0);
  scheduled.setMinutes(parseHHMM(scheduleIn));
  return Math.max(0, Math.round((clockIn.getTime() - scheduled.getTime()) / 60_000));
}

/**
 * Minutes clocked out beyond the employee's designated schedule-out time
 * (paid at the same rate per hour, no overtime multiplier). Anchored to the
 * clock-in's calendar day, rolling schedule-out to the next day if the
 * designated shift crosses midnight. Uses the current time for an entry
 * that's still clocked in. Returns 0 if no schedule-out is set.
 */
export function minutesOvertime(
  clockInIso: string,
  clockOutIso: string | null,
  scheduleIn: string | undefined,
  scheduleOut: string | undefined,
): number {
  if (!scheduleOut) return 0;
  const clockIn = new Date(clockInIso);
  const clockOut = clockOutIso ? new Date(clockOutIso) : new Date();

  let outMinutes = parseHHMM(scheduleOut);
  const inMinutes = scheduleIn ? parseHHMM(scheduleIn) : 0;
  if (outMinutes <= inMinutes) outMinutes += 24 * 60;

  const scheduled = new Date(clockIn);
  scheduled.setHours(0, 0, 0, 0);
  scheduled.setMinutes(outMinutes);

  return Math.max(0, Math.round((clockOut.getTime() - scheduled.getTime()) / 60_000));
}

/** Formats a minute count as "1h 5m" / "20m" / "—" for zero. */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const STANDARD_WORKDAY_MINUTES = 8 * 60;

/**
 * Computes a time entry's Overtime, Late minutes, and accurate Hours (in
 * minutes). Hours is the real elapsed time between clock-in and clock-out —
 * it already reflects a late start (shorter) or an overtime finish (longer)
 * on its own, since those are measured from the same clock times. Overtime/
 * Late are reported separately for context but are NOT additionally added
 * to or subtracted from Hours, which would double-count them (e.g. clock in
 * 9:00 vs an 8:00 schedule, clock out 16:00: Hours = 7, Overtime = 0, Late =
 * 1h — not 7 - 1 = 6).
 *
 * Clocking in early doesn't count toward Hours: if clock-in is before the
 * designated schedule-in time, Hours is measured starting from schedule-in
 * instead of the earlier real clock-in time.
 *
 * Overtime only counts once Hours reaches a full 8-hour day — clocking out
 * past the scheduled end time doesn't earn overtime if the day fell short of
 * 8 hours overall (e.g. a late arrival that leaves slightly after schedule
 * but still under 8 hours worked).
 */
export function computeEntryMinutes(
  clockIn: string,
  clockOut: string | null,
  scheduleIn: string | undefined,
  scheduleOut: string | undefined,
) {
  const late = minutesLate(clockIn, scheduleIn);
  let overtime = minutesOvertime(clockIn, clockOut, scheduleIn, scheduleOut);
  const end = clockOut ? new Date(clockOut) : new Date();

  let start = new Date(clockIn);
  let earlyArrivalMinutes = 0;
  if (scheduleIn) {
    const scheduledStart = new Date(clockIn);
    scheduledStart.setHours(0, 0, 0, 0);
    scheduledStart.setMinutes(parseHHMM(scheduleIn));
    if (start < scheduledStart) {
      earlyArrivalMinutes = Math.round((scheduledStart.getTime() - start.getTime()) / 60_000);
      start = scheduledStart;
    }
  }

  const totalMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
  if (totalMinutes < STANDARD_WORKDAY_MINUTES) overtime = 0;
  return { late, overtime, totalMinutes, earlyArrivalMinutes };
}

/**
 * Whether a day's actual overtime minutes qualify for payment under the
 * configured minimum-duration threshold. Always takes the threshold as a
 * parameter — never hardcode it — so it reflects whatever an Admin has
 * currently configured in Payroll Settings (`minimum_paid_ot_minutes`).
 */
export function isOvertimeEligible(overtimeMinutes: number, minimumPaidOtMinutes: number): boolean {
  return overtimeMinutes > 0 && overtimeMinutes >= minimumPaidOtMinutes;
}

/**
 * Computes a payroll line's accurate financials for one employee over one
 * pay period from the employee's actual time entries within
 * [periodStart, periodEnd] (via computeEntryMinutes). This is the single
 * source of truth used everywhere a payroll line's numbers are displayed, so
 * a rate or schedule change is reflected consistently across the app — it
 * does not touch what's actually stored/paid.
 *
 * Overtime pay works in three stages, matching the Time & Attendance Rules
 * in Payroll Settings:
 * 1. `actualOvertimeMinutes` — every overtime minute actually worked, summed
 *    across entries. Always the true figure, never zeroed by the threshold —
 *    this is the audit trail and is always shown as-is.
 * 2. `thresholdEligibleOvertimeMinutes` — only entries whose *own* overtime
 *    individually meets `minimumPaidOtMinutes` contribute (a day with 10
 *    minutes of overtime doesn't become eligible just because another day in
 *    the period had 45).
 * 3. `approvedOvertimeMinutes` / `payableOvertimeMinutes` — the
 *    threshold-eligible total, gated by `overtimeApproved` (an Admin sign-off
 *    per payroll line). Only this final amount is actually paid.
 *
 * Payable overtime is paid at `hourlyRate * overtimeMultiplier`; every other
 * minute is paid at the plain hourly rate. When `payableOvertimeMinutes` is 0
 * (the common case — nothing eligible, or eligible but not yet approved) this
 * reduces exactly to the previous flat `(periodMinutes/60) * hourlyRate`
 * formula, so periods without payable overtime are unaffected by this logic.
 *
 * Early clock-in keeps the existing auto-exclude-from-Hours behavior (see
 * computeEntryMinutes) — `unpaidEarlyClockinMinutes` does not change Hours or
 * pay here, it's surfaced separately for transparency/labeling only.
 */
export function computePayrollLineAccurate(
  periodStart: string,
  periodEnd: string,
  employeeId: string,
  hourlyRate: number,
  adjustment: number,
  addition: number,
  timeEntries: { employeeId: string; clockIn: string; clockOut: string | null }[],
  scheduleIn: string | undefined,
  scheduleOut: string | undefined,
  minimumPaidOtMinutes: number,
  overtimeMultiplier: number,
  overtimeApproved: boolean,
) {
  const entries = timeEntries.filter(
    (t) =>
      t.employeeId === employeeId &&
      localDateStr(t.clockIn) >= periodStart &&
      localDateStr(t.clockIn) <= periodEnd,
  );
  const computed = entries.map((t) => computeEntryMinutes(t.clockIn, t.clockOut, scheduleIn, scheduleOut));

  const periodMinutes = computed.reduce((sum, c) => sum + c.totalMinutes, 0);
  const actualOvertimeMinutes = computed.reduce((sum, c) => sum + c.overtime, 0);
  const thresholdEligibleOvertimeMinutes = computed.reduce(
    (sum, c) => sum + (isOvertimeEligible(c.overtime, minimumPaidOtMinutes) ? c.overtime : 0),
    0,
  );
  const approvedOvertimeMinutes = overtimeApproved ? thresholdEligibleOvertimeMinutes : 0;
  const payableOvertimeMinutes = approvedOvertimeMinutes;

  const regularMinutes = periodMinutes - payableOvertimeMinutes;
  const regularPay = (regularMinutes / 60) * hourlyRate;
  const overtimePayAmount = (payableOvertimeMinutes / 60) * hourlyRate * overtimeMultiplier;
  const grossPay = regularPay + overtimePayAmount;
  const netPay = grossPay + addition + adjustment;
  const deduction = -adjustment;

  const calculationStatus: "No Overtime" | "Below Threshold" | "Eligible" =
    actualOvertimeMinutes === 0
      ? "No Overtime"
      : thresholdEligibleOvertimeMinutes === 0
        ? "Below Threshold"
        : "Eligible";
  const approvalStatus: "Not Applicable" | "Pending Approval" | "Approved" =
    thresholdEligibleOvertimeMinutes === 0 ? "Not Applicable" : overtimeApproved ? "Approved" : "Pending Approval";

  return {
    periodMinutes,
    regularMinutes,
    grossPay,
    addition,
    deduction,
    netPay,
    actualOvertimeMinutes,
    thresholdEligibleOvertimeMinutes,
    approvedOvertimeMinutes,
    payableOvertimeMinutes,
    overtimePayAmount,
    calculationStatus,
    approvalStatus,
  };
}

/** Formats a (possibly zero) minute count as a duration, e.g. "6h 40m" / "8h". */
export function formatHoursMinutes(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
