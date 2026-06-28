"use client";

import { useEffect, useState } from "react";
import { Save, Megaphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const zones = [
  { key: "ad_header", label: "Header Banner", desc: "Top of every page" },
  { key: "ad_sidebar", label: "Sidebar Ad (300×250)", desc: "Sticky sidebar on tool pages (desktop)" },
  { key: "ad_home_inline", label: "Home Inline Leaderboard", desc: "728×90 every 10 tools on homepage grid" },
  { key: "ad_footer", label: "Footer Leaderboard", desc: "728×90 above site footer on every page" },
  { key: "ad_tool_bottom", label: "Tool Page Bottom", desc: "728×90 / 320×50 below tool output" },
  { key: "ad_blog", label: "Blog In-Article", desc: "Inside blog posts" },
];

export default function AdminAdsPage() {
  const supabase = createClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.from("site_settings").select("*").then(({ data }: { data: any }) => {
      const map: Record<string, string> = {};
      data?.forEach((s: { key: string; value: string }) => (map[s.key] = s.value));
      setValues(map);
    });
  }, [supabase]);

  const save = async () => {
    setSaving(true);
    for (const z of zones) {
      await supabase.from("site_settings").upsert({ key: z.key, value: values[z.key] || "off", updated_at: new Date().toISOString() });
    }
    setSaving(false);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      <div><p className="text-xs text-slate-500">Growth / Ads</p><h1 className="font-display text-2xl font-bold text-white">Ad Manager</h1></div>
      <div className="space-y-3">
        {zones.map((z) => (
          <div key={z.key} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center gap-3"><Megaphone className="h-5 w-5 text-slate-400" /><div><p className="font-medium text-white">{z.label}</p><p className="text-xs text-slate-500">{z.desc}</p></div></div>
            <select value={values[z.key] || "off"} onChange={(e) => setValues((v) => ({ ...v, [z.key]: e.target.value }))} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white">
              <option value="on">Enabled</option>
              <option value="off">Disabled</option>
            </select>
          </div>
        ))}
      </div>
      {success && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">Ad settings saved.</p>}
      <Button variant="gradient" onClick={save} disabled={saving}><Save className="h-4 w-4" /> Save</Button>
    </div>
  );
}
