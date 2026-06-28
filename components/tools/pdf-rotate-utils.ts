/**
 * Ultra PDF Rotate Studio — per-page rotation, reorder, delete, auto-orient, batch export.
 * Client-side via pdf-lib + pdf.js thumbnails. Reuses shared PDF helpers from pdf-merge-utils.
 */

import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import {
  type Rotation,
  loadPdfJs,
  parsePageRange,
  parsePdf,
  renderThumb,
  reorder,
  sanitizeFilename,
} from "./pdf-merge-utils";

export type { Rotation };
export { parsePdf, renderThumb, reorder, sanitizeFilename, parsePageRange };

export type PageRotation = number;

export interface RotatePage {
  id: string;
  sourcePageIndex: number;
  included: boolean;
  /** Total rotation in degrees (0–359), applied on export. */
  rotation: PageRotation;
  /** Original /Rotate from source PDF at load time. */
  baseRotation: PageRotation;
  thumb?: string;
  /** Landscape vs portrait hint from dimensions. */
  orientation?: "portrait" | "landscape" | "square";
}

export interface RotateOutputOptions {
  fileName: string;
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  compress: boolean;
  password: string;
  preserveMetadata: boolean;
  preserveBookmarks: boolean;
  pdfA: boolean;
  pageNumbers: boolean;
  watermark: string;
  fitToA4: boolean;
}

export const DEFAULT_ROTATE_OUTPUT: RotateOutputOptions = {
  fileName: "rotated",
  title: "",
  author: "ToolNest.io",
  subject: "",
  keywords: [],
  compress: true,
  password: "",
  preserveMetadata: true,
  preserveBookmarks: true,
  pdfA: false,
  pageNumbers: false,
  watermark: "",
  fitToA4: false,
};

export interface PageOrientationInfo {
  pageIndex: number;
  width: number;
  height: number;
  baseRotation: number;
  orientation: "portrait" | "landscape" | "square";
  suggestedRotation: number;
  reason: string;
}

export interface RotateRecommendation {
  title: string;
  detail: string;
  action?: "auto-orient" | "normalize" | "rotate-all-90" | "rotate-landscape";
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 36;

export function normalizeRotation(deg: number): PageRotation {
  return ((deg % 360) + 360) % 360;
}

export function rotateClockwise(current: PageRotation, step = 90): PageRotation {
  return normalizeRotation(current + step);
}

export function rotateCounterClockwise(current: PageRotation, step = 90): PageRotation {
  return normalizeRotation(current - step);
}

/** Legacy 90° step helper compatible with merge/split tools. */
export function nextRotation(current: Rotation): Rotation {
  return rotateClockwise(current, 90) as Rotation;
}

export function detectDigitalSignature(bytes: ArrayBuffer): boolean {
  const sample = new Uint8Array(bytes.slice(0, Math.min(bytes.byteLength, 600_000)));
  const text = new TextDecoder("latin1").decode(sample);
  return /\/Type\s*\/Sig\b/.test(text) || /\/SubFilter\s*\/adbe\.pkcs7/.test(text);
}

export async function readPageDimensions(
  bytes: ArrayBuffer,
): Promise<{ width: number; height: number; rotation: number }[]> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdf.getPages().map((p) => ({
    width: p.getWidth(),
    height: p.getHeight(),
    rotation: p.getRotation().angle,
  }));
}

export function classifyOrientation(w: number, h: number): "portrait" | "landscape" | "square" {
  const ratio = w / Math.max(h, 1);
  if (ratio > 1.08) return "landscape";
  if (ratio < 0.92) return "portrait";
  return "square";
}

/** Heuristic auto-orient: normalize embedded rotation + suggest landscape fixes. */
export async function analyzePageOrientations(bytes: ArrayBuffer): Promise<PageOrientationInfo[]> {
  const dims = await readPageDimensions(bytes);
  return dims.map((d, pageIndex) => {
    const orientation = classifyOrientation(d.width, d.height);
    let suggestedRotation = normalizeRotation(d.rotation);
    let reason = "No change suggested";

    if (d.rotation !== 0) {
      suggestedRotation = 0;
      reason = `Page has embedded ${d.rotation}° rotation — normalize to upright`;
    } else if (orientation === "landscape") {
      suggestedRotation = 90;
      reason = "Landscape page — rotate 90° clockwise for portrait reading";
    }

    return {
      pageIndex,
      width: d.width,
      height: d.height,
      baseRotation: d.rotation,
      orientation,
      suggestedRotation,
      reason,
    };
  });
}

