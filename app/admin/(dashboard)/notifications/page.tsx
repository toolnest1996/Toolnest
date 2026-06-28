"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Notif { id: string; title: string; message: string; type: string; read: boolean; created_at: string; }

const typeBadge: Record<string, string> = { info: "bg-sky-500/15 text-sky-400", warning: "bg-amber-500/15 text-amber-400", error: "bg-rose-500/15 text-rose-400", success: "bg-emerald-500/15 text-emerald-400" };

export default function AdminNotificationsPage() {
  const supabase = createClient();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("admin_notifications").select("*").order("created_at", { ascending: false }).then(({ data }: { data: any }) => {
      if (data) setNotifs(data);
      setLoading(false);
    });
  }, [supabase]);

  const markRead = async (id: string) => {
    await supabase.from("admin_notifications").update({ read: true }).eq("id", id);
    setNotifs((n) => n.map((x) => (x.id === id ? { ...x, read: true } : x)));
  };

  const del = async (id: string) => {
    await supabase.from("admin_notifications").delete().eq("id", id);
    setNotifs((n) => n.filter((x) => x.id !== id));
  };

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><p className="text-xs text-slate-500">System / Notifications</p><h1 className="font-display text-2xl font-bold text-white">Notifications</h1></div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">{notifs.filter((n) => !n.read).length} unread</span>
      </div>
      {notifs.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-12 text-center"><Bell className="mx-auto mb-3 h-10 w-10 text-slate-600" /><p className="text-sm text-slate-500">No notifications</p></div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => (
            <div key={n.id} className={`flex items-start gap-4 rounded-xl border p-4 ${n.read ? "border-slate-800/50 bg-slate-900/50" : "border-slate-700 bg-slate-900"}`}>
              <span className={`mt-0.5 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase ${typeBadge[n.type] || ""}`}>{n.type}</span>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${n.read ? "text-slate-400" : "text-white"}`}>{n.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                <p className="mt-1 text-[10px] text-slate-600">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-1">
                {!n.read && <button onClick={() => markRead(n.id)} className="rounded p-1 text-slate-500 hover:text-emerald-400"><Check className="h-4 w-4" /></button>}
                <button onClick={() => del(n.id)} className="rounded p-1 text-slate-500 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
