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
 * Whole-hour duration between two timestamps: both times are truncated down
 * to the start of their hour (minutes dropped) before taking the difference.
 * e.g. clock in 7:30, clock out 9:10 -> 7:00 to 9:00 = 2 hours (not 1h40m).
 */
export function truncatedHoursBetween(startIso: string, endIso: string | null): number {
  const start = new Date(startIso);
  start.setMinutes(0, 0, 0);
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
