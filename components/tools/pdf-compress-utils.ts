import { PDFDocument } from "pdf-lib";
import { loadPdfJs } from "./pdf-merge-utils";

export type CompressionLevel = "lossless" | "low" | "medium" | "high" | "custom";

export interface CompressOptions {
  level: CompressionLevel;
  /** JPEG quality 0.1–1 (raster modes). */
  jpegQuality: number;
  /** Target DPI for rasterization (72 = native points). */
  dpi: number;
  stripMetadata: boolean;
  grayscale: boolean;
  useObjectStreams: boolean;
  outputPassword: string;
}

export interface CompressPreset {
  label: string;
  hint: string;
  jpegQuality: number;
  dpi: number;
  useRaster: boolean;
  stripMetadata: boolean;
  estReduction: string;
}

export const COMPRESS_PRESETS: Record<Exclude<CompressionLevel, "custom">, CompressPreset> = {
  lossless: {
    label: "Lossless",
    hint: "Object streams + structure — no visual change",
    jpegQuality: 0.92,
    dpi: 144,
    useRaster: false,
    stripMetadata: false,
    estReduction: "5–15%",
  },
  low: {
    label: "Low",
    hint: "Light cleanup — best for text PDFs",
    jpegQuality: 0.82,
    dpi: 120,
    useRaster: false,
    stripMetadata: true,
    estReduction: "10–25%",
  },
  medium: {
    label: "Medium",
    hint: "Smart raster — balanced size & quality",
    jpegQuality: 0.72,
    dpi: 110,
    useRaster: true,
    stripMetadata: true,
    estReduction: "40–65%",
  },
  high: {
    label: "High",
    hint: "Maximum compression — scans & images",
    jpegQuality: 0.52,
    dpi: 96,
    useRaster: true,
    stripMetadata: true,
    estReduction: "65–85%",
  },
};

export const DEFAULT_COMPRESS_OPTIONS: CompressOptions = {
  level: "medium",
  jpegQuality: 0.72,
  dpi: 110,
  stripMetadata: true,
  grayscale: false,
  useObjectStreams: true,
  outputPassword: "",
};

export interface CompressResult {
  data: Uint8Array;
  originalBytes: number;
  compressedBytes: number;
  savingsPercent: number;
  pageCount: number;
  mode: "lossless" | "raster";
}

export function resolveCompressOptions(options: CompressOptions): CompressOptions & { useRaster: boolean } {
  if (options.level === "custom") {
    return { ...options, useRaster: options.dpi < 130 || options.jpegQuality < 0.8 };
  }
  const p = COMPRESS_PRESETS[options.level];
  return {
    ...options,
    jpegQuality: p.jpegQuality,
    dpi: p.dpi,
    stripMetadata: p.stripMetadata,
    useRaster: p.useRaster,
  };
}

export function estimateCompressedSize(originalBytes: number, options: CompressOptions): number {
  const resolved = resolveCompressOptions(options);
  if (!resolved.useRaster) {
    const factor = resolved.stripMetadata ? 0.88 : 0.92;
    return Math.round(originalBytes * factor);
  }
  const qFactor = 0.25 + resolved.jpegQuality * 0.55;
  const dpiFactor = Math.min(1, resolved.dpi / 150);
  return Math.round(originalBytes * qFactor * dpiFactor);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function applyGrayscale(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(imageData, 0, 0);
}

async function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number, grayscale: boolean): Promise<Uint8Array> {
  if (grayscale) applyGrayscale(canvas);
  return dataUrlToBytes(canvas.toDataURL("image/jpeg", quality));
}

