/**
 * Ultra PDF Repair Studio — re-save, flatten/copy, rasterize-rebuild strategies.
 * Client-side via pdf-lib + pdf.js canvas. Reuses pdf-merge-utils helpers.
 */

import { PDFDocument } from "pdf-lib";
import {
  parsePdf,
  renderThumb,
  sanitizeFilename,
  PdfEncryptedError,
} from "./pdf-merge-utils";

export { parsePdf, renderThumb, sanitizeFilename, PdfEncryptedError };

export type RepairStrategy = "resave" | "flatten" | "rasterize";

export interface RepairOptions {
  strategy: RepairStrategy;
  password?: string;
  dpi?: number;
  jpegQuality?: number;
}

export const DEFAULT_REPAIR_OPTIONS: RepairOptions = {
  strategy: "resave",
  dpi: 150,
  jpegQuality: 0.85,
};

export interface PdfIssueReport {
  encrypted: boolean;
  zeroPages: boolean;
  xrefError: boolean;
  loadError: string | null;
  pageCount: number;
  fileSize: number;
  canOpenWithPdfJs: boolean;
  canOpenWithPdfLib: boolean;
  severity: "ok" | "warning" | "critical";
  summary: string[];
}

export function detectXrefHeuristic(bytes: ArrayBuffer): boolean {
  const sample = new Uint8Array(bytes.slice(Math.max(0, bytes.byteLength - 8192)));
  const tail = new TextDecoder("latin1").decode(sample);
  if (/startxref\s*\n\s*0\s*\n/i.test(tail)) return true;
  if (!/%%EOF/.test(tail) && bytes.byteLength > 1024) return true;
  const head = new TextDecoder("latin1").decode(new Uint8Array(bytes.slice(0, Math.min(bytes.byteLength, 4096))));
  if (!head.startsWith("%PDF-")) return true;
  return false;
}

export async function analyzePdfIssues(
  bytes: ArrayBuffer,
  password?: string,
): Promise<PdfIssueReport> {
  const summary: string[] = [];
  let encrypted = false;
  let zeroPages = false;
  let xrefError = detectXrefHeuristic(bytes);
  let loadError: string | null = null;
  let pageCount = 0;
  let canOpenWithPdfLib = false;
  let canOpenWithPdfJs = false;

  const head = new TextDecoder("latin1").decode(new Uint8Array(bytes.slice(0, Math.min(bytes.byteLength, 65536))));
  encrypted = /\/Encrypt\b/.test(head);

  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pageCount = pdf.getPageCount();
    canOpenWithPdfLib = true;
    zeroPages = pageCount === 0;
    if (zeroPages) summary.push("PDF reports zero pages.");
  } catch (e) {
    loadError = e instanceof Error ? e.message : "pdf-lib load failed";
    summary.push(`pdf-lib: ${loadError}`);
  }

  try {
    const { loadPdfJs } = await import("./pdf-canvas-utils");
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({
      data: bytes.slice(0),
      password: password || undefined,
    }).promise;
    pageCount = Math.max(pageCount, doc.numPages);
    canOpenWithPdfJs = doc.numPages > 0;
    if (doc.numPages === 0) zeroPages = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "pdf.js load failed";
    if (!loadError) loadError = msg;
    summary.push(`pdf.js: ${msg}`);
  }

  if (xrefError) summary.push("Possible xref/trailer corruption detected (heuristic).");
  if (encrypted) summary.push("Document appears password-encrypted.");

  let severity: PdfIssueReport["severity"] = "ok";
  if (!canOpenWithPdfLib && !canOpenWithPdfJs) severity = "critical";
  else if (xrefError || zeroPages || loadError) severity = "warning";

  if (severity === "ok" && summary.length === 0) {
    summary.push("No obvious structural issues — re-save may still normalize the file.");
  }

  return {
    encrypted,
    zeroPages,
    xrefError,
    loadError,
    pageCount,
    fileSize: bytes.byteLength,
    canOpenWithPdfJs,
    canOpenWithPdfLib,
    severity,
    summary,
  };
}

