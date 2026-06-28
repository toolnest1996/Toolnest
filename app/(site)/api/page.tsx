import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, BookOpen, Activity } from "lucide-react";

export const metadata: Metadata = {
  title: "Developer API",
  description: "ToolNest REST API for Enterprise users.",
};

export default function ApiPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold">Developer <span className="text-gradient">API</span></h1>
        <p className="mt-3 text-muted">Integrate ToolNest tools into your apps with our REST API.</p>
      </div>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {[
          { href: "/api/docs", icon: BookOpen, title: "Documentation", desc: "Full API reference and endpoints" },
          { href: "/api/status", icon: Activity, title: "Status", desc: "Real-time API health monitoring" },
          { href: "/dashboard", icon: KeyRound, title: "API Keys", desc: "Generate keys (Enterprise plan)" },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/30">
            <item.icon className="h-8 w-8 text-primary" />
            <h2 className="mt-4 font-display font-bold">{item.title}</h2>
            <p className="mt-1 text-sm text-muted">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
