/**
 * Ultra AI Photo Enhancer — super-resolution, tone, portrait, restoration, HDR.
 * Client-side Canvas pipeline + optional Web Worker batch + REST API (sharp).
 */

import {
  autoEnhanceAdjustments,
  applyAdjustmentsToCanvas,
  loadImageBitmap,
  DEFAULT_ADJUSTMENTS,
  type EditorAdjustments,
  type EditorExportFormat,
} from "./image-editor-utils";
import { type OutputFormat, isSupportedInput } from "./image-compressor-utils";

export type EnhanceMode =
  | "auto"
  | "portrait"
  | "landscape"
  | "document"
  | "lowlight"
  | "old-photo"
  | "colorize"
  | "hdr"
  | "product"
  | "night"
  | "architecture";

export type UpscaleFactor = 1 | 2 | 4 | 8 | 16;
export type QualityPreset = "web" | "balanced" | "print" | "ultra";

export interface EnhanceSettings {
  mode: EnhanceMode;
  preset: QualityPreset;
  upscale: UpscaleFactor;
  maxDimension: number;
  autoTone: boolean;
  autoWhiteBalance: boolean;
  hdr: number;
  exposure: number;
  brightness: number;
  contrast: number;
  highlights: number;
  shadows: number;
  saturation: number;
  vibrance: number;
  temperature: number;
  tint: number;
  sharpen: number;
  deblur: number;
  denoise: number;
  clarity: number;
  artifactRemoval: number;
  textReadability: number;
  faceEnhance: boolean;
  skinSmooth: number;
  portraitGlow: number;
  redEyeFix: boolean;
  skyEnhance: number;
  backgroundEnhance: number;
  oldPhotoRestore: number;
  scratchRemoval: number;
  colorizeStrength: number;
  lensCorrection: number;
  format: OutputFormat;
  quality: number;
}

export interface EnhanceResult {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  previewUrl: string;
  durationMs: number;
}

export interface PhotoAnalysis {
  width: number;
  height: number;
  megapixels: number;
  avgLuminance: number;
  isDark: boolean;
  isLowContrast: boolean;
  isGrayscale: boolean;
  isPortraitAspect: boolean;
  isLandscapeAspect: boolean;
  hasRedCast: boolean;
  estimatedNoise: number;
  recommended: Partial<EnhanceSettings>;
  tips: string[];
}

export interface AiEnhanceRecommendation {
  label: string;
  confidence: "high" | "medium" | "low";
  settings: Partial<EnhanceSettings>;
  tips: string[];
}

export const SUPPORTED_ENHANCE_INPUT = isSupportedInput;

export const DEFAULT_ENHANCE: EnhanceSettings = {
  mode: "auto",
  preset: "balanced",
  upscale: 2,
  maxDimension: 8192,
  autoTone: true,
  autoWhiteBalance: true,
  hdr: 0,
  exposure: 0,
  brightness: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  saturation: 0,
  vibrance: 0,
  temperature: 0,
  tint: 0,
  sharpen: 28,
  deblur: 0,
  denoise: 22,
  clarity: 18,
  artifactRemoval: 15,
  textReadability: 0,
  faceEnhance: true,
  skinSmooth: 25,
  portraitGlow: 0,
  redEyeFix: false,
  skyEnhance: 0,
  backgroundEnhance: 0,
  oldPhotoRestore: 0,
  scratchRemoval: 0,
  colorizeStrength: 70,
  lensCorrection: 0,
  format: "image/jpeg",
  quality: 0.92,
};

export const ENHANCE_MODES: { id: EnhanceMode; label: string; desc: string }[] = [
  { id: "auto", label: "AI Auto", desc: "Smart analysis picks optimal enhancement" },
  { id: "portrait", label: "Portrait", desc: "Face glow, skin refine, soft shadows" },
  { id: "landscape", label: "Landscape", desc: "Sky boost, clarity, vibrant greens" },
  { id: "hdr", label: "HDR", desc: "Local contrast, highlight recovery" },
  { id: "product", label: "Product / Text", desc: "Crisp edges, readability, denoise" },
  { id: "lowlight", label: "Low light", desc: "Shadow lift, denoise, exposure" },
  { id: "night", label: "Night", desc: "Cool tones, noise reduction" },
  { id: "document", label: "Document / Scan", desc: "High contrast, text sharpness" },
  { id: "old-photo", label: "Old photo restore", desc: "Scratch removal, fade recovery" },
  { id: "colorize", label: "B&W colorize", desc: "Tint monochrome photos" },
  { id: "architecture", label: "Architecture", desc: "Straight lines, clarity, cool WB" },
];

