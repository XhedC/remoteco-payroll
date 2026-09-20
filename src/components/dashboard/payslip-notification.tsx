"use client";

import { Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePayrollStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/format";

export function PayslipNotification() {
  const session = usePayrollStore((s) => s.session);
  const employee = usePayrollStore((s) =>
    session ? s.getEmployee(session.employeeId) : undefined,
  );
  const confirmations = usePayrollStore((s) => s.payslipConfirmations);
  const confirmPayslip = usePayrollStore((s) => s.confirmPayslip);

  if (!session || !employee) return null;

  const pending = confirmations
    .filter((c) => c.employeeId === session.employeeId && !c.confirmedAt)
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());

  if (pending.length === 0) return null;

  const handleConfirm = (id: string) => {
    confirmPayslip(id);
    toast.success("Thanks! Receipt of your salary has been confirmed.");
  };

  return (
    <div className="mb-4 flex flex-col gap-3">
      {pending.map((c) => (
        <Card key={c.id} className="border-primary/30 bg-primary/5">
          <CardHeader className="flex-row items-center gap-2">
            <Mail className="size-4.5 text-primary" />
            <CardTitle className="text-base">New Payslip Notification</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="text-sm leading-relaxed text-foreground">
              <p>Dear {employee.name},</p>
              <p className="mt-3">
                Your salary for the payroll period{" "}
                <strong>
                  {formatDate(c.periodStart)} – {formatDate(c.periodEnd)}
                </strong>{" "}
                has been successfully sent to your account.
              </p>
              <p className="mt-3">
                Please click <strong>&quot;Confirm&quot;</strong> to acknowledge that you have
                received your salary.
              </p>
              <p className="mt-3">Thank you.</p>
              <p className="mt-3">
                Best regards,
                <br />
                Payroll Department
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-background p-3">
              <div>
                <p className="text-xs text-muted-foreground">Amount received</p>
                <p className="text-base font-semibold">{formatCurrency(c.netPay)}</p>
              </div>
              <Button onClick={() => handleConfirm(c.id)}>
                <CheckCircle2 className="size-4" /> Confirm
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
