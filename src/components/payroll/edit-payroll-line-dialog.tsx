"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { usePayrollStore } from "@/lib/store";
import { formatCurrency } from "@/lib/format";
import type { PayrollLine, PayrollRun } from "@/lib/types";

export function EditPayrollLineDialog({
  run,
  line,
  employeeName,
}: {
  run: PayrollRun;
  line: PayrollLine;
  employeeName: string;
}) {
  const updatePayrollLine = usePayrollStore((s) => s.updatePayrollLine);
  const verifyOwnerPassword = usePayrollStore((s) => s.verifyOwnerPassword);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    regularHours: String(line.regularHours),
    overtimeHours: String(line.overtimeHours),
    grossPay: String(line.grossPay),
    adjustment: String(line.adjustment),
  });
  const [authorized, setAuthorized] = useState(false);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm({
        regularHours: String(line.regularHours),
        overtimeHours: String(line.overtimeHours),
        grossPay: String(line.grossPay),
        adjustment: String(line.adjustment),
      });
      setAuthorized(false);
      setOwnerPassword("");
      setOwnerError(null);
    }
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const grossPay = Number(form.grossPay) || 0;
  const adjustment = Number(form.adjustment) || 0;
  const netPayPreview = Math.round((grossPay - adjustment) * 100) / 100;

  const handleAuthorize = async () => {
    const ok = await verifyOwnerPassword(ownerPassword);
    if (!ok) {
      setOwnerError("Incorrect owner password.");
      return;
    }
    setAuthorized(true);
    setOwnerError(null);
  };

  const handleSubmit = async () => {
    const regularHours = Number(form.regularHours);
    const overtimeHours = Number(form.overtimeHours);
    if ([regularHours, overtimeHours, grossPay, adjustment].some((v) => Number.isNaN(v))) {
      toast.error("Please enter valid numbers.");
      return;
    }

    setSubmitting(true);
    const result = await updatePayrollLine(run.id, line.employeeId, {
      regularHours,
      overtimeHours,
      grossPay,
      adjustment,
    });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error ?? "Unable to update this payroll line.");
      return;
    }
    toast.success(`${employeeName}'s payroll updated.`);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon-xs" />}>
        <Pencil className="size-3" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        {!authorized ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="size-4.5 text-destructive" />
                Owner authorization required
              </DialogTitle>
              <DialogDescription>
                Adjusting {employeeName}&apos;s payroll requires the owner password. Enter it to
                continue.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pl-owner-password">Owner password</Label>
              <Input
                id="pl-owner-password"
                type="password"
                autoComplete="off"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAuthorize();
                  }
                }}
                placeholder="Enter owner password"
                autoFocus
              />
              {ownerError && <p className="text-sm text-destructive">{ownerError}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleAuthorize}>
                Authorize
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Adjust {employeeName}&apos;s Payroll</DialogTitle>
              <DialogDescription>
                Manually correct hours, gross pay, or the adjustment for this pay period. Net pay
                recomputes automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pl-regular">Regular Hours</Label>
                <Input
                  id="pl-regular"
                  type="number"
                  step="0.01"
                  value={form.regularHours}
                  onChange={(e) => set("regularHours", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pl-overtime">Overtime Hours</Label>
                <Input
                  id="pl-overtime"
                  type="number"
                  step="0.01"
                  value={form.overtimeHours}
                  onChange={(e) => set("overtimeHours", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pl-gross">Gross Pay</Label>
                <Input
                  id="pl-gross"
                  type="number"
                  step="0.01"
                  value={form.grossPay}
                  onChange={(e) => set("grossPay", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pl-adjustment">Adjustment</Label>
                <Input
                  id="pl-adjustment"
                  type="number"
                  step="0.01"
                  value={form.adjustment}
                  onChange={(e) => set("adjustment", e.target.value)}
                  placeholder="Positive deducts, negative adds a bonus"
                />
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Net pay</span>
                <span className="font-semibold">{formatCurrency(netPayPreview)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                Save Changes
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
