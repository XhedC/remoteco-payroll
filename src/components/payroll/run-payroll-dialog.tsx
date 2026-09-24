"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PlayCircle } from "lucide-react";
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

function defaultPeriod() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 13);
  const toDateInput = (d: Date) => d.toISOString().slice(0, 10);
  return { start: toDateInput(start), end: toDateInput(end) };
}

export function RunPayrollDialog() {
  const runPayroll = usePayrollStore((s) => s.runPayroll);
  const [open, setOpen] = useState(false);
  const initial = defaultPeriod();
  const [periodStart, setPeriodStart] = useState(initial.start);
  const [periodEnd, setPeriodEnd] = useState(initial.end);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!periodStart || !periodEnd) {
      toast.error("Please select a pay period.");
      return;
    }
    if (new Date(periodStart) > new Date(periodEnd)) {
      toast.error("Period start must be before period end.");
      return;
    }
    setSubmitting(true);
    const result = await runPayroll(
      new Date(periodStart).toISOString(),
      new Date(periodEnd).toISOString(),
    );
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error ?? "Unable to run payroll.");
      return;
    }
    if (result.excludedHours > 0) {
      toast.success(
        `Payroll run created. ${result.excludedHours}h already paid in a previous run were excluded to avoid double payment.`,
      );
    } else {
      toast.success("Payroll run created.");
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <PlayCircle className="size-4" /> Run Payroll
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Run Payroll</DialogTitle>
          <DialogDescription>
            Calculates gross pay, overtime, and adjustments from clocked hours in this period.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pr-start">Period Start</Label>
            <Input
              id="pr-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pr-end">Period End</Label>
            <Input
              id="pr-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            Calculate & Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
