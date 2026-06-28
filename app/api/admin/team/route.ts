import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/admin/require-super-admin";
import { ASSIGNABLE_ROLES } from "@/lib/admin/permissions";

const TEAM_ROLES = ["SUPER_ADMIN", "ADMIN", "MODERATOR"];

async function writeAudit(
  userId: string,
  action: string,
  entityId: string | null,
  details: Record<string, unknown>,
) {
  const service = createServiceSupabase();
  await service.from("audit_log").insert({
    user_id: userId,
    action,
    entity: "team",
    entity_id: entityId,
    details,
    ip_address: null,
  });
}

function hasServiceRole() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = createServiceSupabase();
  const { data: profiles } = await service
    .from("profiles")
    .select("id, full_name, role, avatar_url, plan, created_at")
    .in("role", TEAM_ROLES)
    .order("created_at", { ascending: true });

  let emailMap: Record<string, string> = {};
  if (hasServiceRole()) {
    const { data: authData } = await service.auth.admin.listUsers({ perPage: 1000 });
    emailMap = Object.fromEntries(
      (authData?.users ?? []).map((u) => [u.id, u.email ?? ""]),
    );
  }

  const team = (profiles ?? []).map((p) => ({
    ...p,
    email: emailMap[p.id] ?? "",
  }));

  return NextResponse.json({
    team,
    hasServiceRole: hasServiceRole(),
    stats: {
      superAdmin: team.filter((m) => m.role === "SUPER_ADMIN").length,
      admin: team.filter((m) => m.role === "ADMIN").length,
      moderator: team.filter((m) => m.role === "MODERATOR").length,
    },
  });
}

export async function POST(req: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const { email, password, full_name, role } = body as {
    email?: string;
    password?: string;
    full_name?: string;
    role?: string;
  };

  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!role || !ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) {
    return NextResponse.json({ error: "Role must be ADMIN or MODERATOR" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const displayName = full_name?.trim() || normalizedEmail.split("@")[0];

  let userId: string;

  if (hasServiceRole()) {
    const service = createServiceSupabase();
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    });

    if (createErr) {
      return NextResponse.json({ error: createErr.message }, { status: 400 });
    }

    userId = created.user.id;
    await service
      .from("profiles")
      .update({
        role,
        full_name: displayName,
        plan: "ENTERPRISE",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  } else {
    const { data: rpcId, error: rpcErr } = await auth.supabase!.rpc("create_admin_account", {
      admin_email: normalizedEmail,
      admin_password: password,
      admin_name: displayName,
      admin_role: role,
    });

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    }

    userId = rpcId as string;
  }

  await writeAudit(auth.user!.id, "admin_created", userId, {
    email: normalizedEmail,
    role,
    full_name: displayName,
  });

  return NextResponse.json({
    success: true,
    member: {
      id: userId,
      email: normalizedEmail,
      full_name: displayName,
      role,
    },
  });
}

export async function PATCH(req: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const { user_id, role, action, email } = body as {
    user_id?: string;
    role?: string;
    action?: string;
    email?: string;
  };

  const service = createServiceSupabase();

  if (action === "promote_by_email") {
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!role || !ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) {
      return NextResponse.json({ error: "Role must be ADMIN or MODERATOR" }, { status: 400 });
    }

    let targetId = user_id;
    if (!targetId && hasServiceRole()) {
      const { data: authData } = await service.auth.admin.listUsers({ perPage: 1000 });
      const match = authData?.users.find(
        (u) => u.email?.toLowerCase() === email.trim().toLowerCase(),
      );
      targetId = match?.id;
    }

    if (!targetId) {
      return NextResponse.json({ error: "User not found with that email" }, { status: 404 });
    }

    const { data: existing } = await service
      .from("profiles")
      .select("role")
      .eq("id", targetId)
      .single();

    if (existing?.role === "SUPER_ADMIN") {
      return NextResponse.json({ error: "Cannot change super admin role" }, { status: 403 });
    }

    await service
      .from("profiles")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("id", targetId);

    await writeAudit(auth.user!.id, "admin_promoted", targetId, { email: email.trim(), role });

    return NextResponse.json({ success: true, user_id: targetId, role });
  }

  if (action === "reset_password") {
    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }
    if (!hasServiceRole()) {
      return NextResponse.json({ error: "Service role key required" }, { status: 503 });
    }

    const { data: userData } = await service.auth.admin.getUserById(user_id);
    const userEmail = userData.user?.email;
    if (!userEmail) {
      return NextResponse.json({ error: "User email not found" }, { status: 404 });
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { error: resetErr } = await service.auth.resetPasswordForEmail(userEmail, {
      redirectTo: `${origin}/admin/login`,
    });

    if (resetErr) {
      return NextResponse.json({ error: resetErr.message }, { status: 400 });
    }

    await writeAudit(auth.user!.id, "admin_password_reset_sent", user_id, { email: userEmail });
    return NextResponse.json({ success: true });
  }

  if (!user_id || !role) {
    return NextResponse.json({ error: "user_id and role are required" }, { status: 400 });
  }
  if (!ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const { data: target } = await service
    .from("profiles")
    .select("role")
    .eq("id", user_id)
    .single();

  if (target?.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cannot change super admin role" }, { status: 403 });
  }

  await service
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", user_id);

  await writeAudit(auth.user!.id, "admin_role_updated", user_id, { role });

  return NextResponse.json({ success: true, user_id, role });
}

export async function DELETE(req: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { user_id } = await req.json();
  if (!user_id) {
    return NextResponse.json({ error: "user_id is required" }, { status: 400 });
  }

  if (user_id === auth.user!.id) {
    return NextResponse.json({ error: "You cannot demote yourself" }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { data: target } = await service
    .from("profiles")
    .select("role")
    .eq("id", user_id)
    .single();

  if (target?.role === "SUPER_ADMIN") {
    return NextResponse.json({ error: "Cannot demote super admin" }, { status: 403 });
  }

  await service
    .from("profiles")
    .update({ role: "USER", updated_at: new Date().toISOString() })
    .eq("id", user_id);

  await writeAudit(auth.user!.id, "admin_demoted", user_id, {});

  return NextResponse.json({ success: true });
}
