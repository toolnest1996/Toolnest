"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface LogEntry { id: string; action: string; target: string | null; ip_address: string | null; created_at: string; admin_id: string | null; }

export default function AdminAuditLogPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(100).then(({ data }: { data: any }) => {
      if (data) setLogs(data);
      setLoading(false);
    });
  }, [supabase]);

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div><p className="text-xs text-slate-500">System / Audit Log</p><h1 className="font-display text-2xl font-bold text-white">Audit Log</h1></div>
      {logs.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <ScrollText className="mx-auto mb-3 h-10 w-10 text-slate-600" /><p className="text-sm text-slate-500">No audit log entries yet. Admin actions will be recorded here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-left text-xs text-slate-500"><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Target</th><th className="px-4 py-3 font-medium">IP</th><th className="px-4 py-3 font-medium">Date</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-slate-800/50 last:border-0"><td className="px-4 py-2.5 text-white">{l.action}</td><td className="px-4 py-2.5 text-slate-400">{l.target || "—"}</td><td className="px-4 py-2.5 font-mono text-xs text-slate-500">{l.ip_address || "—"}</td><td className="px-4 py-2.5 text-xs text-slate-500">{new Date(l.created_at).toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
