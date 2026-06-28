import { ToolAdSlot } from "@/components/ads/tool-ad-slot";
import { ToolBottomAd } from "@/components/ads/tool-bottom-ad";
import { ToolPageClient } from "@/app/(site)/tool/[slug]/client";
import { ToolSeoSection } from "@/components/tools/tool-seo-section";

interface ToolPageAdsProps {
  slug: string;
  toolName: string;
  live: boolean;
}

/** Tool pages: sticky sidebar (300×250 + 160×600) + bottom leaderboard. */
export function ToolPageAds({ slug, toolName, live }: ToolPageAdsProps) {
  return (
    <>
      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-6">
          <section
            className="rounded-2xl border border-border bg-card p-6 sm:p-8"
            aria-label={`${toolName} tool`}
          >
            <ToolPageClient slug={slug} live={live} />
          </section>

          <ToolBottomAd />
        </div>

        <aside className="hidden lg:block" aria-label="Advertisements">
          <div className="sticky top-20 flex flex-col items-center gap-6">
            <ToolAdSlot variant="sidebar" />
            <ToolAdSlot variant="skyscraper" />
          </div>
        </aside>
      </div>

      <ToolSeoSection slug={slug} />
    </>
  );
}
