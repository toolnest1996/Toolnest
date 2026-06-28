"use client";

import { useRef, useState } from "react";
import { Copy, Check } from "lucide-react";
import { FileDrop } from "./shared";

export function ColorPicker() {
  const [files, setFiles] = useState<File[]>([]);
  const [src, setSrc] = useState("");
  const [picked, setPicked] = useState<{ hex: string; rgb: string } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [copied, setCopied] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const loadFiles = async (next: File[]) => {
    setFiles(next);
    setPicked(null);
    setHistory([]);
    if (next.length === 0) {
      setSrc("");
      return;
    }
    const bmp = await createImageBitmap(next[0]);
    const canvas = canvasRef.current!;
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0);
    setSrc(canvas.toDataURL());
  };

  const onClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);
    const [r, g, b] = canvas.getContext("2d")!.getImageData(x, y, 1, 1).data;
    const hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    setPicked({ hex, rgb: `rgb(${r}, ${g}, ${b})` });
    setHistory((h) => [hex, ...h.filter((c) => c !== hex)].slice(0, 10));
  };

  const copy = async (val: string) => {
    await navigator.clipboard.writeText(val);
    setCopied(val);
    setTimeout(() => setCopied(""), 1200);
  };

  return (
    <div className="space-y-6">
      <canvas ref={canvasRef} className="hidden" />
      {!src ? (
        <FileDrop files={files} onFiles={loadFiles} accept="image/*" hint="Click anywhere on the image to pick a color." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Pick a color"
            onClick={onClick}
            className="max-h-[520px] w-full cursor-crosshair rounded-2xl border border-border object-contain"
          />
          <div className="space-y-4">
            {picked && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div
                  className="mb-3 h-20 rounded-lg border border-border"
                  style={{ backgroundColor: picked.hex }}
                />
                {[picked.hex, picked.rgb].map((val) => (
                  <button
                    key={val}
                    onClick={() => copy(val)}
                    className="mb-2 flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 font-mono text-sm hover:bg-card-hover"
                  >
                    {val}
                    {copied === val ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted" />
                    )}
                  </button>
                ))}
              </div>
            )}
            {history.length > 0 && (
              <div>
                <span className="mb-2 block text-sm font-medium">Recent</span>
                <div className="flex flex-wrap gap-2">
                  {history.map((c) => (
                    <button
                      key={c}
                      onClick={() => copy(c)}
                      title={c}
                      className="h-8 w-8 rounded-md border border-border"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => loadFiles([])}
              className="text-sm text-muted hover:text-foreground"
            >
              Choose another image
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
