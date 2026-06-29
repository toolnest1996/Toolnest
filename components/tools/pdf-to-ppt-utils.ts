/**
 * Ultra PDF to PowerPoint — pdf.js render + pptxgenjs.
 * 100% client-side; optional REST API with text-layout fallback server-side.
 */

import PptxGenJS from "pptxgenjs";
import { renderPdfPagesToCanvases, canvasToBlob, sanitizeFileStem } from "./pdf-canvas-utils";
import { sanitizeFilename } from "./pdf-merge-utils";

export type SlideLayout = "16x9" | "4x3";

export interface PdfToPptSettings {
  dpi: number;
  pageRange: string;
  password: string;
  layout: SlideLayout;
  jpegQuality: number;
}

export const DEFAULT_PDF_TO_PPT: PdfToPptSettings = {
  dpi: 150,
  pageRange: "",
  password: "",
  layout: "16x9",
  jpegQuality: 0.9,
};

export interface ConvertResult {
  blob: Blob;
  bytes: number;
  slideCount: number;
  pageCount: number;
  durationMs: number;
}

export interface ConvertItem {
  id: string;
  file: File;
  name: string;
  originalBytes: number;
  pageCount: number;
  status: "queued" | "loading" | "converting" | "done" | "error";
  result: ConvertResult | null;
  error?: string;
  previewText: string;
}

export function buildPptxOutputName(sourceName: string): string {
  return sanitizeFilename(`${sourceName.replace(/\.pdf$/i, "")}.pptx`);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      resolve(s.split(",")[1] ?? "");
    };
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function probePdfPages(bytes: ArrayBuffer, password?: string): Promise<number> {
  const { loadPdfJs } = await import("./pdf-canvas-utils");
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: bytes.slice(0), password: password || undefined }).promise;
  return doc.numPages;
}

export async function buildPreviewText(file: File): Promise<string> {
  try {
    const pages = await probePdfPages(await file.arrayBuffer());
    return `${pages} page(s) → ${pages} slide(s)`;
  } catch {
    return "PDF document";
  }
}

export function smartPdfToPptSuggestions(items: ConvertItem[], settings: PdfToPptSettings): string[] {
  const tips: string[] = [];
  if (items.some((i) => i.pageCount > 50)) {
    tips.push("Large PDFs at high DPI use significant memory — try 96–120 DPI or a page range.");
  }
  if (settings.dpi > 200) {
    tips.push("DPI above 200 increases file size — 150 is a good balance for presentations.");
  }
  if (settings.pageRange.trim()) {
    tips.push(`Page range "${settings.pageRange}" will limit exported slides.`);
  }
  return tips;
}

export async function convertPdfToPptx(
  bytes: ArrayBuffer,
  fileName: string,
  settings: PdfToPptSettings,
  onProgress?: (pct: number) => void,
): Promise<ConvertResult> {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const { canvases, pageCount } = await renderPdfPagesToCanvases(bytes, {
    dpi: settings.dpi,
    pageRange: settings.pageRange,
    password: settings.password || undefined,
    onProgress: (p, t) => onProgress?.(Math.round((p / t) * 85)),
  });

  const pptx = new PptxGenJS();
  pptx.layout = settings.layout === "16x9" ? "LAYOUT_16x9" : "LAYOUT_4x3";
  pptx.author = "ToolNest.io";
  pptx.title = sanitizeFileStem(fileName);

  for (let i = 0; i < canvases.length; i++) {
    const blob = await canvasToBlob(canvases[i]!, "image/jpeg", settings.jpegQuality);
    const b64 = await blobToBase64(blob);
    const slide = pptx.addSlide();
    slide.addImage({ data: `image/jpeg;base64,${b64}`, x: 0, y: 0, w: "100%", h: "100%" });
    onProgress?.(85 + Math.round(((i + 1) / canvases.length) * 15));
  }

  const out = (await pptx.write({ outputType: "blob" })) as Blob;
  onProgress?.(100);

  return {
    blob: out,
    bytes: out.size,
    slideCount: canvases.length,
    pageCount,
    durationMs: Math.round(typeof performance !== "undefined" ? performance.now() - t0 : 0),
  };
}

export async function convertPdfToPptBatch(
  files: File[],
  settings: PdfToPptSettings,
  onProgress?: (idx: number, total: number) => void,
): Promise<ConvertResult[]> {
  const results: ConvertResult[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length);
    results.push(await convertPdfToPptx(await files[i]!.arrayBuffer(), files[i]!.name, settings));
  }
  onProgress?.(files.length, files.length);
  return results;
}

export async function executeBatchPdfToPpt(
  sources: { name: string; bytes: ArrayBuffer }[],
  settings: PdfToPptSettings,
  onProgress?: (pct: number) => void,
): Promise<{ name: string; blob: Blob }[]> {
  const out: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]!;
    const result = await convertPdfToPptx(src.bytes, src.name, settings);
    out.push({ name: buildPptxOutputName(src.name), blob: result.blob });
    onProgress?.(Math.round(((i + 1) / sources.length) * 100));
  }
  return out;
}

export async function zipPptxFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const f of files) zip.file(f.name.endsWith(".pptx") ? f.name : `${f.name}.pptx`, f.blob);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
