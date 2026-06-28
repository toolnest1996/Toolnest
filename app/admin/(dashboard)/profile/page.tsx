"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Save,
  Camera,
  X,
  Shield,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  ScrollText,
  ExternalLink,
  LogOut,
  ChevronRight,
  UserPlus,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { AdminThemeToggle } from "@/components/admin/admin-theme-toggle";
import { Icon } from "@/components/icon";
import { adminNav } from "@/lib/admin/nav";
import { logAudit } from "@/lib/admin/audit";
import { adminLogout } from "@/lib/admin/logout";

interface AuditEntry {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  created_at: string;
}

const SUPER_ADMIN_ONLY = new Set(["/admin/team", "/admin/system"]);

const QUICK_DESC: Record<string, string> = {
  "/admin": "Overview & KPIs",
  "/admin/analytics": "Usage charts & stats",
  "/admin/reports": "Export CSV reports",
  "/admin/users": "Roles, bans, plans",
  "/admin/tools": "Enable/disable tools",
  "/admin/categories": "Category management",
  "/admin/files": "Files & job queue",
  "/admin/blog": "Blog posts CMS",
  "/admin/contacts": "Contact form inbox",
  "/admin/subscriptions": "Stripe subscriptions",
  "/admin/pricing": "Plan limits & prices",
  "/admin/ads": "Ad zone toggles",
  "/admin/api-keys": "API key management",
  "/admin/features": "Feature flag toggles",
  "/admin/emails": "Email templates",
  "/admin/notifications": "Admin alerts",
  "/admin/team": "Add & manage admins",
  "/admin/audit-log": "Full action history",
  "/admin/settings": "Site-wide settings",
  "/admin/system": "Health & environment",
};

