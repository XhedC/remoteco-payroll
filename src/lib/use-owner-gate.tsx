"use client";

import { useRef, useState } from "react";
import { OwnerPasswordDialog } from "@/components/security/owner-password-dialog";

/**
 * Gates a destructive/edit action behind the owner password.
 * Usage: const { requestOwnerAuth, ownerDialog } = useOwnerGate();
 *        <Button onClick={() => requestOwnerAuth(() => doTheEdit())}>Edit</Button>
 *        {ownerDialog}
 */
export function useOwnerGate(description?: string) {
  const [open, setOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const requestOwnerAuth = (action: () => void) => {
    pendingAction.current = action;
    setOpen(true);
  };

  const ownerDialog = (
    <OwnerPasswordDialog
      open={open}
      onOpenChange={setOpen}
      description={description}
      onConfirmed={() => {
        pendingAction.current?.();
        pendingAction.current = null;
      }}
    />
  );

  return { requestOwnerAuth, ownerDialog };
}
