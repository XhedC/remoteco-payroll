"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { usePayrollStore } from "@/lib/store";
import { initials } from "@/lib/format";
import { SidebarNav } from "./sidebar-nav";

export function TopBar({ title }: { title: string }) {
  const router = useRouter();
  const session = usePayrollStore((s) => s.session);
  const currentUser = usePayrollStore((s) => (session ? s.getEmployee(session.employeeId) : undefined));
  const logout = usePayrollStore((s) => s.logout);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success("Signed out.");
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/70 sm:px-6">
      <div className="flex items-center gap-2">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={<Button variant="ghost" size="icon" className="sm:hidden" />}
          >
            <Menu className="size-4" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarNav role={currentUser?.role} onNavigate={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" className="h-auto gap-2 px-1.5 py-1" />}
        >
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">
              {currentUser ? initials(currentUser.name) : "--"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-sm font-medium">{currentUser?.name ?? "Account"}</span>
            <span className="block text-xs text-muted-foreground">{currentUser?.role}</span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
              <span className="font-medium text-foreground">{currentUser?.name}</span>
              <span className="font-normal text-muted-foreground">{currentUser?.email}</span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <User className="size-4" /> {currentUser?.title}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={handleLogout}>
            <LogOut className="size-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
