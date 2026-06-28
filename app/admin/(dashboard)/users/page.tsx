"use client";

import { useEffect, useState } from "react";
import { Search, Ban, Shield, Crown, Download, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/admin/audit";
import { Button } from "@/components/ui/button";

interface UserRow {
  id: string;
  full_name: string;
  role: string;
  plan: string;
  avatar_url: string;
  is_banned: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const supabase = createClient();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (data) setUsers(data);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const updateRole = async (id: string, role: string) => {
    await supabase.from("profiles").update({ role }).eq("id", id);
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, role } : x)));
    await logAudit("update_role", "user", id, { role });
    toast.success(`Role updated to ${role}`);
  };

  const toggleBan = async (id: string, banned: boolean) => {
    await supabase.from("profiles").update({ is_banned: banned }).eq("id", id);
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, is_banned: banned } : x)));
    await logAudit(banned ? "ban_user" : "unban_user", "user", id);
    toast.success(banned ? "User banned" : "User unbanned");
  };

  const updatePlan = async (id: string, plan: string) => {
    await supabase.from("profiles").update({ plan }).eq("id", id);
    setUsers((u) => u.map((x) => (x.id === id ? { ...x, plan } : x)));
    await logAudit("update_plan", "user", id, { plan });
    toast.success(`Plan updated to ${plan}`);
  };

  const bulkBan = async () => {
    for (const id of selected) {
      await supabase.from("profiles").update({ is_banned: true }).eq("id", id);
    }
    setUsers((u) => u.map((x) => selected.has(x.id) ? { ...x, is_banned: true } : x));
    await logAudit("bulk_ban", "user", undefined, { count: selected.size });
    toast.success(`${selected.size} users banned`);
    setSelected(new Set());
  };

  const exportCsv = () => {
    const header = "id,name,role,plan,banned,joined\n";
    const rows = filtered.map((u) =>
      `${u.id},${u.full_name || ""},${u.role},${u.plan},${u.is_banned},${u.created_at}`,
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "users.csv";
    a.click();
  };

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = users.filter(
    (u) => !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.id.includes(search),
  );

  const roleBadge: Record<string, string> = {
    USER: "bg-slate-700 text-slate-300",
    MODERATOR: "bg-sky-500/15 text-sky-400",
    ADMIN: "bg-violet-500/15 text-violet-400",
    SUPER_ADMIN: "bg-amber-500/15 text-amber-400",
  };
  const planBadge: Record<string, string> = {
    FREE: "bg-slate-700 text-slate-400",
    PRO: "bg-amber-500/15 text-amber-400",
    ENTERPRISE: "bg-emerald-500/15 text-emerald-400",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs text-slate-500">Manage / Users</p>
          <h1 className="font-display text-2xl font-bold text-white">Users</h1>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button variant="outline" size="sm" onClick={bulkBan}><Ban className="h-4 w-4" /> Ban {selected.size}</Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-400">{users.length} total</span>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or ID..." className="h-10 w-full rounded-lg border border-slate-800 bg-slate-900 pl-10 pr-4 text-sm text-white outline-none focus:border-[#E8231A]" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className={`border-b border-slate-800/50 last:border-0 hover:bg-slate-800/50 ${u.is_banned ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleSelect(u.id)} className="text-slate-400">
                      {selected.has(u.id) ? <CheckSquare className="h-4 w-4 text-[#E8231A]" /> : <Square className="h-4 w-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-lg object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-700 text-xs font-bold text-white">{(u.full_name || "U").slice(0, 2).toUpperCase()}</span>
                      )}
                      <div>
                        <p className="font-medium text-white">{u.full_name || "No name"}</p>
                        <p className="font-mono text-[10px] text-slate-500">{u.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${roleBadge[u.role] || ""}`}>{u.role}</span></td>
                  <td className="px-4 py-3">
                    <select value={u.plan} onChange={(e) => updatePlan(u.id, e.target.value)} className="rounded bg-slate-800 px-2 py-1 text-xs text-white outline-none">
                      {["FREE", "PRO", "ENTERPRISE"].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_banned ? <span className="text-xs text-rose-400">Banned</span> : <span className="text-xs text-emerald-400">Active</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {u.role !== "SUPER_ADMIN" && (
                        <>
                          <button onClick={() => updateRole(u.id, u.role === "ADMIN" ? "USER" : "ADMIN")} className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white" title="Toggle admin"><Shield className="h-4 w-4" /></button>
                          <button onClick={() => toggleBan(u.id, !u.is_banned)} className="rounded p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400" title={u.is_banned ? "Unban" : "Ban"}><Ban className="h-4 w-4" /></button>
                          <button onClick={() => updatePlan(u.id, "PRO")} className="rounded p-1.5 text-slate-400 hover:bg-amber-500/20 hover:text-amber-400" title="Grant Pro"><Crown className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
