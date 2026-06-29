/**
 * Ultra PDF Page Numbers Studio — stamp numbering with templates, scope, batch.
 * Client-side via pdf-lib. Reuses helpers from pdf-merge-utils / pdf-watermark-utils.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  parsePageRange,
  parsePdf,
  renderThumb,
  sanitizeFilename,
} from "./pdf-merge-utils";
import { pageMatchesScope, type PageScope, PDF_FONT_OPTIONS, type PdfFontId } from "./pdf-watermark-utils";

export { parsePdf, renderThumb, sanitizeFilename, parsePageRange, PDF_FONT_OPTIONS };
export type { PdfFontId, PageScope };

export type PageNumberFormat =
  | "1"
  | "1/10"
  | "Page 1"
  | "Page 1 of 10"
  | "i"
  | "I"
  | "a"
  | "A";

export type PageNumberPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface PageNumberSettings {
  format: PageNumberFormat;
  position: PageNumberPosition;
  fontId: PdfFontId;
  fontSize: number;
  color: string;
  opacity: number;
  margin: number;
  startNumber: number;
  skipFirstPage: boolean;
  scope: PageScope;
  pageRange: string;
}

export interface PageNumberOutputOptions {
  fileName: string;
  compress: boolean;
  preserveMetadata: boolean;
}

export const DEFAULT_PAGE_NUMBER_SETTINGS: PageNumberSettings = {
  format: "1/10",
  position: "bottom-center",
  fontId: "Helvetica",
  fontSize: 10,
  color: "#333333",
  opacity: 0.85,
  margin: 36,
  startNumber: 1,
  skipFirstPage: false,
  scope: "all",
  pageRange: "",
};

export const DEFAULT_PAGE_NUMBER_OUTPUT: PageNumberOutputOptions = {
  fileName: "numbered",
  compress: true,
  preserveMetadata: true,
};

export const PAGE_NUMBER_FORMATS: { id: PageNumberFormat; label: string; example: string }[] = [
  { id: "1", label: "1", example: "1, 2, 3" },
  { id: "1/10", label: "1 / 10", example: "1/10, 2/10" },
  { id: "Page 1", label: "Page 1", example: "Page 1, Page 2" },
  { id: "Page 1 of 10", label: "Page 1 of 10", example: "Page 1 of 10" },
  { id: "i", label: "i, ii, iii", example: "roman lowercase" },
  { id: "I", label: "I, II, III", example: "roman uppercase" },
  { id: "a", label: "a, b, c", example: "alpha lowercase" },
  { id: "A", label: "A, B, C", example: "alpha uppercase" },
];

export const PAGE_NUMBER_POSITIONS: { id: PageNumberPosition; label: string }[] = [
  { id: "top-left", label: "Top left" },
  { id: "top-center", label: "Top center" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-center", label: "Bottom center" },
  { id: "bottom-right", label: "Bottom right" },
];

const FONT_MAP: Record<PdfFontId, StandardFonts> = {
  Helvetica: StandardFonts.Helvetica,
  HelveticaBold: StandardFonts.HelveticaBold,
  HelveticaOblique: StandardFonts.HelveticaOblique,
  HelveticaBoldOblique: StandardFonts.HelveticaBoldOblique,
  TimesRoman: StandardFonts.TimesRoman,
  TimesBold: StandardFonts.TimesRomanBold,
  TimesItalic: StandardFonts.TimesRomanItalic,
  TimesBoldItalic: StandardFonts.TimesRomanBoldItalic,
  Courier: StandardFonts.Courier,
  CourierBold: StandardFonts.CourierBold,
  CourierOblique: StandardFonts.CourierOblique,
  CourierBoldOblique: StandardFonts.CourierBoldOblique,
  Symbol: StandardFonts.Symbol,
  ZapfDingbats: StandardFonts.ZapfDingbats,
};

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.2, 0.2, 0.2];
  const n = parseInt(m[1], 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function toRoman(n: number, upper: boolean): string {
  if (n <= 0 || n > 3999) return String(n);
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const symsU = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
  const symsL = symsU.map((s) => s.toLowerCase());
  const syms = upper ? symsU : symsL;
  let out = "";
  let rem = n;
  for (let i = 0; i < vals.length; i++) {
    while (rem >= vals[i]!) {
      out += syms[i];
      rem -= vals[i]!;
    }
  }
  return out;
}

function toAlpha(n: number, upper: boolean): string {
  if (n <= 0) return String(n);
  let out = "";
  let rem = n;
  while (rem > 0) {
    rem -= 1;
    out = String.fromCharCode((upper ? 65 : 97) + (rem % 26)) + out;
    rem = Math.floor(rem / 26);
  }
  return out;
}

export function formatPageLabel(
  format: PageNumberFormat,
  displayNum: number,
  total: number,
): string {
  const n = format === "i" || format === "I" ? toRoman(displayNum, format === "I")
    : format === "a" || format === "A" ? toAlpha(displayNum, format === "A")
    : String(displayNum);

  switch (format) {
    case "1":
      return n;
    case "1/10":
      return `${n}/${total}`;
    case "Page 1":
      return `Page ${n}`;
    case "Page 1 of 10":
      return `Page ${n} of ${total}`;
    default:
      return n;
  }
}

function textPosition(
  page: PDFPage,
  font: PDFFont,
  text: string,
  size: number,
  position: PageNumberPosition,
  margin: number,
): { x: number; y: number } {
  const w = page.getWidth();
  const h = page.getHeight();
  const tw = font.widthOfTextAtSize(text, size);
  switch (position) {
    case "top-left":
      return { x: margin, y: h - margin - size };
    case "top-center":
      return { x: (w - tw) / 2, y: h - margin - size };
    case "top-right":
      return { x: w - margin - tw, y: h - margin - size };
    case "bottom-left":
      return { x: margin, y: margin };
    case "bottom-center":
      return { x: (w - tw) / 2, y: margin };
    case "bottom-right":
      return { x: w - margin - tw, y: margin };
  }
}

export function smartPageNumberTips(pageCount: number, settings: PageNumberSettings): string[] {
  const tips: string[] = [];
  if (settings.skipFirstPage && pageCount <= 1) tips.push("Skip first page has no effect on single-page PDFs.");
  if (settings.fontSize > 24) tips.push("Large font sizes may overlap content — try 9–12 pt for footers.");
  if (settings.opacity < 0.4) tips.push("Low opacity may make numbers hard to read on light backgrounds.");
  if (pageCount > 200) tips.push(`${pageCount} pages — processing may take a moment.`);
  if (settings.scope === "range" && !settings.pageRange.trim()) tips.push("Enter a page range or switch scope to All pages.");
  return tips;
}

export async function buildNumberedPdf(
  sourceBytes: ArrayBuffer,
  settings: PageNumberSettings,
  options: PageNumberOutputOptions,
  onProgress?: (pct: number) => void,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const pageCount = pdf.getPageCount();

  if (options.preserveMetadata) {
    try {
      const src = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
      if (src.getTitle()) pdf.setTitle(src.getTitle()!);
      if (src.getAuthor()) pdf.setAuthor(src.getAuthor()!);
      if (src.getSubject()) pdf.setSubject(src.getSubject()!);
    } catch {
      /* ignore */
    }
  }

  pdf.setProducer("ToolNest.io PDF Page Numbers Ultra");
  pdf.setCreator("ToolNest.io");

  const font = await pdf.embedFont(FONT_MAP[settings.fontId] ?? StandardFonts.Helvetica);
  const [r, g, b] = hexToRgb(settings.color);
  const color = rgb(r, g, b);

  let displayCounter = settings.startNumber;
  const pages = pdf.getPages();

  for (let i = 0; i < pages.length; i++) {
    if (settings.skipFirstPage && i === 0) continue;
    if (!pageMatchesScope(i, pageCount, settings.scope, settings.pageRange)) continue;

    const page = pages[i]!;
    const label = formatPageLabel(settings.format, displayCounter, pageCount);
    const size = settings.fontSize;
    const pos = textPosition(page, font, label, size, settings.position, settings.margin);

    page.drawText(label, {
      x: pos.x,
      y: pos.y,
      size,
      font,
      color,
      opacity: settings.opacity,
    });

    displayCounter += 1;
    onProgress?.(Math.round(((i + 1) / pageCount) * 100));
  }

  onProgress?.(100);
  return pdf.save({ useObjectStreams: options.compress });
}

