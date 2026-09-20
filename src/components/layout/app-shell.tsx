"use client";

import type { ReactNode } from "react";
import { Wallet2 } from "lucide-react";
import { cn } from "cn";
import { useRequireAuth } from "@/lib/use-auth";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";

function FullPageLoader() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3">
      <div className="flex size-10 animate-pulse items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Wallet2 className="size-5" />
      </div>
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}

export function AppShell({
  title,
  children,
  contentClassName,
}: {
  title: string;
  children: ReactNode;
  /** Extra classes applied to the scrollable content area, e.g. a page-specific background. */
  contentClassName?: string;
}) {
  const { ready, employee } = useRequireAuth();

  if (!ready) {
    return <FullPageLoader />;
  }

  return (
    <div className="flex min-h-svh">
      <aside className="hidden w-64 shrink-0 border-r border-teal-900/20 sm:block">
        <SidebarNav role={employee?.role} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        <main className={cn("flex-1 p-4 sm:p-6", contentClassName)}>{children}</main>
      </div>
    </div>
  );
}
