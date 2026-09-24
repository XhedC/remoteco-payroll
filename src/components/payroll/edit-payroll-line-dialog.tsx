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
  grossPay,
}: {
  run: PayrollRun;
  line: PayrollLine;
  employeeName: string;
  /** The accurate, currently-displayed Gross Pay (Total Hours x rate), used for the Net Pay preview. */
  grossPay: number;
}) {
  const updatePayrollLine = usePayrollStore((s) => s.updatePayrollLine);
  const verifyOwnerPassword = usePayrollStore((s) => s.verifyOwnerPassword);

  const [open, setOpen] = useState(false);
  // Deduction is the positive amount subtracted from gross pay (adjustment stored negative);
  // a negative deduction here means a bonus added on top of gross pay.
  const [deductionInput, setDeductionInput] = useState(String(-line.adjustment));
  const [authorized, setAuthorized] = useState(false);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prevOpen, setPrevOpen] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDeductionInput(String(-line.adjustment));
      setAuthorized(false);
      setOwnerPassword("");
      setOwnerError(null);
    }
  }

  const deduction = Number(deductionInput) || 0;
  const netPayPreview = Math.round((grossPay - deduction) * 100) / 100;

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
    if (Number.isNaN(deduction)) {
      toast.error("Please enter a valid number.");
      return;
    }

    setSubmitting(true);
    const result = await updatePayrollLine(run.id, line.employeeId, {
      adjustment: -deduction,
    });
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error ?? "Unable to update this payroll line.");
      return;
    }
    toast.success(`${employeeName}'s deduction updated.`);
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
              <DialogTitle>Edit {employeeName}&apos;s Deduction</DialogTitle>
              <DialogDescription>
                Total Hours and Gross Pay are computed automatically from time records and cannot
                be edited here. Net pay recomputes automatically from the deduction below.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Gross pay</span>
                <span className="font-semibold">{formatCurrency(grossPay)}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pl-deduction">Deduction</Label>
                <Input
                  id="pl-deduction"
                  type="number"
                  step="0.01"
                  value={deductionInput}
                  onChange={(e) => setDeductionInput(e.target.value)}
                  placeholder="Positive subtracts from gross pay, negative adds a bonus"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2 text-sm">
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
