"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
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
  Minimize,
  Move,
  RotateCcw,
  RotateCw,
  Sliders,
  Sun,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
  Undo2,
  Redo2,
  Crop as CropIcon2,
  Settings2,
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
import type { PanResult, PanTarget } from "./pan-card-editor";

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
type GridType = "none" | "thirds" | "golden" | "diagonal" | "grid4";
type AspectId = "free" | "target" | "1:1" | "4:5" | "5:4" | "3:4" | "4:3" | "2:3" | "3:2" | "16:9" | "9:16";
type QualityMode = "auto" | "manual";

interface Transform {
  url: string;
  w: number;
  h: number;
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
  straighten: number; // -45..45 degrees
}

interface AdjustState {
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number; // sepia 0..100
  tint: number; // hue-rotate -180..180
  blur: number; // px 0..10
  sharpen: number; // 0..100
  vignette: number; // 0..100
  grayscale: number; // 0..100
  invert: number; // 0..100
}

const DEFAULT_ADJUST: AdjustState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  warmth: 0,
  tint: 0,
  blur: 0,
  sharpen: 0,
  vignette: 0,
  grayscale: 0,
  invert: 0,
};

const ASPECT_PRESETS: { id: AspectId; label: string; ratio: number | null }[] = [
  { id: "target", label: "Target", ratio: null }, // filled at runtime
  { id: "free", label: "Free", ratio: null },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
  { id: "5:4", label: "5:4", ratio: 5 / 4 },
  { id: "3:4", label: "3:4", ratio: 3 / 4 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
  { id: "2:3", label: "2:3", ratio: 2 / 3 },
  { id: "3:2", label: "3:2", ratio: 3 / 2 },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
];

const ENHANCE_PRESETS: {
  id: string;
  label: string;
  patch: Partial<AdjustState>;
}[] = [
  { id: "auto", label: "Auto fix", patch: { brightness: 105, contrast: 108, saturation: 108, sharpen: 12, vignette: 0 } },
  { id: "id", label: "ID Photo", patch: { brightness: 108, contrast: 112, saturation: 96, sharpen: 18, vignette: 0, warmth: 0 } },
  { id: "brighten", label: "Brighten", patch: { brightness: 118, contrast: 104, saturation: 102, sharpen: 8 } },
  { id: "studio", label: "Studio", patch: { brightness: 104, contrast: 116, saturation: 110, sharpen: 22, vignette: 18 } },
  { id: "vivid", label: "Vivid", patch: { brightness: 102, contrast: 118, saturation: 135, sharpen: 16, vignette: 10 } },
  { id: "bw", label: "B&W", patch: { grayscale: 100, contrast: 112, brightness: 102, sharpen: 14 } },
  { id: "warm", label: "Warm", patch: { warmth: 35, brightness: 103, saturation: 108 } },
  { id: "cool", label: "Cool", patch: { tint: -25, brightness: 103, saturation: 102 } },
];

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

function blobFromCanvas(canvas: HTMLCanvasElement, type = "image/png"): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Transform failed"));
        return;
      }
      resolve(URL.createObjectURL(blob));
    }, type);
  });
}

async function bakeFullTransform(
  sourceUrl: string,
  rotation: Rotation,
  flipH: boolean,
  flipV: boolean,
  straighten: number,
  bg: string,
): Promise<{ url: string; w: number; h: number }> {
  const img = await loadImage(sourceUrl);
  const rotated = rotation === 90 || rotation === 270;
  const baseW = rotated ? img.naturalHeight : img.naturalWidth;
  const baseH = rotated ? img.naturalWidth : img.naturalHeight;

  if (straighten === 0) {
    const canvas = document.createElement("canvas");
    canvas.width = baseW;
    canvas.height = baseH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.translate(baseW / 2, baseH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const url = await blobFromCanvas(canvas);
    return { url, w: baseW, h: baseH };
  }

  const rad = (straighten * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const newW = Math.ceil(baseW * cos + baseH * sin);
  const newH = Math.ceil(baseW * sin + baseH * cos);
  const canvas = document.createElement("canvas");
  canvas.width = newW;
  canvas.height = newH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, newW, newH);
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad); // straighten (applied last)
  ctx.rotate((rotation * Math.PI) / 180); // 90° rotation
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  const url = await blobFromCanvas(canvas);
  return { url, w: newW, h: newH };
}

