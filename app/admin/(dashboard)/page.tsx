"use client";

import { useEffect, useState } from "react";
import {
  Trash2,
  Download,
  Power,
  RefreshCw,
  Users as UsersIcon,
  Wrench,
  Activity,
  HardDrive,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { tools } from "@/lib/data/tools";
import { UsageChart, BarList } from "@/components/admin/charts";
import { toast } from "sonner";
import { logAudit } from "@/lib/admin/audit";

interface Stats {
  totalUsers: number;
  totalFiles: number;
  totalJobs: number;
  totalPosts: number;
  proUsers: number;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
}

export default function AdminDashboard() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, totalFiles: 0, totalJobs: 0, totalPosts: 0, proUsers: 0 });
  const [recentUsers, setRecentUsers] = useState<{ full_name: string; avatar_url: string; role: string; plan: string; created_at: string }[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [topToolsData, setTopToolsData] = useState<{ name: string; count: number; color: string }[]>([]);
  const [usageData, setUsageData] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminName, setAdminName] = useState("Admin");
  const [adminRole, setAdminRole] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", user.id)
          .single();
        if (profile?.full_name) setAdminName(profile.full_name);
        if (profile?.role) setAdminRole(profile.role);
      }

      const [users, files, jobs, posts, pro, recent, notifs, usageRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("file_history").select("id", { count: "exact", head: true }),
        supabase.from("jobs").select("id", { count: "exact", head: true }),
        supabase.from("blog_posts").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("plan", "PRO"),
        supabase.from("profiles").select("full_name, avatar_url, role, plan, created_at").order("created_at", { ascending: false }).limit(5),
        supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }).limit(5),
        fetch("/api/tool-usage").then((r) => r.json()),
      ]);

      setStats({
        totalUsers: users.count || 0,
        totalFiles: files.count || 0,
        totalJobs: jobs.count || 0,
        totalPosts: posts.count || 0,
        proUsers: pro.count || 0,
      });
      if (recent.data) setRecentUsers(recent.data);
      if (notifs.data) setNotifications(notifs.data);
      if (usageRes.topTools) {
        setTopToolsData(usageRes.topTools.map((t: { slug: string; count: number }, i: number) => ({
          name: tools.find((x) => x.slug === t.slug)?.name || t.slug,
          count: t.count,
          color: ["#FF6B35", "#E8231A", "#7B2FF7", "#06D6A0", "#F72585", "#4CC9F0"][i % 6],
        })));
        setUsageData(usageRes.daily || []);
      }
      setLoading(false);
    }
    load();
  }, [supabase]);

  const kpis = [
    { label: "Total Users", value: stats.totalUsers.toLocaleString(), icon: UsersIcon, delta: stats.totalUsers > 0 ? "+new" : "0", up: true },
    { label: "Files Processed", value: stats.totalFiles.toLocaleString(), icon: Activity, delta: `${stats.totalFiles}`, up: true },
    { label: "Pro Users", value: stats.proUsers.toLocaleString(), icon: TrendingUp, delta: `${stats.proUsers} paid`, up: stats.proUsers > 0 },
    { label: "Blog Posts", value: stats.totalPosts.toLocaleString(), icon: HardDrive, delta: `${stats.totalPosts} published`, up: true },
  ];

  const runCleanup = async () => {
    const cutoff = new Date(Date.now() - 2 * 3600000).toISOString();
    await supabase.from("file_history").delete().lt("created_at", cutoff);
    await logAudit("run_cleanup", "file_history");
    toast.success("Old files cleaned up (2h+)");
  };

  const toggleMaintenance = async () => {
    const { data } = await supabase.from("site_settings").select("value").eq("key", "maintenance_mode").maybeSingle();
    const next = data?.value === "true" ? "false" : "true";
    await supabase.from("site_settings").upsert({ key: "maintenance_mode", value: next, updated_at: new Date().toISOString() });
    await logAudit(next === "true" ? "enable_maintenance" : "disable_maintenance", "site_settings");
    toast.success(next === "true" ? "Maintenance ON" : "Maintenance OFF");
  };

  const quickActions = [
    { label: "Run Cleanup", icon: Trash2, action: runCleanup },
    { label: "Export Report", icon: Download, action: () => { window.location.href = "/admin/reports"; } },
    { label: "Maintenance", icon: Power, action: toggleMaintenance },
    { label: "Refresh", icon: RefreshCw, action: () => window.location.reload() },
  ];

  const roleBadge: Record<string, string> = {
    USER: "bg-slate-700 text-slate-300",
    MODERATOR: "bg-sky-500/15 text-sky-400",
    ADMIN: "bg-violet-500/15 text-violet-400",
    SUPER_ADMIN: "bg-amber-500/15 text-amber-400",
  };

  const typeBadge: Record<string, string> = {
    info: "bg-sky-500/15 text-sky-400",
    warning: "bg-amber-500/15 text-amber-400",
    error: "bg-rose-500/15 text-rose-400",
    success: "bg-emerald-500/15 text-emerald-400",
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-slate-500">Overview / Dashboard</p>
          <h1 className="mt-0.5 font-display text-2xl font-bold text-white">
            Welcome back, {adminName}
          </h1>
          {adminRole && (
            <p className="mt-1 text-xs text-slate-500">Signed in as {adminRole.replace("_", " ")}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((a) => (
            <button key={a.label} onClick={a.action} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white">
              <a.icon className="h-4 w-4" />{a.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards — real data */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400">{kpi.label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-white">{kpi.value}</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-[#FF6B35]">
                <kpi.icon className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium">
              {kpi.up ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> : <TrendingDown className="h-3.5 w-3.5 text-rose-400" />}
              <span className={kpi.up ? "text-emerald-400" : "text-rose-400"}>{kpi.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Tool usage this week</h2>
            <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">7 days</span>
          </div>
          <UsageChart data={usageData.length ? usageData : [{ label: "Mon", value: 0 }, { label: "Tue", value: 0 }, { label: "Wed", value: 0 }, { label: "Thu", value: 0 }, { label: "Fri", value: 0 }, { label: "Sat", value: 0 }, { label: "Sun", value: 0 }]} />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 font-semibold text-white">Top tools</h2>
          {topToolsData.length ? <BarList data={topToolsData} /> : <p className="py-8 text-center text-sm text-slate-500">No usage yet</p>}
        </div>
      </div>

      {/* Recent Users + Notifications */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 font-semibold text-white">Recent users</h2>
          {recentUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No users yet</p>
          ) : (
            <ul className="space-y-3">
              {recentUsers.map((u, i) => (
                <li key={i} className="flex items-center gap-3">
                  {u.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-lg object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-xs font-bold text-white">
                      {(u.full_name || "U").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{u.full_name || "No name"}</p>
                    <p className="text-[10px] text-slate-500">{new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${roleBadge[u.role] || ""}`}>{u.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 font-semibold text-white">Notifications</h2>
          {notifications.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No notifications</p>
          ) : (
            <ul className="space-y-3">
              {notifications.map((n) => (
                <li key={n.id} className="flex items-start gap-3">
                  <span className={`mt-0.5 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase ${typeBadge[n.type] || ""}`}>{n.type}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.message}</p>
                  </div>
                  <span className="text-[10px] text-slate-600">{new Date(n.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* System status */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: UsersIcon, label: "Registered users", value: stats.totalUsers.toString() },
          { icon: Wrench, label: "Total tools", value: tools.length.toString() },
          { icon: Activity, label: "Files processed", value: stats.totalFiles.toString() },
          { icon: HardDrive, label: "Jobs run", value: stats.totalJobs.toString() },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-white">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
