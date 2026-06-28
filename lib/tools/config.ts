import { tools } from "@/lib/data/tools";
import type { Tool } from "@/lib/data/types";
import { getCategoryConfigMap, isCategoryEnabled } from "@/lib/categories/config";
import { createPublicSupabase } from "@/lib/supabase/public";
import { getPopularityRank } from "@/lib/data/popular-tools";

export type ToolConfigMap = Record<string, { enabled: boolean; order_index: number | null }>;

export async function getToolConfigMap(): Promise<ToolConfigMap> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return {};

    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("tool_configs")
      .select("slug, enabled, order_index");

    if (error) {
      console.error("[tool_configs] failed to load public tool visibility:", error.message);
      return {};
    }

    const map: ToolConfigMap = {};
    data?.forEach((row) => {
      map[row.slug] = { enabled: row.enabled, order_index: row.order_index };
    });
    return map;
  } catch (e) {
    console.error("[tool_configs] unexpected error:", e);
    return {};
  }
}

export function isToolEnabled(slug: string, configMap: ToolConfigMap): boolean {
  return configMap[slug]?.enabled !== false;
}

export function filterPublicTools(
  configMap: ToolConfigMap,
  categoryConfigMap?: Awaited<ReturnType<typeof getCategoryConfigMap>>,
): Tool[] {
  const orderFallback = new Map(tools.map((t, i) => [t.slug, i]));

  return tools
    .filter((t) => {
      if (!isToolEnabled(t.slug, configMap)) return false;
      if (categoryConfigMap && !isCategoryEnabled(t.category, categoryConfigMap)) return false;
      return true;
    })
    .sort((a, b) => {
      // 1) Popular tools (curated top-20) float to the top, in rank order.
      const aRank = getPopularityRank(a.slug);
      const bRank = getPopularityRank(b.slug);
      if (aRank !== null && bRank !== null) return aRank - bRank;
      if (aRank !== null) return -1; // a is popular → comes first
      if (bRank !== null) return 1;  // b is popular → comes first

      // 2) Everything else keeps the existing order_index / array order.
      const aOrder = configMap[a.slug]?.order_index ?? orderFallback.get(a.slug)!;
      const bOrder = configMap[b.slug]?.order_index ?? orderFallback.get(b.slug)!;
      return aOrder - bOrder;
    });
}

export async function getPublicTools(): Promise<Tool[]> {
  const [configMap, categoryConfigMap] = await Promise.all([
    getToolConfigMap(),
    getCategoryConfigMap(),
  ]);
  return filterPublicTools(configMap, categoryConfigMap);
}

export async function getPublicToolsByCategory(category: string): Promise<Tool[]> {
  const publicTools = await getPublicTools();
  return publicTools.filter((t) => t.category === category);
}

export async function isPublicToolEnabled(slug: string): Promise<boolean> {
  const tool = tools.find((t) => t.slug === slug);
  if (!tool) return false;

  try {
    const [configMap, categoryConfigMap] = await Promise.all([
      getToolConfigMap(),
      getCategoryConfigMap(),
    ]);
    if (configMap[slug]?.enabled === false) return false;
    if (categoryConfigMap[tool.category]?.enabled === false) return false;
    return true;
  } catch (e) {
    console.error("[isPublicToolEnabled] fallback enable:", slug, e);
    return true;
  }
}