async function urlToBlob(url: string): Promise<Blob> {
  const r = await fetch(url);
  return r.blob();
}

function buildFilterCss(a: AdjustState): string {
  const parts: string[] = [];
  if (a.brightness !== 100) parts.push(`brightness(${a.brightness}%)`);
  if (a.contrast !== 100) parts.push(`contrast(${a.contrast}%)`);
  if (a.saturation !== 100) parts.push(`saturate(${a.saturation}%)`);
  if (a.warmth > 0) parts.push(`sepia(${a.warmth}%)`);
  if (a.grayscale > 0) parts.push(`grayscale(${a.grayscale}%)`);
  if (a.tint !== 0) parts.push(`hue-rotate(${a.tint}deg)`);
  if (a.invert > 0) parts.push(`invert(${a.invert}%)`);
  if (a.blur > 0) parts.push(`blur(${a.blur}px)`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

export function GovPhotoEditor(props: EditorProps) {
  const {
    file,
    imageUrl,
    imageNatural,
    target,
    resizeMode,
    format: initialFormat,
    isPdf,
    pdfDoc,
    onBack,
    onClear,
    onResult,
    result,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const editorRootRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<{
    type: Handle;
    startX: number;
    startY: number;
    rect: DOMRect;
    orig: CropRect;
  } | null>(null);
  const transformedUrlRef = useRef<string | null>(null);

  // Transform
  const [transform, setTransform] = useState<Transform>({
    url: imageUrl,
    w: imageNatural.w,
    h: imageNatural.h,
    rotation: 0,
    flipH: false,
    flipV: false,
    straighten: 0,
  });

  // View
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [gridType, setGridType] = useState<GridType>("thirds");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("side");
  const [sliderPct, setSliderPct] = useState(50);
  const [fullscreen, setFullscreen] = useState(false);

  // Crop
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [aspectId, setAspectId] = useState<AspectId>("target");
  const [snap, setSnap] = useState(true);

  // Adjust
  const [adjust, setAdjust] = useState<AdjustState>(DEFAULT_ADJUST);
  const [bgColor, setBgColor] = useState("#ffffff");

  // Output
  const [outFormat, setOutFormat] = useState<OutputFormat>(initialFormat);
  const [qualityMode, setQualityMode] = useState<QualityMode>("auto");
  const [manualQuality, setManualQuality] = useState(82);
  const [outDpi, setOutDpi] = useState<number>(target.dpi);
  const [outName, setOutName] = useState<string>(file.name.replace(/\.[a-z0-9]+$/i, ""));

  // Process
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressInfo, setProgressInfo] = useState("");
  const [error, setError] = useState("");

  // Undo / Redo stacks for adjust
  const undoStack = useRef<AdjustState[]>([]);
  const redoStack = useRef<AdjustState[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0); // forces render of undo/redo button states

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
      straighten: 0,
    });
    setCrop(null);
    setZoom(1);
    setAdjust(DEFAULT_ADJUST);
    setBgColor("#ffffff");
    setPreviewMode("side");
    setSliderPct(50);
    setOutFormat(initialFormat);
    setQualityMode("auto");
    setManualQuality(82);
    setOutDpi(target.dpi);
    setOutName(file.name.replace(/\.[a-z0-9]+$/i, ""));
    undoStack.current = [];
    redoStack.current = [];
    setHistoryVersion((v) => v + 1);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.name, file.size]);

  useEffect(
    () => () => {
      if (transformedUrlRef.current) URL.revokeObjectURL(transformedUrlRef.current);
    },
    [],
  );

  // Fullscreen sync
  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const targetAspect = target.pxW > 0 && target.pxH > 0 ? target.pxW / target.pxH : null;
  const targetBytes = target.maxKb * 1024;

  const aspectRatio = useMemo<number | null>(() => {
    if (aspectId === "free") return null;
    if (aspectId === "target") return targetAspect;
    const p = ASPECT_PRESETS.find((x) => x.id === aspectId);
    return p?.ratio ?? null;
  }, [aspectId, targetAspect]);

  const displayFilter = useMemo(() => buildFilterCss(adjust), [adjust]);

  const cropPx = useMemo(() => {
    if (!crop || crop.w <= 0 || crop.h <= 0) return null;
    return {
      w: Math.round(crop.w * transform.w),
      h: Math.round(crop.h * transform.h),
      x: Math.round(crop.x * transform.w),
      y: Math.round(crop.y * transform.h),
    };
  }, [crop, transform]);

  /* ── Adjust history ─ */
  const pushAdjust = useCallback((next: AdjustState) => {
    setAdjust((prev) => {
      undoStack.current.push(prev);
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      return next;
    });
    setHistoryVersion((v) => v + 1);
  }, []);

  const updateAdjust = useCallback((patch: Partial<AdjustState>) => {
    setAdjust((prev) => {
      undoStack.current.push(prev);
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      return { ...prev, ...patch };
    });
    setHistoryVersion((v) => v + 1);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    setAdjust((cur) => {
      redoStack.current.push(cur);
      return prev;
    });
    setHistoryVersion((v) => v + 1);
  }, []);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    setAdjust((cur) => {
      undoStack.current.push(cur);
      return next;
    });
    setHistoryVersion((v) => v + 1);
  }, []);

  const canUndo = historyVersion >= 0 && undoStack.current.length > 0;
  const canRedo = redoStack.current.length > 0;

  const applyEnhancePreset = useCallback((id: string) => {
    const p = ENHANCE_PRESETS.find((x) => x.id === id);
    if (!p) return;
    pushAdjust({ ...DEFAULT_ADJUST, ...p.patch });
  }, [pushAdjust]);

  const resetAdjust = useCallback(() => pushAdjust({ ...DEFAULT_ADJUST }), [pushAdjust]);

  /* ── Transform (rotate / flip / straighten) ─ */
  const applyTransform = useCallback(
    async (rotation: Rotation, flipH: boolean, flipV: boolean, straighten: number) => {
      if (rotation === 0 && !flipH && !flipV && straighten === 0) {
        if (transformedUrlRef.current) {
          URL.revokeObjectURL(transformedUrlRef.current);
          transformedUrlRef.current = null;
        }
        setTransform({ url: imageUrl, w: imageNatural.w, h: imageNatural.h, rotation: 0, flipH: false, flipV: false, straighten: 0 });
        setCrop(null);
        return;
      }
      try {
        const baked = await bakeFullTransform(imageUrl, rotation, flipH, flipV, straighten, bgColor);
        if (transformedUrlRef.current) URL.revokeObjectURL(transformedUrlRef.current);
        transformedUrlRef.current = baked.url;
        setTransform({ url: baked.url, w: baked.w, h: baked.h, rotation, flipH, flipV, straighten });
        setCrop(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Transform failed");
      }
    },
    [imageUrl, imageNatural.w, imageNatural.h, bgColor],
  );

  const rotate = (dir: "cw" | "ccw") => {
    const cur = transform.rotation;
    const next = (((dir === "cw" ? cur + 90 : cur - 90) % 360) + 360) % 360;
    void applyTransform(next as Rotation, transform.flipH, transform.flipV, transform.straighten);
  };
  const flipH = () => void applyTransform(transform.rotation, !transform.flipH, transform.flipV, transform.straighten);
  const flipV = () => void applyTransform(transform.rotation, transform.flipH, !transform.flipV, transform.straighten);
  const setStraighten = (deg: number) => void applyTransform(transform.rotation, transform.flipH, transform.flipV, clamp(Math.round(deg), -45, 45));
  const resetTransform = () => void applyTransform(0, false, false, 0);

  const cycleGrid = () => {
    const order: GridType[] = ["none", "thirds", "golden", "diagonal", "grid4"];
    const i = order.indexOf(gridType);
    const next = order[(i + 1) % order.length];
    setGridType(next);
    setShowGrid(next !== "none");
  };

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
    const SNAP = snap ? 0.012 : 0;
    const snapTo = (v: number, target: number) => (Math.abs(v - target) <= SNAP ? target : v);

    if (type === "draw") {
      const x0 = clamp(startX, 0, rect.width);
      const y0 = clamp(startY, 0, rect.height);
      const x1 = clamp(curX, 0, rect.width);
      const y1 = clamp(curY, 0, rect.height);
      let left = Math.min(x0, x1) / rect.width;
      let top = Math.min(y0, y1) / rect.height;
      let width = Math.abs(x1 - x0) / rect.width;
      let height = Math.abs(y1 - y0) / rect.height;
      if (aspectRatio !== null && width > 0) {
        height = width / aspectRatio;
        if (top + height > 1) {
          height = 1 - top;
          width = height * aspectRatio;
        }
      }
      left = snapTo(left, 0);
      top = snapTo(top, 0);
      if (left + width >= 1 - SNAP) width = 1 - left;
      if (top + height >= 1 - SNAP) height = 1 - top;
      setCrop({ x: left, y: top, w: width, h: height });
      return;
    }

    if (type === "move") {
      const dx = (curX - startX) / rect.width;
      const dy = (curY - startY) / rect.height;
      let x = clamp(orig.x + dx, 0, 1 - orig.w);
      let y = clamp(orig.y + dy, 0, 1 - orig.h);
      x = snapTo(x, 0); x = snapTo(x, 1 - orig.w);
      y = snapTo(y, 0); y = snapTo(y, 1 - orig.h);
      setCrop({ ...orig, x, y });
      return;
    }

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
        if (w / aspectRatio <= h) h = w / aspectRatio;
        else w = h * aspectRatio;
      }
    }

    if (snap) {
      x = snapTo(x, 0); y = snapTo(y, 0);
      if (x + w >= 1 - SNAP) w = 1 - x;
      if (y + h >= 1 - SNAP) h = 1 - y;
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
    if (aspectRatio === null) {
      // Center a 80% crop
      const w = 0.8;
      const h = 0.8;
      setCrop({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
      return;
    }
    const imgAr = transform.w / transform.h;
    let w: number, h: number;
    if (aspectRatio >= imgAr) {
      w = 0.92;
      h = w / aspectRatio;
      if (h > 1) { h = 0.92; w = h * aspectRatio; }
    } else {
      h = 0.92;
      w = h * aspectRatio;
      if (w > 1) { w = 0.92; h = w / aspectRatio; }
    }
    setCrop({ x: (1 - w) / 2, y: (1 - h) / 2, w, h });
  };

  const resetCrop = () => setCrop(null);
  const fillCrop = () => setCrop({ x: 0, y: 0, w: 1, h: 1 });

  /* ── Zoom helpers ─ */
  const setZoomClamped = (z: number) => setZoom(clamp(Number(z.toFixed(2)), 0.1, 8));
  const zoomIn = () => setZoomClamped(zoom + 0.1);
  const zoomOut = () => setZoomClamped(zoom - 0.1);
  const zoomFit = () => setZoom(1);
  const zoom100 = () => {
    // Approximate "100%" — fit container to image at zoom=1 already shows actual pixels scaled by CSS.
    // For a more accurate 100% we'd need container dimensions; keep 1.
    setZoom(1);
  };
  const zoom200 = () => setZoom(2);
  const zoom50 = () => setZoom(0.5);

  /* ── Fullscreen ─ */
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      editorRootRef.current?.requestFullscreen?.().catch(() => {
        toast.error("Fullscreen not available in this browser");
      });
    } else {
      void document.exitFullscreen?.();
    }
  };

  /* ── Keyboard shortcuts ─ */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "z" || e.key === "Z") { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if (e.key === "y" || e.key === "Y") { e.preventDefault(); redo(); return; }
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (!crop) return;
      const step = e.shiftKey ? 0.01 : 0.002;
      let { x, y, w, h } = crop;
      if (e.key === "ArrowLeft") x = clamp(x - step, 0, 1 - w);
      else if (e.key === "ArrowRight") x = clamp(x + step, 0, 1 - w);
      else if (e.key === "ArrowUp") y = clamp(y - step, 0, 1 - h);
      else if (e.key === "ArrowDown") y = clamp(y + step, 0, 1 - h);
      e.preventDefault();
      setCrop({ ...crop, x, y });
      return;
    }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomIn(); return; }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomOut(); return; }
    if (e.key === "r" || e.key === "R") { e.preventDefault(); e.shiftKey ? rotate("ccw") : rotate("cw"); return; }
    if (e.key === "f" || e.key === "F") { e.preventDefault(); e.shiftKey ? flipV() : flipH(); return; }
    if (e.key === "g" || e.key === "G") { e.preventDefault(); cycleGrid(); return; }
    if (e.key === "0") { e.preventDefault(); zoomFit(); return; }
    if (e.key === "Escape") { e.preventDefault(); resetCrop(); return; }
  };

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
          dpi: outDpi || target.dpi,
          stripMetadata: true,
          grayscale: adjust.grayscale > 0,
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
        const stem = (outName || file.name).replace(/\.pdf$/i, "");
        downloadBlob(blob, `${stem}.pdf`);
        toast.success(
          hit
            ? `Hit target · ${formatBytes(res.compressedBytes)} (−${res.savingsPercent}%, ${attempts} passes)`
            : `Closest match · ${formatBytes(res.compressedBytes)}`,
        );
        return;
      }

      const hasTransform = transform.rotation !== 0 || transform.flipH || transform.flipV || transform.straighten !== 0;
      const source: File | Blob = hasTransform && transformedUrlRef.current
        ? await urlToBlob(transformedUrlRef.current)
        : file;

      const useCrop = resizeMode === "selected-area" && crop && crop.w > 0.005 && crop.h > 0.005 ? crop : null;
      const filterCss = buildFilterCss(adjust);
      const opts = {
        preserveTransparency: false,
        flattenBackground: bgColor,
        ocrSafe: true,
        filterCss,
        sharpen: adjust.sharpen,
        vignette: adjust.vignette,
        fixedQuality: qualityMode === "manual" ? manualQuality / 100 : undefined,
      };
      const { result: res, hit, attempts } = await cropAndResizeToExact(
        source,
        useCrop,
        target.pxW,
        target.pxH,
        outFormat,
        targetBytes,
        opts,
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
        format: outFormat,
        hit,
        attempts,
      };
      onResult(r);
      const ext = outFormat.split("/")[1]!.replace("jpeg", "jpg");
      const stem = outName || file.name.replace(/\.[a-z0-9]+$/i, "");
      downloadBlob(res.blob, `${stem}.${ext}`);
      toast.success(
        hit
          ? `Hit target · ${formatBytes(res.bytes)} at ${target.pxW}×${target.pxH} (${attempts} passes)`
          : qualityMode === "manual"
            ? `Encoded · ${formatBytes(res.bytes)} at q${manualQuality}`
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
    isPdf, pdfDoc, outDpi, target.dpi, adjust.grayscale, targetBytes, onResult,
    file, outName, transform.rotation, transform.flipH, transform.flipV, transform.straighten,
    resizeMode, crop, adjust, bgColor, qualityMode, manualQuality, outFormat, target.pxW, target.pxH, target.maxKb,
  ]);

  const downloadAgain = () => {
    if (!result) return;
    const stem = outName || file.name.replace(/\.[a-z0-9]+$/i, "");
    const ext = result.format.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    downloadBlob(result.blob, result.format === "application/pdf" ? `${stem}.pdf` : `${stem}.${ext}`);
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
            {pdfDoc.pageCount} pages · {formatBytes(pdfDoc.size)} → target ≤ {target.maxKb} KB · DPI {outDpi || target.dpi}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <SidebarCard icon={<Settings2 className="h-4 w-4" />} title="PDF output">
            <Field label={`DPI: ${outDpi || target.dpi}`}>
              <input
                type="range"
                min={72}
                max={300}
                step={1}
                value={outDpi || target.dpi}
                onChange={(e) => setOutDpi(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
            </Field>
            <Field label="Output filename">
              <input
                type="text"
                value={outName}
                onChange={(e) => setOutName(e.target.value)}
                className={inputClass()}
                placeholder="aadhaar-compressed"
              />
            </Field>
          </SidebarCard>
          <SidebarCard icon={<Sun className="h-4 w-4" />} title="Tone">
            <SliderRow label="Grayscale" value={adjust.grayscale} min={0} max={100} onChange={(v) => updateAdjust({ grayscale: v })} suffix="%" />
            <Button size="sm" variant="outline" className="mt-1 w-full" onClick={resetAdjust}>Reset</Button>
          </SidebarCard>
        </div>

        {result && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <span className="text-muted">Result</span>
              <span className="font-medium text-emerald-500">{formatBytes(result.bytes)}</span>
            </div>
            <span className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
              result.hit ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500",
            )}>
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
          <Button variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4" /> Back</Button>
          <Button variant="outline" onClick={onClear}><X className="h-4 w-4" /> Start over</Button>
        </div>

        {error && <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
      </div>
    );
  }

  /* ── Image editor ─ */
  const cropEnabled = resizeMode === "selected-area";
  const handlesForRatio = aspectRatio !== null
    ? HANDLES.filter((h) => h.id.length === 2)
    : HANDLES;

  return (
    <div ref={editorRootRef} className={cn("space-y-4", fullscreen && "bg-background p-4")} onKeyDown={onKeyDown} tabIndex={0}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-2">
        <div className="flex items-center gap-1">
          <ToolbarBtn onClick={zoomOut} title="Zoom out (−)"><ZoomOut className="h-4 w-4" /></ToolbarBtn>
          <span className="w-14 text-center text-xs font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
          <ToolbarBtn onClick={zoomIn} title="Zoom in (+)"><ZoomIn className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn onClick={zoomFit} title="Fit (0)"><Maximize className="h-4 w-4" /></ToolbarBtn>
          <ToolbarBtn onClick={zoom50} title="50%"><span className="text-[10px] font-bold">50</span></ToolbarBtn>
          <ToolbarBtn onClick={zoom200} title="200%"><span className="text-[10px] font-bold">2x</span></ToolbarBtn>
        </div>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn onClick={() => rotate("ccw")} title="Rotate 90° CCW (R)"><RotateCcw className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => rotate("cw")} title="Rotate 90° CW (Shift+R)"><RotateCw className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={flipH} title="Flip horizontal (F)"><FlipHorizontal2 className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={flipV} title="Flip vertical (Shift+F)"><FlipVertical2 className="h-4 w-4" /></ToolbarBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn onClick={cycleGrid} title="Grid (G) — cycles thirds/golden/diagonal/4×4/off" active={showGrid}>
          <Grid3x3 className="h-4 w-4" />
        </ToolbarBtn>
        <ToolbarBtn onClick={undo} title="Undo (Ctrl+Z)" disabled={!canUndo}><Undo2 className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={redo} title="Redo (Ctrl+Shift+Z)" disabled={!canRedo}><Redo2 className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn onClick={resetTransform} title="Reset transform" disabled={transform.rotation === 0 && !transform.flipH && !transform.flipV && transform.straighten === 0}>
          <RotateCcw className="h-4 w-4 opacity-70" />
        </ToolbarBtn>
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarBtn onClick={toggleFullscreen} title="Fullscreen">{fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</ToolbarBtn>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span className="hidden sm:inline">
            {transform.w}×{transform.h}
            {transform.rotation !== 0 && ` · ${transform.rotation}°`}
            {transform.straighten !== 0 && ` · ${transform.straighten > 0 ? "+" : ""}${transform.straighten}°`}
            {(transform.flipH || transform.flipV) && " · flipped"}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Canvas area */}
        <div className="space-y-3">
          {/* Straighten slider — always visible for image path */}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <span className="text-xs text-muted">Straighten</span>
            <input
              type="range"
              min={-45}
              max={45}
              step={1}
              value={transform.straighten}
              onChange={(e) => setStraighten(Number(e.target.value))}
              className="flex-1 accent-[var(--primary)]"
            />
            <span className="w-12 text-right text-xs font-medium tabular-nums">{transform.straighten > 0 ? "+" : ""}{transform.straighten}°</span>
            <button
              type="button"
              onClick={() => setStraighten(0)}
              className="text-xs text-muted hover:text-foreground"
              disabled={transform.straighten === 0}
            >reset</button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {cropEnabled
                ? "Drag on image to draw crop · drag inside to move · drag handles to resize · arrow keys nudge · Esc resets crop"
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
            style={{ minHeight: 320, maxHeight: fullscreen ? "70vh" : 560 }}
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
                  <div className="absolute inset-0" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }} aria-hidden />
                  {showGrid && <CropGrid type={gridType} />}
                  {handlesForRatio.map((h) => (
                    <div
                      key={h.id}
                      onPointerDown={(e) => onPointerDown(e, h.id)}
                      className={cn("absolute h-3 w-3 rounded-sm border-2 border-primary bg-white shadow", h.cls)}
                      style={{ cursor: h.cursor, touchAction: "none" }}
                    />
                  ))}
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
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.url} alt="After" className="max-h-[280px] max-w-full object-contain" />
                    <div
                      className="absolute inset-0 flex items-center justify-center overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - sliderPct}% 0 0)` }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Before" className="max-h-[280px] max-w-full object-contain" />
                    </div>
                    <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-primary" style={{ left: `${sliderPct}%` }}>
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
          {/* Enhancement presets */}
          <SidebarCard icon={<Wand2 className="h-4 w-4" />} title="Presets">
            <div className="grid grid-cols-2 gap-2">
              {ENHANCE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyEnhancePreset(p.id)}
                  className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-primary/5"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </SidebarCard>

          {/* Crop panel */}
          {cropEnabled && (
            <SidebarCard icon={<CropIcon2 className="h-4 w-4" />} title="Crop">
              <Field label="Aspect ratio">
                <select
                  value={aspectId}
                  onChange={(e) => { setAspectId(e.target.value as AspectId); setCrop(null); }}
                  className={inputClass()}
                >
                  {ASPECT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id === "target" ? `Target (${target.pxW}:${target.pxH})` : p.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Field label="X (px)">
                  <input
                    type="number"
                    value={cropPx?.x ?? 0}
                    onChange={(e) => { if (!crop) return; const nx = clamp(Number(e.target.value) / transform.w, 0, 1 - crop.w); setCrop({ ...crop, x: nx }); }}
                    className={inputClass()}
                    disabled={!crop}
                  />
                </Field>
                <Field label="Y (px)">
                  <input
                    type="number"
                    value={cropPx?.y ?? 0}
                    onChange={(e) => { if (!crop) return; const ny = clamp(Number(e.target.value) / transform.h, 0, 1 - crop.h); setCrop({ ...crop, y: ny }); }}
                    className={inputClass()}
                    disabled={!crop}
                  />
                </Field>
                <Field label="W (px)">
                  <input
                    type="number"
                    value={cropPx?.w ?? 0}
                    onChange={(e) => { if (!crop) return; const nw = clamp(Number(e.target.value) / transform.w, 0.01, 1 - crop.x); let nh = crop.h; if (aspectRatio !== null) nh = nw / aspectRatio; setCrop({ ...crop, w: nw, h: nh }); }}
                    className={inputClass()}
                    disabled={!crop}
                  />
                </Field>
                <Field label="H (px)">
                  <input
                    type="number"
                    value={cropPx?.h ?? 0}
                    onChange={(e) => { if (!crop) return; const nh = clamp(Number(e.target.value) / transform.h, 0.01, 1 - crop.y); let nw = crop.w; if (aspectRatio !== null) nw = nh * aspectRatio; setCrop({ ...crop, w: nw, h: nh }); }}
                    className={inputClass()}
                    disabled={!crop}
                  />
                </Field>
              </div>

              <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} className="accent-[var(--primary)]" />
                Snap to edges
              </label>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <Button size="sm" variant="outline" onClick={centerCrop}>Center</Button>
                <Button size="sm" variant="outline" onClick={fillCrop} disabled={!crop}>Fill</Button>
                <Button size="sm" variant="outline" onClick={resetCrop} disabled={!crop}>Reset</Button>
              </div>
            </SidebarCard>
          )}

          {/* Adjust panel */}
          <SidebarCard icon={<Sun className="h-4 w-4" />} title="Adjust">
            <SliderRow label="Brightness" value={adjust.brightness} min={20} max={200} onChange={(v) => updateAdjust({ brightness: v })} suffix="%" />
            <SliderRow label="Contrast" value={adjust.contrast} min={20} max={200} onChange={(v) => updateAdjust({ contrast: v })} suffix="%" />
            <SliderRow label="Saturation" value={adjust.saturation} min={0} max={200} onChange={(v) => updateAdjust({ saturation: v })} suffix="%" />
            <SliderRow label="Warmth" value={adjust.warmth} min={0} max={100} onChange={(v) => updateAdjust({ warmth: v })} suffix="%" />
            <SliderRow label="Tint" value={adjust.tint} min={-180} max={180} onChange={(v) => updateAdjust({ tint: v })} suffix="°" />
            <SliderRow label="Blur" value={adjust.blur} min={0} max={10} step={0.1} onChange={(v) => updateAdjust({ blur: v })} suffix="px" />
            <SliderRow label="Sharpen" value={adjust.sharpen} min={0} max={100} onChange={(v) => updateAdjust({ sharpen: v })} suffix="%" />
            <SliderRow label="Vignette" value={adjust.vignette} min={0} max={100} onChange={(v) => updateAdjust({ vignette: v })} suffix="%" />
            <SliderRow label="Grayscale" value={adjust.grayscale} min={0} max={100} onChange={(v) => updateAdjust({ grayscale: v })} suffix="%" />
            <SliderRow label="Invert" value={adjust.invert} min={0} max={100} onChange={(v) => updateAdjust({ invert: v })} suffix="%" />
            <Button size="sm" variant="outline" className="mt-1 w-full" onClick={resetAdjust} disabled={JSON.stringify(adjust) === JSON.stringify(DEFAULT_ADJUST)}>
              Reset adjust
            </Button>
          </SidebarCard>

          {/* Output panel */}
          <SidebarCard icon={<Sliders className="h-4 w-4" />} title="Output">
            <Field label="Format">
              <select value={outFormat} onChange={(e) => setOutFormat(e.target.value as OutputFormat)} className={inputClass()}>
                <option value="image/jpeg">JPG</option>
                <option value="image/png">PNG</option>
                <option value="image/webp">WebP</option>
              </select>
            </Field>

            <Field label="Quality">
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setQualityMode("auto")}
                  className={cn("rounded-md border px-2 py-1 text-xs", qualityMode === "auto" ? "border-primary bg-primary/10 text-primary" : "border-border")}
                >Auto (target KB)</button>
                <button
                  type="button"
                  onClick={() => setQualityMode("manual")}
                  className={cn("rounded-md border px-2 py-1 text-xs", qualityMode === "manual" ? "border-primary bg-primary/10 text-primary" : "border-border")}
                >Manual</button>
              </div>
            </Field>
            {qualityMode === "manual" && (
              <div className="mt-2">
                <SliderRow label="Quality" value={manualQuality} min={10} max={100} onChange={setManualQuality} suffix="%" />
              </div>
            )}

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Field label="Background">
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-border bg-card p-0.5"
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className={cn(inputClass(), "flex-1 font-mono text-xs")}
                  />
                </div>
              </Field>
              <Field label="Filename">
                <input
                  type="text"
                  value={outName}
                  onChange={(e) => setOutName(e.target.value)}
                  className={cn(inputClass(), "text-xs")}
                  placeholder="output"
                />
              </Field>
            </div>

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
        "flex h-8 min-w-8 items-center justify-center rounded-md px-1 text-muted transition-colors",
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
  step = 1,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="font-medium tabular-nums">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--primary)]"
      />
    </div>
  );
}

function PreviewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function CropGrid({ type }: { type: GridType }) {
  if (type === "none") return null;
  const line = "absolute bg-white/40";
  if (type === "thirds") {
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className={cn(line, "left-1/3 top-0 h-full w-px")} />
        <div className={cn(line, "left-2/3 top-0 h-full w-px")} />
        <div className={cn(line, "top-1/3 left-0 w-full h-px")} />
        <div className={cn(line, "top-2/3 left-0 w-full h-px")} />
      </div>
    );
  }
  if (type === "grid4") {
    return (
      <div className="pointer-events-none absolute inset-0">
        {[0.25, 0.5, 0.75].map((p) => (
          <div key={`v${p}`} className={cn(line, "top-0 h-full w-px")} style={{ left: `${p * 100}%` }} />
        ))}
        {[0.25, 0.5, 0.75].map((p) => (
          <div key={`h${p}`} className={cn(line, "left-0 w-full h-px")} style={{ top: `${p * 100}%` }} />
        ))}
      </div>
    );
  }
  if (type === "golden") {
    // Golden ratio ~ 0.382 / 0.618
    return (
      <div className="pointer-events-none absolute inset-0">
        <div className={cn(line, "top-0 h-full w-px")} style={{ left: "38.2%" }} />
        <div className={cn(line, "top-0 h-full w-px")} style={{ left: "61.8%" }} />
        <div className={cn(line, "left-0 w-full h-px")} style={{ top: "38.2%" }} />
        <div className={cn(line, "left-0 w-full h-px")} style={{ top: "61.8%" }} />
      </div>
    );
  }
  // diagonal
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
        <div className="absolute left-0 top-0 w-[140%] origin-top-left -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white/30" style={{ height: "1px" }} />
        <div className="absolute right-0 top-0 w-[140%] origin-top-right translate-x-1/2 -translate-y-1/2 -rotate-45 bg-white/30" style={{ height: "1px" }} />
      </div>
    </div>
  );
}
