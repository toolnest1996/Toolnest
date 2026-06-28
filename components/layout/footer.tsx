import Link from "next/link";
import { Logo } from "./logo";
import type { Category } from "@/lib/data/types";

export function Footer({ categories }: { categories: Category[] }) {
  return (
    <footer className="mt-24 border-t border-border bg-card/40">
      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo size={56} />
            <p className="mt-4 max-w-xs text-sm text-muted">
              The world&apos;s most powerful all-in-one online tools platform.
              120 tools, one place, zero installs.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Categories</h3>
            <ul className="mt-4 space-y-2">
              {categories.slice(0, 5).map((c) => (
                <li key={c.slug}>
                  <Link href={`/category/${c.slug}`} className="text-sm text-muted transition-colors hover:text-foreground">{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Company</h3>
            <ul className="mt-4 space-y-2">
              {[
                { href: "/about", label: "About" },
                { href: "/blog", label: "Blog" },
                { href: "/pricing", label: "Pricing" },
                { href: "/contact", label: "Contact" },
                { href: "/privacy", label: "Privacy" },
                { href: "/terms", label: "Terms" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted transition-colors hover:text-foreground">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Developers</h3>
            <ul className="mt-4 space-y-2">
              {[
                { href: "/api", label: "API" },
                { href: "/api/docs", label: "API Docs" },
                { href: "/api/status", label: "Status" },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted transition-colors hover:text-foreground">{l.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/admin" className="text-sm text-muted transition-colors hover:text-foreground">Admin Panel</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-sm text-muted">© {new Date().getFullYear()} ToolNest.io — Every Tool. One Place.</p>
          <p className="text-xs text-muted">Built with Next.js, React 19 & Tailwind CSS v4.</p>
        </div>
      </div>
    </footer>
  );
}
