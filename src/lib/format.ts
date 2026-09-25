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

/**
 * Computes a time entry's Overtime, Late minutes, and accurate Hours (in
 * minutes). Hours is simply the real elapsed time between clock-in and
 * clock-out — it already reflects a late start (shorter) or an overtime
 * finish (longer) on its own, since those are measured from the same clock
 * times. Overtime/Late are reported separately for context but are NOT
 * additionally added to or subtracted from Hours, which would double-count
 * them (e.g. clock in 9:00 vs a 8:00 schedule, clock out 16:00: Hours = 7,
 * Overtime = 0, Late = 1h — not 7 - 1 = 6).
 */
export function computeEntryMinutes(
  clockIn: string,
  clockOut: string | null,
  scheduleIn: string | undefined,
  scheduleOut: string | undefined,
) {
  const late = minutesLate(clockIn, scheduleIn);
  const overtime = minutesOvertime(clockIn, clockOut, scheduleIn, scheduleOut);
  const end = clockOut ? new Date(clockOut) : new Date();
  const totalMinutes = Math.max(0, Math.round((end.getTime() - new Date(clockIn).getTime()) / 60_000));
  return { late, overtime, totalMinutes };
}

/**
 * Computes a payroll line's accurate financials for one employee over one
 * pay period: Total Hours (minutes) from the employee's actual time entries
 * within [periodStart, periodEnd] (via computeEntryMinutes), Gross Pay as
 * Total Hours x rate, and Net Pay/Deduction from the line's stored
 * adjustment (Gross - Deduction = Net always holds). This is the single
 * source of truth used everywhere a payroll line's numbers are displayed,
 * so a rate or schedule change is reflected consistently across the app —
 * it does not touch what's actually stored/paid.
 */
export function computePayrollLineAccurate(
  periodStart: string,
  periodEnd: string,
  employeeId: string,
  hourlyRate: number,
  adjustment: number,
  timeEntries: { employeeId: string; clockIn: string; clockOut: string | null }[],
  scheduleIn: string | undefined,
  scheduleOut: string | undefined,
) {
  const periodMinutes = timeEntries
    .filter(
      (t) =>
        t.employeeId === employeeId &&
        t.clockIn.slice(0, 10) >= periodStart &&
        t.clockIn.slice(0, 10) <= periodEnd,
    )
    .reduce((sum, t) => sum + computeEntryMinutes(t.clockIn, t.clockOut, scheduleIn, scheduleOut).totalMinutes, 0);
  const grossPay = (periodMinutes / 60) * hourlyRate;
  const netPay = grossPay + adjustment;
  const deduction = grossPay - netPay;
  return { periodMinutes, grossPay, deduction, netPay };
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
