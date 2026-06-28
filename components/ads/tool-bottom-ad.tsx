"use client";

import { useEffect, useState } from "react";
import { ToolAdSlot } from "@/components/ads/tool-ad-slot";

/** Loads only one bottom unit — mobile OR desktop, not both. */
export function ToolBottomAd() {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (isDesktop === null) {
    return <div className="min-h-[50px] lg:min-h-[90px]" aria-hidden />;
  }

  return isDesktop ? (
    <ToolAdSlot variant="bottom" />
  ) : (
    <ToolAdSlot variant="mobileBottom" />
  );
}
