"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Sub { id: string; user_id: string; plan: string; status: string; current_period_end: string | null; created_at: string; }

export default function AdminSubscriptionsPage() {
  const supabase = createClient();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("subscriptions").select("*").order("created_at", { ascending: false }).then(({ data }: { data: any }) => {
      if (data) setSubs(data);
      setLoading(false);
    });
  }, [supabase]);

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div><p className="text-xs text-slate-500">Growth / Subscriptions</p><h1 className="font-display text-2xl font-bold text-white">Subscriptions</h1></div>
      {subs.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center">
          <CreditCard className="mx-auto mb-3 h-10 w-10 text-slate-600" /><p className="text-sm text-slate-500">No subscriptions yet. When users upgrade to Pro or Enterprise, they will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-800 text-left text-xs text-slate-500"><th className="px-4 py-3 font-medium">User ID</th><th className="px-4 py-3 font-medium">Plan</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Expires</th></tr></thead>
            <tbody>{subs.map((s) => (
              <tr key={s.id} className="border-b border-slate-800/50 last:border-0"><td className="px-4 py-2.5 font-mono text-xs text-slate-400">{s.user_id.slice(0, 8)}...</td><td className="px-4 py-2.5 text-white">{s.plan}</td><td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${s.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>{s.status}</span></td><td className="px-4 py-2.5 text-xs text-slate-500">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
