"use client";

import { createClient } from "./client";
import { setAuthNextPath, getOAuthRedirectOrigin } from "./oauth-redirect";

/** Google OAuth for admin — same callback URL as public login (Supabase allowlist). */
export async function signInWithGoogleAdmin() {
  const supabase = createClient();
  setAuthNextPath("/admin");
  const redirectTo = `${getOAuthRedirectOrigin()}/auth/callback`;

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
}