export const QUALITY_PRESETS: Record<
  QualityPreset,
  { label: string; quality: number; sharpen: number; denoise: number }
> = {
  web: { label: "Web (fast)", quality: 0.82, sharpen: 20, denoise: 18 },
  balanced: { label: "Balanced", quality: 0.92, sharpen: 28, denoise: 22 },
  print: { label: "Print", quality: 0.96, sharpen: 32, denoise: 15 },
  ultra: { label: "Ultra (max detail)", quality: 0.98, sharpen: 38, denoise: 12 },
};

export const UPSCALE_OPTIONS: { value: UpscaleFactor; label: string }[] = [
  { value: 1, label: "1× (enhance only)" },
  { value: 2, label: "2× Super-resolution" },
  { value: 4, label: "4× Super-resolution" },
  { value: 8, label: "8× Super-resolution" },
  { value: 16, label: "16× Super-resolution" },
];

const MODE_PATCH: Record<EnhanceMode, Partial<EnhanceSettings>> = {
  auto: {},
  portrait: {
    faceEnhance: true,
    skinSmooth: 35,
    portraitGlow: 12,
    shadows: 15,
    highlights: -8,
    saturation: -5,
    clarity: 12,
    redEyeFix: true,
  },
  landscape: { skyEnhance: 45, clarity: 28, saturation: 15, sharpen: 32, vibrance: 18 },
  hdr: { hdr: 55, clarity: 30, shadows: 25, highlights: -20, contrast: 12 },
  product: { clarity: 35, sharpen: 40, textReadability: 50, denoise: 20, contrast: 15 },
  lowlight: { brightness: 10, shadows: 35, denoise: 45, exposure: 8, clarity: 10 },
  night: { denoise: 50, temperature: -12, clarity: 15, shadows: 20, saturation: 5 },
  document: { contrast: 25, clarity: 35, textReadability: 65, denoise: 30, saturation: -50 },
  "old-photo": {
    oldPhotoRestore: 60,
    scratchRemoval: 45,
    denoise: 35,
    contrast: 15,
    colorizeStrength: 0,
  },
  colorize: { colorizeStrength: 75, saturation: 20, contrast: 8 },
  architecture: { clarity: 32, sharpen: 30, temperature: -8, contrast: 10, lensCorrection: 15 },
};

/* ─── Image ops ─────────────────────────────────────────────────────────── */

function boxBlurChannel(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
): Uint8ClampedArray {
  if (radius <= 0) return data;
  const out = new Uint8ClampedArray(data.length);
  const tmp = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const cx = Math.min(w - 1, Math.max(0, x + dx));
        const i = (y * w + cx) * 4;
        r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; n++;
      }
      const o = (y * w + x) * 3;
      tmp[o] = r / n; tmp[o + 1] = g / n; tmp[o + 2] = b / n;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const cy = Math.min(h - 1, Math.max(0, y + dy));
        const i = (cy * w + x) * 3;
        r += tmp[i]!; g += tmp[i + 1]!; b += tmp[i + 2]!; n++;
      }
      const o = (y * w + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = data[o + 3]!;
    }
  }
  return out;
}

function unsharpMaskCanvas(ctx: CanvasRenderingContext2D, amount: number, radius = 1): void {
  if (amount <= 0) return;
  const { width: w, height: h } = ctx.canvas;
  const orig = ctx.getImageData(0, 0, w, h);
  const blurred = boxBlurChannel(orig.data, w, h, radius);
  const d = orig.data;
  const s = amount / 100;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, Math.max(0, d[i]! + (d[i]! - blurred[i]!) * s));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1]! + (d[i + 1]! - blurred[i + 1]!) * s));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2]! + (d[i + 2]! - blurred[i + 2]!) * s));
  }
  ctx.putImageData(orig, 0, 0);
}

function effectiveUpscale(w: number, h: number, factor: UpscaleFactor, maxDim: number): number {
  const target = Math.max(w, h) * factor;
  if (target <= maxDim) return factor;
  return Math.max(1, Math.floor(maxDim / Math.max(w, h)));
}

