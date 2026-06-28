"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function AdminReportsPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({ users: 0, files: 0, jobs: 0, posts: 0 });

  useEffect(() => {
    async function load() {
      const [u, f, j, p] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("file_history").select("id", { count: "exact", head: true }),
        supabase.from("jobs").select("id", { count: "exact", head: true }),
        supabase.from("blog_posts").select("id", { count: "exact", head: true }),
      ]);
      setStats({ users: u.count || 0, files: f.count || 0, jobs: j.count || 0, posts: p.count || 0 });
    }
    load();
  }, [supabase]);

  const exportCsv = () => {
    const csv = `Metric,Value\nTotal Users,${stats.users}\nFiles Processed,${stats.files}\nJobs Run,${stats.jobs}\nBlog Posts,${stats.posts}\nDate,${new Date().toISOString()}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `toolnest-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><p className="text-xs text-slate-500">System / Reports</p><h1 className="font-display text-2xl font-bold text-white">Reports</h1></div>
        <Button variant="gradient" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex items-center gap-3 mb-4"><FileSpreadsheet className="h-5 w-5 text-slate-400" /><h2 className="font-semibold text-white">Monthly Summary</h2></div>
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-800 p-4 text-center">
              <p className="font-display text-2xl font-bold text-white">{v}</p>
              <p className="text-xs capitalize text-slate-500">{k}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
