import { createClient } from "@/lib/supabase/client";

export async function logAudit(
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, unknown>,
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("audit_log").insert({
    user_id: user.id,
    action,
    entity,
    entity_id: entityId ?? null,
    details: details ?? {},
    ip_address: null,
  });
}