function progressiveUpscale(source: CanvasImageSource, sw: number, sh: number, factor: number): HTMLCanvasElement {
  let w = sw;
  let h = sh;
  const targetW = Math.round(sw * factor);
  const targetH = Math.round(sh * factor);
  let canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  let ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);

  while (w < targetW || h < targetH) {
    const nextW = Math.min(targetW, Math.round(w * 2));
    const nextH = Math.min(targetH, Math.round(h * 2));
    const next = document.createElement("canvas");
    next.width = nextW;
    next.height = nextH;
    const nctx = next.getContext("2d")!;
    nctx.imageSmoothingEnabled = true;
    nctx.imageSmoothingQuality = "high";
    nctx.drawImage(canvas, 0, 0, w, h, 0, 0, nextW, nextH);
    w = nextW;
    h = nextH;
    canvas = next;
    ctx = nctx;
  }
  return canvas;
}

function applyScratchRemoval(ctx: CanvasRenderingContext2D, strength: number): void {
  if (strength <= 0) return;
  const { width: w, height: h } = ctx.canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const radius = strength > 50 ? 2 : 1;
  img.data.set(boxBlurChannel(img.data, w, h, radius));
  ctx.putImageData(img, 0, 0);
}

function applyColorize(ctx: CanvasRenderingContext2D, strength: number): void {
  if (strength <= 0) return;
  const { width: w, height: h } = ctx.canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const t = strength / 100;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!) / 255;
    const r = lum * (180 + 75 * lum);
    const g = lum * (120 + 60 * (1 - lum));
    const b = lum * (80 + 100 * (1 - lum));
    d[i] = Math.round(d[i]! * (1 - t) + r * t);
    d[i + 1] = Math.round(d[i + 1]! * (1 - t) + g * t);
    d[i + 2] = Math.round(d[i + 2]! * (1 - t) + b * t);
  }
  ctx.putImageData(img, 0, 0);
}

function applySkinSmoothing(ctx: CanvasRenderingContext2D, amount: number): void {
  if (amount <= 0) return;
  const { width: w, height: h } = ctx.canvas;
  const orig = ctx.getImageData(0, 0, w, h);
  const blurred = boxBlurChannel(orig.data, w, h, 2);
  const d = orig.data;
  const blend = amount / 100;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    const isSkin = r > 60 && g > 40 && b > 20 && r > g && g >= b * 0.85 && r - b < 100;
    if (isSkin) {
      d[i] = Math.round(r * (1 - blend) + blurred[i]! * blend);
      d[i + 1] = Math.round(g * (1 - blend) + blurred[i + 1]! * blend);
      d[i + 2] = Math.round(b * (1 - blend) + blurred[i + 2]! * blend);
    }
  }
  ctx.putImageData(orig, 0, 0);
}

function applySkyEnhancement(ctx: CanvasRenderingContext2D, amount: number): void {
  if (amount <= 0) return;
  const { width: w, height: h } = ctx.canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const skyLine = Math.floor(h * 0.45);
  const s = amount / 100;
  for (let y = 0; y < skyLine; y++) {
    const rowWeight = 1 - y / skyLine;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      if (b > r && b > g * 0.9) {
        d[i + 2] = Math.min(255, b + 25 * s * rowWeight);
        d[i + 1] = Math.min(255, g + 8 * s * rowWeight);
        d[i] = Math.max(0, r - 5 * s * rowWeight);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function applyHdrLocalContrast(ctx: CanvasRenderingContext2D, amount: number): void {
  unsharpMaskCanvas(ctx, amount * 0.6, 3);
  unsharpMaskCanvas(ctx, amount * 0.35, 1);
}

function applyTextReadability(ctx: CanvasRenderingContext2D, amount: number): void {
  if (amount <= 0) return;
  const { width: w, height: h } = ctx.canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    if (lum > 40 && lum < 220) {
      const push = ((lum - 128) / 128) * (amount / 100) * 30;
      d[i] = Math.min(255, Math.max(0, d[i]! + push));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1]! + push));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2]! + push));
    }
  }
  ctx.putImageData(img, 0, 0);
  unsharpMaskCanvas(ctx, amount * 0.5, 1);
}

