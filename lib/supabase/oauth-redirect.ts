const AUTH_NEXT_COOKIE = "toolnest_auth_next";
const AUTH_NEXT_MAX_AGE = 600; // 10 minutes

/** OAuth redirect must match Supabase allowlist (usually localhost:3000). */
export function getOAuthRedirectOrigin() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
}

/** Store post-login path before OAuth (avoids query params in Supabase redirect URL). */
export function setAuthNextPath(path: string) {
  document.cookie = `${AUTH_NEXT_COOKIE}=${encodeURIComponent(path)}; path=/; max-age=${AUTH_NEXT_MAX_AGE}; SameSite=Lax`;
}

export function getAuthNextPathFromCookie(cookieHeader: string | null): string {
  if (!cookieHeader) return "/dashboard";

  const match = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_NEXT_COOKIE}=`));

  if (!match) return "/dashboard";

  const value = match.slice(AUTH_NEXT_COOKIE.length + 1);
  try {
    const path = decodeURIComponent(value);
    if (path.startsWith("/") && !path.startsWith("//")) return path;
  } catch {
    // ignore malformed cookie
  }
  return "/dashboard";
}

export function clearAuthNextCookieHeader(): string {
  return `${AUTH_NEXT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
