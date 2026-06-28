/**
 * Ultra Image Compressor Studio — engine, presets, smart-AI assist, worker.
 * 100% client-side. No file ever leaves the browser unless the optional REST
 * API is explicitly called.
 */

export type OutputFormat =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/avif"
  | "image/gif"
  | "image/bmp"
  | "image/x-icon"
  | "image/tiff";

export type CompressMode =
  | "lossless"
  | "low"
  | "medium"
  | "high"
  | "extreme"
  | "target"
  | "custom";

export interface ResizeOptions {
  enabled: boolean;
  width: number;
  height: number;
  /** "px" absolute or "%" percentage of natural size */
  unit: "px" | "%";
  /** "none" | "contain" (fit inside) | "cover" (crop to fill) */
  fit: "none" | "contain" | "cover";
  keepRatio: boolean;
}

export interface CompressOptions {
  mode: CompressMode;
  format: OutputFormat;
  /** 0.1 - 1.0 — used for lossy formats */
  quality: number;
  /** target file size in bytes — used when mode === "target" */
  targetBytes: number;
  resize: ResizeOptions;
  /** preserve PNG / WebP alpha channel — flatten to white for JPG */
  preserveTransparency: boolean;
  /** strip EXIF / IPTC / XMP metadata by re-encoding (always on for canvas) */
  stripMetadata: boolean;
  /** OCR-safe mode: avoids aggressive downscaling & chroma subsampling */
  ocrSafe: boolean;
  /** background color used when flattening transparency to JPG/BMP */
  flattenBackground: string;
  /** number of passes for target-size binary search (4 - 12) */
  targetPasses: number;
}

export interface ImageMeta {
  width: number;
  height: number;
  hasAlpha: boolean;
  bytes: number;
  mime: string;
  /** estimated bits per pixel of source */
  bpp: number;
}

export interface CompressResult {
  blob: Blob;
  bytes: number;
  width: number;
  height: number;
  format: OutputFormat;
  quality: number;
  savingsPercent: number;
  /** ms spent compressing */
  durationMs: number;
  /** URL preview — caller must revoke */
  previewUrl: string;
}

export interface ImageItem {
  id: string;
  file: File;
  name: string;
  /** original size in bytes */
  originalBytes: number;
  /** original mime type */
  originalMime: string;
  /** output filename with extension */
  outputName: string;
  meta: ImageMeta | null;
  status: "queued" | "processing" | "done" | "error";
  result: CompressResult | null;
  error?: string;
  /** object URL for the original image thumbnail */
  thumbUrl: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Presets
 * ──────────────────────────────────────────────────────────────────────────── */

export const COMPRESS_PRESETS: Record<
  Exclude<CompressMode, "custom" | "target">,
  { label: string; quality: number; estReduction: string; hint: string }
> = {
  lossless: { label: "Lossless", quality: 1, estReduction: "0–15%", hint: "Re-encode only — pixels untouched" },
  low: { label: "Low", quality: 0.9, estReduction: "20–40%", hint: "Visually identical to source" },
  medium: { label: "Medium", quality: 0.78, estReduction: "40–65%", hint: "Best balance for web" },
  high: { label: "High", quality: 0.62, estReduction: "60–80%", hint: "Smaller files, slight softening" },
  extreme: { label: "Extreme", quality: 0.42, estReduction: "75–90%", hint: "Maximum shrink, noticeable loss" },
};

export const DEFAULT_COMPRESS_OPTIONS: CompressOptions = {
  mode: "medium",
  format: "image/webp",
  quality: 0.78,
  targetBytes: 200 * 1024,
  resize: {
    enabled: false,
    width: 1920,
    height: 1080,
    unit: "px",
    fit: "contain",
    keepRatio: true,
  },
  preserveTransparency: true,
  stripMetadata: true,
  ocrSafe: false,
  flattenBackground: "#ffffff",
  targetPasses: 8,
};

/* ────────────────────────────────────────────────────────────────────────────
 * Format detection & capability probing
 * ──────────────────────────────────────────────────────────────────────────── */

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  tif: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

export function detectMime(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? "image/*";
}

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/avif": "AVIF",
  "image/gif": "GIF",
  "image/bmp": "BMP",
  "image/x-icon": "ICO",
  "image/tiff": "TIFF",
};

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
  "image/tiff": "tiff",
};

/** Whether a format is lossy (accepts a quality slider) or always lossless. */
export const LOSSY_FORMATS: OutputFormat[] = ["image/jpeg", "image/webp", "image/avif"];

/** Formats that preserve alpha transparency. */
export const ALPHA_FORMATS: OutputFormat[] = ["image/png", "image/webp", "image/avif", "image/gif", "image/x-icon"];

let _capCache: {
  avif: boolean;
  webp: boolean;
  gif: boolean;
  bmp: boolean;
  ico: boolean;
  tiff: boolean;
} | null = null;

/**
 * Detect browser encoding support for AVIF / WebP / GIF via a 1×1 canvas.
 * BMP and ICO are always available through our custom encoders.
 * TIFF is never encodable in-browser — only via the REST API.
 */