export interface NumberedFile {
  name: string;
  data: Uint8Array;
}

export async function executeBatchPageNumbers(
  sources: { name: string; bytes: ArrayBuffer }[],
  settings: PageNumberSettings,
  options: PageNumberOutputOptions,
  onProgress?: (pct: number) => void,
): Promise<NumberedFile[]> {
  const results: NumberedFile[] = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]!;
    const stem = src.name.replace(/\.pdf$/i, "") || "numbered";
    const data = await buildNumberedPdf(src.bytes, settings, { ...options, fileName: stem });
    results.push({ name: sanitizeFilename(`${stem}-numbered`), data });
    onProgress?.(Math.round(((i + 1) / sources.length) * 100));
  }
  return results;
}

export async function zipNumberedFiles(files: NumberedFile[]): Promise<Blob> {
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

export interface ApiPageNumbersRequest {
  settings?: Partial<PageNumberSettings>;
  options?: Partial<PageNumberOutputOptions>;
}

export async function pageNumbersPdfFromBytes(
  pdfBytes: Uint8Array,
  request: ApiPageNumbersRequest,
): Promise<Uint8Array> {
  const ab = pdfBytes.slice().buffer;
  const settings: PageNumberSettings = { ...DEFAULT_PAGE_NUMBER_SETTINGS, ...(request.settings ?? {}) };
  const options: PageNumberOutputOptions = {
    ...DEFAULT_PAGE_NUMBER_OUTPUT,
    ...(request.options ?? {}),
  };
  return buildNumberedPdf(ab, settings, options);
}
