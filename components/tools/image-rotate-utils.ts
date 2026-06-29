/**
 * Ultra Image Rotate & Flip Studio — transforms, horizon AI, perspective, batch export.
 * 100% client-side via Canvas + createImageBitmap. Reuses encoders from image-compressor-utils.
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
} from "./image-compressor-utils";
import {
  type PerspectiveCorners,
  defaultPerspective,
  warpPerspective,
} from "./image-crop-utils";

export type { OutputFormat, PerspectiveCorners };
export { isSupportedInput, defaultPerspective };

export type Rotation90 = 0 | 90 | 180 | 270;
export type CanvasMode = "expand" | "crop" | "original";

export interface RotateTransform {
  rotation: Rotation90;
  /** Additional free rotation in degrees (-180 … 180) */
  customAngle: number;
  flipH: boolean;
  flipV: boolean;
  /** Fine straighten (-45 … 45) */
  straighten: number;
}

export interface RotateExportOptions {
  format: OutputFormat;
  quality: number;
  preserveTransparency: boolean;
  flattenBackground: string;
  stripMetadata: boolean;
  canvasMode: CanvasMode;
  perspective: PerspectiveCorners | null;
  outputWidth: number;
  outputHeight: number;
  /** Apply EXIF orientation on load (createImageBitmap from-image) */
  applyExif: boolean;
}

export interface RotateItem {
  id: string;
  file: File;
  name: string;
  originalBytes: number;
  naturalW: number;
  naturalH: number;
  thumbUrl: string;
  transform: RotateTransform;
  perspective: PerspectiveCorners | null;
  status: "queued" | "processing" | "done" | "error";
  resultUrl: string;
  resultBytes: number;
  error?: string;
}

export const DEFAULT_TRANSFORM: RotateTransform = {
  rotation: 0,
  customAngle: 0,
  flipH: false,
  flipV: false,
  straighten: 0,
};

export const DEFAULT_EXPORT: RotateExportOptions = {
  format: "image/png",
  quality: 0.92,
  preserveTransparency: true,
  flattenBackground: "#ffffff",
  stripMetadata: true,
  canvasMode: "expand",
  perspective: null,
  outputWidth: 0,
  outputHeight: 0,
  applyExif: true,
};

function clamp(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality);
  });
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

/** Total rotation in radians (90° steps + custom + straighten). */
export function totalAngleDeg(t: RotateTransform): number {
  return t.rotation + t.customAngle + t.straighten;
}

/** True when re-encoding PNG at 90° multiples with no flips is visually lossless (no resampling artifacts from angle). */
export function isLosslessPath(t: RotateTransform, format: OutputFormat): boolean {
  if (LOSSY_FORMATS.includes(format)) return false;
  if (t.flipH || t.flipV) return false;
  if (t.customAngle !== 0 || t.straighten !== 0) return false;
  return t.rotation % 90 === 0;
}

function boundingSize(w: number, h: number, rad: number): { w: number; h: number } {
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return {
    w: Math.ceil(w * cos + h * sin),
    h: Math.ceil(w * sin + h * cos),
  };
}

/**
 * Bake all transforms onto a canvas and return dimensions + canvas.
 */
export async function bakeRotateCanvas(
  source: Blob | File,
  transform: RotateTransform,
  opts: Pick<RotateExportOptions, "canvasMode" | "flattenBackground" | "applyExif">,
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const orient = opts.applyExif ? ("from-image" as const) : ("none" as const);
  const bitmap = await createImageBitmap(source, { imageOrientation: orient });
  const imgW = bitmap.width;
  const imgH = bitmap.height;

  const rad90 = (transform.rotation * Math.PI) / 180;
  const radCustom = (transform.customAngle * Math.PI) / 180;
  const radStraight = (transform.straighten * Math.PI) / 180;
  const totalRad = rad90 + radCustom + radStraight;

  const after90 = transform.rotation === 90 || transform.rotation === 270;
  const baseW = after90 ? imgH : imgW;
  const baseH = after90 ? imgW : imgH;

  let outW: number;
  let outH: number;
  if (opts.canvasMode === "original") {
    outW = baseW;
    outH = baseH;
  } else if (opts.canvasMode === "crop") {
    outW = baseW;
    outH = baseH;
  } else {
    const bb = boundingSize(baseW, baseH, totalRad - rad90);
    outW = bb.w;
    outH = bb.h;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, outW);
  canvas.height = Math.max(1, outH);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = opts.flattenBackground;
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(totalRad);
  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
  ctx.drawImage(bitmap, -imgW / 2, -imgH / 2);
  bitmap.close();

  if (opts.canvasMode === "crop" && (totalRad !== 0 || transform.flipH || transform.flipV)) {
    const trimmed = trimTransparentOrBackground(canvas, opts.flattenBackground);
    return { canvas: trimmed, width: trimmed.width, height: trimmed.height };
  }

  return { canvas, width: canvas.width, height: canvas.height };
}

