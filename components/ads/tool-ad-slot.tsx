"use client";

import { HighPerformanceAd } from "@/components/ads/high-performance-ad";
import { TOOL_AD_UNITS, type ToolAdUnitKey } from "@/lib/ads/units";
import { cn } from "@/lib/utils";

export type ToolAdVariant = ToolAdUnitKey;

interface ToolAdSlotProps {
  variant: ToolAdVariant;
  className?: string;
}

const MAX_WIDTH: Partial<Record<ToolAdUnitKey, string>> = {
  sidebar: "max-w-[300px]",
  skyscraper: "max-w-[160px]",
  mobileBottom: "max-w-[320px]",
  bottom: "max-w-[728px]",
};

export function ToolAdSlot({ variant, className }: ToolAdSlotProps) {
  const unit = TOOL_AD_UNITS[variant];

  return (
    <HighPerformanceAd
      adKey={unit.key}
      width={unit.width}
      height={unit.height}
      zone={unit.zone}
      className={cn(MAX_WIDTH[variant], className)}
    />
  );
}