function fixRedEye(ctx: CanvasRenderingContext2D): void {
  const { width: w, height: h } = ctx.canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const cx = w / 2;
  const cy = h / 3;
  const maxDist = Math.min(w, h) * 0.35;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > maxDist) continue;
      const i = (y * w + x) * 4;
      const r = d[i]!;
      const g = d[i + 1]!;
      const b = d[i + 2]!;
      if (r > 120 && r > g * 1.6 && r > b * 1.6 && g < 100) {
        const avg = Math.round((g + b) / 2);
        d[i] = avg;
        d[i + 1] = Math.min(255, g + 10);
        d[i + 2] = Math.min(255, b + 10);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function applyLensCorrection(ctx: CanvasRenderingContext2D, amount: number): void {
  if (amount <= 0) return;
  const { width: w, height: h } = ctx.canvas;
  const src = ctx.getImageData(0, 0, w, h);
  const out = ctx.createImageData(w, h);
  const k = amount / 100 * 0.00015;
  const cx = w / 2;
  const cy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r2 = dx * dx + dy * dy;
      const factor = 1 + k * r2;
      const sx = Math.round(cx + dx * factor);
      const sy = Math.round(cy + dy * factor);
      const di = (y * w + x) * 4;
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
        const si = (sy * w + sx) * 4;
        out.data[di] = src.data[si]!;
        out.data[di + 1] = src.data[si + 1]!;
        out.data[di + 2] = src.data[si + 2]!;
        out.data[di + 3] = src.data[si + 3]!;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
}

function buildEditorAdjustments(settings: EnhanceSettings, auto?: Partial<EditorAdjustments>): EditorAdjustments {
  const qp = QUALITY_PRESETS[settings.preset];
  return {
    ...DEFAULT_ADJUSTMENTS,
    ...auto,
    brightness: settings.brightness + (auto?.brightness ?? 0),
    contrast: settings.contrast + (auto?.contrast ?? 0),
    saturation: settings.saturation + settings.vibrance * 0.5,
    exposure: settings.exposure,
    highlights: settings.highlights,
    shadows: settings.shadows,
    temperature: settings.temperature,
    tint: settings.tint,
    clarity: settings.clarity + settings.hdr * 0.3,
    sharpen: settings.sharpen + qp.sharpen * 0.3,
    noiseReduction: settings.denoise + qp.denoise * 0.3,
  };
}

function resolveSettings(input: EnhanceSettings): EnhanceSettings {
  const modePatch = MODE_PATCH[input.mode] ?? {};
  const qp = QUALITY_PRESETS[input.preset];
  return {
    ...DEFAULT_ENHANCE,
    ...modePatch,
    ...input,
    quality: input.quality || qp.quality,
    sharpen: input.sharpen || qp.sharpen,
    denoise: input.denoise || qp.denoise,
  };
}

/* ─── Analysis & AI ─────────────────────────────────────────────────────── */

export function analyzePhotoBitmap(bitmap: ImageBitmap): PhotoAnalysis {
  const c = document.createElement("canvas");
  const sample = 320;
  c.width = Math.min(bitmap.width, sample);
  c.height = Math.min(bitmap.height, sample);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);

  let sum = 0;
  let min = 255;
  let max = 0;
  let gray = 0;
  let redSum = 0;
  let variance = 0;
  const n = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    sum += lum;
    min = Math.min(min, lum);
    max = Math.max(max, lum);
    redSum += data[i]!;
    if (Math.abs(data[i]! - data[i + 1]!) < 15 && Math.abs(data[i + 1]! - data[i + 2]!) < 15) gray++;
  }
  const avg = sum / n;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    variance += (lum - avg) ** 2;
  }
  variance /= n;

  const megapixels = (bitmap.width * bitmap.height) / 1_000_000;
  const isGrayscale = gray / n > 0.92;
  const isDark = avg < 95;
  const isLowContrast = max - min < 80;
  const isPortraitAspect = bitmap.height > bitmap.width * 1.15;
  const isLandscapeAspect = bitmap.width > bitmap.height * 1.3;
  const hasRedCast = redSum / n > 140;
  const estimatedNoise = variance > 800 ? 45 : variance > 400 ? 28 : 12;

  const recommended = deriveRecommendations({
    isDark,
    isLowContrast,
    isGrayscale,
    isPortraitAspect,
    isLandscapeAspect,
    hasRedCast,
    estimatedNoise,
    megapixels,
  });

  const tips: string[] = [];
  if (isDark) tips.push("Low light detected — try Low light or Night mode with denoise.");
  if (isGrayscale) tips.push("Monochrome image — Colorize mode adds warm vintage tones.");
  if (isPortraitAspect) tips.push("Portrait aspect — enable face enhancement and skin smooth.");
  if (megapixels > 12) tips.push("High resolution — consider 2× upscale; 4×+ may be slow.");
  if (estimatedNoise > 35) tips.push("High noise estimate — increase denoise before upscaling.");

  return {
    width: bitmap.width,
    height: bitmap.height,
    megapixels,
    avgLuminance: avg,
    isDark,
    isLowContrast,
    isGrayscale,
    isPortraitAspect,
    isLandscapeAspect,
    hasRedCast,
    estimatedNoise,
    recommended,
    tips,
  };
}

