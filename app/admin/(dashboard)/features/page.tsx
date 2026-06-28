"use client";

import { useEffect, useState } from "react";
import { ToggleLeft, ToggleRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Flag { key: string; enabled: boolean; description: string | null; }

export default function AdminFeaturesPage() {
  const supabase = createClient();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("feature_flags").select("*").order("key").then(({ data }: { data: any }) => {
      if (data) setFlags(data);
      setLoading(false);
    });
  }, [supabase]);

  const toggle = async (key: string) => {
    const flag = flags.find((f) => f.key === key);
    if (!flag) return;
    const newVal = !flag.enabled;
    setFlags((f) => f.map((x) => (x.key === key ? { ...x, enabled: newVal } : x)));
    await supabase.from("feature_flags").update({ enabled: newVal, updated_at: new Date().toISOString() }).eq("key", key);
  };

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div><p className="text-xs text-slate-500">System / Feature Flags</p><h1 className="font-display text-2xl font-bold text-white">Feature Flags</h1></div>
      <div className="space-y-3">
        {flags.map((f) => (
          <div key={f.key} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div>
              <p className="font-medium text-white">{f.key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
              <p className="mt-0.5 text-xs text-slate-500">{f.description || f.key}</p>
            </div>
            <button onClick={() => toggle(f.key)} className={f.enabled ? "text-emerald-400" : "text-slate-600"}>
              {f.enabled ? <ToggleRight className="h-7 w-7" /> : <ToggleLeft className="h-7 w-7" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
