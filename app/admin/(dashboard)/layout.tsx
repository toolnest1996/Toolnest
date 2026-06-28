"use client";

import { useEffect, useState } from "react";
import { redirectTo } from "@/lib/navigation";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";
import { createClient } from "@/lib/supabase/client";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function check() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAuthorized(false);
        setLoading(false);
        redirectTo("/admin/login", true);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || !["ADMIN", "SUPER_ADMIN", "MODERATOR"].includes(profile.role)) {
        setAuthorized(false);
        setLoading(false);
        redirectTo("/admin/login?error=unauthorized", true);
        return;
      }

      setAuthorized(true);
      setLoading(false);
    }

    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === "SIGNED_OUT") {
        setAuthorized(false);
        window.location.href = "/admin/login?logout=1";
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