export function smartRotateSuggestions(
  pages: RotatePage[],
  pageCount: number,
  fileSize: number,
  hasSignature: boolean,
  mixedOrientation: boolean,
): string[] {
  const tips: string[] = [];
  const included = pages.filter((p) => p.included);
  const excluded = pages.length - included.length;
  const rotated = included.filter((p) => p.rotation !== 0).length;
  const nonDefaultBase = pages.filter((p) => p.baseRotation !== 0).length;

  if (hasSignature) {
    tips.push(
      "Digital signature detected — rotating may invalidate the signature. Preview before sharing officially.",
    );
  }
  if (excluded > 0) tips.push(`${excluded} page(s) excluded — output will omit deleted pages.`);
  if (rotated > 0 && rotated < included.length) {
    tips.push(`${rotated} of ${included.length} pages rotated — use Apply to range for bulk updates.`);
  }
  if (nonDefaultBase > 0) {
    tips.push(`${nonDefaultBase} page(s) have embedded rotation — try Auto-orient to normalize.`);
  }
  if (mixedOrientation) {
    tips.push("Mixed portrait/landscape pages — Auto-orient or rotate landscape pages individually.");
  }
  if (fileSize > 40 * 1024 * 1024) {
    tips.push("Large PDF — enable Compress in output settings to reduce file size.");
  }
  if (included.length !== pageCount) {
    tips.push("Reordering or deleting pages rebuilds the PDF — bookmarks may not carry over.");
  }
  return tips;
}

export function aiRotateRecommendations(
  pages: RotatePage[],
  orientations: PageOrientationInfo[],
): RotateRecommendation[] {
  const recs: RotateRecommendation[] = [];
  const landscape = orientations.filter((o) => o.orientation === "landscape").length;
  const embedded = orientations.filter((o) => o.baseRotation !== 0).length;
  const mixed =
    orientations.some((o) => o.orientation === "landscape") &&
    orientations.some((o) => o.orientation === "portrait");

  if (embedded > 0) {
    recs.push({
      title: "Normalize embedded rotation",
      detail: `${embedded} page(s) have non-zero /Rotate — reset to upright for consistent viewing.`,
      action: "normalize",
    });
  }
  if (mixed && landscape > 0) {
    recs.push({
      title: "Auto-orient mixed document",
      detail: "Portrait and landscape pages detected — apply smart orientation per page.",
      action: "auto-orient",
    });
  } else if (landscape >= 2) {
    recs.push({
      title: "Rotate landscape pages",
      detail: `${landscape} landscape page(s) — rotate 90° for standard portrait layout.`,
      action: "rotate-landscape",
    });
  }

  const allZero = pages.every((p) => p.rotation === 0);
  if (allZero && pages.length > 1 && landscape === 0) {
    recs.push({
      title: "Rotate all pages 90°",
      detail: "Quick fix when entire document appears sideways.",
      action: "rotate-all-90",
    });
  }

  return recs.slice(0, 4);
}

export function initRotatePages(pageCount: number, baseRotations: number[]): RotatePage[] {
  return Array.from({ length: pageCount }, (_, i) => ({
    id: crypto.randomUUID(),
    sourcePageIndex: i,
    included: true,
    rotation: normalizeRotation(baseRotations[i] ?? 0),
    baseRotation: normalizeRotation(baseRotations[i] ?? 0),
    orientation: undefined,
  }));
}

export function applyAutoOrient(pages: RotatePage[], orientations: PageOrientationInfo[]): RotatePage[] {
  const map = new Map(orientations.map((o) => [o.pageIndex, o]));
  return pages.map((p) => {
    const info = map.get(p.sourcePageIndex);
    if (!info) return p;
    return {
      ...p,
      rotation: info.suggestedRotation,
      orientation: info.orientation,
    };
  });
}

export function normalizeAllRotations(pages: RotatePage[]): RotatePage[] {
  return pages.map((p) => ({ ...p, rotation: 0 }));
}

export function rotateLandscapePages(pages: RotatePage[], orientations: PageOrientationInfo[]): RotatePage[] {
  const landscape = new Set(
    orientations.filter((o) => o.orientation === "landscape").map((o) => o.pageIndex),
  );
  return pages.map((p) =>
    landscape.has(p.sourcePageIndex) ? { ...p, rotation: rotateClockwise(p.rotation, 90) } : p,
  );
}

