import type { TimeEntry } from "./types";
import { hoursBetween } from "./format";

export interface DayHours {
  label: string;
  date: string; // yyyy-mm-dd
  hours: number;
}

export function weeklyHours(timeEntries: TimeEntry[], days = 7): DayHours[] {
  const buckets: DayHours[] = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    buckets.push({ label, date: dateKey, hours: 0 });
  }

  for (const entry of timeEntries) {
    const dateKey = entry.clockIn.slice(0, 10);
    const bucket = buckets.find((b) => b.date === dateKey);
    if (!bucket) continue;
    bucket.hours += hoursBetween(entry.clockIn, entry.clockOut);
  }

  return buckets.map((b) => ({ ...b, hours: Math.round(b.hours * 10) / 10 }));
}
