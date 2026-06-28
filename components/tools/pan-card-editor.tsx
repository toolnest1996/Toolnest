"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Check,
  ChevronLeft,
  Crop as CropIcon,
  Download,
  FlipHorizontal2,
  FlipVertical2,
  Grid3x3,
  Loader2,
  Maximize,
  Move,
  RotateCcw,
  RotateCw,
  Sliders,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import {
  cropAndResizeToExact,
  type CropRect,
  type OutputFormat,
} from "./image-compressor-utils";
import {
  compressPdfToTarget,
  type CompressOptions as PdfCompressOptions,
} from "./pdf-compress-utils";
import type { PdfDocument } from "./pdf-merge-utils";

export interface PanTarget {
  pxW: number;
  pxH: number;
  maxKb: number;
  dpi: number;
  label: string;
  hint: string;
  cmW: number;
  cmH: number;
}

export interface PanResult {
  blob: Blob;
  url: string;
  bytes: number;
  w: number;
  h: number;
  format: string;
  hit: boolean;
  attempts: number;
}

interface EditorProps {
  file: File;
  imageUrl: string;
  imageNatural: { w: number; h: number };
  target: PanTarget;
  resizeMode: "original" | "selected-area";
  format: OutputFormat;
  isPdf: boolean;
  pdfDoc: PdfDocument | null;
  onBack: () => void;
  onClear: () => void;
  onResult: (r: PanResult | null) => void;
  result: PanResult | null;
}

type Handle = "draw" | "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
type Rotation = 0 | 90 | 180 | 270;
type PreviewMode = "side" | "slider" | "result";

interface Transform {
  url: string;
  w: number;
  h: number;
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image decode failed"));
    img.src = src;
  });
}

async function bakeTransform(
  sourceUrl: string,
  rotation: Rotation,
  flipH: boolean,
  flipV: boolean,
): Promise<{ url: string; w: number; h: number }> {
  const img = await loadImage(sourceUrl);
  const rotated = rotation === 90 || rotation === 270;
  const w = rotated ? img.naturalHeight : img.naturalWidth;
  const h = rotated ? img.naturalWidth : img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.translate(w / 2, h / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Transform failed"));
        return;
      }
      resolve({ url: URL.createObjectURL(blob), w, h });
    }, "image/png");
  });
}

async function urlToBlob(url: string): Promise<Blob> {
  const r = await fetch(url);
  return r.blob();
}

