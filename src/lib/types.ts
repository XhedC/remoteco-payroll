export type Role = "Admin" | "Manager" | "Consultant" | "Staff" | "Other";

export type EmployeeStatus = "Active" | "On Leave" | "Inactive";

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  department: string;
  title: string;
  status: EmployeeStatus;
  hourlyRate: number;
  avatarUrl?: string;
  joinedAt: string; // ISO date
  /** Scheduled shift start time, e.g. "09:00" */
  scheduleIn?: string;
  /** Scheduled shift end time, e.g. "17:00" */
  scheduleOut?: string;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  clockIn: string; // ISO datetime
  clockOut: string | null; // ISO datetime, null if still clocked in
  note?: string;
}

export type PayPeriodStatus = "Pending" | "On Processing" | "Paid" | "Unpaid";

export interface PayrollLine {
  employeeId: string;
  regularHours: number;
  overtimeHours: number;
  hourlyRate: number;
  grossPay: number;
  /** Deduction subtracted from gross pay, stored negative (e.g. -9.60 for a $9.60 deduction). */
  adjustment: number;
  /** Bonus/extra amount added on top of gross pay, stored non-negative. */
  addition: number;
  /** Always grossPay + addition + adjustment. */
  netPay: number;
  /** Per-employee payment status, settable independently of the run's overall status. */
  status: PayPeriodStatus;
}

export interface PayrollRun {
  id: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  status: PayPeriodStatus;
  createdAt: string;
  paidAt: string | null;
  lines: PayrollLine[];
}

export type ScreenLogAction =
  | "Login"
  | "Logout"
  | "Clock In"
  | "Clock Out"
  | "Page View"
  | "Settings Change"
  | "Payroll Run"
  | "Failed Login"
  | "Payslip Email"
  | "Idle"
  | "Active";

export interface ScreenLog {
  id: string;
  employeeId: string;
  action: ScreenLogAction;
  detail: string;
  timestamp: string; // ISO datetime
  ip: string;
  device: string;
}

export interface Screenshot {
  id: string;
  employeeId: string;
  timeEntryId: string;
  capturedAt: string; // ISO datetime
  imageDataUrl: string;
}

export interface PayslipConfirmation {
  id: string;
  payrollRunId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  netPay: number;
  sentAt: string; // ISO datetime, when the "Paid" status triggered the notice
  confirmedAt: string | null; // ISO datetime, when the employee clicked Confirm
}

export interface CompanySettings {
  companyName: string;
  timezone: string;
  currency: string;
  standardWorkHours: number;
  overtimeMultiplier: number;
  overtimeThresholdHours: number;
  payFrequency: "Weekly" | "Bi-Weekly" | "Monthly";
  defaultDeductionRate: number; // percentage, e.g. 0.12
  requireGeoClockIn: boolean;
  notifyOnMissedClockOut: boolean;
  notifyOnPayrollRun: boolean;
}
