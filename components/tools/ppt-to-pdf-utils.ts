/**
 * Ultra PowerPoint to PDF — PPTX via JSZip + jspdf.
 * 100% client-side; optional REST API mirrors the same pipeline server-side.
 * Note: legacy .ppt (binary) is not supported — only .pptx.
 */

import JSZip from "jszip";
import { jsPDF } from "jspdf";
import { sanitizeFilename } from "./pdf-merge-utils";

export type PptFormat = "pptx" | "ppt" | "unknown";

export interface PptToPdfSettings {
  pageSize: "a4" | "letter";
  orientation: "portrait" | "landscape";
  margin: number;
  fontSize: number;
  includeImages: boolean;
}

export const DEFAULT_PPT_TO_PDF: PptToPdfSettings = {
  pageSize: "a4",
  orientation: "landscape",
  margin: 18,
  fontSize: 11,
  includeImages: true,
};

export const ACCEPT_EXTENSIONS = ".pptx";

export interface ConvertResult {
  blob: Blob;
  bytes: number;
  pageCount: number;
  slideCount: number;
  durationMs: number;
  previewUrl: string;
}

export interface ConvertItem {
  id: string;
  file: File;
  name: string;
  originalBytes: number;
  format: PptFormat;
  slideCount: number;
  status: "queued" | "loading" | "converting" | "done" | "error";
  result: ConvertResult | null;
  error?: string;
  previewText: string;
}

export function detectPptFormat(file: File | string): PptFormat {
  const n = (typeof file === "string" ? file : file.name).toLowerCase();
  if (n.endsWith(".pptx")) return "pptx";
  if (n.endsWith(".ppt")) return "ppt";
  return "unknown";
}

export function buildPdfOutputName(sourceName: string): string {
  return sanitizeFilename(`${sourceName.replace(/\.[^.]+$/, "")}.pdf`);
}

function uint8ToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function xmlTexts(xml: string): string[] {
  const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1] ?? "");
  return out;
}

export async function probePptx(bytes: ArrayBuffer): Promise<{ slideCount: number; hasImages: boolean }> {
  const zip = await JSZip.loadAsync(bytes);
  const slides = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p));
  const hasImages = Object.keys(zip.files).some((p) => /^ppt\/media\//i.test(p));
  return { slideCount: slides.length, hasImages };
}

export async function buildPreviewText(file: File): Promise<string> {
  const fmt = detectPptFormat(file);
  if (fmt === "ppt") return "Legacy .ppt is not supported — save as .pptx in PowerPoint";
  if (fmt !== "pptx") return "Unsupported presentation format";
  try {
    const probe = await probePptx(await file.arrayBuffer());
    return `${probe.slideCount} slide(s)${probe.hasImages ? " · embedded images" : ""}`;
  } catch {
    return "PPTX presentation";
  }
}

export function smartPptToPdfSuggestions(items: ConvertItem[], settings: PptToPdfSettings): string[] {
  const tips: string[] = [];
  if (items.some((i) => i.format === "ppt")) {
    tips.push("Convert .ppt files to .pptx in PowerPoint — binary .ppt cannot be read in-browser.");
  }
  if (items.some((i) => i.slideCount > 30)) {
    tips.push("Large decks may take a minute — preview before batch ZIP download.");
  }
  if (!settings.includeImages) {
    tips.push("Enable Include images to embed slide media from ppt/media.");
  }
  if (settings.orientation === "portrait") {
    tips.push("Landscape is recommended for slide layouts.");
  }
  return tips;
}

