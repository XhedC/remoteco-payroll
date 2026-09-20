import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Clock,
  Users,
  Wallet,
  MonitorSmartphone,
  Settings,
} from "lucide-react";
import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Roles allowed to see this link. Omit to show it to everyone. */
  roles?: Role[];
}

export const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/time-record", label: "Time Record", icon: Clock },
  { href: "/employees", label: "Employees", icon: Users, roles: ["Admin", "Manager"] },
  { href: "/payroll", label: "Payroll", icon: Wallet },
  {
    href: "/screen-logs",
    label: "Screen Logs",
    icon: MonitorSmartphone,
    roles: ["Admin", "Manager"],
  },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["Admin"] },
];

export function visibleNavItems(role: Role | undefined): NavItem[] {
  return navItems.filter((item) => !item.roles || (role && item.roles.includes(role)));
}
