import Link from "next/link";
import { ArrowUpRight, Flame } from "lucide-react";
import type { Tool } from "@/lib/data/types";
import { categoryMap } from "@/lib/data/categories";
import { Icon } from "@/components/icon";
import { isPopularTool } from "@/lib/data/popular-tools";

const badgeStyles: Record<string, string> = {
  new: "bg-secondary/15 text-secondary",
  ai: "bg-primary/15 text-primary",
  pro: "bg-accent/15 text-accent",
};

export function ToolCard({ tool, index = 0 }: { tool: Tool; index?: number }) {
  const category = categoryMap[tool.category];
  const color = category?.color ?? "#E8231A";
  const popular = isPopularTool(tool.slug);

  return (
    <Link
      href={`/tool/${tool.slug}`}
      className="group relative flex min-h-[176px] flex-col overflow-hidden rounded-2xl border border-border/40 bg-card p-3 transition-all duration-300 [transform-style:preserve-3d] hover:-translate-y-1.5 hover:border-border/20 hover:bg-card-hover animate-fade-up shadow-[0_2px_4px_-1px_rgba(0,0,0,0.06),0_4px_12px_-6px_rgba(0,0,0,0.12),0_0_20px_-12px_color-mix(in_srgb,var(--glow)_45%,transparent)] hover:shadow-[0_4px_8px_-2px_rgba(0,0,0,0.08),0_24px_48px_-12px_rgba(0,0,0,0.22),0_0_32px_-6px_color-mix(in_srgb,var(--glow)_60%,transparent),0_12px_36px_-12px_color-mix(in_srgb,var(--glow)_40%,transparent)] sm:min-h-[196px] sm:p-4 lg:min-h-[216px] lg:p-5"
      style={
        {
          animationDelay: `${Math.min(index * 30, 400)}ms`,
          "--glow": color,
        } as React.CSSProperties
      }
    >
      {/* Subtle top highlight (light from above for 3D feel) */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3 opacity-60 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06), transparent)",
        }}
        aria-hidden
      />
      {/* Category color hairline at top (appears on hover) */}
      <div
        className="absolute inset-x-0 -top-px h-px opacity-0 transition-opacity group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      {/* Radial color halo on hover */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${color}22, transparent 70%)`,
        }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110 sm:h-10 sm:w-10 lg:h-11 lg:w-11"
          style={{ backgroundColor: `${color}1f`, color }}
        >
          <Icon name={category?.icon ?? "Wrench"} className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
        <div className="flex items-center gap-1 sm:gap-2">
          {popular && (
            <span
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-500 sm:px-2 sm:text-[10px]"
              title="Top searched tool"
            >
              <Flame className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              Popular
            </span>
          )}
          {tool.badge && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase sm:px-2 sm:text-[10px] ${badgeStyles[tool.badge]}`}
            >
              {tool.badge}
            </span>
          )}
          {tool.live && (
            <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-success sm:px-2 sm:text-[10px]">
              Live
            </span>
          )}
        </div>
      </div>

      <h3 className="relative mt-3 flex items-center gap-1 font-display text-xs font-semibold leading-tight sm:mt-4 sm:text-sm lg:text-base">
        <span className="line-clamp-2">{tool.name}</span>
        <ArrowUpRight className="h-3.5 w-3.5 -translate-x-1 shrink-0 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 sm:h-4 sm:w-4" />
      </h3>
      <p className="relative mt-1 line-clamp-2 text-[11px] text-muted sm:text-xs lg:text-sm">{tool.description}</p>

      <div className="relative mt-auto flex items-center justify-between pt-3 text-[10px] text-muted sm:pt-4 sm:text-[11px] lg:text-xs">
        <span className="flex items-center gap-1.5 truncate">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <span className="truncate">{category?.name ?? "Tool"}</span>
        </span>
        <span className="flex items-center gap-0.5 font-medium text-muted transition-colors group-hover:text-foreground">
          Open
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 sm:h-3.5 sm:w-3.5" />
        </span>
      </div>
    </Link>
  );
}
