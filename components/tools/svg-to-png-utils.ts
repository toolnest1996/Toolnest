/**
 * Ultra SVG Rasterizer — PNG/JPG/WebP/AVIF/BMP/ICO, DPI presets, optimization, batch, worker.
 * 100% client-side via Canvas + createImageBitmap. TIFF via REST API (sharp).
 */

import {
  type OutputFormat,
  FORMAT_EXTENSIONS,
  LOSSY_FORMATS,
  encodeBMP,
  encodeICO,
  detectEncodingSupport,
  isBrowserEncodable,
} from "./image-compressor-utils";

export type { OutputFormat };
export { FORMAT_EXTENSIONS, LOSSY_FORMATS, isBrowserEncodable };

export type DpiPreset = 72 | 96 | 150 | 300 | 600;

export interface SvgRasterSettings {
  width: number;
  height: number;
  scale: number;
  dpi: DpiPreset;
  /** When true, output pixels = intrinsic × (dpi/96) × scale */
  useDpi: boolean;
  lockAspectRatio: boolean;
  background: string;
  transparent: boolean;
  format: OutputFormat;
  quality: number;
  antiAlias: boolean;
  optimizeSvg: boolean;
  optimizePrecision: number;
  stripSvgMetadata: boolean;
  preserveColorProfile: boolean;
}

export interface SvgAnalysis {
  intrinsicW: number;
  intrinsicH: number;
  hasViewBox: boolean;
  hasExternalRefs: boolean;
  hasEmbeddedImages: boolean;
  hasFonts: boolean;
  hasTransparency: boolean;
  elementCount: number;
  bytesOriginal: number;
}

export interface SvgRasterItem {
  id: string;
  name: string;
  svg: string;
  svgOptimized: string;
  bytes: number;
  analysis: SvgAnalysis;
  status: "queued" | "processing" | "done" | "error";
  resultUrl: string;
  resultBytes: number;
  error?: string;
}

export interface SvgRasterResult {
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  format: OutputFormat;
  previewUrl: string;
  durationMs: number;
  svgUsed: string;
}

export interface SvgRecommendation {
  title: string;
  detail: string;
  action?: "png" | "webp" | "dpi300" | "optimize" | "transparent" | "ico";
}

export const DEFAULT_SVG_RASTER: SvgRasterSettings = {
  width: 1024,
  height: 0,
  scale: 1,
  dpi: 96,
  useDpi: false,
  lockAspectRatio: true,
  background: "#ffffff",
  transparent: true,
  format: "image/png",
  quality: 0.92,
  antiAlias: true,
  optimizeSvg: true,
  optimizePrecision: 2,
  stripSvgMetadata: true,
  preserveColorProfile: false,
};

export const DPI_PRESETS: { value: DpiPreset; label: string; hint: string }[] = [
  { value: 72, label: "72 DPI", hint: "Screen / legacy" },
  { value: 96, label: "96 DPI", hint: "Web standard" },
  { value: 150, label: "150 DPI", hint: "Draft print" },
  { value: 300, label: "300 DPI", hint: "Print quality" },
  { value: 600, label: "600 DPI", hint: "High-res print" },
];

export const SVG_SIZE_PRESETS = [
  { id: "intrinsic", label: "Intrinsic (SVG size)", w: 0, h: 0 },
  { id: "512", label: "512 px (short side)", w: 512, h: 0 },
  { id: "1024", label: "1024 px", w: 1024, h: 1024 },
  { id: "1920", label: "1920 × 1080 (HD)", w: 1920, h: 1080 },
  { id: "2048", label: "2048 × 2048", w: 2048, h: 2048 },
  { id: "3840", label: "3840 × 2160 (4K)", w: 3840, h: 2160 },
  { id: "favicon", label: "Favicon 32 × 32", w: 32, h: 32 },
  { id: "icon256", label: "App icon 256 × 256", w: 256, h: 256 },
];

const HISTORY_KEY_EXPORT = "toolnest-svg-raster-history";

function clamp(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), type, quality);
  });
}

