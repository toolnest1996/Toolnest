/**
 * Ultra Image Resize Studio — multi-unit sizing, fit modes, content-aware crop,
 * rotate/flip, batch export. 100% client-side via Canvas + createImageBitmap.
 * Reuses format encoders from image-compressor-utils.
 */

import {
  type OutputFormat,
  FORMAT_EXTENSIONS,
  LOSSY_FORMATS,
  encodeBMP,
  encodeICO,
  detectEncodingSupport,
  isBrowserEncodable,
  isSupportedInput,
  analyzeImage,
  type ImageMeta,
} from "./image-compressor-utils";

export type { OutputFormat, ImageMeta };
export { FORMAT_EXTENSIONS, LOSSY_FORMATS, isSupportedInput, detectEncodingSupport, isBrowserEncodable };

export type SizeUnit = "px" | "%" | "in" | "cm" | "mm";
export type ResizeFit = "stretch" | "contain" | "cover" | "content-aware";
export type Rotation = 0 | 90 | 180 | 270;

export interface ResizeTransform {
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
}

export interface ResizeDimensions {
  width: number;
  height: number;
  unit: SizeUnit;
  lockAspect: boolean;
  /** DPI/PPI for physical units (in/cm/mm) */
  dpi: number;
  fit: ResizeFit;
  padColor: string;
  /** Allow upscaling beyond natural size */
  upscale: boolean;
}

export interface ResizeExportOptions {
  format: OutputFormat;
  quality: number;
  preserveTransparency: boolean;
  flattenBackground: string;
  stripMetadata: boolean;
  sharpen: boolean;
  losslessOptimize: boolean;
}

export interface ResizeItem {
  id: string;
  file: File;
  name: string;
  originalBytes: number;
  naturalW: number;
  naturalH: number;
  thumbUrl: string;
  hasAlpha: boolean;
  status: "queued" | "processing" | "done" | "error";
  resultUrl: string;
  resultBytes: number;
  outputW: number;
  outputH: number;
  error?: string;
}

export interface SizePreset {
  id: string;
  label: string;
  width: number;
  height: number;
  unit: SizeUnit;
  category: "social" | "print" | "web" | "video";
}

export interface ResizeAiRec {
  level: "info" | "warning" | "success";
  title: string;
  detail: string;
  action?: "half" | "double" | "webp" | "png" | "cover" | "contain" | "preset-hd";
}

export const DEFAULT_TRANSFORM: ResizeTransform = {
  rotation: 0,
  flipH: false,
  flipV: false,
};

export const DEFAULT_DIMENSIONS: ResizeDimensions = {
  width: 1920,
  height: 1080,
  unit: "px",
  lockAspect: true,
  dpi: 300,
  fit: "contain",
  padColor: "#ffffff",
  upscale: false,
};

export const DEFAULT_EXPORT: ResizeExportOptions = {
  format: "image/webp",
  quality: 0.92,
  preserveTransparency: true,
  flattenBackground: "#ffffff",
  stripMetadata: true,
  sharpen: false,
  losslessOptimize: true,
};

