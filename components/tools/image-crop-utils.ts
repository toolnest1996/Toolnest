/**
 * Ultra Image Crop Studio — transforms, smart crop, perspective warp, batch export.
 * 100% client-side via Canvas + createImageBitmap. Reuses format encoders from
 * image-compressor-utils.
 */

import {
  type CropRect,
  type OutputFormat,
  FORMAT_EXTENSIONS,
  LOSSY_FORMATS,
  encodeBMP,
  encodeICO,
  detectEncodingSupport,
  isBrowserEncodable,
  isSupportedInput,
} from "./image-compressor-utils";

export type { CropRect, OutputFormat };

export type Rotation = 0 | 90 | 180 | 270;
export type CropShape = "rect" | "circle";

export interface CropTransform {
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
  /** -45 .. 45 degrees */
  straighten: number;
  zoom: number;
  panX: number;
  panY: number;
}

export interface PerspectiveCorners {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  br: { x: number; y: number };
  bl: { x: number; y: number };
}

export interface CropExportOptions {
  format: OutputFormat;
  quality: number;
  outputWidth: number;
  outputHeight: number;
  preserveTransparency: boolean;
  flattenBackground: string;
  stripMetadata: boolean;
  shape: CropShape;
  perspective: PerspectiveCorners | null;
}

export interface CropItem {
  id: string;
  file: File;
  name: string;
  originalBytes: number;
  naturalW: number;
  naturalH: number;
  thumbUrl: string;
  crop: CropRect | null;
  transform: CropTransform;
  perspective: PerspectiveCorners | null;
  status: "queued" | "cropping" | "done" | "error";
  resultUrl: string;
  resultBytes: number;
  error?: string;
}

export const DEFAULT_TRANSFORM: CropTransform = {
  rotation: 0,
  flipH: false,
  flipV: false,
  straighten: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
};

export const DEFAULT_EXPORT: CropExportOptions = {
  format: "image/png",
  quality: 0.92,
  outputWidth: 0,
  outputHeight: 0,
  preserveTransparency: true,
  flattenBackground: "#ffffff",
  stripMetadata: true,
  shape: "rect",
  perspective: null,
};

export interface AspectPreset {
  id: string;
  label: string;
  ratio: number | null;
  category: "general" | "social" | "print" | "video";
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: "free", label: "Freeform", ratio: null, category: "general" },
  { id: "1:1", label: "1:1 Square", ratio: 1, category: "general" },
  { id: "4:3", label: "4:3", ratio: 4 / 3, category: "general" },
  { id: "3:4", label: "3:4 Portrait", ratio: 3 / 4, category: "general" },
  { id: "16:9", label: "16:9 Widescreen", ratio: 16 / 9, category: "video" },
  { id: "9:16", label: "9:16 Story", ratio: 9 / 16, category: "social" },
  { id: "4:5", label: "4:5 Instagram Portrait", ratio: 4 / 5, category: "social" },
  { id: "1.91:1", label: "1.91:1 Facebook Link", ratio: 1.91, category: "social" },
  { id: "2:1", label: "2:1 Twitter Header", ratio: 2, category: "social" },
  { id: "1.778:1", label: "16:9 YouTube Thumb", ratio: 16 / 9, category: "social" },
  { id: "2:3", label: "2:3 Pinterest", ratio: 2 / 3, category: "social" },
  { id: "3:2", label: "3:2 Photo", ratio: 3 / 2, category: "general" },
  { id: "a4p", label: "A4 Portrait", ratio: 210 / 297, category: "print" },
  { id: "a4l", label: "A4 Landscape", ratio: 297 / 210, category: "print" },
  { id: "linkedin", label: "LinkedIn Banner 4:1", ratio: 4, category: "social" },
  { id: "tiktok", label: "TikTok 9:16", ratio: 9 / 16, category: "social" },
];

export function defaultPerspective(): PerspectiveCorners {
  return {
    tl: { x: 0, y: 0 },
    tr: { x: 1, y: 0 },
    br: { x: 1, y: 1 },
    bl: { x: 0, y: 1 },
  };
}

