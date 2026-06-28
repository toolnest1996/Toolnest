import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { tool_slug } = await req.json();
    if (!tool_slug) return NextResponse.json({ error: "tool_slug required" }, { status: 400 });

    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("tool_usage").insert({
      tool_slug,
      user_id: user?.id ?? null,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase
      .from("tool_usage")
      .select("tool_slug, created_at")
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());

    const counts: Record<string, number> = {};
    data?.forEach((row: { tool_slug: string }) => {
      counts[row.tool_slug] = (counts[row.tool_slug] || 0) + 1;
    });

    const topTools = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([slug, count]) => ({ slug, count }));

    const daily: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString("en", { weekday: "short" });
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      const count = data?.filter(
        (r: { created_at: string }) => r.created_at >= dayStart.toISOString() && r.created_at <= dayEnd.toISOString(),
      ).length ?? 0;
      daily.push({ label, value: count });
    }

    return NextResponse.json({ topTools, daily, total: data?.length ?? 0 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
