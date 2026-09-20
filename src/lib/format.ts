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