function parseSvgDimensions(svg: string): { w: number; h: number } {
  const viewBox = /viewBox=["']([^"']+)["']/i.exec(svg);
  if (viewBox?.[1]) {
    const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 4 && parts[2]! > 0 && parts[3]! > 0) {
      return { w: parts[2]!, h: parts[3]! };
    }
  }
  const wMatch = /\bwidth=["']([\d.]+)(px|pt|pc|mm|cm|in|%)?["']/i.exec(svg);
  const hMatch = /\bheight=["']([\d.]+)(px|pt|pc|mm|cm|in|%)?["']/i.exec(svg);
  const toPx = (val: number, unit?: string) => {
    switch (unit?.toLowerCase()) {
      case "mm": return val * 3.7795275591;
      case "cm": return val * 37.795275591;
      case "in": return val * 96;
      case "pt": return val * 1.3333333333;
      case "pc": return val * 16;
      default: return val;
    }
  };
  if (wMatch && hMatch) {
    return {
      w: toPx(parseFloat(wMatch[1]), wMatch[2]),
      h: toPx(parseFloat(hMatch[1]), hMatch[2]),
    };
  }
  return { w: 300, h: 150 };
}

export function isSvgFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith(".svg") || file.type === "image/svg+xml" || file.type === "text/xml";
}

export async function loadSvgFromFile(file: File): Promise<string> {
  const text = await file.text();
  if (!/<svg[\s>]/i.test(text)) throw new Error("Not a valid SVG file");
  return text;
}

