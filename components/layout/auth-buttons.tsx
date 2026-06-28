"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UserMenu } from "./user-menu";
import type { User } from "@supabase/supabase-js";

export function AuthButtons() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }: { data: { user: User | null } }) => {
      setUser(data.user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: { user: User | null } | null) => {
        setUser(session?.user ?? null);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="h-9 w-20 animate-pulse rounded-lg bg-card" />;
  }

  if (user) {
    return <UserMenu />;
  }

  return (
    <>
      <Link
        href="/login"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary bg-primary/10 px-4 text-sm font-medium text-primary shadow-sm transition-all hover:bg-primary/20 hover:shadow-md"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Login</span>
      </Link>
      <Link
        href="/register"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg gradient-primary px-4 text-sm font-medium text-white shadow-md shadow-primary/20 transition-transform hover:scale-105"
      >
        <UserPlus className="h-4 w-4" />
        <span className="hidden sm:inline">Sign Up</span>
      </Link>
    </>
  );
}
