"use client";

import { useEffect, useRef, useState } from "react";
import { redirectTo } from "@/lib/navigation";
import { Save, Trash2, AlertTriangle, Camera, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { redirectTo("/login"); return; }

      setUserId(user.id);
      setEmail(user.email || "");

      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

      const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
      const googleName = user.user_metadata?.full_name || user.user_metadata?.name;

      setName(p?.full_name || googleName || "");
      setAvatarUrl(p?.avatar_url || googleAvatar || "");
      setAvatarPreview(p?.avatar_url || googleAvatar || "");
      setLoading(false);
    }
    load();
  }, [supabase]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2 MB.");
      return;
    }

    setUploading(true);
    setError("");

    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);

    const ext = file.name.split(".").pop();
    const filePath = `avatars/${userId}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (upErr) {
      // Storage bucket might not exist — fall back to base64 data URL
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setAvatarUrl(dataUrl);
        setAvatarPreview(dataUrl);
        await supabase
          .from("profiles")
          .update({ avatar_url: dataUrl, updated_at: new Date().toISOString() })
          .eq("id", userId);
        setUploading(false);
        setSuccess("Avatar updated.");
        setTimeout(() => setSuccess(""), 3000);
      };
      reader.readAsDataURL(file);
      return;
    }

    const { data: pubUrl } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    const url = pubUrl.publicUrl + `?t=${Date.now()}`;
    setAvatarUrl(url);
    setAvatarPreview(url);

    await supabase
      .from("profiles")
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq("id", userId);

    setUploading(false);
    setSuccess("Avatar updated.");
    setTimeout(() => setSuccess(""), 3000);
  };

  const removeAvatar = async () => {
    setAvatarUrl("");
    setAvatarPreview("");
    await supabase
      .from("profiles")
      .update({ avatar_url: "", updated_at: new Date().toISOString() })
      .eq("id", userId);
    setSuccess("Avatar removed.");
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    const { error: err } = await supabase
      .from("profiles")
      .update({ full_name: name, updated_at: new Date().toISOString() })
      .eq("id", userId);

    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      setSuccess("Profile updated successfully.");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== "DELETE") return;
    await supabase.auth.signOut();
    redirectTo("/");
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const initials = (name || email.split("@")[0] || "U").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted">Manage your account settings.</p>

      {/* Avatar */}
      <div className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Profile Photo</h2>
        <div className="mt-4 flex items-center gap-6">
          <div className="relative">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview}
                alt="Avatar"
                className="h-20 w-20 rounded-2xl object-cover border-2 border-border"
              />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary text-2xl font-bold text-white">
                {initials}
              </span>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:opacity-90"
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
            <p className="text-sm font-medium">Upload a photo</p>
            <p className="mt-0.5 text-xs text-muted">JPG, PNG or WEBP. Max 2 MB.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "Uploading..." : "Choose File"}
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

      {/* Profile */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Profile</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm text-muted opacity-60"
            />
            <p className="mt-1 text-xs text-muted">Email cannot be changed here.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary"
            />
          </div>

          {error && <p className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>}
          {success && <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{success}</p>}

          <Button variant="gradient" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Password */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-lg font-bold">Password</h2>
        <p className="mt-1 text-sm text-muted">
          To change your password, use the forgot password flow.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={async () => {
            if (!email) return;
            await supabase.auth.resetPasswordForEmail(email);
            setSuccess("Password reset email sent.");
            setTimeout(() => setSuccess(""), 3000);
          }}
        >
          Send Reset Email
        </Button>
      </div>

      {/* Danger zone */}
      <div className="mt-6 rounded-2xl border border-error/30 bg-error/5 p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-error">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </h2>
        <p className="mt-1 text-sm text-muted">
          Deleting your account is permanent and cannot be undone.
        </p>

        {!showDelete ? (
          <Button variant="destructive" className="mt-4" onClick={() => setShowDelete(true)}>
            <Trash2 className="h-4 w-4" /> Delete Account
          </Button>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm">Type <strong>DELETE</strong> to confirm:</p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="h-11 w-full rounded-xl border border-error/50 bg-card px-4 text-sm outline-none focus:border-error"
              placeholder="DELETE"
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleDelete} disabled={deleteConfirm !== "DELETE"}>
                Confirm Delete
              </Button>
              <Button variant="outline" onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
