"use client";

import { createClient } from "./client";
import { getSiteUrl } from "./site-url";
import { setAuthNextPath } from "./oauth-redirect";

const supabase = createClient();

function authCallbackUrl() {
  return `${getSiteUrl()}/auth/callback`;
}

export async function signUp(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: authCallbackUrl(),
    },
  });
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

export async function signInWithGoogle(next = "/dashboard") {
  setAuthNextPath(next);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authCallbackUrl() },
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/** Map Supabase auth errors to clearer login messages. */
export function formatAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("invalid api key")) {
    return "Supabase API key is missing or wrong on this deployment. Set NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel and redeploy.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Wrong email or password. If you signed up with Google, use Continue with Google instead.";
  }

  if (lower.includes("email not confirmed")) {
    return "Please confirm your email first — check your inbox for the activation link.";
  }

  return message;
}