export const SIZE_PRESETS: SizePreset[] = [
  { id: "ig-square", label: "Instagram Square", width: 1080, height: 1080, unit: "px", category: "social" },
  { id: "ig-portrait", label: "Instagram 4:5", width: 1080, height: 1350, unit: "px", category: "social" },
  { id: "ig-story", label: "Instagram Story", width: 1080, height: 1920, unit: "px", category: "social" },
  { id: "fb-cover", label: "Facebook Cover", width: 820, height: 312, unit: "px", category: "social" },
  { id: "x-header", label: "X / Twitter Header", width: 1500, height: 500, unit: "px", category: "social" },
  { id: "yt-thumb", label: "YouTube Thumbnail", width: 1280, height: 720, unit: "px", category: "social" },
  { id: "linkedin", label: "LinkedIn Banner", width: 1584, height: 396, unit: "px", category: "social" },
  { id: "pinterest", label: "Pinterest Pin", width: 1000, height: 1500, unit: "px", category: "social" },
  { id: "tiktok", label: "TikTok Video", width: 1080, height: 1920, unit: "px", category: "social" },
  { id: "hd", label: "HD 1080p", width: 1920, height: 1080, unit: "px", category: "video" },
  { id: "4k", label: "4K UHD", width: 3840, height: 2160, unit: "px", category: "video" },
  { id: "web-md", label: "Web Medium", width: 800, height: 600, unit: "px", category: "web" },
  { id: "web-sm", label: "Web Thumbnail", width: 400, height: 400, unit: "px", category: "web" },
  { id: "a4-300", label: "A4 @ 300 DPI", width: 8.27, height: 11.69, unit: "in", category: "print" },
  { id: "letter-300", label: "US Letter @ 300 DPI", width: 8.5, height: 11, unit: "in", category: "print" },
  { id: "photo-4x6", label: "4×6 Photo", width: 4, height: 6, unit: "in", category: "print" },
  { id: "photo-5x7", label: "5×7 Photo", width: 5, height: 7, unit: "in", category: "print" },
  { id: "photo-8x10", label: "8×10 Photo", width: 8, height: 10, unit: "in", category: "print" },
];

function clamp(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality);
  });
}

/** Convert physical measurement to pixels at given DPI/PPI. */
export function physicalToPixels(value: number, unit: SizeUnit, dpi: number): number {
  if (unit === "px") return value;
  if (unit === "%") return value;
  if (unit === "in") return Math.round(value * dpi);
  if (unit === "cm") return Math.round((value / 2.54) * dpi);
  if (unit === "mm") return Math.round((value / 25.4) * dpi);
  return value;
}

/** Resolve target width/height in pixels from dimension settings and natural size. */
export function computeOutputPixels(
  naturalW: number,
  naturalH: number,
  dims: ResizeDimensions,
): { outW: number; outH: number } {
  let w = dims.width;
  let h = dims.height;

  if (dims.unit === "%") {
    return {
      outW: Math.max(1, Math.round(naturalW * (w / 100))),
      outH: Math.max(1, Math.round(naturalH * (h / 100))),
    };
  }

  if (dims.unit !== "px") {
    w = physicalToPixels(w, dims.unit, dims.dpi);
    h = physicalToPixels(h, dims.unit, dims.dpi);
  }

  if (dims.lockAspect) {
    const ratio = naturalW / naturalH;
    if (w / h > ratio) w = Math.round(h * ratio);
    else h = Math.round(w / ratio);
  }

  return { outW: Math.max(1, Math.round(w)), outH: Math.max(1, Math.round(h)) };
}

/** Saliency-weighted center for content-aware crop (edge + center bias). */
export function detectSaliencyCenter(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): { cx: number; cy: number } {
  let sumX = 0;
  let sumY = 0;
  let total = 0;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 128));

  for (let y = step; y < h - step; y += step) {
    for (let x = step; x < w - step; x += step) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      const li = (y * w + (x - step)) * 4;
      const ri = (y * w + (x + step)) * 4;
      const ti = ((y - step) * w + x) * 4;
      const bi = ((y + step) * w + x) * 4;
      const edge =
        Math.abs(lum - (0.299 * data[li]! + 0.587 * data[li + 1]! + 0.114 * data[li + 2]!)) +
        Math.abs(lum - (0.299 * data[ri]! + 0.587 * data[ri + 1]! + 0.114 * data[ri + 2]!)) +
        Math.abs(lum - (0.299 * data[ti]! + 0.587 * data[ti + 1]! + 0.114 * data[ti + 2]!)) +
        Math.abs(lum - (0.299 * data[bi]! + 0.587 * data[bi + 1]! + 0.114 * data[bi + 2]!));
      const cx = w / 2;
      const cy = h / 2;
      const dist = 1 - Math.min(1, Math.hypot(x - cx, y - cy) / Math.hypot(cx, cy));
      const weight = edge * 0.7 + dist * 30 + (255 - Math.abs(lum - 128)) * 0.05;
      sumX += x * weight;
      sumY += y * weight;
      total += weight;
    }
  }

  if (total <= 0) return { cx: w / 2, cy: h / 2 };
  return { cx: sumX / total, cy: sumY / total };
}

