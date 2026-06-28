"use client";

import { useEffect, useRef } from "react";
import { AD_INVOKE_BASE } from "@/lib/ads/units";
import { cn } from "@/lib/utils";

interface HighPerformanceAdProps {
  adKey: string;
  width: number;
  height: number;
  zone?: string;
  className?: string;
}

/**
 * Each unit runs inside its own iframe so `atOptions` does not clash
 * when multiple Adsterra banners load on one page.
 */
export function HighPerformanceAd({ adKey, width, height, zone, className }: HighPerformanceAdProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || loadedRef.current) return;
    loadedRef.current = true;

    const iframe = document.createElement("iframe");
    iframe.title = "Advertisement";
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("loading", "lazy");
    // Same-origin so we can inject markup; omit allow-top-navigation so ads cannot reload parent.
    iframe.setAttribute("sandbox", "allow-scripts allow-popups allow-forms allow-same-origin");
    iframe.referrerPolicy = "no-referrer";
    iframe.style.border = "0";
    iframe.style.width = `${width}px`;
    iframe.style.height = `${height}px`;
    iframe.style.maxWidth = "100%";
    iframe.style.display = "block";
    iframe.style.overflow = "hidden";
    iframe.style.background = "transparent";

    container.appendChild(iframe);

    try {
      const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
      if (!doc) {
        iframe.remove();
        return;
      }

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{overflow:hidden;background:transparent}</style>
</head>
<body>
<script>
  atOptions = {
    'key' : '${adKey}',
    'format' : 'iframe',
    'height' : ${height},
    'width' : ${width},
    'params' : {}
  };
<\/script>
<script src="${AD_INVOKE_BASE}/${adKey}/invoke.js"><\/script>
</body>
</html>`;

      doc.open();
      doc.write(html);
      doc.close();
    } catch {
      iframe.remove();
    }
  }, [adKey, height, width]);

  return (
    <aside
      className={cn("mx-auto flex w-full justify-center overflow-hidden", className)}
      aria-label="Advertisement"
      data-ad-zone={zone}
      data-ad-key={adKey}
    >
      <div
        ref={containerRef}
        className="flex items-center justify-center"
        style={{ width: "100%", maxWidth: width, minHeight: height }}
      />
    </aside>
  );
}
