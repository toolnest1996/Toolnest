import { createServerSupabase } from "@/lib/supabase/server";

export async function requireSuperAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 as const, supabase: null, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "SUPER_ADMIN") {
    return {
      error: "Super admin access required",
      status: 403 as const,
      supabase: null,
      user: null,
      profile: null,
    };
  }

  return { error: null, status: 200 as const, supabase, user, profile };
}

export async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", status: 401 as const, supabase: null, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  const allowed = ["ADMIN", "SUPER_ADMIN", "MODERATOR"];
  if (!profile || !allowed.includes(profile.role)) {
    return { error: "Admin access required", status: 403 as const, supabase: null, user: null, profile: null };
  }

  return { error: null, status: 200 as const, supabase, user, profile };
}
