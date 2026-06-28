"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { FileDrop } from "./shared";
import { downloadBlob } from "@/lib/utils";

const SIZES = [16, 32, 48, 64, 128, 180, 192, 512];

export function FaviconGenerator() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ size: number; url: string }[]>([]);

  const handleFiles = async (next: File[]) => {
    setFiles(next);
    setPreviews([]);
    if (next.length === 0) return;
    const bitmap = await createImageBitmap(next[0]);
    const out: { size: number; url: string }[] = [];
    for (const size of SIZES) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, size, size);
      out.push({ size, url: canvas.toDataURL("image/png") });
    }
    setPreviews(out);
  };

  const download = (size: number, url: string) => {
    fetch(url)
      .then((r) => r.blob())
      .then((b) => downloadBlob(b, `favicon-${size}x${size}.png`));
  };

  return (
    <div className="space-y-6">
      <FileDrop
        files={files}
        onFiles={handleFiles}
        accept="image/*"
        hint="Use a square image (PNG/JPG) for best results."
      />

      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {previews.map((p) => (
            <div
              key={p.size}
              className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`${p.size}px favicon`}
                width={Math.min(p.size, 64)}
                height={Math.min(p.size, 64)}
                className="rounded"
              />
              <span className="text-xs text-muted">
                {p.size}×{p.size}
              </span>
              <button
                onClick={() => download(p.size, p.url)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> PNG
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
