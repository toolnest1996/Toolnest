/**
 * Ultra PDF → Word Converter — extraction + DOCX/DOC/RTF builders + OCR.
 * 100% client-side using pdfjs-dist + the `docx` library. OCR is lazily
 * loaded from CDN (tesseract.js) only when the user enables it.
 */

import { parsePageRange } from "./pdf-merge-utils";

export type OutputFormat = "docx" | "doc" | "rtf";
export type OcrMode = "auto" | "always" | "scanned-only" | "never";

export interface ConvertOptions {
  pageRanges: string;
  password: string;
  ocrMode: OcrMode;
  ocrLanguage: string;
  preserveLayout: boolean;
  extractImages: boolean;
  imageDpi: number;
  outputFormat: OutputFormat;
  includeHeaders: boolean;
  includeFooters: boolean;
  includeHyperlinks: boolean;
}

export interface TextBlock {
  text: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  alignment: "left" | "center" | "right" | "justify";
  isHeading: boolean;
  listItem: boolean;
  /** 1-based page number */
  page: number;
}

export interface ExtractedImage {
  /** data URL — used directly by DOCX/HTML builders */
  dataUrl: string;
  /** raw bytes for ZIP export */
  bytes: Uint8Array;
  mime: string;
  width: number;
  height: number;
  name: string;
  page: number;
}

export interface PageContent {
  pageNumber: number;
  blocks: TextBlock[];
  images: ExtractedImage[];
  /** rendered page preview for the UI */
  thumbDataUrl: string;
  hasText: boolean;
  isScanned: boolean;
  ocrConfidence: number | null;
}

export interface ConvertResult {
  blob: Blob;
  bytes: number;
  format: OutputFormat;
  pageCount: number;
  wordCount: number;
  imageCount: number;
  ocrPages: number;
  durationMs: number;
  previewUrl: string;
}

export interface ConvertItem {
  id: string;
  file: File;
  name: string;
  originalBytes: number;
  pageCount: number;
  encrypted: boolean;
  status: "queued" | "loading" | "converting" | "done" | "error";
  result: ConvertResult | null;
  error?: string;
  /** page previews */
  pages: PageContent[];
  thumbUrl: string;
}

export const DEFAULT_CONVERT_OPTIONS: ConvertOptions = {
  pageRanges: "",
  password: "",
  ocrMode: "scanned-only",
  ocrLanguage: "eng",
  preserveLayout: true,
  extractImages: true,
  imageDpi: 150,
  outputFormat: "docx",
  includeHeaders: true,
  includeFooters: true,
  includeHyperlinks: true,
};

export const OCR_LANGUAGES: { code: string; label: string }[] = [
  { code: "eng", label: "English" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "ita", label: "Italian" },
  { code: "por", label: "Portuguese" },
  { code: "nld", label: "Dutch" },
  { code: "rus", label: "Russian" },
  { code: "tur", label: "Turkish" },
  { code: "hin", label: "Hindi" },
  { code: "ara", label: "Arabic" },
  { code: "chi_sim", label: "Chinese (Simplified)" },
  { code: "chi_tra", label: "Chinese (Traditional)" },
  { code: "jpn", label: "Japanese" },
  { code: "kor", label: "Korean" },
  { code: "tha", label: "Thai" },
  { code: "vie", label: "Vietnamese" },
  { code: "eng+spa", label: "English + Spanish" },
  { code: "eng+fra", label: "English + French" },
  { code: "eng+deu", label: "English + German" },
];

/* ────────────────────────────────────────────────────────────────────────────
 * pdfjs loader (reuses the same singleton pattern as pdf-merge-utils)
 * ──────────────────────────────────────────────────────────────────────────── */

let _pdfjsReady: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfJs(): Promise<typeof import("pdfjs-dist")> {
  if (!_pdfjsReady) {
    _pdfjsReady = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return _pdfjsReady;
}

/* ────────────────────────────────────────────────────────────────────────────
 * OCR — tesseract.js loaded lazily from CDN
 * ──────────────────────────────────────────────────────────────────────────── */

interface TesseractResult { data: { text: string; confidence: number } };
interface TesseractStatic {
  recognize: (image: HTMLCanvasElement | string, langs: string, opts?: unknown) => Promise<TesseractResult>;
}

let _tesseractPromise: Promise<TesseractStatic> | null = null;

function loadTesseract(): Promise<TesseractStatic> {
  if (_tesseractPromise) return _tesseractPromise;
  _tesseractPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("toolnest-tesseract-script") as HTMLScriptElement | null;
    const onload = () => {
      const T = (window as unknown as { Tesseract?: TesseractStatic }).Tesseract;
      if (T) resolve(T);
      else reject(new Error("Tesseract failed to initialise"));
    };
    if (existing) { existing.addEventListener("load", onload); return; }
    const script = document.createElement("script");
    script.id = "toolnest-tesseract-script";
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    script.async = true;
    script.onload = onload;
    script.onerror = () => reject(new Error("Could not load OCR engine from CDN"));
    document.head.appendChild(script);
  });
  return _tesseractPromise;
}

