"use client";

import { useEffect, useState } from "react";
import { Mail, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
}

export default function AdminContactsPage() {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).then(({ data }: { data: any }) => {
      if (data) setMessages(data);
      setLoading(false);
    });
  }, [supabase]);

  const markRead = async (id: string) => {
    await supabase.from("contact_messages").update({ status: "read" }).eq("id", id);
    setMessages((m) => m.map((x) => x.id === id ? { ...x, status: "read" } : x));
    toast.success("Marked as read");
  };

  const deleteMsg = async (id: string) => {
    if (!confirm("Delete this message?")) return;
    await supabase.from("contact_messages").delete().eq("id", id);
    setMessages((m) => m.filter((x) => x.id !== id));
  };

  if (loading) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><p className="text-xs text-slate-500">Manage / Contact</p><h1 className="font-display text-2xl font-bold text-white">Contact Messages</h1></div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">{messages.filter((m) => m.status === "new").length} unread</span>
      </div>
      {messages.length === 0 ? (
        <p className="py-16 text-center text-slate-500">No messages yet</p>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`rounded-xl border border-slate-800 bg-slate-900 p-5 ${m.status === "new" ? "border-l-4 border-l-[#E8231A]" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 text-slate-500" />
                  <div>
                    <p className="font-medium text-white">{m.subject || "General inquiry"}</p>
                    <p className="text-xs text-slate-500">{m.name} &lt;{m.email}&gt; — {new Date(m.created_at).toLocaleString()}</p>
                    <p className="mt-2 text-sm text-slate-300">{m.message}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {m.status === "new" && (
                    <button onClick={() => markRead(m.id)} className="rounded p-1.5 text-slate-400 hover:bg-emerald-500/20 hover:text-emerald-400"><Check className="h-4 w-4" /></button>
                  )}
                  <button onClick={() => deleteMsg(m.id)} className="rounded p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
