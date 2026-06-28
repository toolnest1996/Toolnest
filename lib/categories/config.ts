import { categories } from "@/lib/data/categories";
import type { Category } from "@/lib/data/types";
import { createPublicSupabase } from "@/lib/supabase/public";

export type CategoryConfigMap = Record<string, { enabled: boolean; order_index: number | null }>;

export async function getCategoryConfigMap(): Promise<CategoryConfigMap> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return {};

    const supabase = createPublicSupabase();
    const { data, error } = await supabase
      .from("category_configs")
      .select("slug, enabled, order_index");

    if (error) {
      console.error("[category_configs] failed to load public category visibility:", error.message);
      return {};
    }

    const map: CategoryConfigMap = {};
    data?.forEach((row) => {
      map[row.slug] = { enabled: row.enabled, order_index: row.order_index };
    });
    return map;
  } catch (e) {
    console.error("[category_configs] unexpected error:", e);
    return {};
  }
}

export function isCategoryEnabled(slug: string, configMap: CategoryConfigMap): boolean {
  return configMap[slug]?.enabled !== false;
}

export function filterPublicCategories(configMap: CategoryConfigMap): Category[] {
  const orderFallback = new Map(categories.map((c, i) => [c.slug, i]));

  return categories
    .filter((c) => isCategoryEnabled(c.slug, configMap))
    .sort((a, b) => {
      const aOrder = configMap[a.slug]?.order_index ?? orderFallback.get(a.slug)!;
      const bOrder = configMap[b.slug]?.order_index ?? orderFallback.get(b.slug)!;
      return aOrder - bOrder;
    });
}

export async function getPublicCategories(): Promise<Category[]> {
  const configMap = await getCategoryConfigMap();
  return filterPublicCategories(configMap);
}

export async function isPublicCategoryEnabled(slug: string): Promise<boolean> {
  const configMap = await getCategoryConfigMap();
  return isCategoryEnabled(slug, configMap);
}
