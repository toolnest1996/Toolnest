import type { ReactNode } from "react";
import type { Tool } from "@/lib/data/types";
import { ToolCard } from "./tool-card";
import { ToolGridInlineAd } from "@/components/ads/tool-grid-inline-ad";

interface ToolGridProps {
  tools: Tool[];
  /** Insert a 728×90 ad after every N tools (0 = off). Default 10 on homepage grids. */
  inlineAdsEvery?: number;
}

export function ToolGrid({ tools, inlineAdsEvery = 10 }: ToolGridProps) {
  if (tools.length === 0) {
    return (
      <p className="py-16 text-center text-muted">No tools found.</p>
    );
  }

  const nodes: ReactNode[] = [];
  let adSlot = 0;

  tools.forEach((tool, i) => {
    nodes.push(<ToolCard key={tool.slug} tool={tool} index={i} />);
    if (inlineAdsEvery > 0 && (i + 1) % inlineAdsEvery === 0 && i < tools.length - 1) {
      nodes.push(<ToolGridInlineAd key={`inline-ad-${adSlot}`} slotIndex={adSlot} />);
      adSlot++;
    }
  });

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-5 lg:gap-4">
      {nodes}
    </div>
  );
}
