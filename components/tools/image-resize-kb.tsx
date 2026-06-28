"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Download,
  Eye,
  Gauge,
  Image as ImageIcon,
  Loader2,
  Lock,
  Settings2,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  FORMAT_EXTENSIONS,
  FORMAT_LABELS,
  LOSSY_FORMATS,
  buildOutputName,
  compressImageToTargetExact,
  detectEncodingSupport,
  detectMime,
  isSupportedInput,
  analyzeImage,
  bytesFromSizeInput,
  formatSizeUnit,
  suggestedOutputFormat,
  type CompressOptions,
  type ImageItem,
  type OutputFormat,
} from "./image-compressor-utils";

const SETTINGS_KEY = "toolnest-image-resize-kb-settings";

const PRESETS_KB = [50, 100, 200, 500, 1024];

export function ImageResizeKb() {
  const favorites = useFavorites();
  const slug = "image-resize-kb";

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [item, setItem] = useState<ImageItem | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [targetValue, setTargetValue] = useState(100);
  const [targetUnit, setTargetUnit] = useState<"B" | "KB" | "MB">("KB");
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [preserveTransparency, setPreserveTransparency] = useState(true);
  const [flattenBackground, setFlattenBackground] = useState("#ffffff");
  const [tolerancePct, setTolerancePct] = useState(5);
  const [progress, setProgress] = useState(0);
  const [progressInfo, setProgressInfo] = useState("");

  const cap = useMemo(() => detectEncodingSupport(), []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (typeof s.targetValue === "number") setTargetValue(s.targetValue);
      if (s.targetUnit === "B" || s.targetUnit === "KB" || s.targetUnit === "MB") setTargetUnit(s.targetUnit);
      if (typeof s.format === "string") setFormat(s.format as OutputFormat);
      if (typeof s.preserveTransparency === "boolean") setPreserveTransparency(s.preserveTransparency);
      if (typeof s.flattenBackground === "string") setFlattenBackground(s.flattenBackground);
      if (typeof s.tolerancePct === "number") setTolerancePct(s.tolerancePct);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ targetValue, targetUnit, format, preserveTransparency, flattenBackground, tolerancePct }),
      );
    } catch { /* ignore */ }
  }, [targetValue, targetUnit, format, preserveTransparency, flattenBackground, tolerancePct]);

  useEffect(() => () => {
    if (item) {
      URL.revokeObjectURL(item.thumbUrl);
      item.result?.previewUrl && URL.revokeObjectURL(item.result.previewUrl);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const targetBytes = useMemo(
    () => bytesFromSizeInput(targetValue, targetUnit),
    [targetValue, targetUnit],
  );

  const addFile = useCallback(async (file: File) => {
    if (!isSupportedInput(file)) {
      toast.error(`Unsupported: ${file.name}`);
      return;
    }
    const thumbUrl = URL.createObjectURL(file);
    const next: ImageItem = {
      id: `irk-${Date.now()}`,
      file,
      name: file.name,
      originalBytes: file.size,
      originalMime: detectMime(file),
      outputName: file.name,
      meta: null,
      status: "queued",
      result: null,
      thumbUrl,
    };
    setItem((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.thumbUrl);
        prev.result?.previewUrl && URL.revokeObjectURL(prev.result.previewUrl);
      }
      return next;
    });
    try {
      const { meta } = await analyzeImage(file);
      next.meta = meta;
      setItem({ ...next });
      const suggested = suggestedOutputFormat(next.originalMime, meta.hasAlpha);
      setFormat(suggested);
      if (meta.hasAlpha) setPreserveTransparency(true);
    } catch {
      next.status = "error";
      next.error = "Could not decode this image in your browser";
      setItem({ ...next });
    }
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void addFile(f);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) void addFile(f);
  };

  const runResize = useCallback(
    async (autoDownload: boolean) => {
      if (!item || !item.meta) {
        toast.error("Add an image first");
        return;
      }
      setBusy(true);
      setProgress(0);
      setProgressInfo("");
      try {
        const baseOptions: CompressOptions = {
          mode: "target",
          format,
          quality: 0.78,
          targetBytes,
          targetPasses: 10,
          resize: {
            enabled: false,
            width: 0,
            height: 0,
            unit: "px",
            fit: "none",
            keepRatio: true,
          },
          preserveTransparency,
          stripMetadata: true,
          ocrSafe: false,
          flattenBackground,
        };
        const { result: res, hit: reached, attempts, scale } = await compressImageToTargetExact(
          item.file,
          targetBytes,
          baseOptions,
          (pct, info) => {
            setProgress(pct);
            setProgressInfo(info);
          },
        );
        const updated: ImageItem = {
          ...item,
          result: res,
          status: "done",
        };
        setItem(updated);
        const diffPct = ((res.bytes - targetBytes) / targetBytes) * 100;
        if (autoDownload) {
          downloadBlob(res.blob, buildOutputName(item.name, res.format));
          toast.success(
            reached
              ? `Hit target · ${formatBytes(res.bytes)} (−${res.savingsPercent}%, ${attempts} pass${attempts === 1 ? "" : "es"}, ${Math.round(scale * 100)}% size)`
              : `Closest match · ${formatBytes(res.bytes)} · ${diffPct > 0 ? "+" : ""}${diffPct.toFixed(1)}% vs target`,
          );
        } else {
          toast.success(
            reached
              ? `Ready · ${formatBytes(res.bytes)} on target (${attempts} passes)`
              : `Ready · closest ${formatBytes(res.bytes)}`,
          );
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Resize failed");
      } finally {
        setBusy(false);
        setProgress(0);
        setProgressInfo("");
      }
    },
    [item, format, targetBytes, preserveTransparency, flattenBackground],
  );

  const clearAll = () => {
    if (item) {
      URL.revokeObjectURL(item.thumbUrl);
      item.result?.previewUrl && URL.revokeObjectURL(item.result.previewUrl);
    }
    setItem(null);
  };

  const targetLabel = useMemo(() => {
    const { value, unit } = formatSizeUnit(targetBytes);
    return `${value} ${unit}`;
  }, [targetBytes]);

  const onTarget = (kb: number) => {
    setTargetValue(kb);
    setTargetUnit("KB");
  };

  const isLossy = LOSSY_FORMATS.includes(format);
  const withinTolerance = item?.result
    ? item.result.bytes <= targetBytes * (1 + tolerancePct / 100)
    : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Lock className="h-3.5 w-3.5" /> 100% private · in-browser
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
            <Zap className="h-3.5 w-3.5 text-primary" /> {cap.avif ? "AVIF" : cap.webp ? "WebP" : "JPG"} encoder active
          </span>
          <button
            type="button"
            onClick={() => favorites.toggle(slug)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
              favorites.isFavorite(slug)
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-card hover:bg-card-hover",
            )}
            aria-pressed={favorites.isFavorite(slug)}
          >
            {favorites.isFavorite(slug) ? "Favorited" : "Add favorite"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Original", value: item ? formatBytes(item.originalBytes) : "—", color: "text-violet-400" },
          { label: "Target", value: targetLabel, color: "text-amber-400" },
          { label: "Result", value: item?.result ? formatBytes(item.result.bytes) : "—", color: "text-emerald-500" },
          { label: "Saved", value: item?.result ? `${item.result.savingsPercent}%` : "—", color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className={cn("font-display text-lg font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {!item ? (
        <div
          ref={dropZoneRef}
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all sm:p-14",
            dragging ? "scale-[1.01] border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
          )}
        >
          <UploadCloud className="mb-4 h-14 w-14 text-primary" />
          <p className="font-display text-xl font-semibold">Resize Image to a target file size in KB</p>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Drop an image, paste, or click to browse. JPG · PNG · WebP · AVIF · GIF · BMP · SVG — 100% in-browser.
          </p>
          <Button variant="gradient" type="button" className="mt-5" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            <UploadCloud className="h-4 w-4" /> Add image
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud className="h-4 w-4" /> Replace image
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} className="text-error">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
        </div>
      )}

      {item && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
            <Gauge className="h-3.5 w-3.5" /> Target file size
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Target size">
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={targetValue}
                  onChange={(e) => setTargetValue(Math.max(1, Number(e.target.value)))}
                  className={inputClass()}
                />
                <select
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value as "B" | "KB" | "MB")}
                  className={cn(inputClass(), "w-24")}
                >
                  <option value="B">B</option>
                  <option value="KB">KB</option>
                  <option value="MB">MB</option>
                </select>
              </div>
            </Field>
            <div className="flex flex-wrap gap-2 pb-1">
              {PRESETS_KB.map((kb) => (
                <button
                  key={kb}
                  type="button"
                  onClick={() => onTarget(kb)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                    targetUnit === "KB" && targetValue === kb
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  {kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            The engine runs a binary search on quality to land at or below the target size.
            {isLossy ? " Lossy formats (JPG/WebP/AVIF) hit targets most accurately." : " PNG is lossless — target may not be reachable; engine picks the closest pass."}
          </p>
        </div>
      )}

      {item && (
        <div className="flex flex-wrap gap-2">
          <Button variant="gradient" disabled={busy || !item.meta} onClick={() => void runResize(true)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Resize & Download
          </Button>
          <Button variant="outline" disabled={busy || !item.meta} onClick={() => void runResize(false)}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button variant="outline" onClick={() => setShowSettings((s) => !s)}>
            <Settings2 className="h-4 w-4" /> Settings
          </Button>
        </div>
      )}

      {busy && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted">
            <span>Tuning quality & dimensions… {progressInfo}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {showSettings && item && (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Output format">
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as OutputFormat)}
              className={inputClass()}
            >
              <option value="image/jpeg">JPG — universal, no alpha</option>
              <option value="image/png">PNG — lossless, alpha</option>
              {cap.webp && <option value="image/webp">WebP — modern, alpha</option>}
              {cap.avif && <option value="image/avif">AVIF — best ratio</option>}
            </select>
          </Field>

          <Field label={`Tolerance: ±${tolerancePct}%`}>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={tolerancePct}
              onChange={(e) => setTolerancePct(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
            <p className="mt-1 text-xs text-muted">Acceptance band above target for the “hit” badge.</p>
          </Field>

          {format !== "image/jpeg" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={preserveTransparency}
                onChange={(e) => setPreserveTransparency(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Preserve transparency
            </label>
          )}

          {(format === "image/jpeg" || !preserveTransparency) && (
            <Field label="Background when flattening">
              <input
                type="color"
                value={flattenBackground}
                onChange={(e) => setFlattenBackground(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-card p-1"
              />
            </Field>
          )}
        </div>
      )}

      {item && (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <ImageIcon className="h-4 w-4" /> {item.name}
            </p>
            <p className="text-xs text-muted">
              {item.meta ? `${item.meta.width}×${item.meta.height} · ` : ""}
              {formatBytes(item.originalBytes)}
              {item.meta?.hasAlpha && " · alpha"}
              {item.meta?.mime && ` · ${item.meta.mime.replace("image/", "")}`}
            </p>
            <div className="mt-3 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(var(--card)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.thumbUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-emerald-500">
                Result · {item.result ? formatBytes(item.result.bytes) : "—"}
              </span>
              {item.result && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px]",
                    withinTolerance
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-amber-500/15 text-amber-500",
                  )}
                >
                  {withinTolerance ? "Within target" : "Closest match"}
                </span>
              )}
            </div>
            {item.result ? (
              <>
                <p className="text-xs text-muted">
                  {FORMAT_LABELS[item.result.format]} · {Math.round(item.result.quality * 100)}% quality · −{item.result.savingsPercent}% saved
                </p>
                <div className="mt-3 flex h-40 items-center justify-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(var(--card)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.result.previewUrl} alt="Resized" className="max-h-full max-w-full object-contain" />
                </div>
              </>
            ) : (
              <div className="mt-3 flex h-40 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center text-sm text-muted">
                <Sparkles className="mb-2 h-6 w-6" />
                Click Resize & Download to hit your target.
              </div>
            )}
            {item.status === "error" && (
              <p className="mt-2 text-xs text-error">{item.error}</p>
            )}
          </div>
        </div>
      )}

      {item?.result && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm">
          <span className="text-muted">Target was {targetLabel}</span>
          <span className="text-foreground">→ got {formatBytes(item.result.bytes)}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-xs", withinTolerance ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500")}>
            {withinTolerance ? "✓ On target" : "Closest achievable"}
          </span>
          <Button
            size="sm"
            variant="gradient"
            className="ml-auto"
            onClick={() => downloadBlob(item.result!.blob, buildOutputName(item.name, item.result!.format))}
          >
            <Download className="h-3.5 w-3.5" /> Download .{FORMAT_EXTENSIONS[item.result.format]}
          </Button>
          <Button size="sm" variant="outline" onClick={clearAll}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      )}
    </div>
  );
}
