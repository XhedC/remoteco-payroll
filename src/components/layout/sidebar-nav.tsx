"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "cn";
import { Wallet2, LogOut } from "lucide-react";
import { visibleNavItems } from "./nav-items";
import { usePayrollStore } from "@/lib/store";
import type { Role } from "@/lib/types";

export function SidebarNav({
  onNavigate,
  role,
}: {
  onNavigate?: () => void;
  role?: Role;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = usePayrollStore((s) => s.logout);
  const items = visibleNavItems(role);

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out.");
    onNavigate?.();
    router.replace("/login");
  };

  return (
    <div className="flex h-full flex-col gap-6 bg-gradient-to-b from-teal-600 to-cyan-800 p-4 dark:from-teal-800 dark:to-cyan-950">
      <div className="flex items-center gap-2 px-2 pt-1">
        <div className="flex size-8 items-center justify-center rounded-lg bg-white text-teal-700">
          <Wallet2 className="size-4.5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-white">RemoteCo Payroll</p>
          <p className="text-xs text-teal-100/70">Workforce management</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white/15 text-white"
                  : "text-teal-50/75 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-100 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" />
          Log out
        </button>
      </div>
    </div>
  );
}