export default function AdminProfilePage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [plan, setPlan] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [lastSignIn, setLastSignIn] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [activity, setActivity] = useState<AuditEntry[]>([]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);
      setEmail(user.email || "");
      setLastSignIn(user.last_sign_in_at || "");

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, role, plan, created_at")
        .eq("id", user.id)
        .single();

      const meta = user.user_metadata || {};
      setName(profile?.full_name || meta.full_name || meta.name || "");
      setRole(profile?.role || "");
      setPlan(profile?.plan || "FREE");
      setMemberSince(profile?.created_at || user.created_at || "");
      setAvatarPreview(
        profile?.avatar_url || meta.avatar_url || meta.picture || "",
      );

      const { data: logs } = await supabase
        .from("audit_log")
        .select("id, action, entity, entity_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(8);

      if (logs) setActivity(logs);
      setLoading(false);
    }
    load();
  }, [supabase]);

  const flash = (msg: string, isError = false) => {
    if (isError) setError(msg);
    else setSuccess(msg);
    setTimeout(() => {
      setError("");
      setSuccess("");
    }, 3500);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      flash("Please select an image file.", true);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      flash("Image must be under 2 MB.", true);
      return;
    }

    setUploading(true);
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);

    const ext = file.name.split(".").pop();
    const filePath = `avatars/${userId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (upErr) {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setAvatarPreview(dataUrl);
        await supabase
          .from("profiles")
          .update({ avatar_url: dataUrl, updated_at: new Date().toISOString() })
          .eq("id", userId);
        await logAudit("profile_avatar_update", "profile", userId);
        setUploading(false);
        flash("Avatar updated.");
      };
      reader.readAsDataURL(file);
      return;
    }

    const { data: pubUrl } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const url = `${pubUrl.publicUrl}?t=${Date.now()}`;
    setAvatarPreview(url);
    await supabase
      .from("profiles")
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq("id", userId);
    await logAudit("profile_avatar_update", "profile", userId);
    setUploading(false);
    flash("Avatar updated.");
  };

  const removeAvatar = async () => {
    setAvatarPreview("");
    await supabase
      .from("profiles")
      .update({ avatar_url: "", updated_at: new Date().toISOString() })
      .eq("id", userId);
    await logAudit("profile_avatar_remove", "profile", userId);
    flash("Avatar removed.");
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const { error: err } = await supabase
      .from("profiles")
      .update({ full_name: name, updated_at: new Date().toISOString() })
      .eq("id", userId);
    setSaving(false);
    if (err) flash(err.message, true);
    else {
      await logAudit("profile_update", "profile", userId, { full_name: name });
      flash("Profile saved.");
    }
  };

  const handleChangePassword = async () => {
    if (!newPw || newPw.length < 8) {
      flash("Password must be at least 8 characters.", true);
      return;
    }
    if (newPw !== confirmPw) {
      flash("Passwords do not match.", true);
      return;
    }

    setChangingPw(true);

    if (currentPw) {
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email,
        password: currentPw,
      });
      if (verifyErr) {
        setChangingPw(false);
        flash("Current password is incorrect.", true);
        return;
      }
    }

    const { error: err } = await supabase.auth.updateUser({ password: newPw });
    setChangingPw(false);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");

    if (err) flash(err.message, true);
    else {
      await logAudit("password_change", "profile", userId);
      flash("Password updated successfully.");
    }
  };

  const quickLinks = adminNav.filter((item) => {
    if (item.href === "/admin") return false;
    if (SUPER_ADMIN_ONLY.has(item.href) && role !== "SUPER_ADMIN") return false;
    return true;
  });

  const roleColor: Record<string, string> = {
    SUPER_ADMIN: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    ADMIN: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    MODERATOR: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" />
      </div>
    );
  }

  const initials = (name || email.split("@")[0] || "A").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-xs text-slate-500">Account / My Profile</p>
        <h1 className="font-display text-2xl font-bold text-white">Admin Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your account, security, and quick access to all admin controls.
        </p>
      </div>

      {(success || error) && (
        <p
          className={`rounded-lg px-4 py-2.5 text-sm ${
            error ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
          }`}
        >
          {error || success}
        </p>
      )}

      {/* Header card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview}
                alt={name}
                className="h-24 w-24 rounded-2xl object-cover border-2 border-slate-700"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#E8231A] text-3xl font-bold text-white">
                {initials}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-[#E8231A] text-white shadow-lg hover:opacity-90"
              aria-label="Change avatar"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold text-white">{name || "Admin"}</h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                  roleColor[role] || "bg-slate-800 text-slate-400"
                }`}
              >
                <Shield className="h-3 w-3" /> {role.replace("_", " ")}
              </span>
              <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
                {plan} plan
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{email}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              {memberSince && (
                <span>Member since {new Date(memberSince).toLocaleDateString()}</span>
              )}
              {lastSignIn && (
                <span>Last sign in {new Date(lastSignIn).toLocaleString()}</span>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "Uploading..." : "Change Photo"}
              </Button>
              {avatarPreview && (
                <Button size="sm" variant="ghost" onClick={removeAvatar}>
                  <X className="h-3.5 w-3.5" /> Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile edit */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="font-semibold text-white">Profile Details</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-slate-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]"
              />
            </div>
            <Button variant="gradient" onClick={handleSaveProfile} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </div>

        {/* Security */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <Lock className="h-4 w-4 text-[#E8231A]" /> Security
          </h3>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">Current Password</label>
              <input
                type={showPw ? "text" : "password"}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                placeholder="Optional if Google-only before"
                className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm text-slate-400">New Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 pr-12 text-sm text-white outline-none focus:border-[#E8231A]"
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
              <label className="mb-1.5 block text-sm text-slate-400">Confirm New Password</label>
              <input
                type={showPw ? "text" : "password"}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 px-4 text-sm text-white outline-none focus:border-[#E8231A]"
              />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="gradient" onClick={handleChangePassword} disabled={changingPw}>
                <KeyRound className="h-4 w-4" />
                {changingPw ? "Updating..." : "Update Password"}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  if (!email) return;
                  await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/admin/login`,
                  });
                  flash("Reset link sent to your email.");
                }}
              >
                Send Reset Email
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="font-semibold text-white">Preferences</h3>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Admin theme</p>
            <p className="text-xs text-slate-500">Switch between light and dark mode</p>
          </div>
          <AdminThemeToggle />
        </div>
      </div>

      {role === "SUPER_ADMIN" && (
        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-slate-900 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 font-semibold text-white">
                <Users className="h-5 w-5 text-amber-400" /> Admin Team Management
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Add new admins, promote users, change roles, send password resets
              </p>
            </div>
            <Link
              href="/admin/team/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8231A] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              <UserPlus className="h-4 w-4" /> Create New Admin
            </Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { label: "Create New Admin", href: "/admin/team/new", desc: "Email + password account" },
              { label: "Promote User", href: "/admin/team", desc: "Upgrade existing user" },
              { label: "Permissions", href: "/admin/team", desc: "Role access matrix" },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 transition-colors hover:border-amber-500/30"
              >
                <p className="text-sm font-medium text-white">{item.label}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick admin controls */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">Admin Control Center</h3>
            <p className="text-sm text-slate-500">
              Quick access to all advanced admin pages
              {role !== "SUPER_ADMIN" && " (some links require SUPER_ADMIN)"}
            </p>
          </div>
          <Link
            href="/admin"
            className="hidden text-xs text-[#E8231A] hover:underline sm:inline"
          >
            Go to Dashboard
          </Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 transition-colors hover:border-[#E8231A]/40 hover:bg-slate-800/50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-400 group-hover:text-[#E8231A]">
                <Icon name={item.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{item.label}</p>
                <p className="truncate text-xs text-slate-500">
                  {QUICK_DESC[item.href] || item.group}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 group-hover:text-slate-400" />
            </Link>
          ))}
        </div>
      </div>

      {/* My activity */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <ScrollText className="h-4 w-4 text-slate-400" /> My Recent Activity
          </h3>
          <Link href="/admin/audit-log" className="text-xs text-[#E8231A] hover:underline">
            View full audit log
          </Link>
        </div>
        {activity.length === 0 ? (
          <p className="text-sm text-slate-500">No recorded actions yet.</p>
        ) : (
          <div className="space-y-2">
            {activity.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm"
              >
                <div>
                  <span className="font-medium text-white">{entry.action}</span>
                  {entry.entity && (
                    <span className="ml-2 text-slate-500">
                      → {entry.entity}
                      {entry.entity_id ? ` (${entry.entity_id.slice(0, 8)}…)` : ""}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session actions */}
      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <ExternalLink className="h-4 w-4" /> View Public Site
        </Link>
        <button
          type="button"
          onClick={() => adminLogout()}
          className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/20"
        >
          <LogOut className="h-4 w-4" /> Sign Out
        </button>
      </div>
    </div>
  );
}
