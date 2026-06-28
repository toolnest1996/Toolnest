"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { categories } from "@/lib/data/categories";
import { usePublicCategories } from "@/components/public-categories-provider";
import { usePublicTools } from "@/components/public-tools-provider";
import { ToolGrid } from "@/components/tool-grid";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { SiteFooterLeaderboard } from "@/components/ads/site-chrome";

interface CategoryOption {
  slug: string;
  name: string;
  count: number;
  color?: string;
  icon?: string;
}

export function Explorer() {
  const allTools = usePublicTools();
  const publicCategories = usePublicCategories();
  const [active, setActive] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [, startTransition] = useTransition();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTools.filter((t) => {
      const matchesCategory = active === "all" || t.category === active;
      const matchesQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [active, query, allTools]);

  // Build the dropdown options with counts (respecting current search query).
  const options = useMemo<CategoryOption[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = (t: { name: string; description: string; slug: string }) =>
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q);

    const allCount = q ? allTools.filter(matches).length : allTools.length;

    const cats: CategoryOption[] = publicCategories.map((c) => {
      const catTools = allTools.filter((t) => t.category === c.slug);
      const count = q ? catTools.filter(matches).length : catTools.length;
      return { slug: c.slug, name: c.name, count, color: c.color, icon: c.icon };
    });

    return [{ slug: "all", name: "All", count: allCount }, ...cats];
  }, [allTools, publicCategories, query]);

  const activeOption = options.find((o) => o.slug === active) ?? options[0];

  const onSearch = (value: string) => {
    startTransition(() => {
      setQuery(value);
    });
  };

  // Close dropdown on outside click / Escape.
  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [dropdownOpen]);

  const selectCategory = (slug: string) => {
    setActive(slug);
    setDropdownOpen(false);
  };

  return (
    <>
      <section id="tools" className="px-4 py-16 sm:px-6 lg:px-8">
      {/* Toolbar: category dropdown (left) + search (right) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Category dropdown */}
        <div ref={dropdownRef} className="relative shrink-0 sm:w-72">
          <button
            type="button"
            onClick={() => setDropdownOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={dropdownOpen}
            className={cn(
              "flex h-12 w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 text-sm font-medium outline-none transition-colors",
              "hover:border-primary/50 focus:border-primary",
              dropdownOpen && "border-primary ring-2 ring-primary/15",
            )}
          >
            <span className="flex items-center gap-2 truncate">
              {activeOption?.icon && activeOption.slug !== "all" && (
                <Icon
                  name={activeOption.icon}
                  className="h-4 w-4 shrink-0"
                  style={activeOption.color ? { color: activeOption.color } : undefined}
                />
              )}
              <span className="truncate">{activeOption?.name ?? "All"}</span>
              {activeOption && (
                <span className="rounded-full bg-border px-1.5 py-0.5 text-[10px] font-semibold text-muted">
                  {activeOption.count}
                </span>
              )}
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-muted transition-transform", dropdownOpen && "rotate-180")}
            />
          </button>

          {dropdownOpen && (
            <div
              role="listbox"
              className="absolute left-0 right-0 z-30 mt-2 max-h-80 overflow-auto rounded-xl border border-border bg-card p-1 shadow-xl shadow-black/10"
            >
              {options.map((o) => {
                const isActive = o.slug === active;
                return (
                  <button
                    key={o.slug}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => selectCategory(o.slug)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-card-hover",
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {o.icon && o.slug !== "all" && (
                        <Icon
                          name={o.icon}
                          className="h-4 w-4 shrink-0"
                          style={o.color ? { color: o.color } : undefined}
                        />
                      )}
                      <span className="truncate">{o.name}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          isActive ? "bg-primary/15 text-primary" : "bg-border text-muted",
                        )}
                      >
                        {o.count}
                      </span>
                      {isActive && <Check className="h-3.5 w-3.5 text-primary" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search tools... (e.g. PDF, compress, QR)"
            className="h-12 w-full rounded-xl border border-border bg-card pl-12 pr-12 text-sm outline-none transition-colors focus:border-primary"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Live result count */}
      {query.trim() && (
        <p className="mt-3 text-sm text-muted animate-fade-up">
          {filtered.length} tool{filtered.length !== 1 ? "s" : ""} found
          {active !== "all" && (
            <> in <span className="font-medium text-foreground">{publicCategories.find(c => c.slug === active)?.name ?? categories.find(c => c.slug === active)?.name}</span></>
          )}
          {" for "}
          <span className="font-medium text-foreground">&ldquo;{query.trim()}&rdquo;</span>
        </p>
      )}

      <div className="mt-8">
        <ToolGrid tools={filtered} inlineAdsEvery={10} />
      </div>
      </section>
      <SiteFooterLeaderboard />
    </>
  );
}