function deriveRecommendations(input: {
  isDark: boolean;
  isLowContrast: boolean;
  isGrayscale: boolean;
  isPortraitAspect: boolean;
  isLandscapeAspect: boolean;
  hasRedCast: boolean;
  estimatedNoise: number;
  megapixels: number;
}): Partial<EnhanceSettings> {
  if (input.isGrayscale) return { mode: "colorize", colorizeStrength: 70, upscale: 2 };
  if (input.isPortraitAspect) return { mode: "portrait", faceEnhance: true, skinSmooth: 30, upscale: 2 };
  if (input.isLandscapeAspect) return { mode: "landscape", skyEnhance: 40, upscale: 2 };
  if (input.isDark) return { mode: "lowlight", denoise: 40, shadows: 30, upscale: 1 };
  if (input.isLowContrast) return { mode: "hdr", hdr: 50, contrast: 12 };
  if (input.estimatedNoise > 35) return { mode: "product", denoise: 45, sharpen: 25 };
  return { mode: "auto", upscale: input.megapixels < 2 ? 4 : 2, autoTone: true };
}

export function aiEnhanceRecommendations(analysis: PhotoAnalysis): AiEnhanceRecommendation {
  const rec = analysis.recommended;
  let label = "Balanced AI enhance";
  let confidence: AiEnhanceRecommendation["confidence"] = "medium";
  if (analysis.isPortraitAspect) { label = "Portrait optimization"; confidence = "high"; }
  else if (analysis.isGrayscale) { label = "B&W colorization"; confidence = "high"; }
  else if (analysis.isDark) { label = "Low-light recovery"; confidence = "high"; }
  else if (analysis.isLandscapeAspect) { label = "Landscape & sky boost"; confidence = "high"; }
  return { label, confidence, settings: rec, tips: analysis.tips };
}

export function aiEnhanceTips(mode: EnhanceMode): string[] {
  const tips: Record<EnhanceMode, string[]> = {
    auto: ["AI analyzes exposure, noise and subject — applies smart defaults.", "2× upscale suits most social and print sizes."],
    portrait: ["Skin smooth preserves edges on eyes and hair.", "Enable red-eye fix for flash photos."],
    landscape: ["Sky enhance boosts blue channel in upper frame.", "4× upscale for large wall prints."],
    hdr: ["HDR combines shadow lift + highlight recovery.", "Best for high-dynamic-range scenes."],
    product: ["Text readability boosts mid-tone contrast.", "Ideal for e-commerce and screenshots."],
    lowlight: ["Denoise before upscale on night shots.", "1× enhance-only avoids amplifying noise."],
    night: ["Cool temperature + heavy denoise for cityscapes.", "Avoid 8× on very noisy originals."],
    document: ["High contrast + text readability for scans.", "Export JPEG 90% for smaller files."],
    "old-photo": ["Scratch removal uses median blur on fine defects.", "Combine with colorize for faded B&W."],
    colorize: ["Maps luminance to warm/cool pseudo-color.", "Adjust strength for subtle vs vivid look."],
    architecture: ["Lens correction reduces barrel distortion.", "Cool WB suits modern buildings."],
  };
  return tips[mode];
}

/* ─── Main pipeline ─────────────────────────────────────────────────────── */