export function applyRotationToRange(
  pages: RotatePage[],
  rangeInput: string,
  pageCount: number,
  delta: number,
  mode: "add" | "set",
  setValue = 0,
): RotatePage[] {
  const indices = new Set(parsePageRange(rangeInput, pageCount));
  if (!indices.size && rangeInput.trim()) return pages;

  const target = rangeInput.trim() ? indices : new Set(pages.map((p) => p.sourcePageIndex));

  return pages.map((p) => {
    if (!target.has(p.sourcePageIndex)) return p;
    const rotation =
      mode === "set"
        ? normalizeRotation(setValue)
        : delta >= 0
          ? rotateClockwise(p.rotation, delta)
          : rotateCounterClockwise(p.rotation, -delta);
    return { ...p, rotation };
  });
}

function saveOpts(options: RotateOutputOptions): Parameters<PDFDocument["save"]>[0] {
  return {
    useObjectStreams: options.compress,
    ...(options.password.trim()
      ? { userPassword: options.password.trim(), ownerPassword: options.password.trim() }
      : {}),
  } as Parameters<PDFDocument["save"]>[0];
}

async function applyRotateMetadata(
  out: PDFDocument,
  sourceBytes: ArrayBuffer,
  options: RotateOutputOptions,
) {
  if (options.preserveMetadata) {
    try {
      const src = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
      if (src.getTitle()) out.setTitle(src.getTitle()!);
      if (src.getAuthor()) out.setAuthor(src.getAuthor()!);
      if (src.getSubject()) out.setSubject(src.getSubject()!);
      const kw = src.getKeywords();
      if (kw) out.setKeywords(typeof kw === "string" ? kw.split(",").map((k) => k.trim()) : kw);
    } catch {
      /* ignore */
    }
  }

  if (options.title.trim()) out.setTitle(options.title.trim());
  if (options.author.trim()) out.setAuthor(options.author.trim());
  if (options.subject.trim()) out.setSubject(options.subject.trim());
  if (options.keywords.length) out.setKeywords(options.keywords.filter(Boolean));

  out.setProducer(options.pdfA ? "ToolNest.io PDF Rotate Ultra (PDF/A)" : "ToolNest.io PDF Rotate Ultra");
  out.setCreator("ToolNest.io");
}

function stampPage(
  page: ReturnType<PDFDocument["getPages"]>[0],
  index: number,
  total: number,
  options: RotateOutputOptions,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
) {
  if (options.watermark.trim()) {
    const size = Math.min(48, page.getWidth() / 8);
    const text = options.watermark.trim();
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: page.getWidth() / 2 - w / 2,
      y: page.getHeight() / 2,
      size,
      font,
      color: rgb(0.82, 0.82, 0.82),
      rotate: degrees(-35),
      opacity: 0.35,
    });
  }
  if (options.pageNumbers) {
    const label = `${index + 1} / ${total}`;
    const size = 9;
    const lw = font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: (page.getWidth() - lw) / 2,
      y: 18,
      size,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  }
}

/** True when output keeps all pages in original order — allows in-place rotation (preserves bookmarks). */
export function canRotateInPlace(pages: RotatePage[], sourcePageCount: number): boolean {
  const included = pages.filter((p) => p.included);
  if (included.length !== sourcePageCount) return false;
  if (pages.length !== sourcePageCount) return false;
  return pages.every((p, i) => p.sourcePageIndex === i && p.included);
}

export async function buildRotatedPdf(
  sourceBytes: ArrayBuffer,
  pages: RotatePage[],
  options: RotateOutputOptions,
  onProgress?: (pct: number) => void,
): Promise<Uint8Array> {
  const included = pages.filter((p) => p.included);
  if (!included.length) throw new Error("No pages selected");

  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const pageCount = source.getPageCount();

  if (canRotateInPlace(pages, pageCount)) {
    const srcPages = source.getPages();
    for (let i = 0; i < srcPages.length; i++) {
      const state = pages[i];
      if (state) srcPages[i]!.setRotation(degrees(state.rotation));
      onProgress?.(Math.round(((i + 1) / pageCount) * 100));
    }
    await applyRotateMetadata(source, sourceBytes, options);
    onProgress?.(100);
    return source.save(saveOpts(options));
  }

  const out = await PDFDocument.create();
  await applyRotateMetadata(out, sourceBytes, options);

  const font =
    options.pageNumbers || options.watermark.trim()
      ? await out.embedFont(StandardFonts.Helvetica)
      : null;

  for (let i = 0; i < included.length; i++) {
    const item = included[i]!;
    const idx = item.sourcePageIndex;
    onProgress?.(Math.round(((i + 1) / included.length) * 100));

    if (options.fitToA4) {
      const srcPage = source.getPages()[idx];
      if (!srcPage) continue;
      const embedded = await out.embedPage(srcPage);
      const newPage = out.addPage(A4);
      let w = embedded.width;
      let h = embedded.height;
      const rot = item.rotation;
      if (rot === 90 || rot === 270) [w, h] = [h, w];
      const scale = Math.min((A4[0] - MARGIN * 2) / w, (A4[1] - MARGIN * 2) / h);
      const dw = w * scale;
      const dh = h * scale;
      newPage.drawPage(embedded, {
        x: (A4[0] - dw) / 2,
        y: (A4[1] - dh) / 2,
        width: dw,
        height: dh,
        rotate: degrees(rot),
      });
    } else {
      const [page] = await out.copyPages(source, [idx]);
      if (item.rotation) page.setRotation(degrees(item.rotation));
      out.addPage(page);
    }
  }

  if (font) {
    const outPages = out.getPages();
    outPages.forEach((page, idx) => stampPage(page, idx, outPages.length, options, font));
  }

  onProgress?.(100);
  return out.save(saveOpts(options));
}

