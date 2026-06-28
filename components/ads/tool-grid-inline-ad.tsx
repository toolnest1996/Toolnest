"use client";

import { SiteAdSlot } from "@/components/ads/site-ad-slot";

/** Full-width 728×90 row inside the tool card grid (every 10 tools). */
export function ToolGridInlineAd({ slotIndex }: { slotIndex: number }) {
  return (
    <div className="col-span-3 flex justify-center py-3 lg:col-span-5">
      <SiteAdSlot variant="inlineLeaderboard" slotIndex={slotIndex} />
    </div>
  );
}
