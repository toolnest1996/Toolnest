import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [files, jobs, profile] = await Promise.all([
    supabase.from("file_history").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("profiles").select("plan, full_name, created_at").eq("id", user.id).single(),
  ]);

  return NextResponse.json({
    filesProcessed: files.count ?? 0,
    jobsRun: jobs.count ?? 0,
    plan: profile.data?.plan ?? "FREE",
    memberSince: profile.data?.created_at,
  });
}
