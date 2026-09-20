"use client";

import { useEffect } from "react";
import { usePayrollStore } from "@/lib/store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/** Resolves the Supabase session (if any) at app start and keeps the store in sync with auth changes. */
export function StoreHydration() {
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    usePayrollStore.getState().bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        usePayrollStore.getState().unsubscribeRealtime();
        usePayrollStore.setState({ session: null, hasHydrated: true });
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
      usePayrollStore.getState().unsubscribeRealtime();
    };
  }, []);

  return null;
}