function clamp(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality);
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Transform baking (rotate / flip / straighten)
 * ──────────────────────────────────────────────────────────────────────────── */

export async function bakeTransform(
  source: Blob | File,
  transform: CropTransform,
  bg = "#ffffff",
): Promise<{ blob: Blob; width: number; height: number; url: string }> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  const imgW = bitmap.width;
  const imgH = bitmap.height;
  const rotated = transform.rotation === 90 || transform.rotation === 270;
  const baseW = rotated ? imgH : imgW;
  const baseH = rotated ? imgW : imgH;

  let canvas: HTMLCanvasElement;
  if (transform.straighten === 0) {
    canvas = document.createElement("canvas");
    canvas.width = baseW;
    canvas.height = baseH;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(baseW / 2, baseH / 2);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
    ctx.drawImage(bitmap, -imgW / 2, -imgH / 2);
  } else {
    const rad = (transform.straighten * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const newW = Math.ceil(baseW * cos + baseH * sin);
    const newH = Math.ceil(baseW * sin + baseH * cos);
    canvas = document.createElement("canvas");
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, newW, newH);
    ctx.translate(newW / 2, newH / 2);
    ctx.rotate(rad);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
    ctx.drawImage(bitmap, -imgW / 2, -imgH / 2);
  }
  bitmap.close();
  const blob = await canvasToBlob(canvas, "image/png");
  const url = URL.createObjectURL(blob);
  return { blob, width: canvas.width, height: canvas.height, url };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Perspective warp — bilinear quad → rectangle
 * ──────────────────────────────────────────────────────────────────────────── */

