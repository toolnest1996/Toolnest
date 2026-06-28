import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  clearAuthNextCookieHeader,
  getAuthNextPathFromCookie,
} from "@/lib/supabase/oauth-redirect";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "MODERATOR"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const cookieStore = await cookies();
  const cookieHeader = request.headers.get("cookie");
  const nextFromQuery = searchParams.get("next");
  const next =
    nextFromQuery ??
    getAuthNextPathFromCookie(cookieHeader);

  if (code) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const destination = await resolveRedirect(next, supabase);
      const redirect = NextResponse.redirect(`${origin}${destination}`);

      if (nextFromQuery || cookieHeader?.includes("toolnest_auth_next")) {
        redirect.headers.append("Set-Cookie", clearAuthNextCookieHeader());
      }

      return redirect;
    }
  }

  const loginPath = next === "/admin" ? "/admin/login?error=auth" : "/login?error=auth";
  const fail = NextResponse.redirect(`${origin}${loginPath}`);
  fail.headers.append("Set-Cookie", clearAuthNextCookieHeader());
  return fail;
}

async function resolveRedirect(
  next: string,
  supabase: ReturnType<typeof createServerClient>,
): Promise<string> {
  if (next === "/admin") {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile && ADMIN_ROLES.includes(profile.role)) {
        return "/admin";
      }
    }
    await supabase.auth.signOut();
    return "/admin/login?error=unauthorized";
  }

  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}
