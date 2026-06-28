"use client";

import { Search, Bell } from "lucide-react";
import { AdminThemeToggle } from "@/components/admin/admin-theme-toggle";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";

export function AdminTopbar() {
  return (
    <header className="admin-topbar sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-slate-800 bg-slate-900/80 px-6 backdrop-blur-xl">
      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          placeholder="Search users, tools, posts..."
          className="h-9 w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-[#E8231A]"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <AdminThemeToggle className="admin-theme-toggle" />

        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#E8231A]" />
        </button>

        <AdminUserMenu />
      </div>
    </header>
  );
}
