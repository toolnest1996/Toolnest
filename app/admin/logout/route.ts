import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await supabase.from("audit_log").insert({
      user_id: user.id,
      action: "admin_logout",
      entity: "session",
      entity_id: null,
      details: {},
      ip_address: null,
    });
  }

  await supabase.auth.signOut();

  const loginUrl = new URL("/admin/login?logout=1", request.url);
  const response = NextResponse.redirect(loginUrl);
  return response;
}
