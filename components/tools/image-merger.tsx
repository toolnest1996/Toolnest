"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDrop, Field, inputClass } from "./shared";
import { downloadBlob } from "@/lib/utils";

export function ImageMerger() {
  const [files, setFiles] = useState<File[]>([]);
  const [direction, setDirection] = useState<"vertical" | "horizontal">("vertical");
  const [gap, setGap] = useState(0);
  const [url, setUrl] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (files.length < 1) {
      setUrl("");
      return;
    }
    let cancelled = false;
    (async () => {
      const bitmaps = await Promise.all(files.map((f) => createImageBitmap(f)));
      if (cancelled) return;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;

      if (direction === "vertical") {
        const w = Math.max(...bitmaps.map((b) => b.width));
        const h = bitmaps.reduce((s, b) => s + b.height, 0) + gap * (bitmaps.length - 1);
        canvas.width = w;
        canvas.height = h;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        let y = 0;
        for (const b of bitmaps) {
          ctx.drawImage(b, (w - b.width) / 2, y);
          y += b.height + gap;
        }
      } else {
        const h = Math.max(...bitmaps.map((b) => b.height));
        const w = bitmaps.reduce((s, b) => s + b.width, 0) + gap * (bitmaps.length - 1);
        canvas.width = w;
        canvas.height = h;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        let x = 0;
        for (const b of bitmaps) {
          ctx.drawImage(b, x, (h - b.height) / 2);
          x += b.width + gap;
        }
      }
      canvas.toBlob((blob) => {
        if (blob && !cancelled) {
          setUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
        }
      }, "image/png");
    })();
    return () => {
      cancelled = true;
    };
  }, [files, direction, gap]);

  const download = () => {
    canvasRef.current?.toBlob((b) => b && downloadBlob(b, "merged.png"), "image/png");
  };

  return (
    <div className="space-y-6">
      <FileDrop files={files} onFiles={setFiles} accept="image/*" multiple hint="Add 2 or more images." />
      <canvas ref={canvasRef} className="hidden" />

      {files.length >= 2 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Direction">
              <select value={direction} onChange={(e) => setDirection(e.target.value as "vertical" | "horizontal")} className={inputClass()}>
                <option value="vertical">Vertical (stack)</option>
                <option value="horizontal">Horizontal (side by side)</option>
              </select>
            </Field>
            <Field label={`Gap: ${gap}px`}>
              <input type="range" min={0} max={100} value={gap} onChange={(e) => setGap(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
            </Field>
          </div>
          {url && (
            <div className="rounded-2xl border border-border bg-card p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Merged preview" className="mx-auto max-h-[420px] object-contain" />
            </div>
          )}
          <Button variant="gradient" onClick={download}>
            <Download className="h-4 w-4" /> Download PNG
          </Button>
        </>
      )}
    </div>
  );
}