/* ────────────────────────────────────────────────────────────────────────────
 * PDF → per-page content
 * ──────────────────────────────────────────────────────────────────────────── */

interface TextItemLite {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  fontName: string;
  hasEOL: boolean;
}

async function extractPageItems(
  pdfjsPage: import("pdfjs-dist").PDFPageProxy,
): Promise<{ items: TextItemLite[]; viewport: { width: number; height: number } }> {
  const content = await pdfjsPage.getTextContent();
  const viewport = pdfjsPage.getViewport({ scale: 1 });
  const items: TextItemLite[] = [];
  for (const raw of content.items) {
    if (!("str" in raw)) continue;
    const it = raw as { str: string; transform: number[]; width: number; height: number; fontName: string; hasEOL?: boolean };
    if (!it.str) continue;
    const fontSize = Math.hypot(it.transform[2], it.transform[3]) || it.height || 12;
    items.push({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width,
      h: it.height || fontSize,
      fontSize,
      fontName: it.fontName,
      hasEOL: !!it.hasEOL,
    });
  }
  return { items, viewport: { width: viewport.width, height: viewport.height } };
}

interface Line {
  items: TextItemLite[];
  y: number;
  x0: number;
  x1: number;
  fontSize: number;
  text: string;
}

/** Group text items into visual lines by Y position. */
function groupIntoLines(items: TextItemLite[], viewportHeight: number): Line[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => (viewportHeight - a.y) - (viewportHeight - b.y) || a.x - b.x);
  const lines: Line[] = [];
  const yTolerance = 3;
  let current: TextItemLite[] = [];
  let currentY = sorted[0].y;
  for (const it of sorted) {
    if (Math.abs(it.y - currentY) <= yTolerance || !current.length) {
      current.push(it);
      currentY = current.length ? (currentY + it.y) / 2 : it.y;
    } else {
      lines.push(buildLine(current));
      current = [it];
      currentY = it.y;
    }
  }
  if (current.length) lines.push(buildLine(current));
  return lines;
}

function buildLine(items: TextItemLite[]): Line {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const text = sorted.map((i) => i.str).join("").replace(/\s+/g, " ").trim();
  const fontSize = sorted.reduce((s, i) => Math.max(s, i.fontSize), 0) || 12;
  return {
    items: sorted,
    y: sorted[0].y,
    x0: sorted[0].x,
    x1: sorted[sorted.length - 1].x + sorted[sorted.length - 1].w,
    fontSize,
    text,
  };
}

/** Detect paragraph breaks by Y gap between consecutive lines. */
function linesToBlocks(lines: Line[], pageNumber: number): TextBlock[] {
  if (!lines.length) return [];
  const blocks: TextBlock[] = [];
  const medianFs = lines.reduce((s, l) => s + l.fontSize, 0) / lines.length;
  const gapThreshold = medianFs * 0.8;

  let buffer: Line[] = [];
  let lastY = lines[0].y;
  for (const line of lines) {
    if (buffer.length && Math.abs(lastY - line.y) > gapThreshold) {
      blocks.push(buildBlock(buffer, pageNumber, medianFs));
      buffer = [];
    }
    buffer.push(line);
    lastY = line.y;
  }
  if (buffer.length) blocks.push(buildBlock(buffer, pageNumber, medianFs));
  return blocks;
}

