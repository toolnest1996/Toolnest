import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/require-super-admin";
import { categories as allCategories } from "@/lib/data/categories";
import { tools as allTools } from "@/lib/data/tools";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceSupabase();
  const [{ data: configs }, { data: toolConfigs }, { data: usageRows }] = await Promise.all([
    service.from("category_configs").select("slug, enabled, order_index, updated_at"),
    service.from("tool_configs").select("slug, enabled"),
    service
      .from("tool_usage")
      .select("tool_slug, created_at")
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  const toolEnabled: Record<string, boolean> = {};
  allTools.forEach((t) => {
    toolEnabled[t.slug] = true;
  });
  toolConfigs?.forEach((c) => {
    toolEnabled[c.slug] = c.enabled;
  });

  const toolCategory = new Map(allTools.map((t) => [t.slug, t.category]));

  const configMap: Record<string, { enabled: boolean; order_index: number | null }> = {};
  allCategories.forEach((c, i) => {
    configMap[c.slug] = { enabled: true, order_index: i };
  });
  configs?.forEach((c) => {
    configMap[c.slug] = { enabled: c.enabled, order_index: c.order_index };
  });

  const toolsPerCategory: Record<string, number> = {};
  const enabledToolsPerCategory: Record<string, number> = {};
  const liveToolsPerCategory: Record<string, number> = {};
  allCategories.forEach((c) => {
    toolsPerCategory[c.slug] = 0;
    enabledToolsPerCategory[c.slug] = 0;
    liveToolsPerCategory[c.slug] = 0;
  });
  allTools.forEach((t) => {
    toolsPerCategory[t.category] = (toolsPerCategory[t.category] || 0) + 1;
    if (toolEnabled[t.slug] !== false) {
      enabledToolsPerCategory[t.category] = (enabledToolsPerCategory[t.category] || 0) + 1;
    }
    if (t.live) {
      liveToolsPerCategory[t.category] = (liveToolsPerCategory[t.category] || 0) + 1;
    }
  });

  const usage7d: Record<string, number> = {};
  const usage30d: Record<string, number> = {};
  const weekAgo = Date.now() - 7 * 86400000;

  usageRows?.forEach((row) => {
    const cat = toolCategory.get(row.tool_slug);
    if (!cat) return;
    usage30d[cat] = (usage30d[cat] || 0) + 1;
    if (new Date(row.created_at).getTime() >= weekAgo) {
      usage7d[cat] = (usage7d[cat] || 0) + 1;
    }
  });

  const enabledCount = allCategories.filter((c) => configMap[c.slug]?.enabled !== false).length;

  return NextResponse.json({
    configs: configMap,
    toolsPerCategory,
    enabledToolsPerCategory,
    liveToolsPerCategory,
    usage7d,
    usage30d,
    stats: {
      total: allCategories.length,
      enabled: enabledCount,
      disabled: allCategories.length - enabledCount,
      totalTools: allTools.length,
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
      action: `categories_${action}`,
      entity: "category_config",
      entity_id: entityId ?? null,
      details,
      ip_address: null,
    });
  }

  function refreshPublicCategories() {
    revalidatePath("/", "layout");
    revalidatePath("/category", "layout");
  }

  async function saveConfig(
    row: { slug: string; enabled: boolean; order_index?: number | null; updated_at: string },
  ) {
    const { error } = await db.from("category_configs").upsert(row);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    refreshPublicCategories();
    return null;
  }

  if (action === "toggle" && slug) {
    const { data: existing, error: readError } = await db
      .from("category_configs")
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
      .from("category_configs")
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
    const { error } = await db.from("category_configs").upsert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await audit({ slugs, enabled: val });
    refreshPublicCategories();
    return NextResponse.json({ success: true, count: slugs.length, enabled: val });
  }

  if (action === "enable_all") {
    const rows = allCategories.map((c, i) => ({
      slug: c.slug,
      enabled: true,
      order_index: i,
      updated_at: now,
    }));
    const { error } = await db.from("category_configs").upsert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await audit({ count: rows.length, enabled: true });
    refreshPublicCategories();
    return NextResponse.json({ success: true, count: rows.length });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
