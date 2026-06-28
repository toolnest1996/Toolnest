"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { redirectTo } from "@/lib/navigation";
import {
  LayoutDashboard,
  History,
  Crown,
  Wrench,
  FileText,
  Image as ImageIcon,
  Video,
  Bot,
  ArrowRight,
  Clock,
  HardDrive,
  Star,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  full_name: string;
  plan: string;
  avatar_url: string;
  role: string;
  tools_used_today: number;
  created_at: string;
}

interface FileHistoryItem {
  id: string;
  tool_slug: string;
  file_name: string;
  file_size: number;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<FileHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) {
        redirectTo("/login");
        return;
      }
      setUser(u);

      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", u.id)
        .single();
      if (p) {
        const googleAvatar = u.user_metadata?.avatar_url || u.user_metadata?.picture;
        const googleName = u.user_metadata?.full_name || u.user_metadata?.name;
        setProfile({
          ...p,
          avatar_url: p.avatar_url || googleAvatar || "",
          full_name: p.full_name || googleName || "",
        });
      }

      const { data: h } = await supabase
        .from("file_history")
        .select("*")
        .eq("user_id", u.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (h) setHistory(h);

      setLoading(false);
    }
    load();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user || !profile) return null;

  const name = profile.full_name || user.email?.split("@")[0] || "User";
  const initials = name.slice(0, 2).toUpperCase();
  const plan = profile.plan;
  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const planLimits: Record<string, { tools: string; fileSize: string; historyDays: string }> = {
    FREE: { tools: "5/day", fileSize: "50 MB", historyDays: "None" },
    PRO: { tools: "Unlimited", fileSize: "500 MB", historyDays: "30 days" },
    ENTERPRISE: { tools: "Unlimited", fileSize: "2 GB", historyDays: "Unlimited" },
  };
  const limits = planLimits[plan] || planLimits.FREE;

  const quickTools = [
    { slug: "pdf-merge", name: "Merge PDF", icon: FileText, color: "#E8231A" },
    { slug: "image-compress", name: "Compress Image", icon: ImageIcon, color: "#FF6B35" },
    { slug: "youtube-thumbnail", name: "YT Thumbnail", icon: Video, color: "#FF0000" },
    { slug: "qr-generator", name: "QR Generator", icon: Wrench, color: "#7B2FF7" },
    { slug: "password-gen", name: "Password Gen", icon: Star, color: "#06D6A0" },
    { slug: "color-palette", name: "Color Palette", icon: Bot, color: "#F72585" },
  ];

  const statusColors: Record<string, string> = {
    done: "bg-success/15 text-success",
    processing: "bg-sky-500/15 text-sky-400 animate-pulse",
    pending: "bg-accent/15 text-accent",
    failed: "bg-error/15 text-error",
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Profile header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar_url} alt={name} className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary text-xl font-bold text-white">
              {initials}
            </span>
          )}
          <div>
            <h1 className="font-display text-2xl font-bold">Welcome, {name}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted">
              <span>{user.email}</span>
              <span className="h-1 w-1 rounded-full bg-muted" />
              <span>Member since {memberSince}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {plan === "FREE" && (
            <Link
              href="/pricing"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg gradient-primary px-4 text-sm font-medium text-white shadow-md shadow-primary/20"
            >
              <Crown className="h-4 w-4" /> Upgrade to Pro
            </Link>
          )}
          <Link
            href="/settings"
            className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-card-hover"
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Wrench,
            label: "Tools used today",
            value: `${profile.tools_used_today}`,
            sub: `of ${limits.tools}`,
          },
          {
            icon: HardDrive,
            label: "Max file size",
            value: limits.fileSize,
            sub: plan,
          },
          {
            icon: Clock,
            label: "History",
            value: `${history.length} files`,
            sub: limits.historyDays,
          },
          {
            icon: TrendingUp,
            label: "Plan",
            value: plan,
            sub: plan === "FREE" ? "Upgrade for more" : "Active",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted" />
            </div>
            <p className="mt-2 font-display text-2xl font-bold">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick access tools */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Quick access</h2>
          <Link href="/#tools" className="flex items-center gap-1 text-sm text-primary hover:underline">
            All tools <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {quickTools.map((t) => (
            <Link
              key={t.slug}
              href={`/tool/${t.slug}`}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:bg-card-hover hover:shadow-lg"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${t.color}1f`, color: t.color }}
              >
                <t.icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-medium">{t.name}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent file history */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Recent files</h2>
          <Link href="/history" className="flex items-center gap-1 text-sm text-primary hover:underline">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {history.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-border bg-card p-10 text-center">
            <History className="mx-auto mb-3 h-10 w-10 text-muted" />
            <p className="font-medium">No files yet</p>
            <p className="mt-1 text-sm text-muted">
              Start using tools and your file history will appear here.
            </p>
            <Link
              href="/#tools"
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg gradient-primary px-4 text-sm font-medium text-white"
            >
              Browse tools <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="px-4 py-3 font-medium">File</th>
                  <th className="px-4 py-3 font-medium">Tool</th>
                  <th className="px-4 py-3 font-medium">Size</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((file) => (
                  <tr key={file.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{file.file_name}</td>
                    <td className="px-4 py-3 text-muted">{file.tool_slug}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {(file.file_size / 1024).toFixed(1)} KB
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${statusColors[file.status] || ""}`}>
                        {file.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {new Date(file.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Plan details */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold">Your plan: {plan}</h2>
              {plan !== "FREE" && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                  Active
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              {plan === "FREE"
                ? "Upgrade to Pro for unlimited tools, no ads, and 30-day history."
                : plan === "PRO"
                  ? "Enjoy unlimited tools, no ads, and priority processing."
                  : "Full access with API, team accounts, and dedicated support."}
            </p>
          </div>
          {plan === "FREE" && (
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center gap-2 rounded-lg gradient-primary px-5 text-sm font-medium text-white shadow-md shadow-primary/20"
            >
              <Crown className="h-4 w-4" /> Upgrade
            </Link>
          )}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Daily tools", value: limits.tools },
            { label: "Max file size", value: limits.fileSize },
            { label: "File history", value: limits.historyDays },
          ].map((l) => (
            <div key={l.label} className="rounded-lg border border-border px-4 py-3">
              <p className="text-xs text-muted">{l.label}</p>
              <p className="mt-0.5 font-medium">{l.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
