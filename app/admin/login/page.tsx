"use client";

import { useState, useEffect, Suspense } from "react";
import { redirectTo } from "@/lib/navigation";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn, Mail, Lock, ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminThemeToggle } from "@/components/admin/admin-theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { signInWithGoogleAdmin } from "@/lib/supabase/admin-auth";

export default function AdminLoginPage() {
  return (
    <Suspense>
      <AdminLoginContent />
    </Suspense>
  );
}

function AdminLoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    const err = searchParams.get("error");
    const logout = searchParams.get("logout");
    if (logout === "1") setSuccess("You have been logged out successfully.");
    else setSuccess("");
    if (err === "unauthorized") setError("Access denied. Your account does not have admin privileges.");
    else if (err === "auth") setError("Authentication failed. Please try again.");
    else setError("");
  }, [searchParams]);

  useEffect(() => {
    const logout = searchParams.get("logout");
    if (logout === "1") return;

    async function checkSession() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile && ["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(profile.role)) {
        redirectTo("/admin", true);
      }
    }
    checkSession();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authErr) {
      setLoading(false);
      const msg = authErr.message?.trim() || "Login failed. Please check email and password.";
      if (msg.toLowerCase().includes("invalid login credentials")) {
        setError(
          "Email/password match nahi hua. Google account ho to \"Sign in with Google\" use karo, ya Forgot password se password set karo.",
        );
      } else if (msg.toLowerCase().includes("database error")) {
        setError("Server error during login. Admin account fix ho raha hai — thodi der baad dubara try karo.");
      } else {
        setError(msg);
      }
      return;
    }

    if (!data.user) {
      setLoading(false);
      setError("Authentication failed.");
      return;
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    setLoading(false);

    if (profileErr) {
      setError(profileErr.message || "Could not verify admin role. Try again.");
      return;
    }

    if (!profile || !["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(profile.role)) {
      await supabase.auth.signOut();
      setError("Access denied. You do not have admin privileges.");
      return;
    }

    redirectTo("/admin");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="absolute right-4 top-4">
        <AdminThemeToggle className="admin-theme-toggle" />
      </div>
      <div className="absolute left-4 top-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to site
        </Link>
      </div>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ToolNest" width={56} height={56} className="mx-auto rounded-2xl" />
          <h1 className="mt-4 font-display text-2xl font-bold text-white">Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to access the control center</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-6 flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-400">
            <ShieldCheck className="h-4 w-4 text-[#E8231A]" />
            Authorized personnel only
          </div>

          <button
            type="button"
            onClick={async () => {
              setError("");
              setSuccess("");
              const { data, error: err } = await signInWithGoogleAdmin();
              if (err) {
                setError(err.message);
                return;
              }
              if (data?.url) {
                window.location.href = data.url;
              }
            }}
            className="mb-2 flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800 text-sm font-medium text-white transition-colors hover:bg-slate-700"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.07l3.66-2.98Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
            </svg>
            Sign in with Google
          </button>

          <Link
            href="/login?next=/admin"
            className="mb-4 flex h-10 w-full items-center justify-center rounded-xl border border-slate-800 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            Site login page se try karo (Google)
          </Link>

          <p className="mb-4 text-center text-xs text-slate-500">
            Google error aaye to pehle{" "}
            <a href="https://accounts.google.com" target="_blank" rel="noreferrer" className="text-[#E8231A] hover:underline">
              accounts.google.com
            </a>{" "}
            par login karo, phir dubara try karo. Site{" "}
            <strong className="text-slate-400">http://localhost:3000</strong> par kholo (3001 par OAuth fail ho sakta hai).
          </p>

          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-600">or with email</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@toolnest.io"
                  className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#E8231A]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-12 text-sm text-white outline-none placeholder:text-slate-600 focus:border-[#E8231A]"
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

            {success && (
              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">{success}</p>
            )}

            {error && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
            )}

            <Button type="submit" variant="gradient" className="h-11 w-full" disabled={loading}>
              <LogIn className="h-4 w-4" />
              {loading ? "Signing in..." : "Sign In to Admin"}
            </Button>

            <button
              type="button"
              onClick={async () => {
                if (!email.trim()) {
                  setError("Pehle apna email likho, phir password reset bhejenge.");
                  return;
                }
                setError("");
                const supabase = createClient();
                const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                  redirectTo: `${window.location.origin}/admin/login`,
                });
                if (err) setError(err.message);
                else setSuccess("Password reset link tumhare email par bhej diya gaya.");
              }}
              className="w-full text-center text-xs text-slate-500 hover:text-[#E8231A]"
            >
              Forgot password? (email account ke liye)
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          ToolNest Admin Panel — Authorized access only
        </p>
      </div>
    </div>
  );
}