async function applyTransform(bitmap: ImageBitmap, transform: ResizeTransform): Promise<ImageBitmap> {
  const imgW = bitmap.width;
  const imgH = bitmap.height;
  const rotated = transform.rotation === 90 || transform.rotation === 270;
  const baseW = rotated ? imgH : imgW;
  const baseH = rotated ? imgW : imgH;

  const canvas = document.createElement("canvas");
  canvas.width = baseW;
  canvas.height = baseH;
  const ctx = canvas.getContext("2d")!;
  ctx.translate(baseW / 2, baseH / 2);
  ctx.rotate((transform.rotation * Math.PI) / 180);
  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
  ctx.drawImage(bitmap, -imgW / 2, -imgH / 2);
  bitmap.close();

  return createImageBitmap(canvas);
}

function applySharpen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const copy = new Uint8ClampedArray(d);
    const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let v = 0;
          let ki = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const si = ((y + ky) * w + (x + kx)) * 4 + c;
              v += copy[si]! * k[ki]!;
              ki++;
            }
          }
          d[(y * w + x) * 4 + c] = clamp(v, 0, 255);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    /* ignore cross-origin */
  }
}

export async function resizeToCanvas(
  source: ImageBitmap,
  dims: ResizeDimensions,
  transform: ResizeTransform,
  exportOpts: ResizeExportOptions,
): Promise<{ canvas: HTMLCanvasElement; outW: number; outH: number }> {
  let bitmap = source;
  if (transform.rotation || transform.flipH || transform.flipV) {
    bitmap = await applyTransform(source, transform);
  }

  const srcW = bitmap.width;
  const srcH = bitmap.height;
  let { outW, outH } = computeOutputPixels(srcW, srcH, dims);

  if (!dims.upscale) {
    if (dims.fit === "stretch" || dims.unit === "%") {
      outW = Math.min(outW, srcW);
      outH = Math.min(outH, srcH);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { alpha: exportOpts.format !== "image/jpeg" })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const needsAlpha =
    exportOpts.preserveTransparency &&
    exportOpts.format !== "image/jpeg" &&
    exportOpts.format !== "image/bmp";

  if (needsAlpha) ctx.clearRect(0, 0, outW, outH);
  else {
    const [r, g, b] = parseHex(exportOpts.flattenBackground);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, outW, outH);
  }

  const srcRatio = srcW / srcH;
  const dstRatio = outW / outH;

  if (dims.fit === "stretch" || dims.unit === "%") {
    ctx.drawImage(bitmap, 0, 0, outW, outH);
  } else if (dims.fit === "contain") {
    const [r, g, b] = parseHex(dims.padColor);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, outW, outH);
    let dw: number;
    let dh: number;
    if (srcRatio > dstRatio) {
      dw = outW;
      dh = Math.round(outW / srcRatio);
    } else {
      dh = outH;
      dw = Math.round(outH * srcRatio);
    }
    const dx = (outW - dw) / 2;
    const dy = (outH - dh) / 2;
    ctx.drawImage(bitmap, dx, dy, dw, dh);
  } else {
    let dw: number;
    let dh: number;
    if (srcRatio > dstRatio) {
      dh = outH;
      dw = Math.round(outH * srcRatio);
    } else {
      dw = outW;
      dh = Math.round(outW / srcRatio);
    }

    let sx = (srcW - dw) / 2;
    let sy = (srcH - dh) / 2;

    if (dims.fit === "content-aware") {
      const tmp = document.createElement("canvas");
      tmp.width = srcW;
      tmp.height = srcH;
      tmp.getContext("2d")!.drawImage(bitmap, 0, 0);
      const { data } = tmp.getContext("2d")!.getImageData(0, 0, srcW, srcH);
      const { cx, cy } = detectSaliencyCenter(data, srcW, srcH);
      sx = clamp(cx - dw / 2, 0, srcW - dw);
      sy = clamp(cy - dh / 2, 0, srcH - dh);
    }

    ctx.drawImage(bitmap, sx, sy, dw, dh, 0, 0, outW, outH);
  }

  if (exportOpts.sharpen && (outW < srcW || outH < srcH)) {
    applySharpen(ctx, outW, outH);
  }

  if (bitmap !== source) bitmap.close();
  return { canvas, outW, outH };
}

