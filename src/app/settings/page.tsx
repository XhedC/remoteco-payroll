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
  const updateSettings = usePayrollStore((s) => s.updateSettings);
  const [form, setForm] = useState<CompanySettings>(settings);
  const [syncedSettings, setSyncedSettings] = useState(settings);
  if (settings !== syncedSettings) {
    setSyncedSettings(settings);
    setForm(settings);
  }

  const { requestOwnerAuth, ownerDialog } = useOwnerGate(
    "Saving changes updates company-wide settings. Enter the owner password to continue.",
  );

  const set = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const saveSettings = async () => {
    await updateSettings(form);
    toast.success("Settings saved.");
  };

  const handleSave = () => requestOwnerAuth(saveSettings);

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

          <Button onClick={handleSave} size="lg">
            Save Settings
          </Button>
        </div>
      </div>
      {ownerDialog}
    </AppShell>
  );
}
