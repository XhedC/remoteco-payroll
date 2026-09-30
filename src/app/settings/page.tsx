"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimezoneCombobox } from "@/components/settings/timezone-combobox";
import { usePayrollStore } from "@/lib/store";
import { useOwnerGate } from "@/lib/use-owner-gate";
import type { CompanySettings } from "@/lib/types";

export default function SettingsPage() {
  const settings = usePayrollStore((s) => s.settings);
  const hasHydrated = usePayrollStore((s) => s.hasHydrated);
  const updateSettings = usePayrollStore((s) => s.updateSettings);
  const [form, setForm] = useState<CompanySettings>(settings);
  // Synced from the store exactly once, the first time real data has loaded
  // (hasHydrated flips true) — not on every reference change. If this page
  // mounts before hydrate() finishes, `settings` is still the hardcoded
  // pre-hydration default; without this, the saved/"fixed" values an
  // Admin/Owner just persisted would never appear after a reload. Realtime
  // syncs elsewhere in the app replace `settings` with a new object on every
  // unrelated table change though, so resyncing on every such change (after
  // this first one) would silently overwrite an admin's in-progress,
  // unsaved edits here.
  const [syncedOnce, setSyncedOnce] = useState(false);
  if (hasHydrated && !syncedOnce) {
    setSyncedOnce(true);
    setForm(settings);
  }
  const [submitting, setSubmitting] = useState(false);

  const { requestOwnerAuth, ownerDialog } = useOwnerGate(
    "Saving changes updates company-wide settings. Enter the owner password to continue.",
  );

  const set = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const saveSettings = async () => {
    if (!form.standardWorkHours || form.standardWorkHours < 1) {
      toast.error("Standard Work Hours / Day must be at least 1.");
      return;
    }
    if (!form.overtimeThresholdHours || form.overtimeThresholdHours < 1) {
      toast.error("Overtime Threshold must be at least 1 hour — clearing this field to 0 would treat every hour as overtime.");
      return;
    }
    if (!form.overtimeMultiplier || form.overtimeMultiplier < 1) {
      toast.error("Overtime Multiplier must be at least 1 — a multiplier of 0 would pay overtime hours nothing.");
      return;
    }
    if (form.defaultDeductionRate < 0 || form.defaultDeductionRate > 1) {
      toast.error("Default Adjustment Rate must be between 0% and 100%.");
      return;
    }
    if (
      form.minimumPaidOtMinutes == null ||
      form.minimumPaidOtMinutes < 0 ||
      form.minimumPaidOtMinutes > 480
    ) {
      toast.error("Minimum Paid OT Minutes must be between 0 and 480.");
      return;
    }
    if (
      form.unpaidEarlyClockinMinutes == null ||
      form.unpaidEarlyClockinMinutes < 0 ||
      form.unpaidEarlyClockinMinutes > 240
    ) {
      toast.error("Early Clock-In Window must be between 0 and 240 minutes.");
      return;
    }
    setSubmitting(true);
    await updateSettings(form);
    setSubmitting(false);
    // Resync to the exact persisted values (e.g. numeric column rounding),
    // so what's displayed always matches what's actually now fixed/saved.
    setForm(usePayrollStore.getState().settings);
    toast.success("Settings saved.");
  };

  const handleSave = () => requestOwnerAuth(saveSettings);
  const handleReset = () => {
    setForm(settings);
    toast.info("Unsaved changes discarded.");
  };

  return (
    <AppShell title="Settings">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Company Profile</CardTitle>
              <CardDescription>Basic information shown across the dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="s-company">Company Name</Label>
                <Input
                  id="s-company"
                  value={form.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-timezone">Timezone</Label>
                <TimezoneCombobox
                  id="s-timezone"
                  value={form.timezone}
                  onValueChange={(v) => set("timezone", v)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-currency">Currency</Label>
                <Select value={form.currency} onValueChange={(v) => v && set("currency", v)}>
                  <SelectTrigger id="s-currency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="PHP">PHP (₱)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pay & Overtime Rules</CardTitle>
              <CardDescription>
                Used to calculate regular vs. overtime hours during payroll runs.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-frequency">Pay Frequency</Label>
                <Select
                  value={form.payFrequency}
                  onValueChange={(v) => set("payFrequency", v as CompanySettings["payFrequency"])}
                >
                  <SelectTrigger id="s-frequency" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Weekly">Weekly</SelectItem>
                    <SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-standard-hours">Standard Work Hours / Day</Label>
                <Input
                  id="s-standard-hours"
                  type="number"
                  min="1"
                  value={form.standardWorkHours}
                  onChange={(e) => set("standardWorkHours", Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-ot-threshold">Overtime Threshold (hrs / period)</Label>
                <Input
                  id="s-ot-threshold"
                  type="number"
                  min="1"
                  value={form.overtimeThresholdHours}
                  onChange={(e) => set("overtimeThresholdHours", Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-ot-multiplier">Overtime Multiplier</Label>
                <Input
                  id="s-ot-multiplier"
                  type="number"
                  step="0.1"
                  min="1"
                  value={form.overtimeMultiplier}
                  onChange={(e) => set("overtimeMultiplier", Number(e.target.value))}
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="s-deduction">Default Adjustment Rate (%)</Label>
                <Input
                  id="s-deduction"
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={Math.round(form.defaultDeductionRate * 100)}
                  onChange={(e) => set("defaultDeductionRate", Number(e.target.value) / 100)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time & Attendance Rules</CardTitle>
              <CardDescription>
                Governs when overtime becomes eligible for payment and how early clock-ins are
                treated. Actual attendance records are never discarded — these thresholds only
                affect what&apos;s automatically counted as payable.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-min-ot">Minimum Paid OT Minutes</Label>
                <Input
                  id="s-min-ot"
                  type="number"
                  min="0"
                  max="480"
                  value={form.minimumPaidOtMinutes}
                  onChange={(e) => set("minimumPaidOtMinutes", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum overtime duration (0–480 min) required for that day&apos;s overtime to be
                  eligible for payment. Overtime below this is still recorded, just not
                  automatically eligible.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="s-early-window">Early Clock-In Window (Minutes)</Label>
                <Input
                  id="s-early-window"
                  type="number"
                  min="0"
                  max="240"
                  value={form.unpaidEarlyClockinMinutes}
                  onChange={(e) => set("unpaidEarlyClockinMinutes", Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Period before scheduled shift start (0–240 min) used to flag early arrivals for
                  review. Time spent on required or authorized work is never automatically
                  discarded.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Clock In Rules</CardTitle>
              <CardDescription>Controls for time tracking accuracy.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Require geolocation</p>
                  <p className="text-xs text-muted-foreground">
                    Employees must share location to clock in
                  </p>
                </div>
                <Switch
                  checked={form.requireGeoClockIn}
                  onCheckedChange={(v) => set("requireGeoClockIn", v)}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Notify on missed clock-out</p>
                  <p className="text-xs text-muted-foreground">
                    Alert admins if a shift runs past 12 hours
                  </p>
                </div>
                <Switch
                  checked={form.notifyOnMissedClockOut}
                  onCheckedChange={(v) => set("notifyOnMissedClockOut", v)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Notify on payroll run</p>
                  <p className="text-xs text-muted-foreground">
                    Email admins when a payroll run completes
                  </p>
                </div>
                <Switch
                  checked={form.notifyOnPayrollRun}
                  onCheckedChange={(v) => set("notifyOnPayrollRun", v)}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset} disabled={submitting} className="flex-1">
              Reset
            </Button>
            <Button onClick={handleSave} size="lg" disabled={submitting} className="flex-1">
              {submitting ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>
      </div>
      {ownerDialog}
    </AppShell>
  );
}