async function compressLossless(bytes: ArrayBuffer, options: CompressOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  if (options.stripMetadata) {
    pdf.setTitle("");
    pdf.setAuthor("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setProducer("ToolNest.io PDF Compress Ultra");
    pdf.setCreator("ToolNest.io");
  } else {
    pdf.setProducer("ToolNest.io PDF Compress Ultra");
  }
  const saveOpts = {
    useObjectStreams: options.useObjectStreams,
    ...(options.outputPassword.trim()
      ? { userPassword: options.outputPassword.trim(), ownerPassword: options.outputPassword.trim() }
      : {}),
  } as Parameters<PDFDocument["save"]>[0];
  return pdf.save(saveOpts);
}

async function compressRaster(
  bytes: ArrayBuffer,
  options: CompressOptions,
  onProgress?: (pct: number) => void,
): Promise<Uint8Array> {
  const pdfjs = await loadPdfJs();
  const src = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  const out = await PDFDocument.create();

  if (!options.stripMetadata) {
    try {
      const meta = await PDFDocument.load(bytes, { ignoreEncryption: true });
      if (meta.getTitle()) out.setTitle(meta.getTitle()!);
      if (meta.getAuthor()) out.setAuthor(meta.getAuthor()!);
      if (meta.getSubject()) out.setSubject(meta.getSubject()!);
    } catch {
      /* ignore */
    }
  }
  out.setProducer("ToolNest.io PDF Compress Ultra");
  out.setCreator("ToolNest.io");

  const scale = options.dpi / 72;
  const total = src.numPages;

  for (let i = 1; i <= total; i++) {
    const page = await src.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const jpegBytes = await canvasToJpegBytes(canvas, options.jpegQuality, options.grayscale);
    const native = page.getViewport({ scale: 1 });
    const pdfPage = out.addPage([native.width, native.height]);
    const img = await out.embedJpg(jpegBytes);
    pdfPage.drawImage(img, { x: 0, y: 0, width: native.width, height: native.height });
    onProgress?.(Math.round((i / total) * 100));
  }

  src.destroy();

  const saveOpts = {
    useObjectStreams: options.useObjectStreams,
    ...(options.outputPassword.trim()
      ? { userPassword: options.outputPassword.trim(), ownerPassword: options.outputPassword.trim() }
      : {}),
  } as Parameters<PDFDocument["save"]>[0];

  return out.save(saveOpts);
}

export async function compressPdf(
  bytes: ArrayBuffer,
  options: CompressOptions,
  onProgress?: (pct: number) => void,
): Promise<CompressResult> {
  const resolved = resolveCompressOptions(options);
  const originalBytes = bytes.byteLength;

  let pageCount = 0;
  try {
    const probe = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pageCount = probe.getPageCount();
  } catch {
    pageCount = 0;
  }

  const data = resolved.useRaster
    ? await compressRaster(bytes, resolved, onProgress)
    : await compressLossless(bytes, resolved);

  const compressedBytes = data.byteLength;
  const savingsPercent =
    originalBytes > 0 ? Math.round((1 - compressedBytes / originalBytes) * 1000) / 10 : 0;

  return {
    data,
    originalBytes,
    compressedBytes,
    savingsPercent,
    pageCount,
    mode: resolved.useRaster ? "raster" : "lossless",
  };
}

export function smartCompressSuggestions(
  fileSize: number,
  pageCount: number,
  level: CompressionLevel,
): string[] {
  const tips: string[] = [];
  const mb = fileSize / (1024 * 1024);
  if (mb > 25) tips.push(`Large file (${mb.toFixed(1)} MB) — try High compression or batch one file at a time.`);
  if (pageCount > 100) tips.push(`${pageCount} pages — raster modes take longer; preview before batch download.`);
  if (level === "lossless" && mb > 5) tips.push("Lossless saves modest space on big files — Medium often cuts 50%+ on scans.");
  if (level === "high") tips.push("High mode rasterizes pages — text may soften slightly; use Medium for mixed documents.");
  return tips;
}

export async function compressPdfBatch(
  files: { name: string; bytes: ArrayBuffer }[],
  options: CompressOptions,
  onProgress?: (pct: number) => void,
): Promise<{ name: string; result: CompressResult }[]> {
  const out: { name: string; result: CompressResult }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const result = await compressPdf(f.bytes, options, (p) => {
      onProgress?.(Math.round(((i + p / 100) / files.length) * 100));
    });
    const stem = f.name.replace(/\.pdf$/i, "");
    out.push({ name: `${stem}-compressed`, result });
  }
  onProgress?.(100);
  return out;
}

