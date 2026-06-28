"use client";

import { useEffect, useState } from "react";
import { Save, Power } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/admin/audit";
import { Button } from "@/components/ui/button";

export default function AdminSettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState({ message: "", type: "info", link_url: "", is_active: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("site_settings").select("*"),
      supabase.from("site_banners").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]).then(([settingsRes, bannerRes]: [{ data: any }, { data: any }]) => {
      const map: Record<string, string> = {};
      settingsRes.data?.forEach((s: { key: string; value: string }) => (map[s.key] = s.value));
      setSettings(map);
      if (bannerRes.data) setBanner(bannerRes.data);
      setLoading(false);
    });
  }, [supabase]);

  const update = (key: string, value: string) => setSettings((s) => ({ ...s, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    for (const [key, value] of Object.entries(settings)) {
      await supabase.from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() });
    }
    await logAudit("update_settings", "site_settings");
    setSaving(false);
    toast.success("Settings saved");
  };

  const toggleMaintenance = async () => {
    const next = settings.maintenance_mode === "true" ? "false" : "true";
    update("maintenance_mode", next);
    await supabase.from("site_settings").upsert({ key: "maintenance_mode", value: next, updated_at: new Date().toISOString() });
    setSettings((s) => ({ ...s, maintenance_mode: next }));
    await logAudit(next === "true" ? "enable_maintenance" : "disable_maintenance", "site_settings");
    toast.success(next === "true" ? "Maintenance mode ON" : "Maintenance mode OFF");
  };

  const saveBanner = async () => {
    const { data: existing } = await supabase.from("site_banners").select("id").limit(1).maybeSingle();
    if (existing?.id) {
      await supabase.from("site_banners").update(banner).eq("id", existing.id);
    } else {
      await supabase.from("site_banners").insert(banner);
    }
    await logAudit("update_banner", "site_banners");
    toast.success("Site banner saved");
  };

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>;

  const fields = [
    { key: "site_name", label: "Site Name", type: "text" },
    { key: "tagline", label: "Tagline", type: "text" },
    { key: "hero_title", label: "Hero Title", type: "text" },
    { key: "hero_subtitle", label: "Hero Subtitle", type: "text" },
    { key: "contact_email", label: "Contact Email", type: "email" },
    { key: "max_file_size_mb", label: "Max File Size (MB)", type: "number" },
    { key: "rate_limit_free", label: "Rate Limit — Free (req/min)", type: "number" },
    { key: "rate_limit_pro", label: "Rate Limit — Pro (req/min)", type: "number" },
    { key: "maintenance_message", label: "Maintenance Message", type: "text" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><p className="text-xs text-slate-500">System / Settings</p><h1 className="font-display text-2xl font-bold text-white">Site Settings</h1></div>
        <Button variant={settings.maintenance_mode === "true" ? "destructive" : "outline"} onClick={toggleMaintenance}>
          <Power className="h-4 w-4" />
          {settings.maintenance_mode === "true" ? "Disable Maintenance" : "Enable Maintenance"}
        </Button>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="font-semibold text-white">General</h2>
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">{f.label}</label>
            <input type={f.type} value={settings[f.key] || ""} onChange={(e) => update(f.key, e.target.value)} className="h-11 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]" />
          </div>
        ))}
        <Button variant="gradient" onClick={handleSave} disabled={saving}><Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}</Button>
      </div>

      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="font-semibold text-white">Site-wide Banner</h2>
        <input value={banner.message} onChange={(e) => setBanner({ ...banner, message: e.target.value })} placeholder="Banner message..." className="h-11 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]" />
        <div className="grid gap-4 sm:grid-cols-2">
          <select value={banner.type} onChange={(e) => setBanner({ ...banner, type: e.target.value })} className="h-11 rounded-lg border border-slate-800 bg-slate-950 px-4 text-sm text-white">
            {["info", "warning", "success", "error"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={banner.link_url || ""} onChange={(e) => setBanner({ ...banner, link_url: e.target.value })} placeholder="Link URL (optional)" className="h-11 rounded-lg border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={banner.is_active} onChange={(e) => setBanner({ ...banner, is_active: e.target.checked })} />
          Show banner on all pages
        </label>
        <Button variant="outline" onClick={saveBanner}>Save Banner</Button>
      </div>
    </div>
  );
}
