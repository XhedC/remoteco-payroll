"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { usePayrollStore } from "@/lib/store";

export function OwnerPasswordDialog({
  open,
  onOpenChange,
  onConfirmed,
  description = "This action changes or removes existing data. Enter the owner password to continue.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
  description?: string;
}) {
  const verifyOwnerPassword = usePayrollStore((s) => s.verifyOwnerPassword);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(false);

  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPassword("");
      setError(null);
    }
  }

  const handleConfirm = () => {
    if (!verifyOwnerPassword(password)) {
      setError("Incorrect owner password.");
      return;
    }
    onOpenChange(false);
    onConfirmed();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4.5 text-destructive" />
            Owner authorization required
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="owner-password">Owner password</Label>
          <Input
            id="owner-password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirm();
              }
            }}
            placeholder="Enter owner password"
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Authorize
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
