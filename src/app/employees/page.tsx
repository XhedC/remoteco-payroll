"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Trash2, Search, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmployeeDialog } from "@/components/employees/employee-dialog";
import { usePayrollStore } from "@/lib/store";
import { useOwnerGate } from "@/lib/use-owner-gate";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import type { EmployeeStatus } from "@/lib/types";

const statusVariant: Record<EmployeeStatus, "default" | "secondary" | "outline"> = {
  Active: "default",
  "On Leave": "secondary",
  Inactive: "outline",
};

export default function EmployeesPage() {
  const employees = usePayrollStore((s) => s.employees);
  const deleteEmployee = usePayrollStore((s) => s.deleteEmployee);
  const isClockedIn = usePayrollStore((s) => s.isClockedIn);
  const currentEmployee = usePayrollStore((s) =>
    s.session ? s.getEmployee(s.session.employeeId) : undefined,
  );
  const canCreateAccounts = currentEmployee?.role === "Admin";
  const [query, setQuery] = useState("");
  const { requestOwnerAuth, ownerDialog } = useOwnerGate(
    "Deleting an employee removes their profile and login. Enter the owner password to continue.",
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q),
    );
  }, [employees, query]);

  const handleDelete = async (id: string, name: string) => {
    await deleteEmployee(id);
    toast.success(`${name} removed from directory.`);
  };

  return (
    <AppShell title="Employees">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Employee Directory</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{employees.length} team members</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search employees..."
                className="w-[220px] pl-8"
              />
            </div>
            {canCreateAccounts && <EmployeeDialog />}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <Link
                      href={`/employees/${employee.id}`}
                      className="group/emp-link flex items-center gap-2.5 rounded-md -m-1 p-1 hover:bg-accent"
                    >
                      <Avatar size="sm">
                        <AvatarFallback>{initials(employee.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-medium group-hover/emp-link:underline">
                          {employee.name}
                          {isClockedIn(employee.id) && (
                            <span
                              className="size-1.5 shrink-0 rounded-full bg-emerald-500"
                              title="Currently clocked in"
                            />
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{employee.title}</p>
                      </div>
                      <ChevronRight className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/emp-link:opacity-100" />
                    </Link>
                  </TableCell>
                  <TableCell>{employee.department}</TableCell>
                  <TableCell>{employee.role}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[employee.status]}>{employee.status}</Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(employee.hourlyRate)}/hr</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(employee.joinedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <EmployeeDialog employee={employee} />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          requestOwnerAuth(() => handleDelete(employee.id, employee.name))
                        }
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No employees match your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {ownerDialog}
    </AppShell>
  );
}