/** Trim uniform background margins after rotation. */
function trimTransparentOrBackground(canvas: HTMLCanvasElement, bg: string): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  const data = ctx.getImageData(0, 0, w, h).data;
  const [br, bgC, bb] = parseHex(bg);
  const threshold = 28;

  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      const diff =
        Math.abs(data[i] - br) + Math.abs(data[i + 1] - bgC) + Math.abs(data[i + 2] - bb);
      if (a > 10 && diff > threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX <= minX) return canvas;
  const tw = maxX - minX + 1;
  const th = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  out.getContext("2d")!.drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);
  return out;
}

function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface RotateResult {
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  format: OutputFormat;
  previewUrl: string;
  durationMs: number;
  lossless: boolean;
}

export async function exportRotatedImage(
  source: Blob | File,
  transform: RotateTransform,
  exportOpts: RotateExportOptions,
): Promise<RotateResult> {
  const start = performance.now();
  const { canvas: baked, width: srcW, height: srcH } = await bakeRotateCanvas(source, transform, {
    canvasMode: exportOpts.canvasMode,
    flattenBackground: exportOpts.flattenBackground,
    applyExif: exportOpts.applyExif,
  });

  let canvas = baked;
  let w = srcW;
  let h = srcH;

  const persp = exportOpts.perspective;
  if (persp && !isDefaultPerspective(persp)) {
    canvas = await warpPerspective(canvas, w, h, persp);
    w = canvas.width;
    h = canvas.height;
  }

  let outW = exportOpts.outputWidth > 0 ? exportOpts.outputWidth : w;
  let outH = exportOpts.outputHeight > 0 ? exportOpts.outputHeight : h;
  if (exportOpts.outputWidth > 0 && exportOpts.outputHeight <= 0) outH = Math.round(outW * (h / w));
  if (exportOpts.outputHeight > 0 && exportOpts.outputWidth <= 0) outW = Math.round(outH * (w / h));

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
  ctx.drawImage(canvas, 0, 0, outW, outH);

  let blob: Blob;
  const cap = detectEncodingSupport();
  let actualFormat = fmt;

  if (fmt === "image/bmp") blob = encodeBMP(out);
  else if (fmt === "image/x-icon") blob = encodeICO(out);
  else if (fmt === "image/tiff" && !isBrowserEncodable(fmt)) {
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
    lossless: isLosslessPath(transform, actualFormat),
  };
}

export async function rotateBatch(
  items: RotateItem[],
  transform: RotateTransform,
  exportOpts: RotateExportOptions,
  onProgress?: (item: RotateItem, index: number, total: number) => void,
): Promise<RotateItem[]> {
  const out: RotateItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = { ...items[i] };
    item.status = "processing";
    onProgress?.(item, i, items.length);
    try {
      const t = item.transform ?? transform;
      const result = await exportRotatedImage(item.file, t, {
        ...exportOpts,
        perspective: item.perspective ?? exportOpts.perspective,
      });
      item.resultUrl = result.previewUrl;
      item.resultBytes = result.bytes;
      item.status = "done";
    } catch (e) {
      item.status = "error";
      item.error = e instanceof Error ? e.message : "rotate failed";
    }
    out.push(item);
  }
  return out;
}

export function buildOutputName(originalName: string, format: OutputFormat): string {
  const stem = originalName.replace(/\.[^.]+$/, "") || "rotated";
  return `${stem}-rotated.${FORMAT_EXTENSIONS[format]}`;
}

