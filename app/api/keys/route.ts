import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { randomBytes, createHash } from "crypto";

export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (profile?.plan !== "ENTERPRISE" && profile?.plan !== "PRO") {
    return NextResponse.json({ error: "Pro or Enterprise plan required" }, { status: 403 });
  }

  const { data } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, usage_count, is_active, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ keys: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan").eq("id", user.id).single();
  if (profile?.plan !== "ENTERPRISE") {
    return NextResponse.json({ error: "Enterprise plan required to create API keys" }, { status: 403 });
  }

  const { name } = await req.json();
  const rawKey = `tn_live_${randomBytes(24).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 16);

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: user.id,
      name: name || "Default",
      key_hash: keyHash,
      key_prefix: keyPrefix,
    })
    .select("id, name, key_prefix, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ key: rawKey, ...data });
}

export async function DELETE(req: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  await supabase.from("api_keys").update({ is_active: false }).eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ success: true });
}
