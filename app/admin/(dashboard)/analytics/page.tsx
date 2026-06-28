"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UsageChart, BarList } from "@/components/admin/charts";
import { tools } from "@/lib/data/tools";

export default function AdminAnalyticsPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({ users: 0, files: 0, jobs: 0, posts: 0 });
  const [usage, setUsage] = useState<{ topTools: { slug: string; count: number }[]; daily: { label: string; value: number }[] }>({ topTools: [], daily: [] });

  useEffect(() => {
    async function load() {
      const [u, f, j, p, usageRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("file_history").select("id", { count: "exact", head: true }),
        supabase.from("jobs").select("id", { count: "exact", head: true }),
        supabase.from("blog_posts").select("id", { count: "exact", head: true }),
        fetch("/api/tool-usage").then((r) => r.json()),
      ]);
      setStats({ users: u.count || 0, files: f.count || 0, jobs: j.count || 0, posts: p.count || 0 });
      if (usageRes.topTools) setUsage(usageRes);
    }
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [supabase]);

  const topToolsData = usage.topTools.map((t, i) => ({
    name: tools.find((x) => x.slug === t.slug)?.name || t.slug,
    count: t.count,
    color: ["#FF6B35", "#E8231A", "#7B2FF7", "#06D6A0", "#F72585", "#4CC9F0"][i % 6],
  }));

  return (
    <div className="space-y-6">
      <div><p className="text-xs text-slate-500">Overview / Analytics</p><h1 className="font-display text-2xl font-bold text-white">Analytics</h1></div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Users", value: stats.users },
          { label: "Files Processed", value: stats.files },
          { label: "Jobs Run", value: stats.jobs },
          { label: "Blog Posts", value: stats.posts },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center">
            <p className="font-display text-2xl font-bold text-white">{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-white">Tool Usage (7 days)</h2>
          <UsageChart data={usage.daily.length ? usage.daily : [{ label: "Mon", value: 0 }, { label: "Tue", value: 0 }, { label: "Wed", value: 0 }, { label: "Thu", value: 0 }, { label: "Fri", value: 0 }, { label: "Sat", value: 0 }, { label: "Sun", value: 0 }]} />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="mb-4 font-semibold text-white">Top Tools</h2>
          {topToolsData.length ? <BarList data={topToolsData} /> : <p className="py-8 text-center text-sm text-slate-500">No usage data yet</p>}
        </div>
      </div>
    </div>
  );
}
