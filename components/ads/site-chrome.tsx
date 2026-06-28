"use client";

import { SiteAdSlot } from "@/components/ads/site-ad-slot";
import { cn } from "@/lib/utils";

/** 728×90 leaderboard above the site footer. */
export function SiteFooterLeaderboard({ className }: { className?: string }) {
  return (
    <div className={cn("mx-auto mb-6 mt-10 max-w-[728px] px-4 sm:px-6 lg:px-8", className)}>
      <SiteAdSlot variant="footerLeaderboard" />
    </div>
  );
}
