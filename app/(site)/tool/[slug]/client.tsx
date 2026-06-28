"use client";

import { Suspense, useEffect } from "react";
import { Construction, Loader2 } from "lucide-react";
import { DynamicTool, hasTool } from "@/components/tools/dynamic-tool";
import { isToolImplemented } from "@/lib/data/implementations";
import { useRecent } from "@/lib/store/use-recent";

export function ToolPageClient({ slug, live }: { slug: string; live: boolean }) {
  const addRecent = useRecent((s) => s.add);
  const implemented = isToolImplemented(slug);
  const available = hasTool(slug);

  useEffect(() => {
    if (implemented && live && available) {
      addRecent(slug);
      fetch("/api/tool-usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool_slug: slug }),
      }).catch(() => {});
    }
  }, [slug, live, implemented, available, addRecent]);

  if (!available || !live) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Construction className="mb-4 h-12 w-12 text-muted" />
        <h2 className="font-display text-xl font-bold">Coming Soon</h2>
        <p className="mt-2 max-w-sm text-sm text-muted">
          This tool is under development. Check back soon or try one of our other live tools.
        </p>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <DynamicTool slug={slug} />
    </Suspense>
  );
}