function quadPoint(u: number, v: number, c: PerspectiveCorners, w: number, h: number) {
  const tl = { x: c.tl.x * w, y: c.tl.y * h };
  const tr = { x: c.tr.x * w, y: c.tr.y * h };
  const br = { x: c.br.x * w, y: c.br.y * h };
  const bl = { x: c.bl.x * w, y: c.bl.y * h };
  return {
    x: (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + u * v * br.x + (1 - u) * v * bl.x,
    y: (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + u * v * br.y + (1 - u) * v * bl.y,
  };
}

function isDefaultPerspective(c: PerspectiveCorners): boolean {
  const eps = 0.001;
  return (
    Math.abs(c.tl.x) < eps && Math.abs(c.tl.y) < eps &&
    Math.abs(c.tr.x - 1) < eps && Math.abs(c.tr.y) < eps &&
    Math.abs(c.br.x - 1) < eps && Math.abs(c.br.y - 1) < eps &&
    Math.abs(c.bl.x) < eps && Math.abs(c.bl.y - 1) < eps
  );
}

export async function warpPerspective(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  corners: PerspectiveCorners,
  maxSide = 4096,
): Promise<HTMLCanvasElement> {
  const aspect = srcW / srcH;
  let outW = Math.min(maxSide, srcW);
  let outH = Math.round(outW / aspect);
  if (outH > maxSide) { outH = maxSide; outW = Math.round(outH * aspect); }

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  srcCanvas.getContext("2d")!.drawImage(source, 0, 0);
  const srcData = srcCanvas.getContext("2d")!.getImageData(0, 0, srcW, srcH);

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext("2d")!;
  const outData = outCtx.createImageData(outW, outH);
  const sd = srcData.data;
  const od = outData.data;

  for (let y = 0; y < outH; y++) {
    const v = outH <= 1 ? 0 : y / (outH - 1);
    for (let x = 0; x < outW; x++) {
      const u = outW <= 1 ? 0 : x / (outW - 1);
      const sp = quadPoint(u, v, corners, srcW, srcH);
      const sx = Math.round(sp.x);
      const sy = Math.round(sp.y);
      const oi = (y * outW + x) * 4;
      if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH) {
        const si = (sy * srcW + sx) * 4;
        od[oi] = sd[si];
        od[oi + 1] = sd[si + 1];
        od[oi + 2] = sd[si + 2];
        od[oi + 3] = sd[si + 3];
      }
    }
  }
  outCtx.putImageData(outData, 0, 0);
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Smart auto-crop
 * ──────────────────────────────────────────────────────────────────────────── */

export type SmartCropMode = "center" | "trim" | "face" | "subject";

export async function smartAutoCrop(
  source: Blob | File,
  mode: SmartCropMode,
  aspectRatio: number | null,
): Promise<CropRect> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  const w = bitmap.width;
  const h = bitmap.height;

  if (mode === "trim") {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;
    bitmap.close();

    const threshold = 18;
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const edge = x > 0 && Math.abs(lum - (0.299 * data[i - 4] + 0.587 * data[i - 3] + 0.114 * data[i - 2])) > threshold;
        const notBorder = lum < 250 && lum > 5;
        if (edge || notBorder) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX <= minX) return { x: 0, y: 0, w: 1, h: 1 };
    const pad = Math.round(Math.min(w, h) * 0.02);
    minX = clamp(minX - pad, 0, w - 1);
    minY = clamp(minY - pad, 0, h - 1);
    maxX = clamp(maxX + pad, minX + 1, w);
    maxY = clamp(maxY + pad, minY + 1, h);
    let rect: CropRect = { x: minX / w, y: minY / h, w: (maxX - minX) / w, h: (maxY - minY) / h };
    return aspectRatio ? fitAspect(rect, aspectRatio) : rect;
  }

  if (mode === "face") {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();
    const FD = (window as unknown as { FaceDetector?: new () => { detect: (src: CanvasImageSource) => Promise<{ boundingBox: DOMRectReadOnly }[]> } }).FaceDetector;
    if (FD) {
      try {
        const detector = new FD();
        const faces = await detector.detect(canvas);
        if (faces.length) {
          const box = faces.reduce((a, f) => {
            const b = f.boundingBox;
            return {
              x: Math.min(a.x, b.x),
              y: Math.min(a.y, b.y),
              r: Math.max(a.r, b.x + b.width),
              b: Math.max(a.b, b.y + b.height),
            };
          }, { x: Infinity, y: Infinity, r: -Infinity, b: -Infinity });
          const padX = (box.r - box.x) * 0.35;
          const padY = (box.b - box.y) * 0.45;
          let cx = (box.x + box.r) / 2;
          let cy = (box.y + box.b) / 2;
          let cw = box.r - box.x + padX * 2;
          let ch = box.b - box.y + padY * 2;
          if (aspectRatio) {
            if (cw / ch > aspectRatio) ch = cw / aspectRatio;
            else cw = ch * aspectRatio;
          }
          let x = clamp((cx - cw / 2) / w, 0, 1);
          let y = clamp((cy - ch / 2) / h, 0, 1);
          let rw = clamp(cw / w, 0.01, 1);
          let rh = clamp(ch / h, 0.01, 1);
          if (x + rw > 1) x = 1 - rw;
          if (y + rh > 1) y = 1 - rh;
          return { x, y, w: rw, h: rh };
        }
      } catch { /* fall through */ }
    }
  }

  // center / subject — rule-of-thirds weighted center crop
  bitmap.close();
  let rw = 0.85;
  let rh = 0.85;
  if (aspectRatio) {
    if (aspectRatio >= w / h) { rh = 0.92; rw = (rh * h * aspectRatio) / w; }
    else { rw = 0.92; rh = (rw * w) / (aspectRatio * h); }
    rw = clamp(rw, 0.1, 1);
    rh = clamp(rh, 0.1, 1);
  }
  return { x: (1 - rw) / 2, y: (1 - rh) / 2, w: rw, h: rh };
}

