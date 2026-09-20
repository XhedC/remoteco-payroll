import type { CompanySettings, Employee } from "./types";

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * A simulated screenshot: this app has no desktop capture agent, so a
 * labeled placeholder image stands in for a real periodic screen capture.
 */
export function screenshotPlaceholder(employeeName: string, capturedAt: string): string {
  const hue = Math.abs(hashCode(employeeName)) % 360;
  const initials = employeeName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const time = new Date(capturedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue},55%,42%)"/>
        <stop offset="100%" stop-color="hsl(${(hue + 40) % 360},55%,26%)"/>
      </linearGradient>
    </defs>
    <rect width="320" height="200" fill="url(#g)"/>
    <text x="16" y="24" font-family="Arial, sans-serif" font-size="11" fill="white" opacity="0.65">SIMULATED SCREENSHOT</text>
    <rect x="16" y="40" width="64" height="64" rx="10" fill="rgba(255,255,255,0.18)"/>
    <text x="48" y="82" font-family="Arial, sans-serif" font-size="24" fill="white" text-anchor="middle">${initials}</text>
    <text x="16" y="150" font-family="Arial, sans-serif" font-size="15" fill="white" opacity="0.92">${employeeName}</text>
    <text x="16" y="172" font-family="Arial, sans-serif" font-size="13" fill="white" opacity="0.75">${time}</text>
  </svg>`;
}

export const SCREENSHOT_INTERVAL_MS = 10 * 60 * 1000;
export const SCREENSHOT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

export const defaultSettings: CompanySettings = {
  companyName: "RemoteCo Solutions",
  timezone: "Asia/Manila",
  currency: "USD",
  standardWorkHours: 8,
  overtimeMultiplier: 1.5,
  overtimeThresholdHours: 40,
  payFrequency: "Bi-Weekly",
  defaultDeductionRate: 0.12,
  requireGeoClockIn: false,
  notifyOnMissedClockOut: true,
  notifyOnPayrollRun: true,
};

// Demo password seeded for every demo employee account in Supabase Auth.
export const DEFAULT_DEMO_PASSWORD = "Password123!";

// The owner account is a built-in master account, separate from the regular
// employee directory. It signs in directly from the login page using its
// username (mapped to a real Supabase Auth account under the hood), and its
// password is the master key required to confirm any edit or delete action
// across the system (verified server-side via the verify_owner_password RPC).
export const OWNER_USERNAME = "JesusIsTheOwner";
export const OWNER_PASSWORD = "ThankYouJesus";
export const OWNER_EMAIL = "owner@internal.remoteco";
export const OWNER_EMPLOYEE_ID = "16197b9d-72be-4d46-a323-2f2229c4d7d8";

export const ownerEmployee: Employee = {
  id: OWNER_EMPLOYEE_ID,
  name: "System Owner",
  email: OWNER_EMAIL,
  role: "Admin",
  department: "Executive",
  title: "System Owner",
  status: "Active",
  hourlyRate: 0,
  joinedAt: "2022-01-01T00:00:00.000Z",
};

/** Looks up an employee for display, including the owner pseudo-account. */
export function getEmployeeOrOwner(employees: Employee[], id: string): Employee | undefined {
  if (id === OWNER_EMPLOYEE_ID) return ownerEmployee;
  return employees.find((e) => e.id === id);
}
