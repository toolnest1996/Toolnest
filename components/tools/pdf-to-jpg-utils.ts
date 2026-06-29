/**
 * Ultra PDF to JPG Studio — export pages as JPG/PNG/WebP at configurable DPI.
 * Client-side via pdf.js canvas. Reuses pdf-canvas-utils + pdf-merge-utils.
 */

import {
  parsePageRange,
  parsePdf,
  renderThumb,
  sanitizeFilename,
} from "./pdf-merge-utils";
import {
  renderPdfPagesToCanvases,
  canvasToBlob,
  sanitizeFileStem,
} from "./pdf-canvas-utils";

export { parsePdf, renderThumb, sanitizeFilename, parsePageRange, sanitizeFileStem };

export type ImageExportFormat = "jpeg" | "png" | "webp";
export type ExportPackMode = "zip" | "individual";

export interface PdfToImageSettings {
  format: ImageExportFormat;
  dpi: number;
  quality: number;
  pageRange: string;
  packMode: ExportPackMode;
}

export const DEFAULT_PDF_TO_IMAGE_SETTINGS: PdfToImageSettings = {
  format: "jpeg",
  dpi: 150,
  quality: 0.92,
  pageRange: "",
  packMode: "zip",
};

export const IMAGE_FORMAT_OPTIONS: { id: ImageExportFormat; label: string; mime: string; ext: string }[] = [
  { id: "jpeg", label: "JPG", mime: "image/jpeg", ext: "jpg" },
  { id: "png", label: "PNG", mime: "image/png", ext: "png" },
  { id: "webp", label: "WebP", mime: "image/webp", ext: "webp" },
];

function mimeForFormat(format: ImageExportFormat): "image/jpeg" | "image/png" | "image/webp" {
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return "image/jpeg";
}

function extForFormat(format: ImageExportFormat): string {
  return IMAGE_FORMAT_OPTIONS.find((f) => f.id === format)?.ext ?? "jpg";
}

export function smartPdfToImageTips(pageCount: number, settings: PdfToImageSettings): string[] {
  const tips: string[] = [];
  if (settings.dpi > 200) tips.push("High DPI (200+) produces large images — use for print, not web.");
  if (settings.dpi < 100) tips.push("Low DPI (<100) is fine for previews but may look blurry when zoomed.");
  if (pageCount > 50 && settings.dpi >= 200) tips.push(`${pageCount} pages at ${settings.dpi} DPI — expect a large ZIP.`);
  if (settings.format === "png" && pageCount > 20) tips.push("PNG is lossless but much larger than JPG for multi-page PDFs.");
  return tips;
}

export interface ExportedImage {
  name: string;
  blob: Blob;
  pageIndex: number;
}

export async function exportPdfToImages(
  bytes: ArrayBuffer,
  fileStem: string,
  settings: PdfToImageSettings,
  password?: string,
  onProgress?: (pct: number) => void,
): Promise<ExportedImage[]> {
  const stem = sanitizeFileStem(fileStem);
  const ext = extForFormat(settings.format);
  const mime = mimeForFormat(settings.format);

  const { canvases, pageIndices, pageCount } = await renderPdfPagesToCanvases(bytes, {
    dpi: settings.dpi,
    pageRange: settings.pageRange,
    password,
    onProgress: (p, t) => onProgress?.(Math.round((p / t) * 90)),
  });

  const images: ExportedImage[] = [];
  for (let i = 0; i < canvases.length; i++) {
    const pageNum = pageIndices[i]! + 1;
    const blob = await canvasToBlob(canvases[i]!, mime, settings.quality);
    const pad = String(pageNum).padStart(String(pageCount).length, "0");
    images.push({
      name: `${stem}-page-${pad}.${ext}`,
      blob,
      pageIndex: pageIndices[i]!,
    });
  }

  onProgress?.(100);
  return images;
}

export async function zipExportedImages(images: ExportedImage[], zipName: string): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  images.forEach((img) => zip.file(img.name, img.blob));
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/zip",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export interface BatchPdfImageResult {
  pdfName: string;
  images: ExportedImage[];
}

export async function executeBatchPdfToImages(
  sources: { name: string; bytes: ArrayBuffer }[],
  settings: PdfToImageSettings,
  onProgress?: (pct: number) => void,
): Promise<BatchPdfImageResult[]> {
  const results: BatchPdfImageResult[] = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]!;
    const stem = src.name.replace(/\.pdf$/i, "") || "pdf";
    const images = await exportPdfToImages(src.bytes, stem, settings);
    results.push({ pdfName: src.name, images });
    onProgress?.(Math.round(((i + 1) / sources.length) * 100));
  }
  return results;
}

export async function zipBatchPdfImages(results: BatchPdfImageResult[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const r of results) {
    const folder = sanitizeFileStem(r.pdfName);
    for (const img of r.images) {
      zip.file(`${folder}/${img.name}`, img.blob);
    }
  }
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/zip",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

export interface ApiPdfToImageRequest {
  settings?: Partial<PdfToImageSettings>;
  password?: string;
}

export interface ApiPdfToImagePage {
  page: number;
  base64: string;
  mimeType: string;
  name: string;
}

export async function pdfToImagesFromBytes(
  pdfBytes: Uint8Array,
  fileStem: string,
  request: ApiPdfToImageRequest = {},
): Promise<ApiPdfToImagePage[]> {
  const settings: PdfToImageSettings = { ...DEFAULT_PDF_TO_IMAGE_SETTINGS, ...(request.settings ?? {}) };
  const ab = pdfBytes.slice().buffer;
  const images = await exportPdfToImages(ab, fileStem, settings, request.password);
  const fmt = IMAGE_FORMAT_OPTIONS.find((f) => f.id === settings.format)!;
  const out: ApiPdfToImagePage[] = [];
  for (const img of images) {
    const buf = new Uint8Array(await img.blob.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]!);
    out.push({
      page: img.pageIndex + 1,
      base64: btoa(binary),
      mimeType: fmt.mime,
      name: img.name,
    });
  }
  return out;
}
