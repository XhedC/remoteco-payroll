import { describe, expect, it } from "vitest";
import { computeEntryMinutes, computePayrollLineAccurate, isOvertimeEligible } from "./format";

const SCHEDULE_IN = "09:00";
const SCHEDULE_OUT = "17:00"; // 8-hour scheduled day
const HOURLY_RATE = 20;
const OT_MULTIPLIER = 1.5;
const MIN_PAID_OT = 30;

/** Builds an ISO clock-in/out pair for a fixed calendar day, given HH:mm start/end. */
function entry(day: string, clockInHHMM: string, clockOutHHMM: string) {
  return {
    employeeId: "emp-1",
    clockIn: `${day}T${clockInHHMM}:00`,
    clockOut: `${day}T${clockOutHHMM}:00`,
  };
}

describe("isOvertimeEligible", () => {
  it("is never hardcoded — eligibility follows whatever threshold is passed in", () => {
    expect(isOvertimeEligible(20, 30)).toBe(false);
    expect(isOvertimeEligible(20, 10)).toBe(true);
  });

  it("treats zero overtime as not eligible regardless of threshold", () => {
    expect(isOvertimeEligible(0, 0)).toBe(false);
  });
});

describe("computeEntryMinutes — overtime and early arrival", () => {
  it("reports overtime below the standard 8h day as 0, and no early arrival for an on-time clock-in", () => {
    // 09:00 - 16:30 = 7.5h, under the 8h day, so overtime is suppressed even
    // though clock-out is before schedule-out (no overtime opportunity here).
    const r = computeEntryMinutes("2026-01-05T09:00:00", "2026-01-05T16:30:00", SCHEDULE_IN, SCHEDULE_OUT);
    expect(r.overtime).toBe(0);
    expect(r.earlyArrivalMinutes).toBe(0);
  });

  it("computes actual overtime minutes and early arrival minutes independently", () => {
    // Clock in 08:40 (20 min early), clock out 17:20 (20 min over schedule),
    // full 8h day reached, so overtime counts.
    const r = computeEntryMinutes("2026-01-05T08:40:00", "2026-01-05T17:20:00", SCHEDULE_IN, SCHEDULE_OUT);
    expect(r.earlyArrivalMinutes).toBe(20);
    expect(r.overtime).toBe(20);
    // Early clock-in does not inflate Hours — start is clamped to schedule-in.
    expect(r.totalMinutes).toBe(8 * 60 + 20);
  });

  it("clamps Hours to schedule-in for any early arrival, however large — early time is never silently paid or discarded from the record, just excluded from Hours as today", () => {
    // Clock in 2h early, clock out exactly on schedule.
    const r = computeEntryMinutes("2026-01-05T07:00:00", "2026-01-05T17:00:00", SCHEDULE_IN, SCHEDULE_OUT);
    expect(r.earlyArrivalMinutes).toBe(120);
    expect(r.totalMinutes).toBe(8 * 60);
  });
});

