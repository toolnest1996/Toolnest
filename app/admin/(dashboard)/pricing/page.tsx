"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const plans = [
  { key: "free", name: "Free", fields: [{ k: "free_tools_per_day", label: "Tools per day", def: "5" }, { k: "free_max_file_mb", label: "Max file size (MB)", def: "50" }] },
  { key: "pro", name: "Pro", fields: [{ k: "pro_price", label: "Price ($/mo)", def: "9.99" }, { k: "pro_max_file_mb", label: "Max file size (MB)", def: "500" }] },
  { key: "enterprise", name: "Enterprise", fields: [{ k: "enterprise_price", label: "Price ($/mo)", def: "29.99" }, { k: "enterprise_max_file_mb", label: "Max file size (MB)", def: "2048" }] },
];

export default function AdminPricingPage() {
  const supabase = createClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.from("site_settings").select("*").then(({ data }: { data: any }) => {
      const map: Record<string, string> = {};
      data?.forEach((s: { key: string; value: string }) => (map[s.key] = s.value));
      plans.forEach((p) => p.fields.forEach((f) => { if (!map[f.k]) map[f.k] = f.def; }));
      setValues(map);
    });
  }, [supabase]);

  const save = async () => {
    setSaving(true);
    for (const p of plans) {
      for (const f of p.fields) {
        await supabase.from("site_settings").upsert({ key: f.k, value: values[f.k] || f.def, updated_at: new Date().toISOString() });
      }
    }
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div><p className="text-xs text-slate-500">Growth / Pricing</p><h1 className="font-display text-2xl font-bold text-white">Pricing Editor</h1></div>
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.key} className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="font-display text-lg font-bold text-white">{p.name}</h3>
            <div className="mt-4 space-y-3">
              {p.fields.map((f) => (
                <div key={f.k}><label className="mb-1 block text-xs text-slate-400">{f.label}</label><input value={values[f.k] || f.def} onChange={(e) => setValues((v) => ({ ...v, [f.k]: e.target.value }))} className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none focus:border-[#E8231A]" /></div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {success && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">Pricing saved.</p>}
      <Button variant="gradient" onClick={save} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Pricing"}</Button>
    </div>
  );
}
