"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  LogOut,
  ChevronDown,
  ExternalLink,
  Shield,
  UserCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { adminLogout } from "@/lib/admin/logout";

interface AdminInfo {
  email: string;
  name: string;
  avatar: string;
  role: string;
}

export function AdminUserMenu() {
  const [info, setInfo] = useState<AdminInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setInfo(null);
        return;
      }

      const meta = user.user_metadata || {};
      const avatar = meta.avatar_url || meta.picture || "";
      const name = meta.full_name || meta.name || user.email?.split("@")[0] || "Admin";

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, role")
        .eq("id", user.id)
        .single();

      if (!profile || !["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(profile.role)) {
        setInfo(null);
        return;
      }

      setInfo({
        email: user.email || "",
        name: profile.full_name || name,
        avatar: profile.avatar_url || avatar,
        role: profile.role,
      });
    }

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleLogout = () => {
    setLoggingOut(true);
    setOpen(false);
    adminLogout();
  };

  if (!info) {
    return (
      <Link
        href="/admin/login"
        className="rounded-lg border border-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
      >
        Login
      </Link>
    );
  }

  const initials = info.name.slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-slate-800 py-1 pl-1 pr-2 transition-colors hover:bg-slate-800"
      >
        {info.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={info.avatar}
            alt={info.name}
            width={28}
            height={28}
            className="h-7 w-7 rounded-md object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#E8231A] text-[10px] font-bold text-white">
            {initials}
          </span>
        )}
        <div className="hidden text-left leading-tight sm:block">
          <p className="max-w-[120px] truncate text-xs font-medium text-white">{info.name}</p>
          <p className="text-[10px] text-slate-500">{info.role}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl">
          <div className="border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-3">
              {info.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={info.avatar}
                  alt={info.name}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-lg object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E8231A] text-xs font-bold text-white">
                  {initials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{info.name}</p>
                <p className="truncate text-xs text-slate-500">{info.email}</p>
              </div>
            </div>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
              <Shield className="h-3 w-3" /> {info.role}
            </span>
          </div>

          <div className="p-1">
            <Link
              href="/admin/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <UserCircle className="h-4 w-4" />
              My Profile
            </Link>
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
              View Site
            </Link>
          </div>

          <div className="border-t border-slate-800 p-1">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-rose-400 transition-colors hover:bg-rose-500/10 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? "Logging out..." : "Log Out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
