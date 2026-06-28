"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { AuthButtons } from "./auth-buttons";
import { usePublicCategories } from "@/components/public-categories-provider";
import { usePublicTools } from "@/components/public-tools-provider";
import { Icon } from "@/components/icon";

const navLinks = [
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
];

export function Header() {
  const publicTools = usePublicTools();
  const publicCategories = usePublicCategories();
  const [catOpen, setCatOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo size={36} />

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {/* Categories dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setCatOpen((o) => !o)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-card-hover hover:text-foreground"
            >
              Categories
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${catOpen ? "rotate-180" : ""}`} />
            </button>

            {catOpen && (
              <div className="absolute left-0 top-full mt-2 w-72 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-fade-up">
                <div className="p-2">
                  {publicCategories.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/category/${c.slug}`}
                      onClick={() => setCatOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-card-hover"
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${c.color}1f`, color: c.color }}
                      >
                        <Icon name={c.icon} className="h-4 w-4" />
                      </span>
                      <span className="flex-1">
                        <span className="block font-medium">{c.name}</span>
                        <span className="block text-xs text-muted">
                          {publicTools.filter((t) => t.category === c.slug).length} tools
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-card-hover hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <AuthButtons />
        </div>
      </div>
    </header>
  );
}
