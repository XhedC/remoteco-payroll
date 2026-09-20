"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, ShieldAlert } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePayrollStore } from "@/lib/store";
import type { Employee, EmployeeStatus, Role } from "@/lib/types";

const ROLES: Role[] = ["Admin", "Manager", "Consultant", "Staff", "Other"];
const STATUSES: EmployeeStatus[] = ["Active", "On Leave", "Inactive"];

const emptyForm = {
  name: "",
  email: "",
  role: "Staff" as Role,
  department: "",
  title: "",
  status: "Active" as EmployeeStatus,
  hourlyRate: "",
};

export function EmployeeDialog({ employee }: { employee?: Employee }) {
  const isEdit = !!employee;
  const addEmployee = usePayrollStore((s) => s.addEmployee);
  const updateEmployee = usePayrollStore((s) => s.updateEmployee);
  const verifyOwnerPassword = usePayrollStore((s) => s.verifyOwnerPassword);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm(
        employee
          ? {
              name: employee.name,
              email: employee.email,
              role: employee.role,
              department: employee.department,
              title: employee.title,
              status: employee.status,
              hourlyRate: String(employee.hourlyRate),
            }
          : emptyForm,
      );
      setPassword("");
      setConfirmPassword("");
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

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = () => {
    if (!form.name.trim() || !form.email.trim() || !form.department.trim() || !form.title.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    const rate = Number(form.hourlyRate);
    if (Number.isNaN(rate) || rate <= 0) {
      toast.error("Hourly rate must be a positive number.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role,
      department: form.department.trim(),
      title: form.title.trim(),
      status: form.status,
      hourlyRate: rate,
    };

    if (isEdit && employee) {
      updateEmployee(employee.id, payload);
      toast.success("Employee updated.");
      setOpen(false);
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    const result = addEmployee({ ...payload, joinedAt: new Date().toISOString() }, password);
    if (!result.success) {
      toast.error(result.error ?? "Unable to create this account.");
      return;
    }
    toast.success("Employee account created.");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={isEdit ? <Button variant="ghost" size="icon-sm" /> : <Button />}>
        {isEdit ? (
          <Pencil className="size-3.5" />
        ) : (
          <>
            <Plus className="size-4" /> Add Employee
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
                Editing an employee&apos;s profile requires the owner password. Enter it to continue.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-owner-password">Owner password</Label>
              <Input
                id="emp-owner-password"
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
          <DialogTitle>{isEdit ? "Edit Employee" : "Add Employee"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this employee's profile and pay rate."
              : "Create a login for a new team member. Only admins can create accounts — there is no public sign-up."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="emp-name">Full Name</Label>
            <Input id="emp-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="emp-email">Email</Label>
            <Input
              id="emp-email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-title">Job Title</Label>
            <Input id="emp-title" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-dept">Department</Label>
            <Input
              id="emp-dept"
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-role">Role</Label>
            <Select value={form.role} onValueChange={(v) => set("role", v as Role)}>
              <SelectTrigger id="emp-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-status">Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as EmployeeStatus)}>
              <SelectTrigger id="emp-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="emp-rate">Hourly Rate (USD)</Label>
            <Input
              id="emp-rate"
              type="number"
              min="0"
              step="0.5"
              value={form.hourlyRate}
              onChange={(e) => set("hourlyRate", e.target.value)}
            />
          </div>

          {!isEdit && (
            <>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="emp-password">Password</Label>
                <Input
                  id="emp-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label htmlFor="emp-confirm-password">Confirm Password</Label>
                <Input
                  id="emp-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter the password"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>{isEdit ? "Save Changes" : "Create Account"}</Button>
        </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
