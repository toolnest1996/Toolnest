"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

interface Banner {
  id: string;
  message: string;
  type: string;
  link_url: string | null;
}

const colors: Record<string, string> = {
  info: "bg-sky-500/10 border-sky-500/30 text-sky-300",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  error: "bg-rose-500/10 border-rose-500/30 text-rose-300",
};

export function SiteBanner() {
  const [banner, setBanner] = useState<Banner | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/banner")
      .then((r) => r.json())
      .then((d) => { if (d.banner) setBanner(d.banner); })
      .catch(() => {});
  }, []);

  if (!banner || dismissed) return null;

  const content = (
    <p className="text-center text-sm font-medium">{banner.message}</p>
  );

  return (
    <div className={`relative border-b px-4 py-2.5 ${colors[banner.type] || colors.info}`}>
      {banner.link_url ? (
        <Link href={banner.link_url} className="block hover:underline">{content}</Link>
      ) : content}
      <button onClick={() => setDismissed(true)} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