export function fitAspect(rect: CropRect, ratio: number): CropRect {
  const current = rect.w / rect.h;
  let w = rect.w;
  let h = rect.h;
  if (current > ratio) w = h * ratio;
  else h = w / ratio;
  let x = rect.x + (rect.w - w) / 2;
  let y = rect.y + (rect.h - h) / 2;
  x = clamp(x, 0, 1 - w);
  y = clamp(y, 0, 1 - h);
  return { x, y, w: clamp(w, 0.01, 1), h: clamp(h, 0.01, 1) };
}

export function centerCropForAspect(imgW: number, imgH: number, ratio: number | null): CropRect {
  if (!ratio) return { x: 0, y: 0, w: 1, h: 1 };
  const imgR = imgW / imgH;
  if (imgR > ratio) {
    const w = (ratio * imgH) / imgW;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = imgW / (ratio * imgH);
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Apply crop + export
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CropResult {
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  format: OutputFormat;
  previewUrl: string;
  durationMs: number;
}

export async function exportCroppedImage(
  source: Blob | File,
  crop: CropRect | null,
  transform: CropTransform,
  exportOpts: CropExportOptions,
): Promise<CropResult> {
  const start = performance.now();
  let working: Blob = source;
  let srcW = 0;
  let srcH = 0;

  const needsBake = transform.rotation !== 0 || transform.flipH || transform.flipV || transform.straighten !== 0;
  if (needsBake) {
    const baked = await bakeTransform(source, transform, exportOpts.flattenBackground);
    working = baked.blob;
    srcW = baked.width;
    srcH = baked.height;
  }

  const bitmap = await createImageBitmap(working, { imageOrientation: "from-image" });
  if (!srcW) { srcW = bitmap.width; srcH = bitmap.height; }

  let canvas = document.createElement("canvas");
  canvas.width = srcW;
  canvas.height = srcH;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();

  if (exportOpts.perspective && !isDefaultPerspective(exportOpts.perspective)) {
    canvas = await warpPerspective(canvas, srcW, srcH, exportOpts.perspective);
    srcW = canvas.width;
    srcH = canvas.height;
  }

  const effectiveCrop = crop && crop.w > 0 && crop.h > 0 ? crop : { x: 0, y: 0, w: 1, h: 1 };
  const sx = Math.round(effectiveCrop.x * srcW);
  const sy = Math.round(effectiveCrop.y * srcH);
  const sw = Math.max(1, Math.min(srcW - sx, Math.round(effectiveCrop.w * srcW)));
  const sh = Math.max(1, Math.min(srcH - sy, Math.round(effectiveCrop.h * srcH)));

  let outW = exportOpts.outputWidth > 0 ? exportOpts.outputWidth : sw;
  let outH = exportOpts.outputHeight > 0 ? exportOpts.outputHeight : sh;
  if (exportOpts.outputWidth > 0 && exportOpts.outputHeight <= 0) outH = Math.round(outW * (sh / sw));
  if (exportOpts.outputHeight > 0 && exportOpts.outputWidth <= 0) outW = Math.round(outH * (sw / sh));

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const fmt = exportOpts.format;
  const lossy = LOSSY_FORMATS.includes(fmt);
  if (lossy || !exportOpts.preserveTransparency) {
    ctx.fillStyle = exportOpts.flattenBackground;
    ctx.fillRect(0, 0, outW, outH);
  } else {
    ctx.clearRect(0, 0, outW, outH);
  }

  if (exportOpts.shape === "circle") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(outW / 2, outH / 2, Math.min(outW, outH) / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
  }

  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, outW, outH);
  if (exportOpts.shape === "circle") ctx.restore();

  let blob: Blob;
  const cap = detectEncodingSupport();
  let actualFormat = fmt;

  if (fmt === "image/bmp") {
    blob = encodeBMP(out);
  } else if (fmt === "image/x-icon") {
    blob = encodeICO(out);
  } else if (fmt === "image/tiff" && !isBrowserEncodable(fmt)) {
    blob = await canvasToBlob(out, "image/png");
    actualFormat = "image/png";
  } else if (fmt === "image/avif" && !cap.avif) {
    blob = await canvasToBlob(out, "image/webp", exportOpts.quality);
    actualFormat = "image/webp";
  } else {
    blob = await canvasToBlob(out, fmt, lossy ? exportOpts.quality : undefined);
  }

  const previewUrl = URL.createObjectURL(blob);
  return {
    blob,
    bytes: blob.size,
    width: outW,
    height: outH,
    format: actualFormat,
    previewUrl,
    durationMs: Math.round(performance.now() - start),
  };
}

export async function cropBatch(
  items: CropItem[],
  crop: CropRect | null,
  transform: CropTransform,
  exportOpts: CropExportOptions,
  onProgress?: (item: CropItem, index: number, total: number) => void,
): Promise<CropItem[]> {
  const out: CropItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = { ...items[i] };
    item.status = "cropping";
    onProgress?.(item, i, items.length);
    try {
      const itemCrop = item.crop ?? crop;
      const itemTransform = item.transform ?? transform;
      const result = await exportCroppedImage(item.file, itemCrop, itemTransform, {
        ...exportOpts,
        perspective: item.perspective ?? exportOpts.perspective,
      });
      item.resultUrl = result.previewUrl;
      item.resultBytes = result.bytes;
      item.status = "done";
    } catch (e) {
      item.status = "error";
      item.error = e instanceof Error ? e.message : "crop failed";
    }
    out.push(item);
  }
  return out;
}

