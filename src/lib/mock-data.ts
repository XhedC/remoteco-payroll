import type {
  CompanySettings,
  Employee,
  PayrollRun,
  PayslipConfirmation,
  ScreenLog,
  Screenshot,
  TimeEntry,
} from "./types";

function daysAgo(days: number, hour = 9, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

/**
 * A simulated screenshot: this mock phase has no desktop capture agent yet,
 * so a labeled placeholder image stands in for a real periodic screen capture.
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200">
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
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SCREENSHOT_INTERVAL_MS = 10 * 60 * 1000;
export const SCREENSHOT_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

export const seedEmployees: Employee[] = [
  {
    id: "emp_1",
    name: "Avery Santos",
    email: "avery.santos@remoteco.com",
    role: "Admin",
    department: "Operations",
    title: "Operations Manager",
    status: "Active",
    hourlyRate: 32,
    joinedAt: "2022-03-14T00:00:00.000Z",
  },
  {
    id: "emp_2",
    name: "Jonas Cruz",
    email: "jonas.cruz@remoteco.com",
    role: "Staff",
    department: "Engineering",
    title: "Frontend Developer",
    status: "Active",
    hourlyRate: 28,
    joinedAt: "2023-01-09T00:00:00.000Z",
  },
  {
    id: "emp_3",
    name: "Marie Dela Cruz",
    email: "marie.delacruz@remoteco.com",
    role: "Staff",
    department: "Engineering",
    title: "Backend Developer",
    status: "Active",
    hourlyRate: 30,
    joinedAt: "2023-05-20T00:00:00.000Z",
  },
  {
    id: "emp_4",
    name: "Liam Torres",
    email: "liam.torres@remoteco.com",
    role: "Manager",
    department: "Customer Success",
    title: "CS Team Lead",
    status: "Active",
    hourlyRate: 27,
    joinedAt: "2021-11-02T00:00:00.000Z",
  },
  {
    id: "emp_5",
    name: "Sofia Reyes",
    email: "sofia.reyes@remoteco.com",
    role: "Consultant",
    department: "Design",
    title: "Product Designer",
    status: "On Leave",
    hourlyRate: 26,
    joinedAt: "2022-08-17T00:00:00.000Z",
  },
  {
    id: "emp_6",
    name: "Noah Bautista",
    email: "noah.bautista@remoteco.com",
    role: "Other",
    department: "Customer Success",
    title: "Support Specialist",
    status: "Inactive",
    hourlyRate: 20,
    joinedAt: "2024-02-01T00:00:00.000Z",
  },
];

export const seedTimeEntries: TimeEntry[] = [
  { id: "te_1", employeeId: "emp_2", clockIn: daysAgo(0, 8, 55), clockOut: null },
  { id: "te_2", employeeId: "emp_3", clockIn: daysAgo(0, 9, 3), clockOut: null },
  { id: "te_3", employeeId: "emp_4", clockIn: daysAgo(0, 8, 40), clockOut: null },

  { id: "te_4", employeeId: "emp_1", clockIn: daysAgo(1, 9, 0), clockOut: daysAgo(1, 17, 30) },
  { id: "te_5", employeeId: "emp_2", clockIn: daysAgo(1, 8, 50), clockOut: daysAgo(1, 18, 10) },
  { id: "te_6", employeeId: "emp_3", clockIn: daysAgo(1, 9, 5), clockOut: daysAgo(1, 17, 20) },
  { id: "te_7", employeeId: "emp_4", clockIn: daysAgo(1, 8, 45), clockOut: daysAgo(1, 17, 0) },

  { id: "te_8", employeeId: "emp_1", clockIn: daysAgo(2, 9, 0), clockOut: daysAgo(2, 17, 10) },
  { id: "te_9", employeeId: "emp_2", clockIn: daysAgo(2, 8, 58), clockOut: daysAgo(2, 19, 0) },
  { id: "te_10", employeeId: "emp_3", clockIn: daysAgo(2, 9, 10), clockOut: daysAgo(2, 17, 40) },
  { id: "te_11", employeeId: "emp_4", clockIn: daysAgo(2, 8, 30), clockOut: daysAgo(2, 16, 50) },

  { id: "te_12", employeeId: "emp_1", clockIn: daysAgo(3, 9, 2), clockOut: daysAgo(3, 17, 5) },
  { id: "te_13", employeeId: "emp_2", clockIn: daysAgo(3, 9, 0), clockOut: daysAgo(3, 17, 45) },
  { id: "te_14", employeeId: "emp_3", clockIn: daysAgo(3, 8, 55), clockOut: daysAgo(3, 17, 15) },

  { id: "te_15", employeeId: "emp_1", clockIn: daysAgo(4, 8, 59), clockOut: daysAgo(4, 17, 0) },
  { id: "te_16", employeeId: "emp_2", clockIn: daysAgo(4, 9, 0), clockOut: daysAgo(4, 18, 30) },
  { id: "te_17", employeeId: "emp_4", clockIn: daysAgo(4, 8, 40), clockOut: daysAgo(4, 17, 20) },
];

function screenshotFor(id: string, employeeId: string, timeEntryId: string, capturedAt: string): Screenshot {
  const employee = seedEmployees.find((e) => e.id === employeeId);
  return {
    id,
    employeeId,
    timeEntryId,
    capturedAt,
    imageDataUrl: screenshotPlaceholder(employee?.name ?? "Unknown", capturedAt),
  };
}

export const seedScreenshots: Screenshot[] = [
  // Jonas Cruz, clocked in today (te_1) — a few 10-minute captures so far this shift.
  screenshotFor("ss_1", "emp_2", "te_1", daysAgo(0, 9, 5)),
  screenshotFor("ss_2", "emp_2", "te_1", daysAgo(0, 9, 15)),
  screenshotFor("ss_3", "emp_2", "te_1", daysAgo(0, 9, 25)),
  // Marie Dela Cruz, clocked in today (te_2).
  screenshotFor("ss_4", "emp_3", "te_2", daysAgo(0, 9, 13)),
  screenshotFor("ss_5", "emp_3", "te_2", daysAgo(0, 9, 23)),
  // Liam Torres, clocked in today (te_3).
  screenshotFor("ss_6", "emp_4", "te_3", daysAgo(0, 8, 50)),
  // Avery Santos, yesterday's completed shift (te_4) — within the 3-day retention window.
  screenshotFor("ss_7", "emp_1", "te_4", daysAgo(1, 9, 10)),
  screenshotFor("ss_8", "emp_1", "te_4", daysAgo(1, 9, 20)),
  // A 4-day-old capture (te_15), left in on purpose: it's past the 3-day retention
  // window, so it's pruned automatically the moment the app loads.
  screenshotFor("ss_9", "emp_1", "te_15", daysAgo(4, 9, 10)),
];

export const seedScreenLogs: ScreenLog[] = [
  { id: "sl_1", employeeId: "emp_2", action: "Login", detail: "Signed in via web dashboard", timestamp: daysAgo(0, 8, 54), ip: "136.158.22.10", device: "Chrome on Windows" },
  { id: "sl_2", employeeId: "emp_2", action: "Clock In", detail: "Clocked in for shift", timestamp: daysAgo(0, 8, 55), ip: "136.158.22.10", device: "Chrome on Windows" },
  { id: "sl_3", employeeId: "emp_3", action: "Login", detail: "Signed in via web dashboard", timestamp: daysAgo(0, 9, 2), ip: "203.177.4.51", device: "Safari on macOS" },
  { id: "sl_4", employeeId: "emp_3", action: "Clock In", detail: "Clocked in for shift", timestamp: daysAgo(0, 9, 3), ip: "203.177.4.51", device: "Safari on macOS" },
  { id: "sl_5", employeeId: "emp_4", action: "Clock In", detail: "Clocked in for shift", timestamp: daysAgo(0, 8, 40), ip: "112.198.90.5", device: "Chrome on Windows" },
  { id: "sl_6", employeeId: "emp_1", action: "Login", detail: "Signed in via web dashboard", timestamp: daysAgo(1, 8, 58), ip: "136.158.22.11", device: "Edge on Windows" },
  { id: "sl_7", employeeId: "emp_1", action: "Clock Out", detail: "Clocked out for the day", timestamp: daysAgo(1, 17, 30), ip: "136.158.22.11", device: "Edge on Windows" },
  { id: "sl_8", employeeId: "emp_6", action: "Failed Login", detail: "Incorrect password (3rd attempt)", timestamp: daysAgo(2, 10, 12), ip: "88.201.14.3", device: "Chrome on Android" },
  { id: "sl_9", employeeId: "emp_1", action: "Payroll Run", detail: "Ran payroll for Sep 1 - Sep 15", timestamp: daysAgo(5, 14, 0), ip: "136.158.22.11", device: "Edge on Windows" },
  { id: "sl_10", employeeId: "emp_1", action: "Settings Change", detail: "Updated overtime multiplier to 1.5x", timestamp: daysAgo(6, 11, 20), ip: "136.158.22.11", device: "Edge on Windows" },
  { id: "sl_11", employeeId: "emp_4", action: "Page View", detail: "Viewed Employee directory", timestamp: daysAgo(0, 10, 5), ip: "112.198.90.5", device: "Chrome on Windows" },
  { id: "sl_12", employeeId: "emp_5", action: "Logout", detail: "Signed out", timestamp: daysAgo(7, 16, 0), ip: "45.112.8.20", device: "Firefox on Windows" },
];

export const seedPayrollRuns: PayrollRun[] = [
  {
    id: "pr_1",
    periodStart: daysAgo(19, 0, 0),
    periodEnd: daysAgo(5, 0, 0),
    status: "Paid",
    createdAt: daysAgo(5, 14, 0),
    paidAt: daysAgo(4, 9, 0),
    lines: [
      { employeeId: "emp_1", regularHours: 80, overtimeHours: 2, hourlyRate: 32, grossPay: 2656, deductions: 318.72, netPay: 2337.28, status: "Paid" },
      { employeeId: "emp_2", regularHours: 80, overtimeHours: 5, hourlyRate: 28, grossPay: 2450, deductions: 294, netPay: 2156, status: "Paid" },
      { employeeId: "emp_3", regularHours: 78, overtimeHours: 0, hourlyRate: 30, grossPay: 2340, deductions: 280.8, netPay: 2059.2, status: "Paid" },
      { employeeId: "emp_4", regularHours: 80, overtimeHours: 0, hourlyRate: 27, grossPay: 2160, deductions: 259.2, netPay: 1900.8, status: "Paid" },
    ],
  },
];

export const seedPayslipConfirmations: PayslipConfirmation[] = [
  {
    id: "pc_1",
    payrollRunId: "pr_1",
    employeeId: "emp_1",
    periodStart: seedPayrollRuns[0].periodStart,
    periodEnd: seedPayrollRuns[0].periodEnd,
    netPay: 2337.28,
    sentAt: seedPayrollRuns[0].paidAt as string,
    confirmedAt: daysAgo(3, 10, 15),
  },
  {
    id: "pc_2",
    payrollRunId: "pr_1",
    employeeId: "emp_2",
    periodStart: seedPayrollRuns[0].periodStart,
    periodEnd: seedPayrollRuns[0].periodEnd,
    netPay: 2156,
    sentAt: seedPayrollRuns[0].paidAt as string,
    confirmedAt: null,
  },
  {
    id: "pc_3",
    payrollRunId: "pr_1",
    employeeId: "emp_3",
    periodStart: seedPayrollRuns[0].periodStart,
    periodEnd: seedPayrollRuns[0].periodEnd,
    netPay: 2059.2,
    sentAt: seedPayrollRuns[0].paidAt as string,
    confirmedAt: daysAgo(3, 14, 40),
  },
  {
    id: "pc_4",
    payrollRunId: "pr_1",
    employeeId: "emp_4",
    periodStart: seedPayrollRuns[0].periodStart,
    periodEnd: seedPayrollRuns[0].periodEnd,
    netPay: 1900.8,
    sentAt: seedPayrollRuns[0].paidAt as string,
    confirmedAt: null,
  },
];

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

// Demo-only password for every seeded account. There is no email delivery in
// this mock phase, so it's shown directly on the login page.
export const DEFAULT_DEMO_PASSWORD = "Password123!";

export const seedCredentials: Record<string, string> = Object.fromEntries(
  seedEmployees.map((e) => [e.email.toLowerCase(), DEFAULT_DEMO_PASSWORD]),
);

// The owner account is a built-in master account, separate from the regular
// employee directory. It can sign in directly from the login page using its
// username instead of an email, and its password is the master key required
// to confirm any edit or delete action across the system.
export const OWNER_USERNAME = "JesusIsTheOwner";
export const OWNER_PASSWORD = "ThankYouJesus";
export const OWNER_EMPLOYEE_ID = "owner";

export const ownerEmployee: Employee = {
  id: OWNER_EMPLOYEE_ID,
  name: "System Owner",
  email: OWNER_USERNAME,
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