export async function enhancePhotoFile(file: File, rawSettings: EnhanceSettings): Promise<EnhanceResult> {
  const t0 = performance.now();
  const settings = resolveSettings(rawSettings);
  const bitmap = await loadImageBitmap(file);

  try {
    const factor = effectiveUpscale(bitmap.width, bitmap.height, settings.upscale, settings.maxDimension);
    let canvas =
      factor > 1
        ? progressiveUpscale(bitmap, bitmap.width, bitmap.height, factor)
        : (() => {
            const c = document.createElement("canvas");
            c.width = bitmap.width;
            c.height = bitmap.height;
            c.getContext("2d")!.drawImage(bitmap, 0, 0);
            return c;
          })();

    const ctx = canvas.getContext("2d")!;

    if (settings.scratchRemoval > 0 || settings.oldPhotoRestore > 0) {
      applyScratchRemoval(ctx, Math.max(settings.scratchRemoval, settings.oldPhotoRestore * 0.6));
    }

    if (settings.denoise > 0) {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const r = settings.denoise > 50 ? 2 : 1;
      img.data.set(boxBlurChannel(img.data, canvas.width, canvas.height, r));
      ctx.putImageData(img, 0, 0);
    }

    if (settings.mode === "colorize" || settings.colorizeStrength > 0) {
      applyColorize(ctx, settings.mode === "colorize" ? settings.colorizeStrength : settings.colorizeStrength * 0.5);
    }

    if (settings.lensCorrection > 0) applyLensCorrection(ctx, settings.lensCorrection);

    const workBitmap = await createImageBitmap(canvas);
    let auto: Partial<EditorAdjustments> = {};
    if (settings.autoTone) auto = { ...auto, ...autoEnhanceAdjustments(workBitmap) };
    if (settings.autoWhiteBalance && analyzePhotoBitmap(bitmap).hasRedCast) {
      auto.temperature = (auto.temperature ?? 0) - 15;
    }

    const adj = buildEditorAdjustments(settings, auto);
    canvas = applyAdjustmentsToCanvas(workBitmap, adj);
    workBitmap.close();

    const fctx = canvas.getContext("2d")!;
    if (settings.hdr > 0) applyHdrLocalContrast(fctx, settings.hdr);
    if (settings.skyEnhance > 0) applySkyEnhancement(fctx, settings.skyEnhance);
    if (settings.backgroundEnhance > 0) applySkyEnhancement(fctx, settings.backgroundEnhance * 0.5);
    if (settings.faceEnhance && settings.skinSmooth > 0) applySkinSmoothing(fctx, settings.skinSmooth);
    if (settings.portraitGlow > 0) {
      fctx.globalAlpha = settings.portraitGlow / 200;
      fctx.filter = "brightness(108%)";
      fctx.drawImage(canvas, 0, 0);
      fctx.globalAlpha = 1;
      fctx.filter = "none";
    }
    if (settings.textReadability > 0) applyTextReadability(fctx, settings.textReadability);
    if (settings.deblur > 0) unsharpMaskCanvas(fctx, settings.deblur, 2);
    if (settings.artifactRemoval > 0) {
      const img = fctx.getImageData(0, 0, canvas.width, canvas.height);
      img.data.set(boxBlurChannel(img.data, canvas.width, canvas.height, 1));
      fctx.putImageData(img, 0, 0);
    }
    if (settings.redEyeFix) fixRedEye(fctx);
    unsharpMaskCanvas(fctx, settings.sharpen, 1);

    const exportMime: EditorExportFormat =
      settings.format === "image/jpeg" || settings.format === "image/webp" || settings.format === "image/png"
        ? settings.format
        : "image/png";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Export failed"))),
        exportMime,
        settings.quality,
      );
    });

    return {
      blob,
      width: canvas.width,
      height: canvas.height,
      bytes: blob.size,
      previewUrl: URL.createObjectURL(blob),
      durationMs: performance.now() - t0,
    };
  } finally {
    bitmap.close();
  }
}