export function analyzeSvg(svg: string): SvgAnalysis {
  const { w, h } = parseSvgDimensions(svg);
  const hasViewBox = /viewBox=/i.test(svg);
  const hasExternalRefs = /(?:href|xlink:href)=["'](?!#|data:)[^"']+["']/i.test(svg);
  const hasEmbeddedImages = /(?:href|xlink:href)=["']data:image/i.test(svg);
  const hasFonts = /@font-face|<font[\s>]/i.test(svg);
  const hasTransparency =
    /fill=["']none["']/i.test(svg) ||
    /fill-opacity=["']0/i.test(svg) ||
    /opacity=["']0/i.test(svg) ||
    /rgba?\([^)]*,\s*0/i.test(svg);
  const elementCount = (svg.match(/<(path|rect|circle|ellipse|polygon|polyline|line|text|g|use|image)\b/gi) ?? []).length;
  return {
    intrinsicW: Math.round(w),
    intrinsicH: Math.round(h),
    hasViewBox,
    hasExternalRefs,
    hasEmbeddedImages,
    hasFonts,
    hasTransparency,
    elementCount,
    bytesOriginal: new Blob([svg]).size,
  };
}

/** Lightweight SVG optimization (SVGOMG-style) without external deps. */
export function optimizeSvgMarkup(svg: string, opts: Pick<SvgRasterSettings, "optimizePrecision" | "stripSvgMetadata">): string {
  let out = svg.trim();
  if (opts.stripSvgMetadata) {
    out = out.replace(/<!--[\s\S]*?-->/g, "");
    out = out.replace(/<metadata[\s\S]*?<\/metadata>/gi, "");
    out = out.replace(/<title[\s\S]*?<\/title>/gi, "");
    out = out.replace(/<desc[\s\S]*?<\/desc>/gi, "");
  }
  out = out.replace(/\s*(xmlns:(inkscape|sodipodi|adobe))="[^"]*"/gi, "");
  out = out.replace(/\s+inkscape:[^\s=]+="[^"]*"/gi, "");
  out = out.replace(/\s+sodipodi:[^\s=]+="[^"]*"/gi, "");
  out = out.replace(/>\s+</g, "><");
  if (opts.optimizePrecision >= 0) {
    const p = opts.optimizePrecision;
    out = out.replace(/(-?\d+\.\d{3,})/g, (m) => {
      const n = Number(m);
      return Number.isFinite(n) ? String(Math.round(n * 10 ** p) / 10 ** p) : m;
    });
  }
  return out;
}

export function prepareSvg(svg: string, settings: SvgRasterSettings): string {
  if (!settings.optimizeSvg) return svg;
  return optimizeSvgMarkup(svg, settings);
}

export function computeRasterSize(svgText: string, settings: SvgRasterSettings): { w: number; h: number } {
  const intrinsic = parseSvgDimensions(svgText);
  let w = settings.width;
  let h = settings.height;

  if (settings.useDpi) {
    const factor = (settings.dpi / 96) * settings.scale;
    w = Math.max(1, Math.round(intrinsic.w * factor));
    h = Math.max(1, Math.round(intrinsic.h * factor));
    return { w, h };
  }

  if (!w && !h) {
    w = Math.round(intrinsic.w * settings.scale);
    h = Math.round(intrinsic.h * settings.scale);
  } else if (w && !h) {
    h = settings.lockAspectRatio
      ? Math.max(1, Math.round(w / (intrinsic.w / intrinsic.h)))
      : Math.round(intrinsic.h * settings.scale);
    w = Math.max(1, Math.round(w * settings.scale));
  } else if (h && !w) {
    w = settings.lockAspectRatio
      ? Math.max(1, Math.round(h * (intrinsic.w / intrinsic.h)))
      : Math.round(intrinsic.w * settings.scale);
    h = Math.max(1, Math.round(h * settings.scale));
  } else {
    if (settings.lockAspectRatio) {
      const ratio = intrinsic.w / intrinsic.h;
      const boxRatio = w / h;
      if (boxRatio > ratio) w = Math.round(h * ratio);
      else h = Math.round(w / ratio);
    }
    w = Math.max(1, Math.round(w * settings.scale));
    h = Math.max(1, Math.round(h * settings.scale));
  }

  return { w, h };
}

export function buildOutputName(sourceName: string, format: OutputFormat): string {
  const base = sourceName.replace(/\.svg$/i, "") || "rasterized";
  return `${base}.${FORMAT_EXTENSIONS[format]}`;
}

async function loadSvgImage(svgText: string): Promise<HTMLImageElement> {
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(
          new Error(
            "Failed to render SVG — check external resources, fonts, or invalid markup",
          ),
        );
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function rasterizeSvgToCanvas(
  svgText: string,
  settings: SvgRasterSettings,
): Promise<{ canvas: HTMLCanvasElement; w: number; h: number; svgUsed: string }> {
  const svgUsed = prepareSvg(svgText, settings);
  const { w, h } = computeRasterSize(svgUsed, settings);
  const img = await loadSvgImage(svgUsed);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = settings.antiAlias;
  ctx.imageSmoothingQuality = "high";

  const lossy = LOSSY_FORMATS.includes(settings.format);
  if (!settings.transparent || lossy || settings.format === "image/bmp") {
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, w, h, svgUsed };
}

async function encodeCanvas(canvas: HTMLCanvasElement, settings: SvgRasterSettings): Promise<Blob> {
  const fmt = settings.format;
  if (fmt === "image/bmp") return encodeBMP(canvas);
  if (fmt === "image/x-icon") return encodeICO(canvas);
  if (fmt === "image/tiff") {
    throw new Error("TIFF export requires the REST API — use POST /api/v1/image/svg-to-png");
  }
  if (!isBrowserEncodable(fmt)) {
    throw new Error(`${fmt} is not supported in this browser`);
  }
  const q = LOSSY_FORMATS.includes(fmt) ? settings.quality : undefined;
  return canvasToBlob(canvas, fmt, q);
}

export async function rasterizeSvgToBlob(
  svgText: string,
  settings: SvgRasterSettings,
): Promise<SvgRasterResult> {
  const start = performance.now();
  const { canvas, w, h, svgUsed } = await rasterizeSvgToCanvas(svgText, settings);
  const blob = await encodeCanvas(canvas, settings);
  const previewUrl = URL.createObjectURL(blob);
  return {
    blob,
    bytes: blob.size,
    width: w,
    height: h,
    format: settings.format,
    previewUrl,
    durationMs: performance.now() - start,
    svgUsed,
  };
}

export async function rasterizeSvgBatch(
  items: { name: string; svg: string }[],
  settings: SvgRasterSettings,
  onProgress?: (pct: number) => void,
): Promise<{ name: string; blob: Blob; width: number; height: number }[]> {
  const out: { name: string; blob: Blob; width: number; height: number }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const result = await rasterizeSvgToBlob(item.svg, settings);
    out.push({
      name: buildOutputName(item.name, settings.format),
      blob: result.blob,
      width: result.width,
      height: result.height,
    });
    URL.revokeObjectURL(result.previewUrl);
    onProgress?.(Math.round(((i + 1) / items.length) * 100));
  }
  return out;
}

export async function zipRasterOutputs(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name, f.blob));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function aiRecommendSvgRaster(
  analysis: SvgAnalysis,
  settings: SvgRasterSettings,
): SvgRecommendation[] {
  const recs: SvgRecommendation[] = [];
  if (analysis.hasTransparency && settings.format === "image/jpeg") {
    recs.push({
      title: "Use PNG or WebP",
      detail: "JPG cannot preserve transparency — switch format for logos and icons.",
      action: "png",
    });
  }
  if (analysis.hasExternalRefs) {
    recs.push({
      title: "External resources detected",
      detail: "Linked images/fonts may not render offline — embed assets as data URIs in the SVG.",
    });
  }
  if (analysis.bytesOriginal > 200_000 && settings.optimizeSvg) {
    recs.push({
      title: "SVG optimization enabled",
      detail: `Large SVG (${Math.round(analysis.bytesOriginal / 1024)} KB) — metadata stripped before rasterize.`,
      action: "optimize",
    });
  }
  if (!settings.useDpi && analysis.intrinsicW < 512 && settings.width >= 1024) {
    recs.push({
      title: "Upscaled small SVG",
      detail: "Small source upscaled — enable anti-aliasing for smoother edges.",
    });
  }
  if (settings.useDpi && settings.dpi < 300 && analysis.elementCount > 20) {
    recs.push({
      title: "Print-quality DPI",
      detail: "Complex artwork for print — try 300 DPI for sharper output.",
      action: "dpi300",
    });
  }
  if (analysis.intrinsicW <= 256 && analysis.intrinsicH <= 256 && settings.format !== "image/x-icon") {
    recs.push({
      title: "Favicon / app icon",
      detail: "Small square SVG — export as ICO for browser tabs.",
      action: "ico",
    });
  }
  if (analysis.hasTransparency && !settings.transparent) {
    recs.push({
      title: "Enable transparency",
      detail: "SVG contains transparent areas — keep alpha on PNG/WebP export.",
      action: "transparent",
    });
  }
  const cap = detectEncodingSupport();
  if (!analysis.hasTransparency && cap.webp && settings.format === "image/png") {
    recs.push({
      title: "Smaller WebP export",
      detail: "Opaque graphics compress smaller as WebP with similar quality.",
      action: "webp",
    });
  }
  return recs.slice(0, 5);
}

/* ─── Web Worker batch acceleration ─── */

const WORKER_SRC = `
self.onmessage = async (e) => {
  const { id, svg, settings } = e.data;
  try {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("SVG render failed"));
      el.src = url;
    });
    URL.revokeObjectURL(url);
    const w = settings.w;
    const h = settings.h;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!settings.transparent || settings.lossy) {
      ctx.fillStyle = settings.background;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingEnabled = settings.antiAlias;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    const outBlob = await canvas.convertToEncodedBlob({
      type: settings.format,
      quality: settings.quality,
    });
    const buf = await outBlob.arrayBuffer();
    self.postMessage({ id, ok: true, buf, bytes: outBlob.size, format: outBlob.type }, [buf]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
`;

let workerUrl: string | null = null;
let rasterWorker: Worker | null = null;

function getRasterWorker(): Worker | null {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return null;
  if (!rasterWorker) {
    try {
      if (!workerUrl) {
        workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: "application/javascript" }));
      }
      rasterWorker = new Worker(workerUrl);
    } catch {
      return null;
    }
  }
  return rasterWorker;
}