export async function convertPptxToPdf(
  bytes: ArrayBuffer,
  fileName: string,
  settings: PptToPdfSettings,
  onProgress?: (pct: number) => void,
): Promise<ConvertResult> {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const fmt = detectPptFormat(fileName);
  if (fmt === "ppt") throw new Error("Legacy .ppt is not supported — save as .pptx and retry.");
  if (fmt !== "pptx") throw new Error("Only .pptx files are supported.");

  onProgress?.(10);
  const zip = await JSZip.loadAsync(bytes);
  const slideFiles = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const na = parseInt(a.match(/(\d+)/)?.[1] ?? "0", 10);
      const nb = parseInt(b.match(/(\d+)/)?.[1] ?? "0", 10);
      return na - nb;
    });

  if (!slideFiles.length) throw new Error("No slides found in PPTX file.");

  const doc = new jsPDF({ orientation: settings.orientation, unit: "mm", format: settings.pageSize });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = settings.margin;

  for (let i = 0; i < slideFiles.length; i++) {
    if (i > 0) doc.addPage();
    onProgress?.(10 + Math.round((i / slideFiles.length) * 80));

    const xml = await zip.file(slideFiles[i]!)!.async("string");
    const texts = xmlTexts(xml);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(`Slide ${i + 1}`, m, m + 8);
    doc.setFontSize(settings.fontSize);
    doc.setFont("helvetica", "normal");
    let y = m + 20;

    texts.forEach((t) => {
      if (!t.trim()) return;
      const lines = doc.splitTextToSize(t, pageW - m * 2) as string[];
      lines.forEach((line) => {
        if (y > pageH - m) {
          doc.addPage();
          y = m + 10;
        }
        doc.text(line, m, y);
        y += settings.fontSize * 0.5 + 4;
      });
    });

    if (settings.includeImages) {
      const relPath = slideFiles[i]!.replace("slides/", "slides/_rels/") + ".rels";
      const rels = zip.file(relPath);
      if (rels) {
        const relXml = await rels.async("string");
        const imgRefs = [...relXml.matchAll(/Target="\.\.\/media\/([^"]+)"/g)].map((x) => x[1]!);
        for (const ref of imgRefs.slice(0, 3)) {
          const media = zip.file(`ppt/media/${ref}`);
          if (!media) continue;
          const imgBytes = await media.async("uint8array");
          const b64 = uint8ToBase64(imgBytes);
          const mime = ref.toLowerCase().endsWith(".png") ? "PNG" : "JPEG";
          try {
            if (y > pageH - m - 45) {
              doc.addPage();
              y = m + 10;
            }
            doc.addImage(`data:image/${mime.toLowerCase()};base64,${b64}`, mime, m, y, pageW - m * 2, 45);
            y += 48;
          } catch {
            /* skip bad image */
          }
        }
      }
    }
  }

  doc.setProperties({ title: fileName.replace(/\.[^.]+$/, ""), creator: "ToolNest.io" });
  const ab = doc.output("arraybuffer");
  const blob = new Blob([ab], { type: "application/pdf" });
  onProgress?.(100);

  return {
    blob,
    bytes: ab.byteLength,
    pageCount: doc.getNumberOfPages(),
    slideCount: slideFiles.length,
    durationMs: Math.round(typeof performance !== "undefined" ? performance.now() - t0 : 0),
    previewUrl: typeof URL !== "undefined" && "createObjectURL" in URL ? URL.createObjectURL(blob) : "",
  };
}

export async function convertPptBatch(
  files: File[],
  settings: PptToPdfSettings,
  onProgress?: (idx: number, total: number) => void,
): Promise<ConvertResult[]> {
  const results: ConvertResult[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, files.length);
    results.push(await convertPptxToPdf(await files[i]!.arrayBuffer(), files[i]!.name, settings));
  }
  onProgress?.(files.length, files.length);
  return results;
}

export async function executeBatchPptToPdf(
  sources: { name: string; bytes: ArrayBuffer }[],
  settings: PptToPdfSettings,
  onProgress?: (pct: number) => void,
): Promise<{ name: string; data: Uint8Array }[]> {
  const out: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]!;
    const result = await convertPptxToPdf(src.bytes, src.name, settings);
    out.push({ name: buildPdfOutputName(src.name), data: new Uint8Array(await result.blob.arrayBuffer()) });
    onProgress?.(Math.round(((i + 1) / sources.length) * 100));
  }
  return out;
}

export async function zipPdfOutputs(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const JSZipMod = (await import("jszip")).default;
  const zip = new JSZipMod();
  files.forEach((f) => zip.file(f.name.endsWith(".pdf") ? f.name : `${f.name}.pdf`, f.blob));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
