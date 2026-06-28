"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  ToggleLeft,
  ToggleRight,
  Download,
  RefreshCw,
  ExternalLink,
  LayoutGrid,
  List,
  Zap,
  Filter,
  ChevronUp,
  ChevronDown,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { categories as allCategories } from "@/lib/data/categories";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";

interface CategoryConfig {
  enabled: boolean;
  order_index: number | null;
}

interface CategoryStats {
  total: number;
  enabled: number;
  disabled: number;
  totalTools: number;
  uses7d: number;
  uses30d: number;
}

type ViewMode = "table" | "grid";
type SortKey = "name" | "tools" | "usage7d" | "order";
type FilterStatus = "all" | "enabled" | "disabled";

export default function AdminCategoriesPage() {
  const [configs, setConfigs] = useState<Record<string, CategoryConfig>>({});
  const [toolsPerCategory, setToolsPerCategory] = useState<Record<string, number>>({});
  const [enabledToolsPerCategory, setEnabledToolsPerCategory] = useState<Record<string, number>>({});
  const [liveToolsPerCategory, setLiveToolsPerCategory] = useState<Record<string, number>>({});
  const [usage7d, setUsage7d] = useState<Record<string, number>>({});
  const [usage30d, setUsage30d] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<CategoryStats | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FilterStatus>("all");
  const [view, setView] = useState<ViewMode>("table");
  const [sortKey, setSortKey] = useState<SortKey>("order");
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/categories");
    if (!res.ok) {
      toast.error("Failed to load categories data");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setConfigs(data.configs ?? {});
    setToolsPerCategory(data.toolsPerCategory ?? {});
    setEnabledToolsPerCategory(data.enabledToolsPerCategory ?? {});
    setLiveToolsPerCategory(data.liveToolsPerCategory ?? {});
    setUsage7d(data.usage7d ?? {});
    setUsage30d(data.usage30d ?? {});
    setStats(data.stats ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error || "Update failed");
      return null;
    }
    return data;
  };

  const toggle = async (slug: string) => {
    const prev = configs[slug]?.enabled !== false;
    setConfigs((c) => ({
      ...c,
      [slug]: { ...c[slug], enabled: !prev, order_index: c[slug]?.order_index ?? null },
    }));
    const result = await patch({ action: "toggle", slug });
    if (!result) {
      setConfigs((c) => ({ ...c, [slug]: { ...c[slug], enabled: prev } }));
    } else {
      toast.success(result.enabled ? "Category enabled" : "Category disabled");
      load();
    }
  };

  const bulkAction = async (action: "bulk_enable" | "bulk_disable", slugs: string[]) => {
    if (!slugs.length) return;
    const result = await patch({ action, slugs });
    if (result) {
      toast.success(`${slugs.length} categories updated`);
      load();
      setSelected(new Set());
    }
  };

  const setOrder = async (slug: string, order_index: number) => {
    const result = await patch({ action: "set_order", slug, order_index });
    if (result) {
      setConfigs((c) => ({
        ...c,
        [slug]: { ...c[slug], enabled: c[slug]?.enabled !== false, order_index },
      }));
    }
  };

  const filtered = useMemo(() => {
    let list = allCategories.filter((c) => {
      const enabled = configs[c.slug]?.enabled !== false;
      if (status === "enabled" && !enabled) return false;
      if (status === "disabled" && enabled) return false;
      if (
        search &&
        !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !c.slug.includes(search.toLowerCase()) &&
        !c.description.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "tools") cmp = (toolsPerCategory[b.slug] || 0) - (toolsPerCategory[a.slug] || 0);
      else if (sortKey === "usage7d") cmp = (usage7d[b.slug] || 0) - (usage7d[a.slug] || 0);
      else cmp = (configs[a.slug]?.order_index ?? 999) - (configs[b.slug]?.order_index ?? 999);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [status, search, sortKey, sortAsc, configs, toolsPerCategory, usage7d]);

  const exportCsv = () => {
    const header = "slug,name,color,enabled,tools,enabled_tools,live_tools,uses_7d,uses_30d,order\n";
    const rows = filtered
      .map((c) => {
        const enabled = configs[c.slug]?.enabled !== false;
        return [
          c.slug,
          `"${c.name}"`,
          c.color,
          enabled ? "yes" : "no",
          toolsPerCategory[c.slug] || 0,
          enabledToolsPerCategory[c.slug] || 0,
          liveToolsPerCategory[c.slug] || 0,
          usage7d[c.slug] || 0,
          usage30d[c.slug] || 0,
          configs[c.slug]?.order_index ?? "",
        ].join(",");
      })
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "categories-export.csv";
    a.click();
    toast.success("CSV exported");
  };

  const copySlug = (slug: string) => {
    navigator.clipboard.writeText(slug);
    setCopied(slug);
    setTimeout(() => setCopied(null), 1500);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((s) => !s);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      sortAsc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
    ) : null;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E8231A] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs text-slate-500">Manage / Categories</p>
          <h1 className="font-display text-2xl font-bold text-white">Advanced Categories Manager</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enable/disable categories, sort order, tool counts & usage analytics
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={busy}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              const r = await patch({ action: "enable_all" });
              if (r) {
                toast.success(`${r.count} categories enabled`);
                load();
              }
            }}
          >
            <Zap className="h-4 w-4" /> Enable All
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { label: "Total", value: stats.total, color: "text-white" },
            { label: "Enabled", value: stats.enabled, color: "text-emerald-400" },
            { label: "Disabled", value: stats.disabled, color: "text-rose-400" },
            { label: "Total Tools", value: stats.totalTools, color: "text-sky-400" },
            { label: "Uses (7d)", value: stats.uses7d, color: "text-violet-400" },
            { label: "Uses (30d)", value: stats.uses30d, color: "text-violet-300" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-center"
            >
              <p className={`font-display text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, slug or description..."
            className="h-10 w-full rounded-lg border border-slate-800 bg-slate-950 pl-10 pr-4 text-sm text-white outline-none focus:border-[#E8231A]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FilterStatus)}
            className="h-10 rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-white outline-none"
          >
            <option value="all">All status</option>
            <option value="enabled">Enabled only</option>
            <option value="disabled">Disabled only</option>
          </select>
          <div className="flex rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setView("table")}
              className={`px-3 py-2 ${view === "table" ? "bg-slate-800 text-white" : "text-slate-400"}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`px-3 py-2 ${view === "grid" ? "bg-slate-800 text-white" : "text-slate-400"}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#E8231A]/30 bg-[#E8231A]/10 px-4 py-3">
          <span className="text-sm text-white">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkAction("bulk_enable", [...selected])}>
            Enable selected
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkAction("bulk_disable", [...selected])}>
            Disable selected
          </Button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-xs text-slate-400 hover:text-white">
            Clear
          </button>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Showing {filtered.length} of {allCategories.length} categories
      </p>

      {view === "table" ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                <th className="w-8 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(filtered.map((c) => c.slug)) : new Set())
                    }
                  />
                </th>
                <th className="px-4 py-3 font-medium">
                  <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("name")}>
                    Category <SortIcon col="name" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">
                  <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("tools")}>
                    Tools <SortIcon col="tools" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("usage7d")}>
                    Usage 7d <SortIcon col="usage7d" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button type="button" className="flex items-center gap-1" onClick={() => toggleSort("order")}>
                    Order <SortIcon col="order" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const enabled = configs[c.slug]?.enabled !== false;
                const uses = usage7d[c.slug] || 0;
                const toolCount = toolsPerCategory[c.slug] || 0;
                const enabledTools = enabledToolsPerCategory[c.slug] || 0;
                const liveTools = liveToolsPerCategory[c.slug] || 0;
                return (
                  <tr
                    key={c.slug}
                    className={`border-b border-slate-800/50 last:border-0 ${!enabled ? "opacity-60" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(c.slug)}
                        onChange={(e) => {
                          setSelected((s) => {
                            const next = new Set(s);
                            if (e.target.checked) next.add(c.slug);
                            else next.delete(c.slug);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${c.color}22`, color: c.color }}
                        >
                          <Icon name={c.icon} className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-medium text-white">{c.name}</p>
                          <p className="font-mono text-[10px] text-slate-500">{c.slug}</p>
                          <span
                            className="mt-1 inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: c.color }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-slate-400">
                      <p className="line-clamp-2 text-xs">{c.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{toolCount}</p>
                      <p className="text-[10px] text-slate-500">
                        {enabledTools} enabled · {liveTools} live
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={uses > 0 ? "font-medium text-violet-400" : "text-slate-600"}>{uses}</span>
                      <span className="ml-1 text-[10px] text-slate-600">/ {usage30d[c.slug] || 0} (30d)</span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        defaultValue={configs[c.slug]?.order_index ?? ""}
                        onBlur={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!Number.isNaN(v)) setOrder(c.slug, v);
                        }}
                        className="h-8 w-16 rounded border border-slate-700 bg-slate-950 px-2 text-xs text-white outline-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggle(c.slug)}
                          disabled={busy}
                          className={enabled ? "text-emerald-400" : "text-slate-600"}
                          title={enabled ? "Disable" : "Enable"}
                        >
                          {enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                        </button>
                        <Link
                          href={`/category/${c.slug}`}
                          target="_blank"
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                          title="Preview category"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/admin/tools?category=${c.slug}`}
                          className="rounded px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-white"
                          title="Manage tools in category"
                        >
                          Tools
                        </Link>
                        <button
                          type="button"
                          onClick={() => copySlug(c.slug)}
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                          title="Copy slug"
                        >
                          {copied === c.slug ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const enabled = configs[c.slug]?.enabled !== false;
            const toolCount = toolsPerCategory[c.slug] || 0;
            return (
              <div
                key={c.slug}
                className={`rounded-xl border p-4 transition-all ${
                  enabled ? "border-slate-800 bg-slate-900" : "border-slate-800/50 bg-slate-900/50 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${c.color}22`, color: c.color }}
                  >
                    <Icon name={c.icon} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{c.name}</p>
                    <p className="truncate font-mono text-[10px] text-slate-500">{c.slug}</p>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-400">{c.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                      <span className="text-sky-400">{toolCount} tools</span>
                      <span className="text-violet-400">{usage7d[c.slug] || 0} uses (7d)</span>
                      {!enabled && <span className="text-rose-400">Off</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(c.slug)}
                    disabled={busy}
                    className={enabled ? "text-emerald-400" : "text-slate-600"}
                  >
                    {enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