function buildBlock(lines: Line[], pageNumber: number, medianFs: number): TextBlock {
  const text = lines.map((l) => l.text).join("\n").replace(/\n+/g, "\n").trim();
  const fs = lines[0].fontSize;
  const bold = /bold|black|heavy/i.test(lines[0].items[0]?.fontName ?? "");
  const italic = /italic|oblique/i.test(lines[0].items[0]?.fontName ?? "");
  const isHeading = fs >= medianFs * 1.4 && text.length < 120;
  const listItem = /^\s*([•\-–—]|\d+[.)])\s+/.test(text);
  // Alignment heuristic from line extents
  const xs0 = Math.min(...lines.map((l) => l.x0));
  const xs1 = Math.max(...lines.map((l) => l.x1));
  const pageWidth = Math.max(...lines.map((l) => l.x1)) + 50;
  const leftAligned = lines.every((l) => Math.abs(l.x0 - xs0) < 10);
  const rightAligned = lines.every((l) => Math.abs(l.x1 - xs1) < 10);
  const centered = lines.every((l) => Math.abs((l.x0 + l.x1) / 2 - (xs0 + xs1) / 2) < 12) && !leftAligned;
  const alignment: TextBlock["alignment"] = centered
    ? "center"
    : rightAligned && !leftAligned
      ? "right"
      : "left";
  return { text, fontSize: fs, bold, italic, alignment, isHeading, listItem, page: pageNumber };
}

async function renderPageToCanvas(
  pdfjsPage: import("pdfjs-dist").PDFPageProxy,
  dpi: number,
): Promise<HTMLCanvasElement> {
  const scale = dpi / 72;
  const viewport = pdfjsPage.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await pdfjsPage.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

function canvasToDataUrl(canvas: HTMLCanvasElement, mime: string, quality: number): { dataUrl: string; bytes: Uint8Array } {
  const dataUrl = canvas.toDataURL(mime, quality);
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { dataUrl, bytes };
}

/** Detect scanned page: very little or no extractable text. */
function isPageScanned(blocks: TextBlock[], images: ExtractedImage[]): boolean {
  const totalChars = blocks.reduce((s, b) => s + b.text.length, 0);
  return totalChars < 20 && images.length > 0;
}

export interface ParseProgress {
  phase: "loading" | "parsing" | "rendering" | "ocr" | "building" | "done";
  page?: number;
  totalPages?: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Core: parse a PDF file into per-page content
 * ──────────────────────────────────────────────────────────────────────────── */

export async function parsePdfToContent(
  file: File,
  options: ConvertOptions,
  onProgress: (p: ParseProgress) => void,
): Promise<{ pages: PageContent[]; pageCount: number; thumbUrl: string }> {
  onProgress({ phase: "loading" });
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data: buf.slice(0), password: options.password || undefined });
  const doc = await task.promise;
  const pageCount = doc.numPages;

  const indices = parsePageRange(options.pageRanges, pageCount);
  const pages: PageContent[] = [];
  let thumbUrl = "";

  for (let i = 0; i < indices.length; i++) {
    const pageIndex = indices[i];
    const pageNum = pageIndex + 1;
    onProgress({ phase: "parsing", page: i + 1, totalPages: indices.length });
    const page = await doc.getPage(pageNum);
    const { items, viewport } = await extractPageItems(page);
    const lines = groupIntoLines(items, viewport.height);
    const blocks = linesToBlocks(lines, pageNum);

    // Render thumbnail + optional high-res image for scanned pages.
    onProgress({ phase: "rendering", page: i + 1, totalPages: indices.length });
    const thumbCanvas = await renderPageToCanvas(page, 72);
    if (i === 0) thumbUrl = thumbCanvas.toDataURL("image/jpeg", 0.6);

    const images: ExtractedImage[] = [];
    let isScanned = isPageScanned(blocks, images);
    let ocrConfidence: number | null = null;

    // Decide whether to OCR this page.
    const shouldOcr =
      options.ocrMode === "always" ||
      (options.ocrMode === "scanned-only" && isScanned) ||
      (options.ocrMode === "auto" && blocks.length === 0);

    if (shouldOcr) {
      onProgress({ phase: "ocr", page: i + 1, totalPages: indices.length });
      try {
        const ocrCanvas = await renderPageToCanvas(page, 200);
        const Tesseract = await loadTesseract();
        const result = await Tesseract.recognize(ocrCanvas, options.ocrLanguage);
        if (result.data.text && result.data.text.trim().length > 0) {
          const ocrBlocks: TextBlock[] = result.data.text
            .split(/\n\s*\n/)
            .map((para) => para.replace(/\n/g, "\n").trim())
            .filter((p) => p.length > 0)
            .map((text) => ({
              text,
              fontSize: 12,
              bold: false,
              italic: false,
              alignment: "left" as const,
              isHeading: false,
              listItem: /^\s*([•\-–—]|\d+[.)])\s+/.test(text),
              page: pageNum,
            }));
          if (ocrBlocks.length) {
            blocks.push(...ocrBlocks);
            ocrConfidence = Math.round(result.data.confidence);
            isScanned = true;
          }
        }
      } catch (e) {
        // OCR failure is non-fatal — page is still exported with whatever text pdfjs found.
        console.warn("OCR failed for page", pageNum, e);
      }
    }

    // For scanned pages with images enabled, embed the rendered page as an image
    // so the DOCX visually preserves the page.
    if (isScanned && options.extractImages && blocks.length > 0 && options.preserveLayout) {
      const imgCanvas = await renderPageToCanvas(page, options.imageDpi);
      const { dataUrl, bytes } = canvasToDataUrl(imgCanvas, "image/jpeg", 0.82);
      images.push({
        dataUrl,
        bytes,
        mime: "image/jpeg",
        width: imgCanvas.width,
        height: imgCanvas.height,
        name: `page-${pageNum}.jpg`,
        page: pageNum,
      });
    }

    pages.push({
      pageNumber: pageNum,
      blocks,
      images,
      thumbDataUrl: thumbCanvas.toDataURL("image/jpeg", 0.55),
      hasText: blocks.length > 0,
      isScanned,
      ocrConfidence,
    });

    page.cleanup();
  }

  doc.destroy();
  onProgress({ phase: "done" });
  return { pages, pageCount, thumbUrl: thumbUrl || (pages[0]?.thumbDataUrl ?? "") };
}