describe("computePayrollLineAccurate — overtime threshold, approval, and pay", () => {
  it("scenario: overtime below threshold — not payable, but actual overtime is still fully reported", () => {
    // 20 minutes of overtime, threshold is 30 — below threshold.
    const entries = [entry("2026-01-05", "09:00", "17:20")];
    const result = computePayrollLineAccurate(
      "2026-01-05",
      "2026-01-05",
      "emp-1",
      HOURLY_RATE,
      0,
      0,
      entries,
      SCHEDULE_IN,
      SCHEDULE_OUT,
      MIN_PAID_OT,
      OT_MULTIPLIER,
      true, // even if approved, below-threshold OT is never payable
    );
    expect(result.actualOvertimeMinutes).toBe(20);
    expect(result.thresholdEligibleOvertimeMinutes).toBe(0);
    expect(result.payableOvertimeMinutes).toBe(0);
    expect(result.calculationStatus).toBe("Below Threshold");
  });

  it("scenario: overtime at/above threshold, approved — payable and paid at the OT multiplier", () => {
    // 60 minutes of overtime, threshold is 30 — eligible.
    const entries = [entry("2026-01-05", "09:00", "18:00")];
    const result = computePayrollLineAccurate(
      "2026-01-05",
      "2026-01-05",
      "emp-1",
      HOURLY_RATE,
      0,
      0,
      entries,
      SCHEDULE_IN,
      SCHEDULE_OUT,
      MIN_PAID_OT,
      OT_MULTIPLIER,
      true,
    );
    expect(result.calculationStatus).toBe("Eligible");
    expect(result.approvalStatus).toBe("Approved");
    expect(result.payableOvertimeMinutes).toBe(60);
    // 8h regular @ $20 + 1h OT @ $20 * 1.5
    expect(result.grossPay).toBeCloseTo(8 * 20 + 1 * 20 * 1.5, 5);
    expect(result.overtimePayAmount).toBeCloseTo(20 * 1.5, 5);
  });

  it("scenario: eligible overtime NOT yet approved — pending, not paid", () => {
    const entries = [entry("2026-01-05", "09:00", "18:00")];
    const result = computePayrollLineAccurate(
      "2026-01-05",
      "2026-01-05",
      "emp-1",
      HOURLY_RATE,
      0,
      0,
      entries,
      SCHEDULE_IN,
      SCHEDULE_OUT,
      MIN_PAID_OT,
      OT_MULTIPLIER,
      false,
    );
    expect(result.approvalStatus).toBe("Pending Approval");
    expect(result.payableOvertimeMinutes).toBe(0);
    // No payable OT -> identical to the flat pre-feature formula.
    expect(result.grossPay).toBeCloseTo((result.periodMinutes / 60) * HOURLY_RATE, 5);
  });

  it("scenario: changing the threshold changes eligibility — proves the threshold is never hardcoded", () => {
    const entries = [entry("2026-01-05", "09:00", "17:20")]; // 20 min OT
    const strict = computePayrollLineAccurate(
      "2026-01-05",
      "2026-01-05",
      "emp-1",
      HOURLY_RATE,
      0,
      0,
      entries,
      SCHEDULE_IN,
      SCHEDULE_OUT,
      30,
      OT_MULTIPLIER,
      true,
    );
    const lenient = computePayrollLineAccurate(
      "2026-01-05",
      "2026-01-05",
      "emp-1",
      HOURLY_RATE,
      0,
      0,
      entries,
      SCHEDULE_IN,
      SCHEDULE_OUT,
      10,
      OT_MULTIPLIER,
      true,
    );
    expect(strict.payableOvertimeMinutes).toBe(0);
    expect(lenient.payableOvertimeMinutes).toBe(20);
  });

  it("scenario: early clock-in within vs. beyond the configured window — Hours clamp is unchanged either way, only the raw early-arrival figure differs", () => {
    const withinWindow = [entry("2026-01-05", "08:50", "17:00")]; // 10 min early
    const beyondWindow = [entry("2026-01-05", "08:00", "17:00")]; // 60 min early

    const a = computePayrollLineAccurate(
      "2026-01-05",
      "2026-01-05",
      "emp-1",
      HOURLY_RATE,
      0,
      0,
      withinWindow,
      SCHEDULE_IN,
      SCHEDULE_OUT,
      MIN_PAID_OT,
      OT_MULTIPLIER,
      false,
    );
    const b = computePayrollLineAccurate(
      "2026-01-05",
      "2026-01-05",
      "emp-1",
      HOURLY_RATE,
      0,
      0,
      beyondWindow,
      SCHEDULE_IN,
      SCHEDULE_OUT,
      MIN_PAID_OT,
      OT_MULTIPLIER,
      false,
    );
    // Both clamp to the same 8h scheduled day regardless of how early — the
    // window setting itself doesn't change what Hours excludes (Q2 answer).
    expect(a.periodMinutes).toBe(8 * 60);
    expect(b.periodMinutes).toBe(8 * 60);
  });

  it("regression: a standard on-time, no-overtime day produces the same Gross/Net as the pre-feature flat formula", () => {
    const entries = [entry("2026-01-05", "09:00", "17:00")]; // exactly 8h, no OT
    const result = computePayrollLineAccurate(
      "2026-01-05",
      "2026-01-05",
      "emp-1",
      HOURLY_RATE,
      -5, // adjustment (deduction)
      10, // addition
      entries,
      SCHEDULE_IN,
      SCHEDULE_OUT,
      MIN_PAID_OT,
      OT_MULTIPLIER,
      true,
    );
    expect(result.payableOvertimeMinutes).toBe(0);
    const expectedGross = (8 * 60 / 60) * HOURLY_RATE;
    expect(result.grossPay).toBeCloseTo(expectedGross, 5);
    expect(result.netPay).toBeCloseTo(expectedGross + 10 - 5, 5);
  });

  it("regression: a late arrival that still falls short of 8 hours earns no overtime, matching prior behavior", () => {
    const entries = [entry("2026-01-05", "10:00", "17:00")]; // 7h worked, late start
    const result = computePayrollLineAccurate(
      "2026-01-05",
      "2026-01-05",
      "emp-1",
      HOURLY_RATE,
      0,
      0,
      entries,
      SCHEDULE_IN,
      SCHEDULE_OUT,
      MIN_PAID_OT,
      OT_MULTIPLIER,
      true,
    );
    expect(result.actualOvertimeMinutes).toBe(0);
    expect(result.calculationStatus).toBe("No Overtime");
    expect(result.grossPay).toBeCloseTo(7 * HOURLY_RATE, 5);
  });
});