export function detectEncodingSupport(): {
  avif: boolean;
  webp: boolean;
  gif: boolean;
  bmp: boolean;
  ico: boolean;
  tiff: boolean;
} {
  if (_capCache) return _capCache;
  if (typeof document === "undefined") {
    return { avif: false, webp: true, gif: false, bmp: true, ico: true, tiff: false };
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const probe = (mime: string): boolean => {
    try {
      const dataUrl = canvas.toDataURL(mime, 0.5);
      return dataUrl.startsWith(`data:${mime}`);
    } catch {
      return false;
    }
  };
  _capCache = {
    avif: probe("image/avif"),
    webp: probe("image/webp"),
    gif: probe("image/gif"),
    bmp: true,   // custom encoder — always available
    ico: true,   // custom encoder — always available
    tiff: false, // not encodable in-browser; API only
  };
  return _capCache;
}

/** Whether a format can be encoded in-browser (vs. server-only). */
export function isBrowserEncodable(format: OutputFormat): boolean {
  const cap = detectEncodingSupport();
  switch (format) {
    case "image/avif": return cap.avif;
    case "image/webp": return cap.webp;
    case "image/gif": return cap.gif;
    case "image/bmp": return cap.bmp;
    case "image/x-icon": return cap.ico;
    case "image/tiff": return false;
    default: return true; // jpeg, png
  }
}

/** Decodable input formats — browsers handle these via createImageBitmap. */
export const ACCEPTED_INPUT_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/bmp",
  "image/svg+xml",
];

