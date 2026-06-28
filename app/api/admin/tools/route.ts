import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-super-admin";
import { tools as allTools } from "@/lib/data/tools";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceSupabase();
  const [{ data: configs }, { data: usageRows }] = await Promise.all([
    service.from("tool_configs").select("slug, enabled, order_index, updated_at"),
    service
      .from("tool_usage")
      .select("tool_slug, created_at")
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  const configMap: Record<string, { enabled: boolean; order_index: number | null }> = {};
  allTools.forEach((t, i) => {
    configMap[t.slug] = { enabled: true, order_index: i };
  });
  configs?.forEach((c) => {
    configMap[c.slug] = { enabled: c.enabled, order_index: c.order_index };
  });

  const usage7d: Record<string, number> = {};
  const usage30d: Record<string, number> = {};
  const weekAgo = Date.now() - 7 * 86400000;

  usageRows?.forEach((row) => {
    usage30d[row.tool_slug] = (usage30d[row.tool_slug] || 0) + 1;
    if (new Date(row.created_at).getTime() >= weekAgo) {
      usage7d[row.tool_slug] = (usage7d[row.tool_slug] || 0) + 1;
    }
  });

  const enabledCount = allTools.filter((t) => configMap[t.slug]?.enabled !== false).length;
  const liveCount = allTools.filter((t) => t.live).length;

  return NextResponse.json({
    configs: configMap,
    usage7d,
    usage30d,
    stats: {
      total: allTools.length,
      enabled: enabledCount,
      disabled: allTools.length - enabledCount,
      live: liveCount,
      comingSoon: allTools.length - liveCount,
      uses7d: Object.values(usage7d).reduce((a, b) => a + b, 0),
      uses30d: Object.values(usage30d).reduce((a, b) => a + b, 0),
    },
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const { action, slug, slugs, enabled, order_index } = body as {
    action?: string;
    slug?: string;
    slugs?: string[];
    enabled?: boolean;
    order_index?: number;
  };

  const db = auth.supabase!;
  const auditDb = createServiceSupabase();
  const now = new Date().toISOString();
  const actorId = auth.user!.id;

  async function audit(details: Record<string, unknown>, entityId?: string) {
    await auditDb.from("audit_log").insert({
      user_id: actorId,
      action: `tools_${action}`,
      entity: "tool_config",
      entity_id: entityId ?? null,
      details,
      ip_address: null,
    });
  }

  function refreshPublicTools() {
    revalidatePath("/", "layout");
    revalidatePath("/category", "layout");
    revalidatePath("/tool", "layout");
  }

  async function saveConfig(
    row: { slug: string; enabled: boolean; order_index?: number | null; updated_at: string },
  ) {
    const { error } = await db.from("tool_configs").upsert(row);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    refreshPublicTools();
    return null;
  }

  if (action === "toggle" && slug) {
    const { data: existing, error: readError } = await db
      .from("tool_configs")
      .select("enabled")
      .eq("slug", slug)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    const newEnabled = existing ? !existing.enabled : false;
    const saveError = await saveConfig({ slug, enabled: newEnabled, updated_at: now });
    if (saveError) return saveError;

    await audit({ slug, enabled: newEnabled }, slug);
    return NextResponse.json({ success: true, slug, enabled: newEnabled });
  }

  if (action === "set" && slug && typeof enabled === "boolean") {
    const saveError = await saveConfig({
      slug,
      enabled,
      order_index: order_index ?? null,
      updated_at: now,
    });
    if (saveError) return saveError;

    await audit({ slug, enabled, order_index }, slug);
    return NextResponse.json({ success: true, slug, enabled });
  }

  if (action === "set_order" && slug && typeof order_index === "number") {
    const { data: existing, error: readError } = await db
      .from("tool_configs")
      .select("enabled")
      .eq("slug", slug)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    const saveError = await saveConfig({
      slug,
      enabled: existing?.enabled ?? true,
      order_index,
      updated_at: now,
    });
    if (saveError) return saveError;

    await audit({ slug, order_index }, slug);
    return NextResponse.json({ success: true, slug, order_index });
  }

  if ((action === "bulk_enable" || action === "bulk_disable") && slugs?.length) {
    const val = action === "bulk_enable";
    const rows = slugs.map((s) => ({
      slug: s,
      enabled: val,
      updated_at: now,
    }));
    const { error } = await db.from("tool_configs").upsert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await audit({ slugs, enabled: val });
    refreshPublicTools();
    return NextResponse.json({ success: true, count: slugs.length, enabled: val });
  }

  if (action === "enable_live") {
    const liveSlugs = allTools.filter((t) => t.live).map((t) => t.slug);
    const rows = liveSlugs.map((s) => ({ slug: s, enabled: true, updated_at: now }));
    const { error } = await db.from("tool_configs").upsert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await audit({ count: liveSlugs.length, enabled: true });
    refreshPublicTools();
    return NextResponse.json({ success: true, count: liveSlugs.length });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