export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  exportOpts: ResizeExportOptions,
): Promise<{ blob: Blob; format: OutputFormat }> {
  const cap = detectEncodingSupport();
  let fmt = exportOpts.format;
  if (fmt === "image/avif" && !cap.avif) fmt = "image/webp";
  else if (fmt === "image/webp" && !cap.webp) fmt = "image/jpeg";
  else if (fmt === "image/gif" && !cap.gif) fmt = "image/png";
  else if (fmt === "image/tiff") fmt = "image/png";

  let quality = exportOpts.quality;
  if (exportOpts.losslessOptimize && !LOSSY_FORMATS.includes(fmt)) quality = 1;
  else if (exportOpts.losslessOptimize && (fmt === "image/webp" || fmt === "image/avif")) quality = 1;

  let blob: Blob;
  if (fmt === "image/bmp") blob = encodeBMP(canvas);
  else if (fmt === "image/x-icon") blob = encodeICO(canvas);
  else blob = await canvasToBlob(canvas, fmt, quality);

  return { blob, format: fmt };
}

export interface ResizeResult {
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  format: OutputFormat;
  previewUrl: string;
  durationMs: number;
}

export async function resizeImage(
  file: File | Blob,
  dims: ResizeDimensions,
  transform: ResizeTransform,
  exportOpts: ResizeExportOptions,
): Promise<ResizeResult> {
  const start = performance.now();
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { canvas, outW, outH } = await resizeToCanvas(bitmap, dims, transform, exportOpts);
  bitmap.close();
  const { blob, format } = await encodeCanvas(canvas, exportOpts);
  const previewUrl = URL.createObjectURL(blob);
  return {
    blob,
    bytes: blob.size,
    width: outW,
    height: outH,
    format,
    previewUrl,
    durationMs: Math.round(performance.now() - start),
  };
}

export async function loadImageMeta(file: File): Promise<{
  w: number;
  h: number;
  thumbUrl: string;
  bytes: number;
  hasAlpha: boolean;
}> {
  const { bitmap, meta } = await analyzeImage(file);
  const max = 280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return {
    w: meta.width,
    h: meta.height,
    thumbUrl: canvas.toDataURL("image/jpeg", 0.75),
    bytes: file.size,
    hasAlpha: meta.hasAlpha,
  };
}

export function buildOutputName(originalName: string, format: OutputFormat, suffix = "resized"): string {
  const stem = originalName.replace(/\.[^.]+$/, "") || "image";
  return `${stem}-${suffix}.${FORMAT_EXTENSIONS[format]}`;
}