export function isSupportedInput(file: File): boolean {
  const mime = detectMime(file);
  if (ACCEPTED_INPUT_MIMES.includes(mime)) return true;
  // HEIC / TIFF / ICO may or may not decode depending on browser — surface a
  // friendly notice later rather than blocking.
  return ["image/heic", "image/heif", "image/tiff", "image/x-icon"].includes(mime);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Sizing helpers
 * ──────────────────────────────────────────────────────────────────────────── */

export function suggestedOutputFormat(mime: string, hasAlpha: boolean): OutputFormat {
  const cap = detectEncodingSupport();
  if (hasAlpha) {
    if (cap.avif) return "image/avif";
    if (cap.webp) return "image/webp";
    return "image/png";
  }
  if (cap.avif) return "image/avif";
  if (cap.webp) return "image/webp";
  return "image/jpeg";
}

export function estimateCompressedSize(
  bytes: number,
  width: number,
  height: number,
  options: CompressOptions,
): number {
  const px = width * height || 1;
  const baseBpp = bytes / px;
  let factor: number;
  switch (options.mode) {
    case "lossless": factor = 0.85; break;
    case "low": factor = 0.55; break;
    case "medium": factor = 0.38; break;
    case "high": factor = 0.22; break;
    case "extreme": factor = 0.13; break;
    case "target": factor = Math.min(0.5, options.targetBytes / bytes); break;
    default: factor = Math.max(0.08, options.quality * 0.42);
  }
  if (options.resize.enabled) {
    const scale = options.resize.unit === "%"
      ? Math.min(options.resize.width, options.resize.height) / 100
      : Math.min(
          options.resize.width / (width || 1),
          options.resize.height / (height || 1),
        );
    if (scale < 1) factor *= scale * scale;
  }
  if (options.ocrSafe) factor *= 1.18;
  if (options.format === "image/png" && options.mode !== "lossless") factor = 0.7;
  if (options.format === "image/avif") factor *= 0.78;
  if (options.format === "image/webp") factor *= 0.88;
  if (options.format === "image/bmp") factor = 1.4;       // uncompressed-ish — usually larger
  if (options.format === "image/x-icon") factor = 1.45;   // BMP + AND mask overhead
  if (options.format === "image/gif") factor = 0.85;      // 256-color, decent for flat art
  if (options.format === "image/tiff") factor = 1.0;      // server-only, variable
  return Math.max(1024, Math.round(bytes * Math.min(0.98, factor)));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Smart-AI assist — heuristic recommendations, not a black-box ML model
 * ──────────────────────────────────────────────────────────────────────────── */

export interface SmartTip {
  level: "info" | "warn" | "success";
  text: string;
}

export function smartRecommend(
  meta: ImageMeta,
  options: CompressOptions,
): { recommendedMode: CompressMode; recommendedFormat: OutputFormat; tips: SmartTip[] } {
  const tips: SmartTip[] = [];
  const { bytes, width, height, hasAlpha, mime } = meta;
  const megapx = (width * height) / 1_000_000;
  const bpp = bytes / (width * height || 1);

  let recommendedMode: CompressMode = options.mode;
  let recommendedFormat: OutputFormat = options.format;
  const cap = detectEncodingSupport();

  // Format recommendation
  if (hasAlpha && options.format === "image/jpeg") {
    recommendedFormat = cap.avif ? "image/avif" : cap.webp ? "image/webp" : "image/png";
    tips.push({
      level: "warn",
      text: `Source has transparency. JPG would flatten it — switching to ${FORMAT_LABELS[recommendedFormat]} preserves alpha.`,
    });
  } else if (!hasAlpha && (mime === "image/png" || mime === "image/bmp") && options.format === "image/png") {
    recommendedFormat = cap.avif ? "image/avif" : cap.webp ? "image/webp" : "image/jpeg";
    tips.push({
      level: "info",
      text: `PNG/BMP without transparency compresses 4–10× smaller as ${FORMAT_LABELS[recommendedFormat]}.`,
    });
  } else if (mime === "image/jpeg" && (options.format === "image/png")) {
    recommendedFormat = cap.avif ? "image/avif" : "image/webp";
    tips.push({
      level: "info",
      text: `Photo content compresses far smaller with ${FORMAT_LABELS[recommendedFormat]} than PNG.`,
    });
  }

  // Mode recommendation
  if (bpp > 2.4 && megapx > 2) {
    recommendedMode = "high";
    tips.push({ level: "info", text: `High bpp (${bpp.toFixed(2)}) on a large photo — High mode typically saves 70%+ with no visible loss.` });
  } else if (megapx > 8) {
    recommendedMode = "high";
    tips.push({ level: "info", text: `${megapx.toFixed(1)} MP image — consider resizing to ≤4 MP and High compression for web.` });
  } else if (bytes < 80 * 1024) {
    recommendedMode = "lossless";
    tips.push({ level: "info", text: "File is already small — Lossless re-encode keeps quality with marginal savings." });
  } else if (mime === "image/png" && !hasAlpha && bytes > 500 * 1024) {
    recommendedMode = "high";
    tips.push({ level: "success", text: "Opaque PNG is the worst-case for photos — High + WebP/AVIF can shrink 80–95%." });
  }

  if (options.ocrSafe && options.mode === "extreme") {
    tips.push({ level: "warn", text: "OCR-safe is ON — Extreme mode may destroy text legibility. Consider High instead." });
  }
  if (options.resize.enabled && options.resize.unit === "px" && (options.resize.width < 800 || options.resize.height < 800)) {
    tips.push({ level: "warn", text: "Resize target is below 800 px — text and fine detail may become unreadable." });
  }
  if (options.format === "image/avif" && !cap.avif) {
    recommendedFormat = "image/webp";
    tips.push({ level: "warn", text: "This browser cannot encode AVIF — falling back to WebP." });
  }
  if (options.format === "image/tiff") {
    recommendedFormat = "image/png";
    tips.push({ level: "warn", text: "TIFF output is server-only (REST API). In-browser output falls back to PNG." });
  }
  if (options.format === "image/bmp" || options.format === "image/x-icon") {
    if (meta.width > 256 || meta.height > 256) {
      if (options.format === "image/x-icon") {
        recommendedFormat = "image/png";
        tips.push({ level: "warn", text: "ICO output is capped at 256×256 — your image exceeds that, PNG recommended." });
      } else {
        tips.push({ level: "warn", text: "BMP produces very large files — switch to PNG or WebP for big images." });
      }
    } else {
      tips.push({ level: "info", text: "BMP/ICO are lossless but produce larger files — best for icons and legacy systems." });
    }
  }
  if (options.format === "image/gif" && !cap.gif) {
    recommendedFormat = "image/png";
    tips.push({ level: "warn", text: "This browser cannot encode GIF — falling back to PNG." });
  }

  if (tips.length === 0) {
    tips.push({ level: "success", text: "Current settings look well-tuned for this image." });
  }
  return { recommendedMode, recommendedFormat, tips };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Core canvas-based compression
 * ──────────────────────────────────────────────────────────────────────────── */

function computeTargetSize(
  naturalW: number,
  naturalH: number,
  resize: ResizeOptions,
): { w: number; h: number } {
  if (!resize.enabled) return { w: naturalW, h: naturalH };
  if (resize.unit === "%") {
    const s = Math.min(resize.width, resize.height) / 100;
    return { w: Math.max(1, Math.round(naturalW * s)), h: Math.max(1, Math.round(naturalH * s)) };
  }
  let w = resize.width;
  let h = resize.height;
  if (resize.keepRatio) {
    const ratio = naturalW / naturalH;
    if (resize.fit === "contain") {
      if (w / h > ratio) w = Math.round(h * ratio);
      else h = Math.round(w / ratio);
    } else if (resize.fit === "cover") {
      if (w / h > ratio) h = Math.round(w / ratio);
      else w = Math.round(h * ratio);
    }
  }
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
}

function flattenBackground(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Custom encoders — BMP & ICO (canvas.toBlob can't produce these).
 * TIFF is server-only (sharp); GIF uses canvas.toBlob when supported.
 * ──────────────────────────────────────────────────────────────────────────── */

function readRGBA(ctx: CanvasRenderingContext2D, w: number, h: number): Uint8ClampedArray {
  return ctx.getImageData(0, 0, w, h).data;
}

/** Encode canvas as a 32-bit BGRA Windows BMP (lossless, no compression). */
export function encodeBMP(canvas: HTMLCanvasElement): Blob {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const rgba = readRGBA(ctx, w, h);
  const rowSize = w * 4;
  const pixelBytes = rowSize * h;
  const fileSize = 54 + pixelBytes;
  const buf = new ArrayBuffer(fileSize);
  const view = new DataView(buf);
  // BITMAPFILEHEADER (14 bytes)
  view.setUint16(0, 0x4d42, true);            // "BM"
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);                 // reserved
  view.setUint32(10, 54, true);               // offset to pixel data
  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);               // header size
  view.setInt32(18, w, true);                 // width
  view.setInt32(22, h, true);                 // height (bottom-up)
  view.setUint16(26, 1, true);                // planes
  view.setUint16(28, 32, true);               // bpp
  view.setUint32(30, 0, true);                // compression = BI_RGB
  view.setUint32(34, pixelBytes, true);       // image size
  view.setInt32(38, 2835, true);              // x ppm (~72 dpi)
  view.setInt32(42, 2835, true);              // y ppm
  view.setUint32(46, 0, true);                // colors used
  view.setUint32(50, 0, true);                // important colors
  // Pixel data — bottom-up, BGRA
  const pixels = new Uint8Array(buf, 54, pixelBytes);
  for (let y = 0; y < h; y++) {
    const srcRow = (h - 1 - y) * w * 4;
    const dstRow = y * rowSize;
    for (let x = 0; x < w; x++) {
      const si = srcRow + x * 4;
      const di = dstRow + x * 4;
      pixels[di] = rgba[si + 2];     // B
      pixels[di + 1] = rgba[si + 1]; // G
      pixels[di + 2] = rgba[si];     // R
      pixels[di + 3] = rgba[si + 3]; // A
    }
  }
  return new Blob([buf], { type: "image/bmp" });
}

/**
 * Encode canvas as a single-image Windows ICO file (32-bit BGRA + 1-bit AND
 * mask). Supports dimensions up to 256×256 (icon size stored as 0 in header).
 */
export function encodeICO(canvas: HTMLCanvasElement): Blob {
  const w = canvas.width;
  const h = canvas.height;
  if (w > 256 || h > 256) {
    throw new Error("ICO output is limited to 256×256");
  }
  const ctx = canvas.getContext("2d")!;
  const rgba = readRGBA(ctx, w, h);
  const xorRowSize = w * 4;
  const xorBytes = xorRowSize * h;
  // AND mask: 1 bpp, rows padded to multiple of 4 bytes, bottom-up.
  const andRowSize = Math.ceil(w / 32) * 4;
  const andBytes = andRowSize * h;
  const imageDataSize = 40 + xorBytes + andBytes;
  const totalSize = 6 + 16 + imageDataSize;
  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);
  // ICONDIR (6 bytes)
  view.setUint16(0, 0, true);     // reserved
  view.setUint16(2, 1, true);     // type = 1 (icon)
  view.setUint16(4, 1, true);     // count = 1
  // ICONDIRENTRY (16 bytes)
  view.setUint8(6, w >= 256 ? 0 : w);
  view.setUint8(7, h >= 256 ? 0 : h);
  view.setUint8(8, 0);            // colors (0 = 24-bit+)
  view.setUint8(9, 0);            // reserved
  view.setUint16(10, 1, true);    // planes
  view.setUint16(12, 32, true);   // bpp
  view.setUint32(14, imageDataSize, true);
  view.setUint32(18, 22, true);   // offset to image data
  // BITMAPINFOHEADER (40 bytes) — note height = 2*h (XOR + AND)
  view.setUint32(22, 40, true);
  view.setInt32(26, w, true);
  view.setInt32(30, h * 2, true);
  view.setUint16(34, 1, true);
  view.setUint16(36, 32, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, xorBytes, true);
  view.setInt32(46, 0, true);
  view.setInt32(50, 0, true);
  view.setUint32(54, 0, true);
  view.setUint32(58, 0, true);
  // XOR color data (BGRA, bottom-up)
  const xorOffset = 22 + 40;
  const xor = new Uint8Array(buf, xorOffset, xorBytes);
  for (let y = 0; y < h; y++) {
    const srcRow = (h - 1 - y) * w * 4;
    const dstRow = y * xorRowSize;
    for (let x = 0; x < w; x++) {
      const si = srcRow + x * 4;
      const di = dstRow + x * 4;
      xor[di] = rgba[si + 2];
      xor[di + 1] = rgba[si + 1];
      xor[di + 2] = rgba[si];
      xor[di + 3] = rgba[si + 3];
    }
  }
  // AND mask (1 bpp, bottom-up, transparent pixels → 1)
  const andOffset = xorOffset + xorBytes;
  const and = new Uint8Array(buf, andOffset, andBytes);
  for (let y = 0; y < h; y++) {
    const srcRow = (h - 1 - y) * w * 4;
    const dstRow = y * andRowSize;
    for (let x = 0; x < w; x++) {
      const alpha = rgba[srcRow + x * 4 + 3];
      if (alpha < 128) {
        const byteIndex = dstRow + (x >> 3);
        const bit = 7 - (x & 7);
        and[byteIndex] |= 1 << bit;
      }
    }
  }
  return new Blob([buf], { type: "image/x-icon" });
}

async function canvasFromBitmap(
  bitmap: ImageBitmap,
  options: CompressOptions,
): Promise<HTMLCanvasElement> {
  const { w, h } = computeTargetSize(bitmap.width, bitmap.height, options.resize);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: options.format !== "image/jpeg" })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = options.ocrSafe ? "high" : "medium";

  if (options.format === "image/jpeg") {
    const [r, g, b] = flattenBackground(options.flattenBackground);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, w, h);
  } else if (!options.preserveTransparency) {
    const [r, g, b] = flattenBackground(options.flattenBackground);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.clearRect(0, 0, w, h);
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

function toBlobP(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error(`Encoding failed for ${type}`))),
      type,
      quality,
    );
  });
}