export async function compressPdfFromBytes(pdfBytes: Uint8Array, options: CompressOptions): Promise<CompressResult> {
  const ab = pdfBytes.slice().buffer;
  return compressPdf(ab, options);
}

export interface TargetCompressResult {
  result: CompressResult;
  options: CompressOptions;
  attempts: number;
  hit: boolean;
}

/**
 * High-quality-first ladder search for hitting a target PDF byte size.
 *
 * Walks (DPI, JPEG quality) pairs from highest visual quality down to very
 * aggressive settings, returning the FIRST combination that lands at or below
 * the target — i.e. the best-looking output that still fits. If the target is
 * unreachable, returns the smallest result produced.
 *
 * If the source PDF is already under the target, returns a lossless re-save
 * (no rasterization) immediately so quality is fully preserved.
 */
const TARGET_PDF_LADDER: { dpi: number; q: number }[] = [
  { dpi: 144, q: 0.92 },
  { dpi: 130, q: 0.88 },
  { dpi: 120, q: 0.85 },
  { dpi: 110, q: 0.80 },
  { dpi: 100, q: 0.75 },
  { dpi: 96, q: 0.70 },
  { dpi: 84, q: 0.62 },
  { dpi: 72, q: 0.55 },
  { dpi: 64, q: 0.48 },
  { dpi: 56, q: 0.40 },
  { dpi: 48, q: 0.32 },
  { dpi: 40, q: 0.25 },
  { dpi: 36, q: 0.20 },
  { dpi: 32, q: 0.18 },
];

export async function compressPdfToTarget(
  bytes: ArrayBuffer,
  targetBytes: number,
  base: CompressOptions,
  onProgress?: (pct: number, attempt: number, info: string) => void,
): Promise<TargetCompressResult> {
  const originalBytes = bytes.byteLength;

  // Fast path: source already fits — lossless re-save preserves quality.
  if (originalBytes <= targetBytes) {
    const losslessOpts: CompressOptions = {
      ...base,
      level: "lossless",
      dpi: 144,
      jpegQuality: 0.92,
      stripMetadata: base.stripMetadata,
      useObjectStreams: true,
    };
    const res = await compressPdf(bytes, losslessOpts, (p) => onProgress?.(p, 1, "lossless"));
    onProgress?.(100, 1, "original fits");
    return { result: res, options: losslessOpts, attempts: 1, hit: true };
  }

  let best: CompressResult | null = null;
  let bestOptions = base;
  let attempts = 0;
  const total = TARGET_PDF_LADDER.length;

  for (let i = 0; i < total; i++) {
    const { dpi, q } = TARGET_PDF_LADDER[i]!;
    attempts++;
    const opts: CompressOptions = {
      ...base,
      level: "custom",
      dpi,
      jpegQuality: q,
      useObjectStreams: true,
      stripMetadata: true,
    };
    try {
      const res = await compressPdf(bytes, opts, (p) =>
        onProgress?.(Math.max(p, (i / total) * 100), attempts, `dpi ${dpi} q${Math.round(q * 100)}`),
      );
      if (!best || res.compressedBytes < best.compressedBytes) {
        best = res;
        bestOptions = opts;
      }
      onProgress?.(Math.round(((i + 1) / total) * 100), attempts, `dpi ${dpi} q${Math.round(q * 100)}`);
      if (res.compressedBytes <= targetBytes) {
        return { result: res, options: opts, attempts, hit: true };
      }
    } catch {
      /* try next rung */
    }
  }

  if (!best) {
    throw new Error("Could not compress PDF to target size");
  }
  return { result: best, options: bestOptions, attempts, hit: false };
}