export function buildOutputName(originalName: string, format: OutputFormat): string {
  const stem = originalName.replace(/\.[^.]+$/, "") || "cropped";
  return `${stem}-cropped.${FORMAT_EXTENSIONS[format]}`;
}

export async function loadImageMeta(file: File): Promise<{ w: number; h: number; thumbUrl: string; bytes: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const max = 280;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const thumbUrl = canvas.toDataURL("image/jpeg", 0.75);
  return { w: canvas.width / scale, h: canvas.height / scale, thumbUrl, bytes: file.size };
}

/* ────────────────────────────────────────────────────────────────────────────
 * AI recommendations
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CropAiRec {
  level: "info" | "warning";
  title: string;
  detail: string;
  action?: "smart-face" | "smart-trim" | "ec-h" | "png" | "aspect-1:1";
}

export function aiRecommendCrop(
  crop: CropRect | null,
  naturalW: number,
  naturalH: number,
  aspectId: string,
  exportOpts: CropExportOptions,
): CropAiRec[] {
  const recs: CropAiRec[] = [];
  if (!crop || crop.w < 0.05 || crop.h < 0.05) {
    recs.push({ level: "warning", title: "Draw a crop region", detail: "Drag on the image or use Smart Crop to select an area." });
    return recs;
  }
  const outW = exportOpts.outputWidth || Math.round(crop.w * naturalW);
  const outH = exportOpts.outputHeight || Math.round(crop.h * naturalH);
  if (outW < 400 || outH < 400) {
    recs.push({ level: "warning", title: "Low output resolution", detail: "Crop output is under 400px — may look blurry on retina displays." });
  }
  if (exportOpts.format === "image/jpeg" && exportOpts.preserveTransparency) {
    recs.push({ level: "info", title: "JPG removes transparency", detail: "Use PNG or WebP to preserve alpha.", action: "png" });
  }
  if (aspectId === "free" && naturalW === naturalH) {
    recs.push({ level: "info", title: "Square source", detail: "1:1 works well for profile photos and Instagram.", action: "aspect-1:1" });
  }
  if (crop.w > 0.95 && crop.h > 0.95) {
    recs.push({ level: "info", title: "Try Smart Trim", detail: "Auto-trim detects content boundaries and removes empty margins.", action: "smart-trim" });
  }
  if (recs.length === 0) {
    recs.push({ level: "info", title: "Ready to export", detail: `${outW}×${outH}px · ${exportOpts.format.split("/")[1]?.toUpperCase() ?? "PNG"}` });
  }
  return recs;
}

export { isSupportedInput, detectEncodingSupport, FORMAT_EXTENSIONS };