export async function analyzeImage(file: File): Promise<{ bitmap: ImageBitmap; meta: ImageMeta }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  // Detect alpha by sampling the bitmap onto a small canvas and reading pixels.
  let hasAlpha = false;
  try {
    const sample = document.createElement("canvas");
    const sw = Math.min(64, bitmap.width);
    const sh = Math.min(64, bitmap.height);
    sample.width = sw;
    sample.height = sh;
    const sctx = sample.getContext("2d")!;
    sctx.drawImage(bitmap, 0, 0, sw, sh);
    const { data } = sctx.getImageData(0, 0, sw, sh);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) { hasAlpha = true; break; }
    }
  } catch { /* ignore */ }
  const meta: ImageMeta = {
    width: bitmap.width,
    height: bitmap.height,
    hasAlpha,
    bytes: file.size,
    mime: detectMime(file),
    bpp: file.size / ((bitmap.width * bitmap.height) || 1),
  };
  return { bitmap, meta };
}

export async function compressImage(
  bitmap: ImageBitmap,
  meta: ImageMeta,
  options: CompressOptions,
): Promise<CompressResult> {
  const start = performance.now();
  const cap = detectEncodingSupport();
  // Resolve the effective format with fallbacks for unsupported encoders.
  let fmt: OutputFormat = options.format;
  if (fmt === "image/avif" && !cap.avif) fmt = "image/webp";
  else if (fmt === "image/webp" && !cap.webp) fmt = "image/jpeg";
  else if (fmt === "image/gif" && !cap.gif) fmt = "image/png";
  else if (fmt === "image/tiff") {
    // Browser cannot encode TIFF — fall back to PNG (lossless) client-side.
    fmt = "image/png";
  }
  const isLossy = LOSSY_FORMATS.includes(fmt);
  const isCustomEncoder = fmt === "image/bmp" || fmt === "image/x-icon";

  let quality = options.quality;
  let blob: Blob;

  // BMP & ICO are always lossless — bypass quality search entirely.
  if (isCustomEncoder) {
    const canvas = await canvasFromBitmap(bitmap, { ...options, format: fmt });
    blob = fmt === "image/bmp" ? encodeBMP(canvas) : encodeICO(canvas);
    quality = 1;
  } else if (options.mode === "target" && isLossy) {
    // Binary search quality to hit targetBytes.
    let lo = 0.05;
    let hi = 0.98;
    let best: Blob | null = null;
    let bestQ = quality;
    const passes = Math.max(4, Math.min(12, options.targetPasses));
    for (let i = 0; i < passes; i++) {
      quality = (lo + hi) / 2;
      const canvas = await canvasFromBitmap(bitmap, { ...options, format: fmt });
      const candidate = await toBlobP(canvas, fmt, quality);
      if (candidate.size <= options.targetBytes) {
        best = candidate;
        bestQ = quality;
        lo = quality;
      } else {
        hi = quality;
      }
      if (hi - lo < 0.01) break;
    }
    if (!best) {
      // Could not reach target — accept the smallest we produced.
      const canvas = await canvasFromBitmap(bitmap, { ...options, format: fmt });
      best = await toBlobP(canvas, fmt, lo);
      bestQ = lo;
    }
    blob = best;
    quality = bestQ;
  } else if (options.mode === "lossless" || !isLossy) {
    const canvas = await canvasFromBitmap(bitmap, { ...options, format: fmt });
    // PNG/GIF/BMP/ICO are lossless; for webp/avif use quality 1.0 (still lossy encoder but max quality).
    quality = fmt === "image/png" || fmt === "image/gif" ? 1 : 0.98;
    blob = await toBlobP(canvas, fmt, quality);
  } else {
    const preset = options.mode !== "custom" && options.mode !== "target"
      ? COMPRESS_PRESETS[options.mode]
      : null;
    quality = preset ? preset.quality : options.quality;
    const canvas = await canvasFromBitmap(bitmap, { ...options, format: fmt });
    blob = await toBlobP(canvas, fmt, quality);
  }

  const durationMs = Math.round(performance.now() - start);
  const previewUrl = URL.createObjectURL(blob);
  const savingsPercent = Math.max(
    0,
    Math.round((1 - blob.size / (meta.bytes || 1)) * 100),
  );
  return {
    blob,
    bytes: blob.size,
    width: bitmap.width,
    height: bitmap.height,
    format: fmt,
    quality,
    savingsPercent,
    durationMs,
    previewUrl,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Target-size exact compression — dimensions + quality search.
 * Returns the highest-quality result that lands at or below targetBytes.
 * Strategy: try the largest dimensions first; at each scale, binary-search
 * the encoder quality for the highest value that fits. If no quality fits at
 * that scale, downscale and try again. Returns the closest achievable result
 * if the target is unreachable.
 * ──────────────────────────────────────────────────────────────────────────── */

const TARGET_SCALES = [
  1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5,
  0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.07, 0.05,
];

export interface TargetImageResult {
  result: CompressResult;
  hit: boolean;
  attempts: number;
  scale: number;
}

export async function compressImageToTargetExact(
  file: File,
  targetBytes: number,
  base: CompressOptions,
  onProgress?: (pct: number, info: string) => void,
): Promise<TargetImageResult> {
  const { bitmap, meta } = await analyzeImage(file);

  const cap = detectEncodingSupport();
  let fmt: OutputFormat = base.format;
  if (fmt === "image/avif" && !cap.avif) fmt = "image/webp";
  else if (fmt === "image/webp" && !cap.webp) fmt = "image/jpeg";
  else if (fmt === "image/gif" && !cap.gif) fmt = "image/png";
  else if (fmt === "image/tiff") fmt = "image/png";

  const isLossy = LOSSY_FORMATS.includes(fmt);

  // If the original file already fits the target, re-encode at max quality to
  // honour the chosen output format and return immediately.
  if (meta.bytes <= targetBytes) {
    const maxOptions: CompressOptions = {
      ...base,
      mode: "lossless",
      format: fmt,
      quality: isLossy ? 0.98 : 1,
      resize: { enabled: false, width: 0, height: 0, unit: "px", fit: "none", keepRatio: true },
    };
    const result = await compressImage(bitmap, meta, maxOptions);
    bitmap.close();
    onProgress?.(100, "original fits");
    return { result, hit: true, attempts: 1, scale: 1 };
  }

  let best: CompressResult | null = null;
  let bestScale = 1;
  let closest: CompressResult | null = null;
  let attempts = 0;

  const totalLossyPasses = TARGET_SCALES.length * 8;
  let step = 0;

  for (const scale of TARGET_SCALES) {
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const resizeOpts = {
      enabled: scale < 1,
      width: w,
      height: h,
      unit: "px" as const,
      fit: "none" as const,
      keepRatio: true,
    };

    if (isLossy) {
      // Binary search quality for the highest value that fits at this scale.
      let lo = 0.05;
      let hi = 0.98;
      let highestFitting: CompressResult | null = null;
      let highestFittingQ = 0;

      for (let pass = 0; pass < 8; pass++) {
        const q = (lo + hi) / 2;
        const opts: CompressOptions = {
          ...base,
          mode: "custom",
          format: fmt,
          quality: q,
          resize: resizeOpts,
        };
        const result = await compressImage(bitmap, meta, opts);
        attempts++;
        step++;
        onProgress?.(
          Math.round((step / totalLossyPasses) * 100),
          `${Math.round(scale * 100)}% · q${Math.round(q * 100)}`,
        );

        // Track the smallest result we've seen for the closest-match fallback.
        if (!closest || result.bytes < closest.bytes) {
          if (closest && closest !== result && closest.previewUrl) {
            URL.revokeObjectURL(closest.previewUrl);
          }
          closest = result;
        } else if (result.previewUrl && result !== closest) {
          URL.revokeObjectURL(result.previewUrl);
        }

        if (result.bytes <= targetBytes) {
          if (q > highestFittingQ) {
            if (highestFitting && highestFitting.previewUrl && highestFitting !== result) {
              URL.revokeObjectURL(highestFitting.previewUrl);
            }
            highestFitting = result;
            highestFittingQ = q;
          } else if (result.previewUrl && result !== highestFitting) {
            URL.revokeObjectURL(result.previewUrl);
          }
          lo = q; // try higher quality
        } else {
          hi = q;
          if (result.previewUrl && result !== closest && result !== highestFitting) {
            URL.revokeObjectURL(result.previewUrl);
          }
        }
        if (hi - lo < 0.015) break;
      }

      if (highestFitting) {
        // First scale (largest) where some quality fits = highest quality at
        // the largest dimensions — that's our high-quality answer.
        best = highestFitting;
        bestScale = scale;
        break;
      }
    } else {
      // Lossless (PNG/GIF) — only dimensions affect size.
      const opts: CompressOptions = {
        ...base,
        mode: "lossless",
        format: fmt,
        quality: 1,
        resize: resizeOpts,
      };
      const result = await compressImage(bitmap, meta, opts);
      attempts++;
      step++;
      onProgress?.(Math.round((step / TARGET_SCALES.length) * 100), `${Math.round(scale * 100)}%`);
      if (!closest || result.bytes < closest.bytes) {
        if (closest && closest !== result && closest.previewUrl) URL.revokeObjectURL(closest.previewUrl);
        closest = result;
      } else if (result.previewUrl && result !== closest) {
        URL.revokeObjectURL(result.previewUrl);
      }
      if (result.bytes <= targetBytes) {
        best = result;
        bestScale = scale;
        break;
      }
    }
  }

  bitmap.close();

  if (!best) {
    if (!closest) throw new Error("Could not compress image to target size");
    return { result: closest, hit: false, attempts, scale: bestScale };
  }
  return { result: best, hit: true, attempts, scale: bestScale };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Crop + exact-dimensions + target-size compression.
 *
 * Used by tools like the PAN Card Resizer where the output must be EXACTLY
 * targetW × targetH pixels (e.g. 213 × 274 for an NSDL photo) AND under a
 * specific byte budget (e.g. 50 KB). Strategy:
 *   1. Optionally crop to a user-selected rectangle.
 *   2. Resize the (cropped) source to the exact target dimensions on a canvas.
 *   3. Binary-search encoder quality (0.05 → 0.98) for the highest value
 *      that lands at or below targetBytes — dimensions stay fixed.
 *   4. If no quality fits, return the smallest pass (closest match).
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CropRect {
  /** 0..1 normalized coordinates relative to the source image */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Clamp a number to [lo, hi]. */
function clampNum(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * In-place 3x3 unsharp-mask sharpening.
 * `amount` is 0..1. Kernel: center = 1 + 4*amount, neighbors = -amount.
 * This is the classic Laplacian-of-Gaussian-style sharpen kernel.
 */
function unsharpMask(img: ImageData, amount: number): void {
  const { data, width: w, height: h } = img;
  if (w < 3 || h < 3) return;
  const src = new Uint8ClampedArray(data); // copy
  const c = Math.min(amount, 1) * 1.5; // scale up effect a touch
  const center = 1 + 4 * c;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const idx = i + ch;
        const up = idx - w * 4;
        const down = idx + w * 4;
        const left = idx - 4;
        const right = idx + 4;
        const v =
          src[idx] * center -
          src[up] * c -
          src[down] * c -
          src[left] * c -
          src[right] * c;
        data[idx] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      // alpha unchanged
    }
  }
}

export interface ExactResizeResult {
  result: CompressResult;
  hit: boolean;
  attempts: number;
}

export interface ExactResizeOptions {
  preserveTransparency?: boolean;
  flattenBackground?: string;
  ocrSafe?: boolean;
  /** 100 = normal, 50 = half, 200 = double */
  brightness?: number;
  /** 100 = normal */
  contrast?: number;
  /** 100 = normal, 0 = grayscale */
  saturation?: number;
  /** Raw CSS filter string that overrides brightness/contrast/saturation when provided. */
  filterCss?: string;
  /** 0-100, light unsharp-mask sharpening applied after draw. */
  sharpen?: number;
  /** 0-100, radial vignette darkening applied after draw. */
  vignette?: number;
  /** Override the binary-search quality with a fixed quality (0-1). Skips the search. */
  fixedQuality?: number;
}

export async function cropAndResizeToExact(
  source: File | Blob,
  crop: CropRect | null,
  targetW: number,
  targetH: number,
  format: OutputFormat,
  targetBytes: number,
  options: ExactResizeOptions,
  onProgress?: (pct: number, info: string) => void,
): Promise<ExactResizeResult> {
  const cap = detectEncodingSupport();
  let fmt: OutputFormat = format;
  if (fmt === "image/avif" && !cap.avif) fmt = "image/webp";
  else if (fmt === "image/webp" && !cap.webp) fmt = "image/jpeg";

  const isLossy = LOSSY_FORMATS.includes(fmt);
  const preserveAlpha = (options.preserveTransparency ?? true) && fmt !== "image/jpeg";
  const bg = options.flattenBackground ?? "#ffffff";
  const ocrSafe = options.ocrSafe ?? true;

  // Build the (optional) CSS filter string for brightness/contrast/saturation,
  // or use the raw override if provided.
  let cssFilter = "none";
  if (options.filterCss && options.filterCss.trim().length > 0) {
    cssFilter = options.filterCss.trim();
  } else {
    const filterParts: string[] = [];
    if (options.brightness !== undefined && options.brightness !== 100) filterParts.push(`brightness(${options.brightness}%)`);
    if (options.contrast !== undefined && options.contrast !== 100) filterParts.push(`contrast(${options.contrast}%)`);
    if (options.saturation !== undefined && options.saturation !== 100) filterParts.push(`saturate(${options.saturation}%)`);
    cssFilter = filterParts.length > 0 ? filterParts.join(" ") : "none";
  }

  // 1. Load source bitmap.
  const origBitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  const srcW = origBitmap.width;
  const srcH = origBitmap.height;

  // 2. Crop (optional).
  let sourceBitmap = origBitmap;
  if (crop && crop.w > 0 && crop.h > 0) {
    const sx = Math.max(0, Math.round(crop.x * srcW));
    const sy = Math.max(0, Math.round(crop.y * srcH));
    const sw = Math.min(srcW - sx, Math.round(crop.w * srcW));
    const sh = Math.min(srcH - sy, Math.round(crop.h * srcH));
    if (sw > 0 && sh > 0) {
      try {
        sourceBitmap = await createImageBitmap(origBitmap, sx, sy, sw, sh);
        origBitmap.close();
      } catch {
        sourceBitmap = origBitmap; // fallback to uncropped
      }
    }
  }

  // 3. Build a target-size canvas and draw the source scaled into it.
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(targetW));
  canvas.height = Math.max(1, Math.round(targetH));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = ocrSafe ? "high" : "medium";

  if (fmt === "image/jpeg" || !preserveAlpha) {
    const [r, g, b] = ((hex: string): [number, number, number] => {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
      if (!m) return [255, 255, 255];
      const n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    })(bg);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Apply brightness/contrast/saturation via canvas filter (drawn after fill).
  ctx.filter = cssFilter;
  ctx.drawImage(sourceBitmap, 0, 0, canvas.width, canvas.height);
  ctx.filter = "none";

  // Optional radial vignette overlay.
  const vignette = clampNum(options.vignette ?? 0, 0, 100);
  if (vignette > 0) {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = Math.hypot(cx, cy);
    const grad = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    const alpha = (vignette / 100) * 0.75;
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${alpha.toFixed(3)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Optional unsharp-mask sharpening via 3x3 convolution.
  const sharpen = clampNum(options.sharpen ?? 0, 0, 100);
  if (sharpen > 0 && canvas.width > 2 && canvas.height > 2) {
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      unsharpMask(imgData, sharpen / 100);
      ctx.putImageData(imgData, 0, 0);
    } catch {
      // getImageData may throw on tainted canvases — silently skip.
    }
  }

  // 4. Convert canvas to a bitmap so we can reuse compressImage's target mode.
  const resizedBitmap = await createImageBitmap(canvas);
  sourceBitmap.close();

  const meta: ImageMeta = {
    width: canvas.width,
    height: canvas.height,
    hasAlpha: preserveAlpha,
    bytes: source.size,
    mime: fmt,
    bpp: source.size / (canvas.width * canvas.height || 1),
  };

  // 5. Binary-search quality (dimensions fixed) for highest quality that fits.
  if (!isLossy) {
    // Lossless (PNG) — quality is irrelevant; just encode once.
    const opts: CompressOptions = {
      mode: "lossless",
      format: fmt,
      quality: 1,
      targetBytes,
      targetPasses: 1,
      resize: { enabled: false, width: 0, height: 0, unit: "px", fit: "none", keepRatio: true },
      preserveTransparency: preserveAlpha,
      stripMetadata: true,
      ocrSafe,
      flattenBackground: bg,
    };
    const result = await compressImage(resizedBitmap, meta, opts);
    resizedBitmap.close();
    onProgress?.(100, "encoded");
    return { result, hit: result.bytes <= targetBytes, attempts: 1 };
  }

  // Fixed-quality override — skip the binary search entirely.
  if (typeof options.fixedQuality === "number" && options.fixedQuality > 0 && options.fixedQuality <= 1) {
    const opts: CompressOptions = {
      mode: "custom",
      format: fmt,
      quality: options.fixedQuality,
      targetBytes,
      targetPasses: 1,
      resize: { enabled: false, width: 0, height: 0, unit: "px", fit: "none", keepRatio: true },
      preserveTransparency: preserveAlpha,
      stripMetadata: true,
      ocrSafe,
      flattenBackground: bg,
    };
    const result = await compressImage(resizedBitmap, meta, opts);
    resizedBitmap.close();
    onProgress?.(100, `q${Math.round(options.fixedQuality * 100)}`);
    return { result, hit: result.bytes <= targetBytes, attempts: 1 };
  }

  let lo = 0.05;
  let hi = 0.98;
  let best: CompressResult | null = null;
  let bestQ = 0;
  let closest: CompressResult | null = null;
  let attempts = 0;
  const passes = 10;

  for (let i = 0; i < passes; i++) {
    const q = (lo + hi) / 2;
    const opts: CompressOptions = {
      mode: "custom",
      format: fmt,
      quality: q,
      targetBytes,
      targetPasses: passes,
      resize: { enabled: false, width: 0, height: 0, unit: "px", fit: "none", keepRatio: true },
      preserveTransparency: preserveAlpha,
      stripMetadata: true,
      ocrSafe,
      flattenBackground: bg,
    };
    const result = await compressImage(resizedBitmap, meta, opts);
    attempts++;
    onProgress?.(Math.round(((i + 1) / passes) * 100), `q${Math.round(q * 100)}`);

    if (!closest || result.bytes < closest.bytes) {
      if (closest && closest !== result && closest.previewUrl) URL.revokeObjectURL(closest.previewUrl);
      closest = result;
    } else if (result.previewUrl && result !== closest && result !== best) {
      URL.revokeObjectURL(result.previewUrl);
    }

    if (result.bytes <= targetBytes) {
      if (q > bestQ) {
        if (best && best !== result && best.previewUrl && best !== closest) URL.revokeObjectURL(best.previewUrl);
        best = result;
        bestQ = q;
      } else if (result.previewUrl && result !== best && result !== closest) {
        URL.revokeObjectURL(result.previewUrl);
      }
      lo = q;
    } else {
      hi = q;
      if (result.previewUrl && result !== closest && result !== best) {
        URL.revokeObjectURL(result.previewUrl);
      }
    }
    if (hi - lo < 0.01) break;
  }

  resizedBitmap.close();

  if (!best) {
    if (!closest) throw new Error("Could not compress image to target size");
    return { result: closest, hit: false, attempts };
  }
  // Revoke closest if it's not the chosen best.
  if (closest && closest !== best && closest.previewUrl) URL.revokeObjectURL(closest.previewUrl);
  return { result: best, hit: true, attempts };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Web Worker — off-main-thread compression for big batches
 * ──────────────────────────────────────────────────────────────────────────── */

const WORKER_SRC = `
self.onmessage = async (e) => {
  const { id, bytes, mime, options } = e.data;
  try {
    const blob = new Blob([bytes], { type: mime });
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const quality = options.mode === "lossless" ? 1 : (options.quality || 0.78);
    let outType = options.format;
    try {
      const outBlob = await canvas.convertToEncodedBlob({ type: outType, quality });
      const buf = await outBlob.arrayBuffer();
      self.postMessage({ id, ok: true, buf, bytes: outBlob.size, format: outType, quality }, [buf]);
      bitmap.close();
      return;
    } catch (err) {
      // Fall back to PNG if the requested type isn't supported in this browser.
      outType = 'image/png';
      const outBlob = await canvas.convertToEncodedBlob({ type: outType });
      const buf = await outBlob.arrayBuffer();
      self.postMessage({ id, ok: true, buf, bytes: outBlob.size, format: outType, quality: 1 }, [buf]);
      bitmap.close();
    }
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
`;

let workerUrl: string | null = null;
let worker: Worker | null = null;

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!worker) {
    try {
      if (!workerUrl) {
        const blob = new Blob([WORKER_SRC], { type: "application/javascript" });
        workerUrl = URL.createObjectURL(blob);
      }
      worker = new Worker(workerUrl);
    } catch {
      return null;
    }
  }
  return worker;
}

/** Optional worker-based compress; falls back to main thread if unsupported. */
export async function compressImageWorker(
  file: File,
  options: CompressOptions,
  meta: ImageMeta,
): Promise<CompressResult | null> {
  const w = getWorker();
  if (!w) return null;
  // OffscreenCanvas.convertToEncodedBlob is required — Safari may lack it.
  if (typeof OffscreenCanvas === "undefined") return null;
  const buf = await file.arrayBuffer();
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (d.id !== id) return;
      w.removeEventListener("message", onMsg);
      if (d.ok) {
        const blob = new Blob([d.buf], { type: d.format });
        resolve({
          blob,
          bytes: d.bytes,
          width: meta.width,
          height: meta.height,
          format: d.format,
          quality: d.quality,
          savingsPercent: Math.max(0, Math.round((1 - d.bytes / (meta.bytes || 1)) * 100)),
          durationMs: 0,
          previewUrl: URL.createObjectURL(blob),
        });
      } else {
        reject(new Error(d.error || "worker compression failed"));
      }
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ id, bytes: buf, mime: meta.mime, options }, [buf]);
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Batch + ZIP export
 * ──────────────────────────────────────────────────────────────────────────── */

export async function compressBatch(
  items: ImageItem[],
  options: CompressOptions,
  onProgress: (done: number, total: number, current: ImageItem) => void,
  useWorker: boolean,
): Promise<ImageItem[]> {
  const out: ImageItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress(i, items.length, item);
    try {
      if (!item.meta) {
        const { bitmap, meta } = await analyzeImage(item.file);
        item.meta = meta;
        const resolved = await compressImage(bitmap, meta, options);
        bitmap.close();
        item.result = resolved;
        item.status = "done";
      } else {
        let resolved: CompressResult | null = null;
        const workerSafe =
          useWorker &&
          !options.resize.enabled &&
          options.mode !== "target" &&
          // Worker only handles natively encodable formats (no custom BMP/ICO encoders).
          (options.format === "image/jpeg" ||
            options.format === "image/png" ||
            options.format === "image/webp" ||
            options.format === "image/avif");
        if (workerSafe) {
          try { resolved = await compressImageWorker(item.file, options, item.meta); }
          catch { resolved = null; }
        }
        if (!resolved) {
          const { bitmap } = await analyzeImage(item.file);
          resolved = await compressImage(bitmap, item.meta, options);
          bitmap.close();
        }
        item.result = resolved;
        item.status = "done";
      }
    } catch (e) {
      item.status = "error";
      item.error = e instanceof Error ? e.message : "compression failed";
    }
    out.push(item);
  }
  onProgress(items.length, items.length, items[items.length - 1]);
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Filename helpers
 * ──────────────────────────────────────────────────────────────────────────── */

export function buildOutputName(originalName: string, format: OutputFormat): string {
  const stem = originalName.replace(/\.[a-z0-9]+$/i, "") || "image";
  const ext = FORMAT_EXTENSIONS[format];
  return `${stem}.${ext}`;
}

export function bytesFromSizeInput(value: number, unit: "B" | "KB" | "MB"): number {
  if (unit === "B") return Math.round(value);
  if (unit === "KB") return Math.round(value * 1024);
  return Math.round(value * 1024 * 1024);
}

export function formatSizeUnit(bytes: number): { value: string; unit: "B" | "KB" | "MB" } {
  if (bytes >= 1024 * 1024) {
    return { value: (bytes / (1024 * 1024)).toFixed(2), unit: "MB" };
  }
  if (bytes >= 1024) {
    return { value: (bytes / 1024).toFixed(1), unit: "KB" };
  }
  return { value: String(bytes), unit: "B" };
}