export async function rasterizeSvgInWorker(
  svgText: string,
  settings: SvgRasterSettings,
): Promise<Blob | null> {
  const w = getRasterWorker();
  if (!w) return null;
  const svgUsed = prepareSvg(svgText, settings);
  const size = computeRasterSize(svgUsed, settings);
  const id = Math.random().toString(36).slice(2);
  const lossy = LOSSY_FORMATS.includes(settings.format);
  if (settings.format === "image/bmp" || settings.format === "image/x-icon" || settings.format === "image/tiff") {
    return null;
  }
  return new Promise((resolve) => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { id: string; ok: boolean; buf?: ArrayBuffer; error?: string };
      if (d.id !== id) return;
      w.removeEventListener("message", onMsg);
      if (!d.ok || !d.buf) {
        resolve(null);
        return;
      }
      resolve(new Blob([d.buf], { type: settings.format }));
    };
    w.addEventListener("message", onMsg);
    w.postMessage({
      id,
      svg: svgUsed,
      settings: {
        w: size.w,
        h: size.h,
        format: settings.format,
        quality: settings.quality,
        transparent: settings.transparent,
        lossy,
        background: settings.background,
        antiAlias: settings.antiAlias,
      },
    });
  });
}

export { HISTORY_KEY_EXPORT };
