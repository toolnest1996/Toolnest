"use client";

import { useEffect, useState } from "react";
import { Save, Mail } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/admin/audit";
import { Button } from "@/components/ui/button";

interface Template {
  id: string;
  slug: string;
  name: string;
  subject: string;
  body: string;
}

export default function AdminEmailsPage() {
  const supabase = createClient();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [active, setActive] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("email_templates").select("*").order("slug").then(({ data }: { data: any }) => {
      if (data?.length) {
        setTemplates(data);
        setActive(data[0]);
      }
      setLoading(false);
    });
  }, [supabase]);

  const save = async () => {
    if (!active) return;
    await supabase.from("email_templates").update({
      subject: active.subject,
      body: active.body,
      updated_at: new Date().toISOString(),
    }).eq("id", active.id);
    await logAudit("update_email_template", "email_templates", active.id);
    toast.success("Template saved");
  };

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div><p className="text-xs text-slate-500">System / Email Templates</p><h1 className="font-display text-2xl font-bold text-white">Email Templates</h1></div>
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-1">
          {templates.map((t) => (
            <button key={t.id} onClick={() => setActive(t)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm ${active?.id === t.id ? "bg-[#E8231A]/15 text-white" : "text-slate-400 hover:bg-slate-800"}`}>
              <Mail className="h-4 w-4 shrink-0" />{t.name}
            </button>
          ))}
        </div>
        {active && (
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-6 lg:col-span-3">
            <p className="text-xs text-slate-500">Slug: {active.slug} — Variables: {"{{name}}"}, {"{{link}}"}</p>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Subject</label>
              <input value={active.subject} onChange={(e) => setActive({ ...active, subject: e.target.value })} className="h-11 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Body</label>
              <textarea value={active.body} onChange={(e) => setActive({ ...active, body: e.target.value })} rows={12} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-[#E8231A] font-mono" />
            </div>
            <Button variant="gradient" onClick={save}><Save className="h-4 w-4" /> Save Template</Button>
          </div>
        )}
      </div>
    </div>
  );
}