export async function loadImageMeta(
  file: File,
  applyExif = true,
): Promise<{ w: number; h: number; thumbUrl: string; bytes: number }> {
  const orient = applyExif ? ("from-image" as const) : ("none" as const);
  const bitmap = await createImageBitmap(file, { imageOrientation: orient });
  const w = bitmap.width;
  const h = bitmap.height;
  const max = 480;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const thumbUrl = canvas.toDataURL("image/jpeg", 0.82);
  return { w, h, thumbUrl, bytes: file.size };
}

/* ── AI horizon detection (edge-gradient heuristic) ── */

export async function detectHorizonAngle(source: Blob | File): Promise<number> {
  const bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  const maxSide = 400;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const data = ctx.getImageData(0, 0, w, h).data;

  let sumAngle = 0;
  let weight = 0;
  const step = 2;
  for (let y = 1; y < h - 1; y += step) {
    for (let x = 1; x < w - 1; x += step) {
      const i = (y * w + x) * 4;
      const lum =
        0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const lumR =
        0.299 * data[i + 4] + 0.587 * data[i + 5] + 0.114 * data[i + 6];
      const lumD =
        0.299 * data[i + w * 4] + 0.587 * data[i + w * 4 + 1] + 0.114 * data[i + w * 4 + 2];
      const gx = lumR - lum;
      const gy = lumD - lum;
      const mag = Math.hypot(gx, gy);
      if (mag < 18) continue;
      const angle = Math.atan2(gy, gx) * (180 / Math.PI);
      const horiz = Math.abs(((angle + 90) % 180) - 90);
      if (horiz < 25) {
        const tilt = -Math.atan2(gy, gx) * (180 / Math.PI);
        sumAngle += tilt * mag;
        weight += mag;
      }
    }
  }
  if (weight < 1) return 0;
  return clamp(Math.round((sumAngle / weight) * 10) / 10, -45, 45);
}

/* ── AI recommendations ── */

export interface RotateAiRec {
  level: "info" | "warning";
  title: string;
  detail: string;
  action?: "horizon" | "exif" | "png" | "expand" | "lossless";
}

export function aiRecommendRotate(
  transform: RotateTransform,
  naturalW: number,
  naturalH: number,
  exportOpts: RotateExportOptions,
): RotateAiRec[] {
  const recs: RotateAiRec[] = [];
  const angle = totalAngleDeg(transform);

  if (Math.abs(angle) > 0.5 && exportOpts.canvasMode === "original") {
    recs.push({
      level: "warning",
      title: "Corners may clip",
      detail: "Use Expand canvas so rotated content is not cut off at the edges.",
      action: "expand",
    });
  }
  if (exportOpts.format === "image/jpeg" && exportOpts.preserveTransparency) {
    recs.push({
      level: "info",
      title: "JPG removes transparency",
      detail: "Use PNG or WebP to preserve alpha after rotation.",
      action: "png",
    });
  }
  if (isLosslessPath(transform, exportOpts.format)) {
    recs.push({
      level: "info",
      title: "Lossless 90° rotation",
      detail: "PNG at exact 90°/180°/270° with no flips — pixel-perfect orthogonal rotation.",
      action: "lossless",
    });
  }
  if (naturalW > naturalH * 1.4 || naturalH > naturalW * 1.4) {
    recs.push({
      level: "info",
      title: "Try horizon straighten",
      detail: "AI horizon detection can auto-level tilted photos and scanned documents.",
      action: "horizon",
    });
  }
  if (!exportOpts.applyExif) {
    recs.push({
      level: "info",
      title: "EXIF orientation off",
      detail: "Enable auto-orientation to respect camera rotation metadata on upload.",
      action: "exif",
    });
  }
  if (recs.length === 0) {
    recs.push({
      level: "info",
      title: "Ready to export",
      detail: `${Math.round(angle)}° total · ${exportOpts.format.split("/")[1]?.toUpperCase() ?? "PNG"}`,
    });
  }
  return recs;
}

export { FORMAT_EXTENSIONS, detectEncodingSupport };
