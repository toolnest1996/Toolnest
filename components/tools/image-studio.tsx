"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDrop, Field, inputClass } from "./shared";
import { downloadBlob, formatBytes } from "@/lib/utils";

type Fmt = "image/jpeg" | "image/png" | "image/webp";

const SOCIAL_PRESETS: { label: string; w: number; h: number }[] = [
  { label: "Instagram Post", w: 1080, h: 1080 },
  { label: "Instagram Story", w: 1080, h: 1920 },
  { label: "Twitter Header", w: 1500, h: 500 },
  { label: "Facebook Cover", w: 820, h: 312 },
  { label: "LinkedIn Banner", w: 1584, h: 396 },
  { label: "YouTube Thumb", w: 1280, h: 720 },
];

export interface ImageStudioProps {
  lockFormat?: Fmt;
  showSocialPresets?: boolean;
  accept?: string;
  defaultFormat?: Fmt;
}

export function ImageStudio({
  lockFormat,
  showSocialPresets = false,
  accept = "image/*",
  defaultFormat = "image/jpeg",
}: ImageStudioProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [resultUrl, setResultUrl] = useState("");
  const [resultSize, setResultSize] = useState(0);

  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [keepRatio, setKeepRatio] = useState(true);
  const [format, setFormat] = useState<Fmt>(lockFormat ?? defaultFormat);
  const [quality, setQuality] = useState(0.82);
  const [rotate, setRotate] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [watermark, setWatermark] = useState("");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const naturalRef = useRef({ w: 0, h: 0 });

  const loadFiles = async (next: File[]) => {
    setFiles(next);
    setResultUrl("");
    if (next.length === 0) {
      setBitmap(null);
      return;
    }
    const bmp = await createImageBitmap(next[0]);
    naturalRef.current = { w: bmp.width, h: bmp.height };
    setBitmap(bmp);
    setWidth(bmp.width);
    setHeight(bmp.height);
  };

  useEffect(() => {
    if (!bitmap || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const w = width || bitmap.width;
    const h = height || bitmap.height;
    const rotated = rotate === 90 || rotate === 270;
    canvas.width = rotated ? h : w;
    canvas.height = rotated ? w : h;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (format === "image/jpeg") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
    ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
    ctx.restore();

    if (watermark) {
      ctx.save();
      const fontSize = Math.max(16, canvas.width * 0.04);
      ctx.font = `600 ${fontSize}px Inter, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = fontSize / 12;
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      const x = canvas.width - fontSize * 0.6;
      const y = canvas.height - fontSize * 0.6;
      ctx.strokeText(watermark, x, y);
      ctx.fillText(watermark, x, y);
      ctx.restore();
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setResultUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setResultSize(blob.size);
      },
      format,
      quality,
    );
  }, [
    bitmap,
    width,
    height,
    format,
    quality,
    rotate,
    flipH,
    flipV,
    brightness,
    contrast,
    saturate,
    watermark,
  ]);

  const onWidth = (v: number) => {
    setWidth(v);
    if (keepRatio && naturalRef.current.w) {
      setHeight(Math.round((v / naturalRef.current.w) * naturalRef.current.h));
    }
  };
  const onHeight = (v: number) => {
    setHeight(v);
    if (keepRatio && naturalRef.current.h) {
      setWidth(Math.round((v / naturalRef.current.h) * naturalRef.current.w));
    }
  };

  const ext = format.split("/")[1].replace("jpeg", "jpg");
  const download = () => {
    canvasRef.current?.toBlob(
      (blob) => blob && downloadBlob(blob, `toolnest.${ext}`),
      format,
      quality,
    );
  };

  if (!bitmap) {
    return (
      <FileDrop
        files={files}
        onFiles={loadFiles}
        accept={accept}
        hint="Everything is processed locally in your browser."
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
      <div className="space-y-5">
        {showSocialPresets && (
          <div>
            <span className="mb-1.5 block text-sm font-medium">Presets</span>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => {
                    setKeepRatio(false);
                    setWidth(p.w);
                    setHeight(p.h);
                  }}
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs hover:bg-card-hover"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Width (px)">
            <input
              type="number"
              value={width}
              onChange={(e) => onWidth(Number(e.target.value))}
              className={inputClass()}
            />
          </Field>
          <Field label="Height (px)">
            <input
              type="number"
              value={height}
              onChange={(e) => onHeight(Number(e.target.value))}
              className={inputClass()}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={keepRatio}
            onChange={(e) => setKeepRatio(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Keep aspect ratio
        </label>

        {!lockFormat && (
          <Field label="Output format">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as Fmt)}
              className={inputClass()}
            >
              <option value="image/jpeg">JPG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WebP</option>
            </select>
          </Field>
        )}

        {format !== "image/png" && (
          <Field label={`Quality: ${Math.round(quality * 100)}%`}>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.01}
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
          </Field>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium">Rotate & flip</span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setRotate((r) => (r + 90) % 360)}>
              Rotate 90°
            </Button>
            <Button size="sm" variant={flipH ? "default" : "outline"} onClick={() => setFlipH((f) => !f)}>
              Flip H
            </Button>
            <Button size="sm" variant={flipV ? "default" : "outline"} onClick={() => setFlipV((f) => !f)}>
              Flip V
            </Button>
          </div>
        </div>

        <details className="rounded-lg border border-border bg-card p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Adjustments
          </summary>
          <div className="mt-3 space-y-3">
            <Field label={`Brightness: ${brightness}%`}>
              <input type="range" min={0} max={200} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
            </Field>
            <Field label={`Contrast: ${contrast}%`}>
              <input type="range" min={0} max={200} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
            </Field>
            <Field label={`Saturation: ${saturate}%`}>
              <input type="range" min={0} max={200} value={saturate} onChange={(e) => setSaturate(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
            </Field>
            <Field label="Watermark text">
              <input value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="© ToolNest" className={inputClass()} />
            </Field>
          </div>
        </details>

        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <span className="text-muted">Original {formatBytes(files[0]?.size ?? 0)}</span>
          <span className="font-medium text-success">→ {formatBytes(resultSize)}</span>
        </div>

        <div className="flex gap-3">
          <Button variant="gradient" onClick={download} className="flex-1">
            <Download className="h-4 w-4" /> Download .{ext}
          </Button>
          <Button variant="outline" onClick={() => loadFiles([])}>
            Reset
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center rounded-2xl border border-border bg-[repeating-conic-gradient(var(--card)_0%_25%,transparent_0%_50%)] bg-[length:24px_24px] p-4">
        {resultUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resultUrl}
            alt="Result preview"
            className="max-h-[520px] max-w-full rounded-lg object-contain"
          />
        )}
      </div>
    </div>
  );
}