const HANDLES: { id: Handle; cls: string; cursor: string }[] = [
  { id: "nw", cls: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { id: "n", cls: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "ns-resize" },
  { id: "ne", cls: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "nesw-resize" },
  { id: "e", cls: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
  { id: "se", cls: "right-0 bottom-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
  { id: "s", cls: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "ns-resize" },
  { id: "sw", cls: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
  { id: "w", cls: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

export function PanCardEditor(props: EditorProps) {
  const {
    file,
    imageUrl,
    imageNatural,
    target,
    resizeMode,
    format,
    isPdf,
    pdfDoc,
    onBack,
    onClear,
    onResult,
    result,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<{
    type: Handle;
    startX: number;
    startY: number;
    rect: DOMRect;
    orig: CropRect;
  } | null>(null);
  const transformedUrlRef = useRef<string | null>(null);

  // Editor-only state
  const [transform, setTransform] = useState<Transform>({
    url: imageUrl,
    w: imageNatural.w,
    h: imageNatural.h,
    rotation: 0,
    flipH: false,
    flipV: false,
  });
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [showGrid, setShowGrid] = useState(true);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("side");
  const [sliderPct, setSliderPct] = useState(50);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressInfo, setProgressInfo] = useState("");
  const [error, setError] = useState("");

  // Reset editor state when the source file changes
  useEffect(() => {
    if (transformedUrlRef.current) {
      URL.revokeObjectURL(transformedUrlRef.current);
      transformedUrlRef.current = null;
    }
    setTransform({
      url: imageUrl,
      w: imageNatural.w,
      h: imageNatural.h,
      rotation: 0,
      flipH: false,
      flipV: false,
    });
    setCrop(null);
    setZoom(1);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setBgColor("#ffffff");
    setPreviewMode("side");
    setSliderPct(50);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.name, file.size]);

  useEffect(
    () => () => {
      if (transformedUrlRef.current) URL.revokeObjectURL(transformedUrlRef.current);
    },
    [],
  );

  const aspectRatio = target.pxW > 0 && target.pxH > 0 ? target.pxW / target.pxH : null;
  const targetBytes = target.maxKb * 1024;

  // Display filter (mirrors what processing will apply)
  const displayFilter = useMemo(() => {
    const parts: string[] = [];
    if (brightness !== 100) parts.push(`brightness(${brightness}%)`);
    if (contrast !== 100) parts.push(`contrast(${contrast}%)`);
    if (saturation !== 100) parts.push(`saturate(${saturation}%)`);
    return parts.length > 0 ? parts.join(" ") : "none";
  }, [brightness, contrast, saturation]);

  // Live crop pixel readout (in transformed source pixels)
  const cropPx = useMemo(() => {
    if (!crop || crop.w <= 0 || crop.h <= 0) return null;
    return {
      w: Math.round(crop.w * transform.w),
      h: Math.round(crop.h * transform.h),
      x: Math.round(crop.x * transform.w),
      y: Math.round(crop.y * transform.h),
    };
  }, [crop, transform]);

  /* ── Transform handlers (rotate / flip) ─ */
  const applyTransform = useCallback(
    async (rotation: Rotation, flipH: boolean, flipV: boolean) => {
      if (rotation === 0 && !flipH && !flipV) {
        // Reset to original
        if (transformedUrlRef.current) {
          URL.revokeObjectURL(transformedUrlRef.current);
          transformedUrlRef.current = null;
        }
        setTransform({ url: imageUrl, w: imageNatural.w, h: imageNatural.h, rotation: 0, flipH: false, flipV: false });
        setCrop(null);
        return;
      }
      try {
        const baked = await bakeTransform(imageUrl, rotation, flipH, flipV);
        if (transformedUrlRef.current) URL.revokeObjectURL(transformedUrlRef.current);
        transformedUrlRef.current = baked.url;
        setTransform({ url: baked.url, w: baked.w, h: baked.h, rotation, flipH, flipV });
        setCrop(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Transform failed");
      }
    },
    [imageUrl, imageNatural.w, imageNatural.h],
  );

  const rotate = (dir: "cw" | "ccw") => {
    const cur = transform.rotation;
    const next = (((dir === "cw" ? cur + 90 : cur - 90) % 360) + 360) % 360;
    void applyTransform(next as Rotation, transform.flipH, transform.flipV);
  };
  const flipH = () => void applyTransform(transform.rotation, !transform.flipH, transform.flipV);
  const flipV = () => void applyTransform(transform.rotation, transform.flipH, !transform.flipV);
  const resetTransform = () => void applyTransform(0, false, false);

  /* ── Crop interaction ─ */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>, handle: Handle) => {
    if (resizeMode !== "selected-area" || !containerRef.current) return;
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    interactionRef.current = {
      type: handle,
      startX,
      startY,
      rect,
      orig: crop ?? { x: 0, y: 0, w: 0, h: 0 },
    };
    if (handle === "draw") {
      setCrop({ x: startX / rect.width, y: startY / rect.height, w: 0, h: 0 });
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactionRef.current || !containerRef.current) return;
    const { type, startX, startY, rect, orig } = interactionRef.current;
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    if (type === "draw") {
      const x0 = clamp(startX, 0, rect.width);
      const y0 = clamp(startY, 0, rect.height);
      const x1 = clamp(curX, 0, rect.width);
      const y1 = clamp(curY, 0, rect.height);
      let left = Math.min(x0, x1);
      let top = Math.min(y0, y1);
      let width = Math.abs(x1 - x0);
      let height = Math.abs(y1 - y0);
      if (aspectRatio !== null && width > 0) {
        height = width / aspectRatio;
        if (top + height > rect.height) {
          height = rect.height - top;
          width = height * aspectRatio;
        }
      }
      setCrop({
        x: left / rect.width,
        y: top / rect.height,
        w: width / rect.width,
        h: height / rect.height,
      });
      return;
    }

    if (type === "move") {
      const dx = (curX - startX) / rect.width;
      const dy = (curY - startY) / rect.height;
      const x = clamp(orig.x + dx, 0, 1 - orig.w);
      const y = clamp(orig.y + dy, 0, 1 - orig.h);
      setCrop({ ...orig, x, y });
      return;
    }

    // Resize handles
    const dx = (curX - startX) / rect.width;
    const dy = (curY - startY) / rect.height;
    let x = orig.x;
    let y = orig.y;
    let w = orig.w;
    let h = orig.h;

    if (type.includes("e")) w = clamp(orig.w + dx, 0.01, 1 - orig.x);
    if (type.includes("s")) h = clamp(orig.h + dy, 0.01, 1 - orig.y);
    if (type.includes("w")) {
      const nx = clamp(orig.x + dx, 0, orig.x + orig.w - 0.01);
      w = orig.w + (orig.x - nx);
      x = nx;
    }
    if (type.includes("n")) {
      const ny = clamp(orig.y + dy, 0, orig.y + orig.h - 0.01);
      h = orig.h + (orig.y - ny);
      y = ny;
    }

    // Aspect-ratio lock for non-edge handles (corners) and edge handles
    if (aspectRatio !== null) {
      if (type === "e" || type === "w") {
        const newH = w / aspectRatio;
        const cy = orig.y + orig.h / 2;
        y = clamp(cy - newH / 2, 0, 1 - newH);
        h = newH;
        if (y + h > 1) h = 1 - y;
      } else if (type === "n" || type === "s") {
        const newW = h * aspectRatio;
        const cx = orig.x + orig.w / 2;
        x = clamp(cx - newW / 2, 0, 1 - newW);
        w = newW;
        if (x + w > 1) w = 1 - x;
      } else {
        // corner — drive by dominant axis
        if (w / aspectRatio <= h) {
          h = w / aspectRatio;
        } else {
          w = h * aspectRatio;
        }
      }
    }

    setCrop({ x, y, w, h });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionRef.current) {
      interactionRef.current = null;
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  };

  const centerCrop = () => {
    if (aspectRatio === null) return;
    const w = Math.min(0.8, aspectRatio * 0.8 / (transform.w / transform.h));
    const h = w / aspectRatio;
    setCrop({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
  };

  const resetCrop = () => setCrop(null);

  const resetAdjust = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
  };

  /* ── Keyboard nudge ─ */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!crop) return;
    const step = e.shiftKey ? 0.01 : 0.002;
    let { x, y, w, h } = crop;
    if (e.key === "ArrowLeft") x = clamp(x - step, 0, 1 - w);
    else if (e.key === "ArrowRight") x = clamp(x + step, 0, 1 - w);
    else if (e.key === "ArrowUp") y = clamp(y - step, 0, 1 - h);
    else if (e.key === "ArrowDown") y = clamp(y + step, 0, 1 - h);
    else return;
    e.preventDefault();
    setCrop({ ...crop, x, y });
  };

  /* ── Zoom helpers ─ */
  const setZoomClamped = (z: number) => setZoom(clamp(Number(z.toFixed(2)), 0.1, 5));
  const zoomIn = () => setZoomClamped(zoom + 0.1);
  const zoomOut = () => setZoomClamped(zoom - 0.1);
  const zoomFit = () => setZoom(1);
  const zoom100 = () => setZoom(1);

  /* ── Process ─ */
  const process = useCallback(async () => {
    setError("");
    setBusy(true);
    setProgress(0);
    setProgressInfo("");
    onResult(null);
    try {
      if (isPdf && pdfDoc) {
        const base: PdfCompressOptions = {
          level: "custom",
          jpegQuality: 0.72,
          dpi: target.dpi,
          stripMetadata: true,
          grayscale: false,
          useObjectStreams: true,
          outputPassword: "",
        };
        const { result: res, hit, attempts } = await compressPdfToTarget(
          pdfDoc.bytes,
          targetBytes,
          base,
          (pct, att, info) => {
            setProgress(pct);
            setProgressInfo(`${info} (attempt ${att})`);
          },
        );
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const r: PanResult = {
          blob,
          url,
          bytes: res.compressedBytes,
          w: 0,
          h: 0,
          format: "application/pdf",
          hit,
          attempts,
        };
        onResult(r);
        const stem = file.name.replace(/\.pdf$/i, "");
        downloadBlob(blob, `${stem}-pan.pdf`);
        toast.success(
          hit
            ? `Hit target · ${formatBytes(res.compressedBytes)} (−${res.savingsPercent}%, ${attempts} passes)`
            : `Closest match · ${formatBytes(res.compressedBytes)}`,
        );
        return;
      }

      // Image path — use transformed blob if any transform applied, else original file
      const hasTransform = transform.rotation !== 0 || transform.flipH || transform.flipV;
      const source: File | Blob = hasTransform && transformedUrlRef.current
        ? await urlToBlob(transformedUrlRef.current)
        : file;

      const useCrop = resizeMode === "selected-area" && crop && crop.w > 0.005 && crop.h > 0.005 ? crop : null;
      const { result: res, hit, attempts } = await cropAndResizeToExact(
        source,
        useCrop,
        target.pxW,
        target.pxH,
        format,
        targetBytes,
        {
          preserveTransparency: false,
          flattenBackground: bgColor,
          ocrSafe: true,
          brightness,
          contrast,
          saturation,
        },
        (pct, info) => {
          setProgress(pct);
          setProgressInfo(info);
        },
      );
      const r: PanResult = {
        blob: res.blob,
        url: res.previewUrl,
        bytes: res.bytes,
        w: target.pxW,
        h: target.pxH,
        format,
        hit,
        attempts,
      };
      onResult(r);
      const ext = format.split("/")[1]!.replace("jpeg", "jpg");
      const stem = file.name.replace(/\.[a-z0-9]+$/i, "");
      downloadBlob(res.blob, `${stem}-pan.${ext}`);
      toast.success(
        hit
          ? `Hit target · ${formatBytes(res.bytes)} at ${target.pxW}×${target.pxH} (${attempts} passes)`
          : `Closest match · ${formatBytes(res.bytes)} (target ${target.maxKb} KB not reachable at exact size)`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Processing failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(0);
      setProgressInfo("");
    }
  }, [
    isPdf,
    pdfDoc,
    target,
    targetBytes,
    file,
    transform.rotation,
    transform.flipH,
    transform.flipV,
    resizeMode,
    crop,
    format,
    bgColor,
    brightness,
    contrast,
    saturation,
    onResult,
  ]);

  const downloadAgain = () => {
    if (!result) return;
    const stem = file.name.replace(/\.[a-z0-9]+$/i, "");
    const ext = result.format.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    downloadBlob(result.blob, `${stem}-pan.${ext}`);
  };

  /* ── PDF path (no crop UI) ─ */
  if (isPdf && pdfDoc) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 font-medium">
            <CropIcon className="h-4 w-4 text-primary" /> {pdfDoc.name}
          </p>
          <p className="mt-1 text-xs text-muted">
            {pdfDoc.pageCount} pages · {formatBytes(pdfDoc.size)} → target ≤ {target.maxKb} KB · DPI {target.dpi}
          </p>
        </div>

        {result && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <span className="text-muted">Result</span>
              <span className="font-medium text-emerald-500">{formatBytes(result.bytes)}</span>
            </div>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                result.hit ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500",
              )}
            >
              {result.hit ? "✓ On target" : "Closest match"} · {result.attempts} passes
            </span>
            <Button variant="gradient" className="w-full" onClick={downloadAgain}>
              <Download className="h-4 w-4" /> Download again
            </Button>
          </div>
        )}

        {busy && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted">
              <span>Processing… {progressInfo}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="gradient" disabled={busy} onClick={() => void process()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {result ? "Process again" : "Process & Download"}
          </Button>
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>
          <Button variant="outline" onClick={onClear}>
            <X className="h-4 w-4" /> Start over
          </Button>
        </div>

        {error && <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
      </div>
    );
  }

  /* ── Image editor ─ */
  const cropEnabled = resizeMode === "selected-area";
  const handlesForRatio = aspectRatio !== null
    ? HANDLES.filter((h) => h.id.length === 2) // corners only when locked
    : HANDLES;

  return (
    <div className="space-y-4" onKeyDown={onKeyDown} tabIndex={0}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-2">
        <div className="flex items-center gap-1">
          <ToolbarBtn onClick={zoomOut} title="Zoom out (−)">
            <ZoomOut className="h-4 w-4" />
          </ToolbarBtn>
          <span className="w-14 text-center text-xs font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
          <ToolbarBtn onClick={zoomIn} title="Zoom in (+)">
            <ZoomIn className="h-4 w-4" />
          </ToolbarBtn>
          <ToolbarBtn onClick={zoomFit} title="Fit">
            <Maximize className="h-4 w-4" />
          </ToolbarBtn>
        </div>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn onClick={() => rotate("ccw")} title="Rotate 90° CCW (R)">
          <RotateCcw className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={() => rotate("cw")} title="Rotate 90° CW (Shift+R)">
          <RotateCw className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={flipH} title="Flip horizontal (F)">
          <FlipHorizontal2 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={flipV} title="Flip vertical (Shift+F)">
          <FlipVertical2 className="h-4 w-4" />
        </ToolbarBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn onClick={() => setShowGrid((g) => !g)} title="Grid (G)" active={showGrid}>
          <Grid3x3 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={resetTransform} title="Reset transform" disabled={transform.rotation === 0 && !transform.flipH && !transform.flipV}>
          <RotateCcw className="h-4 w-4 opacity-70" />
        </ToolbarBtn>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span className="hidden sm:inline">
            {transform.w}×{transform.h}
            {transform.rotation !== 0 && ` · ${transform.rotation}°`}
            {(transform.flipH || transform.flipV) && " · flipped"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Canvas area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {cropEnabled
                ? "Drag on image to draw crop · drag inside to move · drag handles to resize · arrow keys nudge"
                : "Whole image will be resized to target dimensions."}
            </span>
            {cropPx && (
              <span className="font-medium text-foreground tabular-nums">
                Crop {cropPx.w}×{cropPx.h}px → {target.pxW}×{target.pxH}px
              </span>
            )}
          </div>

          <div
            ref={containerRef}
            onPointerDown={(e) => cropEnabled && onPointerDown(e, "draw")}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className={cn(
              "relative flex items-center justify-center overflow-auto rounded-xl border border-border bg-[repeating-conic-gradient(var(--card)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]",
              cropEnabled ? "touch-none select-none" : "",
              cropEnabled ? (crop ? "cursor-default" : "cursor-crosshair") : "cursor-default",
            )}
            style={{ minHeight: 320, maxHeight: 560 }}
          >
            <div
              className="relative"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center center",
                transition: "transform 120ms ease-out",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={transform.url}
                alt="Source"
                className="block max-h-[540px] max-w-full select-none"
                draggable={false}
                style={{ filter: displayFilter }}
              />

              {/* Crop overlay */}
              {crop && crop.w > 0 && crop.h > 0 && (
                <div
                  className="absolute border-2 border-primary bg-primary/10"
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.w * 100}%`,
                    height: `${crop.h * 100}%`,
                  }}
                  onPointerDown={(e) => onPointerDown(e, "move")}
                >
                  {/* Darken outside via box-shadow trick */}
                  <div
                    className="absolute inset-0"
                    style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}
                    aria-hidden
                  />
                  {/* Rule-of-thirds grid */}
                  {showGrid && (
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
                      <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
                      <div className="absolute top-1/3 left-0 w-full h-px bg-white/40" />
                      <div className="absolute top-2/3 left-0 w-full h-px bg-white/40" />
                    </div>
                  )}
                  {/* Handles */}
                  {handlesForRatio.map((h) => (
                    <div
                      key={h.id}
                      onPointerDown={(e) => onPointerDown(e, h.id)}
                      className={cn(
                        "absolute h-3 w-3 rounded-sm border-2 border-primary bg-white shadow",
                        h.cls,
                      )}
                      style={{ cursor: h.cursor, touchAction: "none" }}
                    />
                  ))}
                  {/* Move icon center */}
                  <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/70">
                    <Move className="h-4 w-4 drop-shadow" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Before / After preview after processing */}
          {result && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <PreviewTab active={previewMode === "side"} onClick={() => setPreviewMode("side")}>Side by side</PreviewTab>
                <PreviewTab active={previewMode === "slider"} onClick={() => setPreviewMode("slider")}>Slider</PreviewTab>
                <PreviewTab active={previewMode === "result"} onClick={() => setPreviewMode("result")}>Result only</PreviewTab>
              </div>

              {previewMode === "side" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <PreviewCard label={`Before · ${formatBytes(file.size)}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="Before" className="max-h-[280px] max-w-full object-contain" />
                  </PreviewCard>
                  <PreviewCard label={`After · ${formatBytes(result.bytes)} · ${result.w}×${result.h}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.url} alt="After" className="max-h-[280px] max-w-full object-contain" />
                  </PreviewCard>
                </div>
              )}

              {previewMode === "slider" && (
                <div
                  className="relative select-none overflow-hidden rounded-xl border border-border bg-[repeating-conic-gradient(var(--card)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
                  style={{ minHeight: 280 }}
                >
                  <div className="relative flex items-center justify-center" style={{ minHeight: 280 }}>
                    {/* eslint-disable-next-line @next/next/no-img-label */}
                    <img src={result.url} alt="After" className="max-h-[280px] max-w-full object-contain" />
                    <div
                      className="absolute inset-0 flex items-center justify-center overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - sliderPct}% 0 0)` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Before" className="max-h-[280px] max-w-full object-contain" />
                    </div>
                    <div
                      className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-primary"
                      style={{ left: `${sliderPct}%` }}
                    >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-7 w-7 rounded-full border-2 border-primary bg-white shadow" />
                    </div>
                    <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">Before</span>
                    <span className="absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-xs text-white">After</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={sliderPct}
                    onChange={(e) => setSliderPct(Number(e.target.value))}
                    className="absolute inset-x-0 bottom-0 h-8 w-full cursor-ew-resize opacity-0"
                    aria-label="Before/after slider"
                  />
                </div>
              )}

              {previewMode === "result" && (
                <PreviewCard label={`Result · ${formatBytes(result.bytes)} · ${result.w}×${result.h}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result.url} alt="Result" className="max-h-[360px] max-w-full object-contain" />
                </PreviewCard>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          {/* Crop panel */}
          {cropEnabled && (
            <SidebarCard icon={<CropIcon className="h-4 w-4" />} title="Crop">
              {aspectRatio !== null && (
                <p className="mb-2 text-xs text-muted">
                  Aspect locked to {target.pxW}:{target.pxH}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label="X (px)">
                  <input
                    type="number"
                    value={cropPx?.x ?? 0}
                    onChange={(e) => {
                      if (!crop) return;
                      const nx = clamp(Number(e.target.value) / transform.w, 0, 1 - crop.w);
                      setCrop({ ...crop, x: nx });
                    }}
                    className={inputClass()}
                    disabled={!crop}
                  />
                </Field>
                <Field label="Y (px)">
                  <input
                    type="number"
                    value={cropPx?.y ?? 0}
                    onChange={(e) => {
                      if (!crop) return;
                      const ny = clamp(Number(e.target.value) / transform.h, 0, 1 - crop.h);
                      setCrop({ ...crop, y: ny });
                    }}
                    className={inputClass()}
                    disabled={!crop}
                  />
                </Field>
                <Field label="W (px)">
                  <input
                    type="number"
                    value={cropPx?.w ?? 0}
                    onChange={(e) => {
                      if (!crop) return;
                      const nw = clamp(Number(e.target.value) / transform.w, 0.01, 1 - crop.x);
                      let nh = crop.h;
                      if (aspectRatio !== null) nh = nw / aspectRatio;
                      setCrop({ ...crop, w: nw, h: nh });
                    }}
                    className={inputClass()}
                    disabled={!crop}
                  />
                </Field>
                <Field label="H (px)">
                  <input
                    type="number"
                    value={cropPx?.h ?? 0}
                    onChange={(e) => {
                      if (!crop) return;
                      const nh = clamp(Number(e.target.value) / transform.h, 0.01, 1 - crop.y);
                      let nw = crop.w;
                      if (aspectRatio !== null) nw = nh * aspectRatio;
                      setCrop({ ...crop, w: nw, h: nh });
                    }}
                    className={inputClass()}
                    disabled={!crop}
                  />
                </Field>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={centerCrop} disabled={aspectRatio === null}>
                  Center
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={resetCrop} disabled={!crop}>
                  Reset crop
                </Button>
              </div>
            </SidebarCard>
          )}

          {/* Adjust panel */}
          <SidebarCard icon={<Sun className="h-4 w-4" />} title="Adjust">
            <SliderRow label="Brightness" value={brightness} min={20} max={200} onChange={setBrightness} />
            <SliderRow label="Contrast" value={contrast} min={20} max={200} onChange={setContrast} />
            <SliderRow label="Saturation" value={saturation} min={0} max={200} onChange={setSaturation} />
            <Button size="sm" variant="outline" className="mt-1 w-full" onClick={resetAdjust} disabled={brightness === 100 && contrast === 100 && saturation === 100}>
              Reset adjust
            </Button>
          </SidebarCard>

          {/* Output panel */}
          <SidebarCard icon={<Sliders className="h-4 w-4" />} title="Output">
            <Field label="Background (for JPG)">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded border border-border bg-card p-1"
                />
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className={cn(inputClass(), "flex-1 font-mono")}
                />
              </div>
            </Field>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-border bg-card px-2.5 py-2">
                <p className="text-muted">Target</p>
                <p className="font-semibold">{target.maxKb} KB</p>
              </div>
              <div className="rounded-lg border border-border bg-card px-2.5 py-2">
                <p className="text-muted">Output</p>
                <p className="font-semibold">{target.pxW}×{target.pxH}</p>
              </div>
            </div>
          </SidebarCard>

          {/* Action panel */}
          <div className="space-y-2 rounded-xl border border-border bg-card p-3">
            <Button variant="gradient" className="w-full" disabled={busy} onClick={() => void process()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {result ? "Process again" : "Process & Download"}
            </Button>
            {result && (
              <Button variant="outline" className="w-full" onClick={downloadAgain}>
                <Download className="h-4 w-4" /> Download again
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={onBack}>
                <ChevronLeft className="h-3.5 w-3.5" /> Back
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={onClear}>
                <X className="h-3.5 w-3.5" /> Start over
              </Button>
            </div>
          </div>

          {result && (
            <div className={cn(
              "rounded-xl border p-3 text-sm",
              result.hit ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5",
            )}>
              <p className={cn("flex items-center gap-2 font-medium", result.hit ? "text-emerald-500" : "text-amber-500")}>
                {result.hit ? <Check className="h-4 w-4" /> : <Sliders className="h-4 w-4" />}
                {result.hit ? "On target" : "Closest match"}
              </p>
              <div className="mt-1.5 space-y-1 text-xs">
                <Row label="Target" value={`${target.maxKb} KB`} />
                <Row label="Result" value={formatBytes(result.bytes)} accent />
                <Row label="Passes" value={String(result.attempts)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {busy && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted">
            <span>Processing… {progressInfo}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {error && <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
    </div>
  );
}

/* ── Small UI helpers ─ */

function ToolbarBtn({
  onClick,
  title,
  children,
  disabled,
  active,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors",
        "hover:bg-card-hover hover:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        active && "bg-primary/15 text-primary",
      )}
    >
      {children}
    </button>
  );
}

function SidebarCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="mb-2.5 flex items-center gap-2 text-sm font-medium">
        <span className="text-primary">{icon}</span>
        {title}
      </p>
      {children}
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-medium tabular-nums">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)]"
      />
    </div>
  );
}

function PreviewTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active ? "bg-primary text-white" : "border border-border bg-card text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function PreviewCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <p className="mb-1.5 text-xs text-muted">{label}</p>
      <div className="flex items-center justify-center rounded-lg bg-[repeating-conic-gradient(var(--card)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-2" style={{ minHeight: 160 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className={cn("font-medium", accent && "text-emerald-500")}>{value}</span>
    </div>
  );
}
