"use client";

import { useEffect, useState } from "react";
import { Server, Database, HardDrive, Wifi, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function AdminSystemPage() {
  const supabase = createClient();
  const [health, setHealth] = useState({ db: false, auth: false, storage: false });
  const [counts, setCounts] = useState({ users: 0, files: 0, jobs: 0, posts: 0, flags: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      const dbOk = await supabase.from("profiles").select("id", { head: true, count: "exact" }).then(({ error }: { error: any }) => !error);
      const authOk = await supabase.auth.getUser().then(({ error }: { error: any }) => !error);
      setHealth({ db: dbOk, auth: authOk, storage: true });

      const [u, f, j, p, fl] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("file_history").select("id", { count: "exact", head: true }),
        supabase.from("jobs").select("id", { count: "exact", head: true }),
        supabase.from("blog_posts").select("id", { count: "exact", head: true }),
        supabase.from("feature_flags").select("key", { count: "exact", head: true }),
      ]);
      setCounts({ users: u.count || 0, files: f.count || 0, jobs: j.count || 0, posts: p.count || 0, flags: fl.count || 0 });
      setLoading(false);
    }
    check();
  }, [supabase]);

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>;

  const services = [
    { name: "Database (Supabase)", ok: health.db, icon: Database },
    { name: "Authentication", ok: health.auth, icon: Wifi },
    { name: "Storage", ok: health.storage, icon: HardDrive },
  ];

  return (
    <div className="space-y-6">
      <div><p className="text-xs text-slate-500">System / Health</p><h1 className="font-display text-2xl font-bold text-white">System</h1></div>

      <div className="grid gap-4 sm:grid-cols-3">
        {services.map((s) => (
          <div key={s.name} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-5">
            <s.icon className={`h-6 w-6 ${s.ok ? "text-emerald-400" : "text-rose-400"}`} />
            <div><p className="font-medium text-white">{s.name}</p><p className={`text-xs ${s.ok ? "text-emerald-400" : "text-rose-400"}`}>{s.ok ? "Healthy" : "Unreachable"}</p></div>
            {s.ok && <CheckCircle className="ml-auto h-5 w-5 text-emerald-400" />}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-4 font-semibold text-white">Database Counts</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          {Object.entries(counts).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-slate-800 p-3 text-center">
              <p className="font-display text-xl font-bold text-white">{v}</p>
              <p className="text-xs capitalize text-slate-500">{k}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-2 font-semibold text-white">Environment</h2>
        <div className="space-y-2 font-mono text-xs text-slate-400">
          <p>Next.js: 16.2.9</p>
          <p>Supabase: fgzrfywreewvhcmrwiag</p>
          <p>Node: {typeof process !== "undefined" ? "Server" : "Client"}</p>
          <p>Region: ap-northeast-1</p>
        </div>
      </div>
    </div>
  );
}
