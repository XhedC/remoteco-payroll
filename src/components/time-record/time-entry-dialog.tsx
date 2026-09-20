"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePayrollStore } from "@/lib/store";
import { fromDatetimeLocal, toDatetimeLocal } from "@/lib/format";
import type { TimeEntry } from "@/lib/types";
import { Plus, Pencil, ShieldAlert } from "lucide-react";

export function TimeEntryDialog({ entry }: { entry?: TimeEntry }) {
  const isEdit = !!entry;
  const employees = usePayrollStore((s) => s.employees);
  const addManualTimeEntry = usePayrollStore((s) => s.addManualTimeEntry);
  const updateTimeEntry = usePayrollStore((s) => s.updateTimeEntry);
  const verifyOwnerPassword = usePayrollStore((s) => s.verifyOwnerPassword);

  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState(entry?.employeeId ?? employees[0]?.id ?? "");
  const [clockIn, setClockIn] = useState(toDatetimeLocal(entry?.clockIn ?? new Date().toISOString()));
  const [clockOut, setClockOut] = useState(toDatetimeLocal(entry?.clockOut ?? null));
  const [note, setNote] = useState(entry?.note ?? "");
  const [authorized, setAuthorized] = useState(false);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setEmployeeId(entry?.employeeId ?? employees[0]?.id ?? "");
      setClockIn(toDatetimeLocal(entry?.clockIn ?? new Date().toISOString()));
      setClockOut(toDatetimeLocal(entry?.clockOut ?? null));
      setNote(entry?.note ?? "");
      setAuthorized(false);
      setOwnerPassword("");
      setOwnerError(null);
    }
  }

  const handleAuthorize = () => {
    if (!verifyOwnerPassword(ownerPassword)) {
      setOwnerError("Incorrect owner password.");
      return;
    }
    setAuthorized(true);
    setOwnerError(null);
  };

  const handleSubmit = () => {
    if (!employeeId || !clockIn) {
      toast.error("Employee and clock-in time are required.");
      return;
    }
    const clockInIso = fromDatetimeLocal(clockIn);
    const clockOutIso = clockOut ? fromDatetimeLocal(clockOut) : null;

    if (clockOutIso && new Date(clockOutIso) <= new Date(clockInIso)) {
      toast.error("Clock-out must be after clock-in.");
      return;
    }

    if (isEdit && entry) {
      updateTimeEntry(entry.id, { employeeId, clockIn: clockInIso, clockOut: clockOutIso, note });
      toast.success("Time record updated.");
    } else {
      addManualTimeEntry({ employeeId, clockIn: clockInIso, clockOut: clockOutIso, note });
      toast.success("Time record added.");
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          isEdit ? <Button variant="ghost" size="icon-sm" /> : <Button />
        }
      >
        {isEdit ? (
          <Pencil className="size-3.5" />
        ) : (
          <>
            <Plus className="size-4" /> Add Time Record
          </>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {isEdit && !authorized ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="size-4.5 text-destructive" />
                Owner authorization required
              </DialogTitle>
              <DialogDescription>
                Editing a time record requires the owner password. Enter it to continue.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="te-owner-password">Owner password</Label>
              <Input
                id="te-owner-password"
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
              <DialogTitle>{isEdit ? "Edit Time Record" : "Add Manual Time Record"}</DialogTitle>
              <DialogDescription>
                Record or correct a login (clock in) / logout (clock out) pair for an employee.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="te-employee">Employee</Label>
                <Select value={employeeId} onValueChange={(v) => v && setEmployeeId(v)}>
                  <SelectTrigger id="te-employee" className="w-full">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="te-in">Login (Clock In)</Label>
                  <Input
                    id="te-in"
                    type="datetime-local"
                    value={clockIn}
                    onChange={(e) => setClockIn(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="te-out">Logout (Clock Out)</Label>
                  <Input
                    id="te-out"
                    type="datetime-local"
                    value={clockOut}
                    onChange={(e) => setClockOut(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="te-note">Note (optional)</Label>
                <Textarea
                  id="te-note"
                  placeholder="e.g. Approved by manager, on-call shift..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>{isEdit ? "Save Changes" : "Add Record"}</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
