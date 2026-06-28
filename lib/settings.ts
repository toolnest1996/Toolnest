import { createServerSupabase } from "@/lib/supabase/server";

export async function getSiteSettings(): Promise<Record<string, string>> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("site_settings").select("key, value");
  const map: Record<string, string> = {};
  data?.forEach((s: { key: string; value: string }) => {
    map[s.key] = s.value;
  });
  return map;
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const settings = await getSiteSettings();
  return settings[key] ?? fallback;
}

export async function isMaintenanceMode(): Promise<boolean> {
  const val = await getSetting("maintenance_mode", "false");
  return val === "true";
}