/* ────────────────────────────────────────────────────────────────────────────
 * DOCX builder — uses the `docx` library (browser-compatible)
 * ──────────────────────────────────────────────────────────────────────────── */

export async function buildDocx(pages: PageContent[], options: ConvertOptions): Promise<Blob> {
  const docx = await import("docx");
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak, ImageRun } = docx;

  const paragraphs: InstanceType<typeof Paragraph>[] = [];
  let imageCount = 0;
  let wordCount = 0;

  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    // Embed scanned-page image first (full-page visual).
    if (page.images.length && page.isScanned) {
      for (const img of page.images) {
        try {
          const dataBytes = await (await fetch(img.dataUrl)).arrayBuffer();
          paragraphs.push(
            new Paragraph({
              children: [
                new ImageRun({
                  type: "jpg",
                  data: new Uint8Array(dataBytes),
                  transformation: { width: 612, height: 792 },
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          );
          imageCount++;
        } catch { /* skip bad image */ }
      }
    }

    for (const block of page.blocks) {
      const runs = block.text.split("\n").map((line) =>
        new TextRun({
          text: line,
          bold: block.bold,
          italics: block.italic,
          size: Math.round(block.fontSize * 2), // half-points
        }),
      );
      wordCount += block.text.split(/\s+/).filter(Boolean).length;
      paragraphs.push(
        new Paragraph({
          children: runs,
          heading: block.isHeading ? HeadingLevel.HEADING_2 : undefined,
          alignment:
            block.alignment === "center" ? AlignmentType.CENTER
            : block.alignment === "right" ? AlignmentType.RIGHT
            : block.alignment === "justify" ? AlignmentType.JUSTIFIED
            : AlignmentType.LEFT,
          bullet: block.listItem ? { level: 0 } : undefined,
          spacing: { after: 120 },
        }),
      );
    }

    // Page break between pages
    if (p < pages.length - 1) {
      paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }

  const doc = new Document({
    creator: "ToolNest.io",
    title: "Converted by ToolNest PDF to Word",
    description: `Converted from PDF — ${pages.length} page(s), ${options.ocrMode} OCR mode`,
    sections: [{
      properties: {},
      children: paragraphs,
    }],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}

/* ────────────────────────────────────────────────────────────────────────────
 * DOC builder — Word-compatible HTML saved as .doc
 * ──────────────────────────────────────────────────────────────────────────── */

export async function buildDoc(pages: PageContent[], _options: ConvertOptions): Promise<Blob> {
  const body: string[] = [];
  let imageCount = 0;
  let wordCount = 0;

  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    if (p > 0) body.push('<br clear=all style="page-break-before:always">');

    if (page.images.length && page.isScanned) {
      for (const img of page.images) {
        body.push(`<div style="text-align:center"><img src="${img.dataUrl}" style="max-width:612pt"></div>`);
        imageCount++;
      }
    }

    for (const block of page.blocks) {
      const style = `font-size:${block.fontSize}px;${block.bold ? "font-weight:bold;" : ""}${block.italic ? "font-style:italic;" : ""}text-align:${block.alignment}`;
      const tag = block.isHeading ? "h2" : "p";
      const text = escapeHtml(block.text).replace(/\n/g, "<br>");
      body.push(`<${tag} style="${style}">${text}</${tag}>`);
      wordCount += block.text.split(/\s+/).filter(Boolean).length;
    }
  }

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Converted by ToolNest</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.4}h2{font-size:14pt;font-weight:bold}</style>
</head><body>${body.join("\n")}</body></html>`;

  void imageCount; void wordCount;
  return new Blob([html], { type: "application/msword" });
}

/* ────────────────────────────────────────────────────────────────────────────
 * RTF builder — plain-text Rich Text Format
 * ──────────────────────────────────────────────────────────────────────────── */

function rtfEscape(text: string): string {
  return text
    .replace(/[\\{}]/g, (c) => `\\${c}`)
    .replace(/[^\x00-\x7F]/g, (c) => `\\u${c.charCodeAt(0)}?`)
    .replace(/\n/g, "\\par\n");
}

export async function buildRtf(pages: PageContent[], _options: ConvertOptions): Promise<Blob> {
  const parts: string[] = [
    "{\\rtf1\\ansi\\deff0",
    "{\\fonttbl{\\f0 Calibri;}}",
    "{\\info{\\title Converted by ToolNest}{\\author ToolNest.io}}",
  ];

  for (let p = 0; p < pages.length; p++) {
    const page = pages[p];
    if (p > 0) parts.push("\\page");

    for (const block of page.blocks) {
      const prefix = block.isHeading ? "{\\pard\\f0\\fs28\\b " : "{\\pard\\f0\\fs22 ";
      const align = block.alignment === "center" ? "\\qc "
        : block.alignment === "right" ? "\\qr "
        : block.alignment === "justify" ? "\\qj "
        : "\\ql ";
      const bold = block.bold ? "\\b " : "";
      const italic = block.italic ? "\\i " : "";
      const fs = Math.round(block.fontSize * 2);
      const text = rtfEscape(block.text);
      parts.push(`${prefix}${align}${bold}${italic}\\fs${fs} ${text}\\par}`);
    }
  }

  parts.push("}");
  return new Blob([parts.join("\n")], { type: "application/rtf" });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Convert orchestrator
 * ──────────────────────────────────────────────────────────────────────────── */

export async function convertPdfToWord(
  file: File,
  options: ConvertOptions,
  onProgress: (p: ParseProgress) => void,
): Promise<ConvertResult> {
  const start = performance.now();
  const { pages, pageCount } = await parsePdfToContent(file, options, onProgress);

  onProgress({ phase: "building" });
  let blob: Blob;
  switch (options.outputFormat) {
    case "docx": blob = await buildDocx(pages, options); break;
    case "doc": blob = await buildDoc(pages, options); break;
    case "rtf": blob = await buildRtf(pages, options); break;
  }

  const wordCount = pages.reduce((s, p) => s + p.blocks.reduce((ss, b) => ss + b.text.split(/\s+/).filter(Boolean).length, 0), 0);
  const imageCount = pages.reduce((s, p) => s + p.images.length, 0);
  const ocrPages = pages.filter((p) => p.isScanned && p.ocrConfidence !== null).length;
  const previewUrl = URL.createObjectURL(blob);

  return {
    blob,
    bytes: blob.size,
    format: options.outputFormat,
    pageCount,
    wordCount,
    imageCount,
    ocrPages,
    durationMs: Math.round(performance.now() - start),
    previewUrl,
  };
}

export async function convertBatch(
  items: ConvertItem[],
  options: ConvertOptions,
  onProgress: (item: ConvertItem, phase: ParseProgress) => void,
): Promise<ConvertItem[]> {
  const out: ConvertItem[] = [];
  for (const item of items) {
    item.status = "converting";
    try {
      const result = await convertPdfToWord(item.file, options, (p) => onProgress(item, p));
      item.result = result;
      item.status = "done";
    } catch (e) {
      item.status = "error";
      item.error = e instanceof Error ? e.message : "conversion failed";
    }
    out.push(item);
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────────── */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildOutputName(originalName: string, format: OutputFormat): string {
  const stem = originalName.replace(/\.pdf$/i, "") || "document";
  return `${stem}.${format}`;
}

/** Try to detect if a PDF is encrypted without fully parsing it. */
export async function probePdfEncryption(file: File): Promise<boolean> {
  try {
    const pdfjs = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const task = pdfjs.getDocument({ data: buf.slice(0) });
    try {
      await task.promise;
      return false;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return /password/i.test(msg);
    }
  } catch {
    return false;
  }
}
