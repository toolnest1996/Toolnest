"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  History,
  Settings,
  LogOut,
  Crown,
  ChevronDown,
} from "lucide-react";
import { redirectTo } from "@/lib/navigation";
import { createClient } from "@/lib/supabase/client";

interface UserInfo {
  email: string;
  name: string;
  avatar: string;
  plan: string;
}

export function UserMenu() {
  const [info, setInfo] = useState<UserInfo | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const meta = user.user_metadata || {};
      const avatar = meta.avatar_url || meta.picture || "";
      const name = meta.full_name || meta.name || user.email?.split("@")[0] || "User";

      let plan = "FREE";
      try {
        const { data: p } = await supabase
          .from("profiles")
          .select("plan, avatar_url, full_name")
          .eq("id", user.id)
          .single();
        if (p) {
          plan = p.plan || "FREE";
          setInfo({
            email: user.email || "",
            name: p.full_name || name,
            avatar: p.avatar_url || avatar,
            plan,
          });
          return;
        }
      } catch {}

      setInfo({ email: user.email || "", name, avatar, plan });
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

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    setInfo(null);
    redirectTo("/");
  };

  if (!info) return null;

  const initials = info.name.slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-border bg-card py-1 pl-1 pr-2 transition-colors hover:bg-card-hover"
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
          <span className="flex h-7 w-7 items-center justify-center rounded-md gradient-primary text-[10px] font-bold text-white">
            {initials}
          </span>
        )}
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-xs font-medium">{info.name}</span>
          <span className="block text-[10px] text-muted">{info.plan}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-fade-up z-50">
          <div className="border-b border-border px-4 py-3">
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
                <span className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary text-xs font-bold text-white">
                  {initials}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{info.name}</p>
                <p className="truncate text-xs text-muted">{info.email}</p>
              </div>
            </div>
            {info.plan !== "FREE" && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                <Crown className="h-3 w-3" /> {info.plan}
              </span>
            )}
          </div>
          <div className="p-1">
            {[
              { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
              { href: "/history", icon: History, label: "File History" },
              { href: "/settings", icon: Settings, label: "Settings" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-card-hover"
              >
                <item.icon className="h-4 w-4 text-muted" />
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t border-border p-1">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-error transition-colors hover:bg-error/10"
            >
              <LogOut className="h-4 w-4" />
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
