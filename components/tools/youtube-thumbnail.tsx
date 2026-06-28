"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { downloadBlob } from "@/lib/utils";

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

const qualities = ["maxresdefault", "sddefault", "hqdefault", "mqdefault", "default"] as const;

export function YoutubeThumbnail() {
  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);

  const fetchThumb = () => setVideoId(extractVideoId(url.trim()));

  const download = async (quality: string) => {
    if (!videoId) return;
    const imgUrl = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
    const res = await fetch(imgUrl);
    const blob = await res.blob();
    downloadBlob(blob, `youtube-${videoId}-${quality}.jpg`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Field label="YouTube URL">
        <input value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass()} placeholder="https://youtube.com/watch?v=..." />
      </Field>
      <Button variant="gradient" onClick={fetchThumb}>Get Thumbnails</Button>
      {videoId && (
        <div className="grid gap-4 sm:grid-cols-2">
          {qualities.map((q) => (
            <div key={q} className="overflow-hidden rounded-xl border border-border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`https://img.youtube.com/vi/${videoId}/${q}.jpg`} alt={q} className="aspect-video w-full object-cover" />
              <div className="flex items-center justify-between p-3">
                <span className="text-xs font-medium uppercase">{q}</span>
                <button onClick={() => download(q)} className="text-primary hover:underline text-xs flex items-center gap-1">
                  <Download className="h-3 w-3" /> Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