export function smartRepairTips(report: PdfIssueReport, strategy: RepairStrategy): string[] {
  const tips: string[] = [];
  if (report.encrypted) tips.push("Unlock with password before repair.");
  if (report.xrefError && strategy === "resave") tips.push("Xref errors — try Flatten/Copy or Rasterize rebuild.");
  if (report.severity === "critical" && strategy !== "rasterize") {
    tips.push("Heavy corruption — Rasterize rebuild renders each page as image (largest file, best recovery).");
  }
  if (strategy === "rasterize") tips.push("Rasterize converts pages to images — text will not be selectable.");
  return tips;
}

function toArrayBuffer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (bytes instanceof Uint8Array) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer.slice(0) as ArrayBuffer;
  }
  return bytes.slice(0);
}

async function repairResave(bytes: ArrayBuffer): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdf.save({ useObjectStreams: true });
}

async function repairFlatten(bytes: ArrayBuffer): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, src.getPageIndices());
  copied.forEach((p) => out.addPage(p));
  if (src.getTitle()) out.setTitle(src.getTitle()!);
  if (src.getAuthor()) out.setAuthor(src.getAuthor()!);
  return out.save({ useObjectStreams: true });
}

async function repairRasterize(
  bytes: ArrayBuffer,
  options: RepairOptions,
  onProgress?: (pct: number) => void,
): Promise<Uint8Array> {
  const { renderPdfPagesToCanvases, canvasToBlob } = await import("./pdf-canvas-utils");
  const { canvases, pageCount } = await renderPdfPagesToCanvases(bytes, {
    dpi: options.dpi ?? 150,
    password: options.password,
    onProgress: (p, t) => onProgress?.(Math.round((p / t) * 80)),
  });

  const out = await PDFDocument.create();
  const quality = options.jpegQuality ?? 0.85;

  for (let i = 0; i < canvases.length; i++) {
    const canvas = canvases[i]!;
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    const jpgBytes = new Uint8Array(await blob.arrayBuffer());
    const img = await out.embedJpg(jpgBytes);
    const page = out.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
    onProgress?.(80 + Math.round(((i + 1) / pageCount) * 20));
  }

  out.setProducer("ToolNest.io PDF Repair Ultra (rasterize)");
  onProgress?.(100);
  return out.save({ useObjectStreams: true });
}

export async function repairPdf(
  bytes: ArrayBuffer | Uint8Array,
  options: RepairOptions = DEFAULT_REPAIR_OPTIONS,
  onProgress?: (pct: number) => void,
): Promise<Uint8Array> {
  const ab = toArrayBuffer(bytes);
  const strategy = options.strategy;

  if (strategy === "resave") {
    onProgress?.(50);
    const out = await repairResave(ab);
    onProgress?.(100);
    return out;
  }
  if (strategy === "flatten") {
    onProgress?.(40);
    const out = await repairFlatten(ab);
    onProgress?.(100);
    return out;
  }
  return repairRasterize(ab, options, onProgress);
}

export interface RepairedFile {
  name: string;
  data: Uint8Array;
}

export async function executeBatchRepair(
  sources: { name: string; bytes: ArrayBuffer }[],
  options: RepairOptions,
  onProgress?: (pct: number) => void,
): Promise<RepairedFile[]> {
  const results: RepairedFile[] = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]!;
    const stem = src.name.replace(/\.pdf$/i, "") || "repaired";
    const data = await repairPdf(src.bytes, options);
    results.push({ name: sanitizeFilename(`${stem}-repaired`), data });
    onProgress?.(Math.round(((i + 1) / sources.length) * 100));
  }
  return results;
}

export async function zipRepairedFiles(files: RepairedFile[]): Promise<Blob> {
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

export interface ApiRepairRequest {
  options?: Partial<RepairOptions>;
}

export async function repairPdfFromBytes(
  pdfBytes: Uint8Array,
  request: ApiRepairRequest = {},
): Promise<Uint8Array> {
  const options: RepairOptions = { ...DEFAULT_REPAIR_OPTIONS, ...(request.options ?? {}) };
  if (options.strategy === "rasterize") {
    throw new Error("Rasterize strategy requires client-side processing. Use resave or flatten via API.");
  }
  const ab = pdfBytes.slice().buffer;
  return repairPdf(ab, options);
}
