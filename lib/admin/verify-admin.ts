import { createServerSupabase } from "@/lib/supabase/server";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "MODERATOR"];

export async function getAdminUser() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || !ADMIN_ROLES.includes(profile.role)) return null;
  return { user, profile };
}

export async function requireAdmin() {
  const admin = await getAdminUser();
  if (!admin) throw new Error("Unauthorized");
  return admin;
}