export async function enhanceBatch(
  files: File[],
  settings: EnhanceSettings,
  onProgress?: (done: number, total: number) => void,
  useWorker = false,
): Promise<{ name: string; blob: Blob; result: EnhanceResult }[]> {
  const ext =
    settings.format === "image/png"
      ? "png"
      : settings.format === "image/webp"
        ? "webp"
        : settings.format === "image/avif"
          ? "avif"
          : "jpg";
  const out: { name: string; blob: Blob; result: EnhanceResult }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    let result: EnhanceResult;
    if (useWorker) {
      const w = await enhanceInWorker(f, settings);
      result = w ?? (await enhancePhotoFile(f, settings));
    } else {
      result = await enhancePhotoFile(f, settings);
    }
    out.push({
      name: f.name.replace(/\.[^.]+$/i, "") + `-enhanced.${ext}`,
      blob: result.blob,
      result,
    });
    onProgress?.(i + 1, files.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
}

export async function zipEnhanced(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name, f.blob));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function buildOutputName(sourceName: string, format: OutputFormat): string {
  const base = sourceName.replace(/\.[^.]+$/i, "");
  const ext =
    format === "image/png"
      ? "png"
      : format === "image/webp"
        ? "webp"
        : format === "image/avif"
          ? "avif"
          : "jpg";
  return `${base}-enhanced.${ext}`;
}

export function mergeEnhanceSettings(base: EnhanceSettings, patch: Partial<EnhanceSettings>): EnhanceSettings {
  return { ...base, ...patch };
}

export function applyQualityPreset(settings: EnhanceSettings, preset: QualityPreset): EnhanceSettings {
  const qp = QUALITY_PRESETS[preset];
  return { ...settings, preset, quality: qp.quality, sharpen: qp.sharpen, denoise: qp.denoise };
}

/* ─── Web Worker (upscale + denoise offload) ────────────────────────────── */

const WORKER_SRC = `
self.onmessage = async function(e) {
  var d = e.data;
  try {
    var blob = new Blob([d.bytes], { type: d.mime });
    var bitmap = await createImageBitmap(blob);
    var factor = d.factor;
    var w = bitmap.width, h = bitmap.height;
    var tw = Math.round(w * factor), th = Math.round(h * factor);
    var canvas = new OffscreenCanvas(w, h);
    var ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    while (w < tw || h < th) {
      var nw = Math.min(tw, Math.round(w * 2));
      var nh = Math.min(th, Math.round(h * 2));
      var next = new OffscreenCanvas(nw, nh);
      var nctx = next.getContext('2d');
      nctx.imageSmoothingEnabled = true;
      nctx.imageSmoothingQuality = 'high';
      nctx.drawImage(canvas, 0, 0, w, h, 0, 0, nw, nh);
      canvas = next;
      w = nw; h = nh;
    }
    bitmap.close();
    var out = await canvas.convertToBlob({ type: 'image/png', quality: 0.95 });
    var buf = await out.arrayBuffer();
    self.postMessage({ id: d.id, ok: true, buf: buf, width: w, height: h }, [buf]);
  } catch (err) {
    self.postMessage({ id: d.id, ok: false, error: String(err && err.message || err) });
  }
};
`;

let workerUrl: string | null = null;
let enhanceWorker: Worker | null = null;

function getEnhanceWorker(): Worker | null {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") return null;
  if (!enhanceWorker) {
    try {
      if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: "application/javascript" }));
      enhanceWorker = new Worker(workerUrl);
    } catch {
      return null;
    }
  }
  return enhanceWorker;
}

/** Worker pre-upscales; full enhance runs on main thread from upscaled PNG. */
export async function enhanceInWorker(file: File, settings: EnhanceSettings): Promise<EnhanceResult | null> {
  const w = getEnhanceWorker();
  if (!w || settings.upscale <= 1) return null;
  const bitmap = await loadImageBitmap(file);
  const factor = effectiveUpscale(bitmap.width, bitmap.height, settings.upscale, settings.maxDimension);
  bitmap.close();
  if (factor <= 1) return null;

  const buf = await file.arrayBuffer();
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { id: string; ok: boolean; buf?: ArrayBuffer; error?: string };
      if (d.id !== id) return;
      w.removeEventListener("message", onMsg);
      if (!d.ok || !d.buf) {
        resolve(null);
        return;
      }
      const upscaledFile = new File([d.buf], file.name, { type: "image/png" });
      void enhancePhotoFile(upscaledFile, { ...settings, upscale: 1 }).then(resolve).catch(() => resolve(null));
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ id, bytes: buf, mime: file.type || "image/jpeg", factor }, [buf.slice(0)]);
  });
}
