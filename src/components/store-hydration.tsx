"use client";

import { useEffect } from "react";
import { usePayrollStore } from "@/lib/store";

export function StoreHydration() {
  useEffect(() => {
    usePayrollStore.persist.rehydrate();
  }, []);

  return null;
}
