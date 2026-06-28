"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { redirectTo } from "@/lib/navigation";
import {
  UserPlus,
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Shield,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/admin/permissions";

export default function CreateAdminPage() {
  const supabase = createClient();
  const [myRole, setMyRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [created, setCreated] = useState<{ email: string; role: string } | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("ADMIN");

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        redirectTo("/admin/login", true);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      setMyRole(profile?.role ?? "");
      setLoading(false);
    }
    check();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setBusy(true);
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role,
      }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      toast.error(data.error || "Failed to create admin");
      return;
    }

    setCreated({ email: email.trim(), role });
    toast.success(`Admin created: ${email.trim()}`);
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setRole("ADMIN");
  };

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
        <Shield className="mx-auto mb-3 h-10 w-10 text-rose-400" />
        <h1 className="font-display text-xl font-bold text-white">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-400">Only SUPER_ADMIN can create new admin accounts.</p>
        <Link href="/admin/team" className="mt-4 inline-block text-sm text-[#E8231A] hover:underline">
          Back to Admin Team
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/admin/team"
          className="mb-3 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Admin Team
        </Link>
        <p className="text-xs text-slate-500">System / Admin Team / New</p>
        <h1 className="font-display text-2xl font-bold text-white">Create New Admin</h1>
        <p className="mt-1 text-sm text-slate-500">
          Naya admin account banao — email/password se turant /admin/login par login kar sakta hai.
        </p>
      </div>

      {created && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="font-medium text-emerald-300">Admin successfully created!</p>
              <p className="mt-1 text-sm text-emerald-200/80">
                {created.email} — {roleLabel(created.role)}
              </p>
              <p className="mt-2 text-xs text-emerald-200/60">
                Login URL: <strong>http://localhost:3000/admin/login</strong>
              </p>
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6"
      >
        <div>
          <label className="mb-1.5 block text-sm text-slate-400">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Admin name"
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 text-sm text-white outline-none focus:border-[#E8231A]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-slate-400">Email *</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@toolnest.io"
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 text-sm text-white outline-none focus:border-[#E8231A]"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-slate-400">Password *</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type={showPw ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-12 text-sm text-white outline-none focus:border-[#E8231A]"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-slate-400">Confirm Password *</label>
          <input
            type={showPw ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat password"
            className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-slate-400">Admin Role *</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-600">
            ADMIN = full panel access · MODERATOR = limited access (no team/system)
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row">
          <Button type="submit" variant="gradient" className="flex-1" disabled={busy}>
            <UserPlus className="h-4 w-4" />
            {busy ? "Creating..." : "Create Admin Account"}
          </Button>
          <Link
            href="/admin/team"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-700 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
