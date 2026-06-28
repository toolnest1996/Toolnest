"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Shield,
  UserMinus,
  UserPlus,
  Mail,
  RefreshCw,
  Crown,
  Users,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ADMIN_PERMISSIONS,
  ASSIGNABLE_ROLES,
  roleLabel,
} from "@/lib/admin/permissions";

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string;
  email: string;
  plan: string;
  created_at: string;
}

interface TeamStats {
  superAdmin: number;
  admin: number;
  moderator: number;
}

type Tab = "members" | "add" | "promote" | "permissions";

export default function AdminTeamPage() {
  const supabase = createClient();
  const [myRole, setMyRole] = useState("");
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [stats, setStats] = useState<TeamStats>({ superAdmin: 0, admin: 0, moderator: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("members");
  const [busy, setBusy] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("ADMIN");

  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoteRole, setPromoteRole] = useState<string>("ADMIN");

  const loadTeam = useCallback(async () => {
    const res = await fetch("/api/admin/team");
    if (res.status === 403) {
      setMyRole("DENIED");
      setLoading(false);
      return;
    }
    if (!res.ok) {
      toast.error("Failed to load team");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setTeam(data.team ?? []);
    setStats(data.stats ?? { superAdmin: 0, admin: 0, moderator: 0 });
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        setMyRole(profile?.role ?? "");
      }
      await loadTeam();
    }
    init();
  }, [supabase, loadTeam]);

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        full_name: newName,
        role: newRole,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Failed to create admin");
      return;
    }
    toast.success(`${roleLabel(newRole)} created: ${newEmail}`);
    setNewEmail("");
    setNewPassword("");
    setNewName("");
    setTab("members");
    loadTeam();
  };

  const promoteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/admin/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "promote_by_email",
        email: promoteEmail,
        role: promoteRole,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Failed to promote user");
      return;
    }
    toast.success(`${promoteEmail} promoted to ${roleLabel(promoteRole)}`);
    setPromoteEmail("");
    setTab("members");
    loadTeam();
  };

  const updateRole = async (userId: string, role: string) => {
    const res = await fetch("/api/admin/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to update role");
      return;
    }
    toast.success(`Role updated to ${roleLabel(role)}`);
    loadTeam();
  };

  const demote = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from admin team? They will become a regular user.`)) return;
    const res = await fetch("/api/admin/team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to demote");
      return;
    }
    toast.success("Removed from admin team");
    loadTeam();
  };

  const sendReset = async (userId: string) => {
    const res = await fetch("/api/admin/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_password", user_id: userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to send reset email");
      return;
    }
    toast.success("Password reset email sent");
  };

  const roleBadge: Record<string, string> = {
    SUPER_ADMIN: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    ADMIN: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    MODERATOR: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  };

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: "members", label: "Team Members", icon: Users },
    { id: "add", label: "Add New Admin", icon: UserPlus },
    { id: "promote", label: "Promote User", icon: Crown },
    { id: "permissions", label: "Permissions", icon: Shield },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" />
      </div>
    );
  }

  if (myRole !== "SUPER_ADMIN") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-rose-400" />
        <h1 className="font-display text-xl font-bold text-white">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-400">
          Only <strong className="text-amber-400">SUPER_ADMIN</strong> can manage the admin team.
          Your role: {myRole || "Unknown"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs text-slate-500">System / Team</p>
          <h1 className="font-display text-2xl font-bold text-white">Admin Team</h1>
          <p className="mt-1 text-sm text-slate-500">
            Add admins, promote users, manage roles & permissions
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={loadTeam}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Link
            href="/admin/team/new"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#E8231A] px-4 text-sm font-medium text-white hover:opacity-90"
          >
            <UserPlus className="h-4 w-4" /> Create New Admin
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Super Admins", value: stats.superAdmin, color: "text-amber-400" },
          { label: "Admins", value: stats.admin, color: "text-violet-400" },
          { label: "Moderators", value: stats.moderator, color: "text-sky-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-center">
            <p className={`font-display text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-[#E8231A]/15 text-[#E8231A]"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "members" && (
        <div className="space-y-3">
          {team.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center"
            >
              {m.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.avatar_url}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-sm font-bold text-white">
                  {(m.full_name || "U").slice(0, 2).toUpperCase()}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-white">{m.full_name || "No name"}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      roleBadge[m.role] || ""
                    }`}
                  >
                    {roleLabel(m.role)}
                  </span>
                </div>
                <p className="truncate text-sm text-slate-400">{m.email || m.id.slice(0, 16) + "…"}</p>
                <p className="text-xs text-slate-600">
                  Joined {new Date(m.created_at).toLocaleDateString()} · {m.plan} plan
                </p>
              </div>

              {m.role !== "SUPER_ADMIN" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={m.role}
                    onChange={(e) => updateRole(m.id, e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none"
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => sendReset(m.id)}
                    className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                    title="Send password reset"
                  >
                    <Mail className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => demote(m.id, m.full_name || m.email)}
                    className="rounded-lg border border-rose-500/30 p-2 text-rose-400 hover:bg-rose-500/10"
                    title="Remove from team"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-amber-400/80">Protected account</span>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "add" && (
        <form
          onSubmit={createAdmin}
          className="mx-auto max-w-lg space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6"
        >
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <UserPlus className="h-5 w-5 text-[#E8231A]" /> Create New Admin Account
          </h2>
          <p className="text-sm text-slate-500">
            New account with email/password — can login at /admin/login immediately.
          </p>

          <div>
            <label className="mb-1.5 block text-sm text-slate-400">Full Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Admin name"
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">Email</label>
            <input
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="admin@toolnest.io"
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" variant="gradient" className="w-full" disabled={busy}>
            <UserPlus className="h-4 w-4" />
            {busy ? "Creating..." : "Create Admin Account"}
          </Button>
          <Link
            href="/admin/team/new"
            className="block text-center text-xs text-[#E8231A] hover:underline"
          >
            Full create page kholo →
          </Link>
        </form>
      )}

      {tab === "promote" && (
        <form
          onSubmit={promoteUser}
          className="mx-auto max-w-lg space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6"
        >
          <h2 className="flex items-center gap-2 font-semibold text-white">
            <Crown className="h-5 w-5 text-amber-400" /> Promote Existing User
          </h2>
          <p className="text-sm text-slate-500">
            User must already be registered on ToolNest (Google or email signup).
          </p>

          <div>
            <label className="mb-1.5 block text-sm text-slate-400">User Email</label>
            <input
              type="email"
              required
              value={promoteEmail}
              onChange={(e) => setPromoteEmail(e.target.value)}
              placeholder="user@example.com"
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-slate-400">Admin Role</label>
            <select
              value={promoteRole}
              onChange={(e) => setPromoteRole(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" variant="gradient" className="w-full" disabled={busy}>
            <Crown className="h-4 w-4" />
            {busy ? "Promoting..." : "Promote to Admin Team"}
          </Button>
        </form>
      )}

      {tab === "permissions" && (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">Permission</th>
                <th className="px-4 py-3 text-center font-medium text-amber-400">Super Admin</th>
                <th className="px-4 py-3 text-center font-medium text-violet-400">Admin</th>
                <th className="px-4 py-3 text-center font-medium text-sky-400">Moderator</th>
              </tr>
            </thead>
            <tbody>
              {ADMIN_PERMISSIONS.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50 last:border-0">
                  <td className="px-4 py-3 text-white">{p.label}</td>
                  {[p.superAdmin, p.admin, p.moderator].map((allowed, i) => (
                    <td key={i} className="px-4 py-3 text-center">
                      {allowed ? (
                        <Check className="mx-auto h-4 w-4 text-emerald-400" />
                      ) : (
                        <X className="mx-auto h-4 w-4 text-slate-600" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
