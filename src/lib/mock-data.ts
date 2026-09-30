import type { CompanySettings, Employee } from "./types";

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
  minimumPaidOtMinutes: 30,
  unpaidEarlyClockinMinutes: 15,
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