export function aiResizeRecommendations(
  naturalW: number,
  naturalH: number,
  hasAlpha: boolean,
  dims: ResizeDimensions,
  exportOpts: ResizeExportOptions,
): ResizeAiRec[] {
  const recs: ResizeAiRec[] = [];
  const { outW, outH } = computeOutputPixels(naturalW, naturalH, dims);
  const mp = (naturalW * naturalH) / 1_000_000;

  if (outW > naturalW * 2 || outH > naturalH * 2) {
    recs.push({
      level: "warning",
      title: "Heavy upscaling",
      detail: "Output is more than 2× source — enable Upscale or reduce target size to avoid blur.",
    });
  }
  if (mp > 12 && exportOpts.format === "image/png" && !hasAlpha) {
    recs.push({
      level: "info",
      title: "Large photo without alpha",
      detail: "WebP or JPG at 92% quality will be much smaller than PNG.",
      action: "webp",
    });
  }
  if (hasAlpha && exportOpts.format === "image/jpeg") {
    recs.push({
      level: "warning",
      title: "JPG removes transparency",
      detail: "Switch to PNG or WebP to preserve alpha.",
      action: "png",
    });
  }
  if (naturalW > 3000 && dims.unit === "px" && dims.width === naturalW) {
    recs.push({
      level: "info",
      title: "Web delivery size",
      detail: "1920px width is ideal for most websites — try HD preset.",
      action: "preset-hd",
    });
  }
  if (dims.fit === "stretch" && Math.abs(naturalW / naturalH - dims.width / dims.height) > 0.1) {
    recs.push({
      level: "info",
      title: "Aspect ratio mismatch",
      detail: "Contain or Cover fit avoids distortion; Content-aware keeps subjects centered.",
      action: "contain",
    });
  }
  if (recs.length === 0) {
    recs.push({
      level: "success",
      title: "Ready to resize",
      detail: `${outW}×${outH}px · ${exportOpts.format.split("/")[1]?.toUpperCase() ?? "WEBP"}`,
    });
  }
  return recs.slice(0, 5);
}

export function smartResizeTips(
  naturalW: number,
  naturalH: number,
  dims: ResizeDimensions,
  itemCount: number,
): string[] {
  const tips: string[] = [];
  const { outW, outH } = computeOutputPixels(naturalW, naturalH, dims);
  if (itemCount > 1) tips.push(`${itemCount} files queued — batch export downloads a ZIP.`);
  if (dims.fit === "content-aware") tips.push("Content-aware mode uses edge + saliency detection to center crop.");
  if (dims.unit !== "px") tips.push(`Physical units converted at ${dims.dpi} DPI/PPI.`);
  if (outW * outH > 8_000_000) tips.push("Output exceeds 8 MP — consider WebP/AVIF for smaller files.");
  if (!dims.upscale && (outW > naturalW || outH > naturalH)) {
    tips.push("Upscale disabled — output capped at source dimensions.");
  }
  return tips;
}

export async function resizeBatch(
  items: ResizeItem[],
  dims: ResizeDimensions,
  transform: ResizeTransform,
  exportOpts: ResizeExportOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<ResizeItem[]> {
  const results: ResizeItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    try {
      const result = await resizeImage(item.file, dims, transform, exportOpts);
      results.push({
        ...item,
        status: "done",
        resultUrl: result.previewUrl,
        resultBytes: result.bytes,
        outputW: result.width,
        outputH: result.height,
      });
    } catch (e) {
      results.push({
        ...item,
        status: "error",
        error: e instanceof Error ? e.message : "Resize failed",
        resultUrl: "",
        resultBytes: 0,
        outputW: 0,
        outputH: 0,
      });
    }
    onProgress?.(i + 1, items.length);
  }
  return results;
}

export async function zipResizeResults(items: ResizeItem[], format: OutputFormat): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const item of items) {
    if (item.status !== "done" || !item.resultUrl) continue;
    const res = await fetch(item.resultUrl);
    const blob = await res.blob();
    zip.file(buildOutputName(item.name, format), blob);
  }
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/zip",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export interface ApiResizeRequest {
  width: number;
  height: number;
  unit?: SizeUnit;
  dpi?: number;
  fit?: ResizeFit;
  lockAspect?: boolean;
  rotate?: Rotation;
  flipH?: boolean;
  flipV?: boolean;
  format?: OutputFormat;
  quality?: number;
  padColor?: string;
  upscale?: boolean;
}
