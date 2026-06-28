"use client";

import { useEffect, useState } from "react";
import { KeyRound, Copy, Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminApiKeysPage() {
  const supabase = createClient();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [copied, setCopied] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("api_keys").select("id, name, key_prefix, usage_count, is_active, created_at").order("created_at", { ascending: false }).then(({ data }: { data: any }) => {
      if (data) setKeys(data);
      setLoading(false);
    });
  }, [supabase]);

  const copy = async (k: string) => { await navigator.clipboard.writeText(k); setCopied(k); setTimeout(() => setCopied(""), 1500); };

  const revoke = async (id: string) => {
    await supabase.from("api_keys").update({ is_active: false }).eq("id", id);
    setKeys((k) => k.map((x) => x.id === id ? { ...x, is_active: false } : x));
    toast.success("Key revoked");
  };

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div><p className="text-xs text-slate-500">Growth / API Keys</p><h1 className="font-display text-2xl font-bold text-white">API Keys</h1></div>
      {keys.length === 0 ? (
        <p className="py-12 text-center text-slate-500">No API keys yet. Enterprise users can generate keys from their dashboard.</p>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div key={k.id} className={`flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 p-5 ${!k.is_active ? "opacity-50" : ""}`}>
              <KeyRound className="h-5 w-5 text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">{k.name}</p>
                <p className="font-mono text-xs text-slate-500">{k.key_prefix}...</p>
              </div>
              <span className="text-xs text-slate-500">{k.usage_count} calls</span>
              <span className={`text-xs ${k.is_active ? "text-emerald-400" : "text-rose-400"}`}>{k.is_active ? "Active" : "Revoked"}</span>
              <button onClick={() => copy(k.key_prefix)} className="text-slate-400 hover:text-white">
                {copied === k.key_prefix ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
              {k.is_active && (
                <button onClick={() => revoke(k.id)} className="text-slate-400 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