export interface RotatedFile {
  name: string;
  data: Uint8Array;
}

export async function executeBatchRotate(
  sources: { name: string; bytes: ArrayBuffer; pageCount: number }[],
  globalRotation: PageRotation,
  options: RotateOutputOptions,
  onProgress?: (pct: number) => void,
): Promise<RotatedFile[]> {
  const results: RotatedFile[] = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]!;
    const base = await readPageDimensions(src.bytes);
    const pages: RotatePage[] = base.map((d, j) => ({
      id: crypto.randomUUID(),
      sourcePageIndex: j,
      included: true,
      rotation: normalizeRotation(d.rotation + globalRotation),
      baseRotation: normalizeRotation(d.rotation),
    }));
    const opts = {
      ...options,
      fileName: src.name.replace(/\.pdf$/i, "") || "rotated",
    };
    const data = await buildRotatedPdf(src.bytes, pages, opts);
    results.push({
      name: sanitizeFilename(`${opts.fileName}-rotated`),
      data,
    });
    onProgress?.(Math.round(((i + 1) / sources.length) * 100));
  }
  return results;
}

export async function zipRotatedFiles(files: RotatedFile[], zipName: string): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name.endsWith(".pdf") ? f.name : `${f.name}.pdf`, f.data));
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/zip",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

/** Render thumbnail with rotation applied in viewport. */
export async function renderRotatedThumb(
  bytes: ArrayBuffer,
  pageIndex: number,
  rotation: PageRotation,
  scale = 0.22,
): Promise<string> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale, rotation });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    doc.destroy();
    return "";
  }
  await page.render({ canvasContext: ctx, viewport }).promise;
  doc.destroy();
  return canvas.toDataURL("image/jpeg", 0.72);
}

export interface ApiRotateRequest {
  /** Per-page: { pageIndex, rotation?, included? } — omit for global rotate all. */
  pages?: { pageIndex: number; rotation?: number; included?: boolean }[];
  globalRotation?: number;
  options?: Partial<RotateOutputOptions>;
}

export async function rotatePdfFromBytes(
  pdfBytes: Uint8Array,
  request: ApiRotateRequest,
): Promise<Uint8Array> {
  const ab = pdfBytes.slice().buffer;
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageCount = pdf.getPageCount();
  const dims = await readPageDimensions(ab);

  let pages: RotatePage[];
  if (request.pages?.length) {
    pages = dims.map((d, i) => {
      const ref = request.pages!.find((p) => p.pageIndex === i);
      return {
        id: crypto.randomUUID(),
        sourcePageIndex: i,
        included: ref?.included !== false,
        rotation: normalizeRotation(ref?.rotation ?? d.rotation + (request.globalRotation ?? 0)),
        baseRotation: normalizeRotation(d.rotation),
      };
    });
  } else {
    const global = request.globalRotation ?? 90;
    pages = dims.map((d, i) => ({
      id: crypto.randomUUID(),
      sourcePageIndex: i,
      included: true,
      rotation: normalizeRotation(d.rotation + global),
      baseRotation: normalizeRotation(d.rotation),
    }));
  }

  const options: RotateOutputOptions = {
    ...DEFAULT_ROTATE_OUTPUT,
    ...(request.options ?? {}),
    keywords: request.options?.keywords ?? DEFAULT_ROTATE_OUTPUT.keywords,
  };

  return buildRotatedPdf(ab, pages, options);
}
