"use client";

import { HighPerformanceAd } from "@/components/ads/high-performance-ad";
import { SITE_AD_UNITS, type SiteAdUnitKey } from "@/lib/ads/units";
import { cn } from "@/lib/utils";

interface SiteAdSlotProps {
  variant: SiteAdUnitKey;
  className?: string;
  /** Distinguish multiple inline units on one page (for analytics). */
  slotIndex?: number;
}

const MAX_WIDTH: Record<SiteAdUnitKey, string> = {
  sidebar: "max-w-[300px]",
  inlineLeaderboard: "max-w-[728px]",
  footerLeaderboard: "max-w-[728px]",
};

export function SiteAdSlot({ variant, className, slotIndex }: SiteAdSlotProps) {
  const unit = SITE_AD_UNITS[variant];

  return (
    <HighPerformanceAd
      adKey={unit.key}
      width={unit.width}
      height={unit.height}
      zone={slotIndex !== undefined ? `${unit.zone}_${slotIndex}` : unit.zone}
      className={cn(MAX_WIDTH[variant], className)}
    />
  );
}
