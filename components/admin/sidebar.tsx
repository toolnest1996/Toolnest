"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ExternalLink, LogOut } from "lucide-react";
import { adminNav, adminNavGroups } from "@/lib/admin/nav";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { adminLogout } from "@/lib/admin/logout";

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    setLoggingOut(true);
    adminLogout();
  };

  return (
    <aside
      className={cn(
        "admin-sidebar sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300 transition-all",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="ToolNest"
          width={36}
          height={36}
          className="shrink-0 rounded-lg"
        />
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="font-display text-base font-extrabold text-white">
              ToolNest
            </span>
            <span className="text-[10px] text-slate-500">Admin Panel</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4">
        {adminNavGroups.map((group) => (
          <div key={group} className="mb-4">
            {!collapsed && (
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                {group}
              </p>
            )}
            <ul className="space-y-0.5">
              {adminNav
                .filter((item) => item.group === group)
                .map((item) => {
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-[#E8231A] text-white"
                            : "text-slate-400 hover:bg-slate-800 hover:text-white",
                        )}
                      >
                        <Icon name={item.icon} className="h-4.5 w-4.5 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-2">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
          title="View site"
        >
          <ExternalLink className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && <span>View Site</span>}
        </Link>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <ChevronLeft
            className={cn("h-4.5 w-4.5 shrink-0 transition-transform", collapsed && "rotate-180")}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 disabled:opacity-50"
          title="Log out"
        >
          <LogOut className="h-4.5 w-4.5 shrink-0" />
          {!collapsed && <span>{loggingOut ? "Logging out..." : "Log Out"}</span>}
        </button>
      </div>
    </aside>
  );
}
