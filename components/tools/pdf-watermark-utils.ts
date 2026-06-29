/**
 * Ultra PDF Watermark Studio — text, image, QR, tiling, headers/footers, batch.
 * Client-side via pdf-lib + pdf.js. Reuses helpers from pdf-merge-utils.
 */

import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import {
  parsePageRange,
  parsePdf,
  renderThumb,
  sanitizeFilename,
} from "./pdf-merge-utils";

export { parsePdf, renderThumb, sanitizeFilename, parsePageRange };

export type WatermarkType = "text" | "image" | "qr";
export type WatermarkLayer = "background" | "foreground";
export type WatermarkPosition =
  | "center"
  | "diagonal"
  | "tile"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "custom";
export type PageScope = "all" | "range" | "odd" | "even" | "first" | "last" | "first-last";

export type PdfFontId =
  | "Helvetica"
  | "HelveticaBold"
  | "HelveticaOblique"
  | "HelveticaBoldOblique"
  | "TimesRoman"
  | "TimesBold"
  | "TimesItalic"
  | "TimesBoldItalic"
  | "Courier"
  | "CourierBold"
  | "CourierOblique"
  | "CourierBoldOblique"
  | "Symbol"
  | "ZapfDingbats";

export interface PdfFontOption {
  id: PdfFontId;
  label: string;
  group: "Helvetica" | "Times" | "Courier" | "Special";
}

export const PDF_FONT_OPTIONS: PdfFontOption[] = [
  { id: "Helvetica", label: "Helvetica Regular", group: "Helvetica" },
  { id: "HelveticaBold", label: "Helvetica Bold", group: "Helvetica" },
  { id: "HelveticaOblique", label: "Helvetica Italic", group: "Helvetica" },
  { id: "HelveticaBoldOblique", label: "Helvetica Bold Italic", group: "Helvetica" },
  { id: "TimesRoman", label: "Times New Roman Regular", group: "Times" },
  { id: "TimesBold", label: "Times New Roman Bold", group: "Times" },
  { id: "TimesItalic", label: "Times New Roman Italic", group: "Times" },
  { id: "TimesBoldItalic", label: "Times New Roman Bold Italic", group: "Times" },
  { id: "Courier", label: "Courier Regular", group: "Courier" },
  { id: "CourierBold", label: "Courier Bold", group: "Courier" },
  { id: "CourierOblique", label: "Courier Italic", group: "Courier" },
  { id: "CourierBoldOblique", label: "Courier Bold Italic", group: "Courier" },
  { id: "Symbol", label: "Symbol (Greek & math)", group: "Special" },
  { id: "ZapfDingbats", label: "Zapf Dingbats (icons)", group: "Special" },
];

export interface WatermarkSettings {
  type: WatermarkType;
  layer: WatermarkLayer;
  position: WatermarkPosition;
  scope: PageScope;
  pageRange: string;
  /** Text watermark */
  text: string;
  fontId: PdfFontId;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  scale: number;
  tileSpacingX: number;
  tileSpacingY: number;
  /** Custom position 0..1 from bottom-left */
  customX: number;
  customY: number;
  /** Image/logo watermark bytes */
  imageBytes: ArrayBuffer | null;
  imageMime: "png" | "jpg";
  imageScale: number;
  /** QR watermark payload */
  qrContent: string;
  qrSize: number;
  /** Header / footer / extras */
  headerText: string;
  footerText: string;
  includeTimestamp: boolean;
  includePageNumbers: boolean;
  timestampFormat: "date" | "datetime" | "iso";
}

export interface WatermarkOutputOptions {
  fileName: string;
  title: string;
  author: string;
  preserveMetadata: boolean;
  compress: boolean;
  password: string;
  pdfA: boolean;
}

export const DEFAULT_WATERMARK: WatermarkSettings = {
  type: "text",
  layer: "foreground",
  position: "diagonal",
  scope: "all",
  pageRange: "",
  text: "CONFIDENTIAL",
  fontId: "HelveticaBold",
  fontSize: 48,
  color: "#c0392b",
  opacity: 0.25,
  rotation: -35,
  scale: 1,
  tileSpacingX: 200,
  tileSpacingY: 180,
  customX: 0.5,
  customY: 0.5,
  imageBytes: null,
  imageMime: "png",
  imageScale: 0.25,
  qrContent: "https://toolnest.io",
  qrSize: 72,
  headerText: "",
  footerText: "",
  includeTimestamp: false,
  includePageNumbers: false,
  timestampFormat: "datetime",
};

export const DEFAULT_WATERMARK_OUTPUT: WatermarkOutputOptions = {
  fileName: "watermarked",
  title: "",
  author: "ToolNest.io",
  preserveMetadata: true,
  compress: true,
  password: "",
  pdfA: false,
};

export interface WatermarkTemplate {
  id: string;
  label: string;
  hint: string;
  category: "legal" | "status" | "business" | "utility";
  settings: Partial<WatermarkSettings>;
}

export const WATERMARK_TEMPLATE_CATEGORIES: { id: WatermarkTemplate["category"]; label: string }[] = [
  { id: "legal", label: "Legal & security" },
  { id: "status", label: "Document status" },
  { id: "business", label: "Business & finance" },
  { id: "utility", label: "Utility & stamps" },
];

export const WATERMARK_TEMPLATES: WatermarkTemplate[] = [
  // Legal & security
  { id: "confidential", label: "CONFIDENTIAL", hint: "Red diagonal", category: "legal", settings: { text: "CONFIDENTIAL", color: "#c0392b", opacity: 0.28, rotation: -35, position: "diagonal", fontId: "HelveticaBold", fontSize: 52 } },
  { id: "top-secret", label: "TOP SECRET", hint: "Dark red diagonal", category: "legal", settings: { text: "TOP SECRET", color: "#922b21", opacity: 0.32, rotation: -38, position: "diagonal", fontId: "HelveticaBold", fontSize: 48 } },
  { id: "internal", label: "INTERNAL USE ONLY", hint: "Orange diagonal", category: "legal", settings: { text: "INTERNAL USE ONLY", color: "#d35400", opacity: 0.26, rotation: -35, position: "diagonal", fontId: "HelveticaBold", fontSize: 38 } },
  { id: "restricted", label: "RESTRICTED", hint: "Maroon center", category: "legal", settings: { text: "RESTRICTED", color: "#7b241c", opacity: 0.3, rotation: -30, position: "center", fontId: "HelveticaBold", fontSize: 56 } },
  { id: "private", label: "PRIVATE", hint: "Purple diagonal", category: "legal", settings: { text: "PRIVATE", color: "#6c3483", opacity: 0.25, rotation: -35, position: "diagonal", fontId: "HelveticaBold", fontSize: 54 } },
  { id: "do-not-copy", label: "DO NOT COPY", hint: "Strong red", category: "legal", settings: { text: "DO NOT COPY", color: "#e74c3c", opacity: 0.35, rotation: -40, position: "diagonal", fontId: "HelveticaBold", fontSize: 44 } },
  { id: "not-for-distribution", label: "NOT FOR DISTRIBUTION", hint: "Red tile", category: "legal", settings: { text: "NOT FOR DISTRIBUTION", color: "#c0392b", opacity: 0.14, position: "tile", fontSize: 22, tileSpacingX: 220, tileSpacingY: 160, fontId: "HelveticaBold" } },
  { id: "attorney-client", label: "ATTORNEY-CLIENT PRIVILEGED", hint: "Legal footer style", category: "legal", settings: { text: "ATTORNEY-CLIENT PRIVILEGED", color: "#2c3e50", opacity: 0.35, rotation: 0, position: "bottom-left", fontId: "TimesBold", fontSize: 12, footerText: "Privileged & Confidential" } },
  // Document status
  { id: "draft", label: "DRAFT", hint: "Gray diagonal", category: "status", settings: { text: "DRAFT", color: "#7f8c8d", opacity: 0.22, rotation: -35, position: "diagonal", fontId: "HelveticaBold", fontSize: 56 } },
  { id: "copy", label: "COPY", hint: "Blue center", category: "status", settings: { text: "COPY", color: "#2980b9", opacity: 0.3, rotation: 0, position: "center", fontId: "HelveticaBold", fontSize: 64 } },
  { id: "sample", label: "SAMPLE", hint: "Green tile", category: "status", settings: { text: "SAMPLE", color: "#27ae60", opacity: 0.15, position: "tile", fontId: "HelveticaBold", fontSize: 28, tileSpacingX: 180, tileSpacingY: 140 } },
  { id: "approved", label: "APPROVED", hint: "Green diagonal", category: "status", settings: { text: "APPROVED", color: "#16a085", opacity: 0.3, rotation: -30, position: "diagonal", fontId: "HelveticaBold", fontSize: 50 } },
  { id: "rejected", label: "REJECTED", hint: "Red center", category: "status", settings: { text: "REJECTED", color: "#e74c3c", opacity: 0.35, rotation: -20, position: "center", fontId: "HelveticaBold", fontSize: 58 } },
  { id: "void", label: "VOID", hint: "Large center", category: "status", settings: { text: "VOID", color: "#000000", opacity: 0.2, rotation: -25, position: "center", fontId: "HelveticaBold", fontSize: 80 } },
  { id: "pending", label: "PENDING REVIEW", hint: "Amber diagonal", category: "status", settings: { text: "PENDING REVIEW", color: "#f39c12", opacity: 0.28, rotation: -35, position: "diagonal", fontId: "HelveticaOblique", fontSize: 42 } },
  { id: "final", label: "FINAL", hint: "Dark green center", category: "status", settings: { text: "FINAL", color: "#1e8449", opacity: 0.32, rotation: 0, position: "center", fontId: "TimesBold", fontSize: 72 } },
  { id: "revised", label: "REVISED", hint: "Blue diagonal", category: "status", settings: { text: "REVISED", color: "#2471a3", opacity: 0.26, rotation: -35, position: "diagonal", fontId: "HelveticaBold", fontSize: 52 } },
  // Business & finance
  { id: "original", label: "ORIGINAL", hint: "Black corner", category: "business", settings: { text: "ORIGINAL", color: "#1c2833", opacity: 0.35, rotation: 0, position: "top-right", fontId: "TimesBold", fontSize: 24 } },
  { id: "duplicate", label: "DUPLICATE", hint: "Gray corner", category: "business", settings: { text: "DUPLICATE", color: "#566573", opacity: 0.3, rotation: 0, position: "top-right", fontId: "Helvetica", fontSize: 22 } },
  { id: "paid", label: "PAID", hint: "Green stamp", category: "business", settings: { text: "PAID", color: "#27ae60", opacity: 0.4, rotation: -12, position: "center", fontId: "HelveticaBoldOblique", fontSize: 68 } },
  { id: "unpaid", label: "UNPAID", hint: "Red stamp", category: "business", settings: { text: "UNPAID", color: "#c0392b", opacity: 0.38, rotation: -12, position: "center", fontId: "HelveticaBoldOblique", fontSize: 64 } },
  { id: "invoice-copy", label: "INVOICE COPY", hint: "Footer + diagonal", category: "business", settings: { text: "INVOICE COPY", color: "#2c3e50", opacity: 0.25, rotation: -35, position: "diagonal", fontId: "CourierBold", fontSize: 40, footerText: "Invoice Copy — Not Original" } },
  { id: "received", label: "RECEIVED", hint: "Blue bottom-left", category: "business", settings: { text: "RECEIVED", color: "#2980b9", opacity: 0.35, rotation: 0, position: "bottom-left", fontId: "HelveticaBold", fontSize: 28 } },
  { id: "copyright", label: "© ALL RIGHTS RESERVED", hint: "Footer copyright", category: "business", settings: { text: "© ALL RIGHTS RESERVED", color: "#34495e", opacity: 0.4, rotation: 0, position: "bottom-right", fontId: "TimesItalic", fontSize: 11, includeTimestamp: true } },
  { id: "company-draft", label: "COMPANY DRAFT", hint: "Tile + header", category: "business", settings: { text: "COMPANY DRAFT", color: "#95a5a6", opacity: 0.12, position: "tile", fontSize: 26, headerText: "Draft — Subject to Change", fontId: "Helvetica" } },
  // Utility & stamps
  { id: "timestamp", label: "Timestamp stamp", hint: "Date + footer", category: "utility", settings: { text: "", includeTimestamp: true, footerText: "ToolNest Watermark", opacity: 0.4, position: "bottom-right", fontSize: 14, scope: "all", fontId: "Courier" } },
  { id: "urgent", label: "URGENT", hint: "Red top-left", category: "utility", settings: { text: "URGENT", color: "#e74c3c", opacity: 0.45, rotation: 0, position: "top-left", fontId: "HelveticaBold", fontSize: 32 } },
  { id: "page-numbers", label: "Page numbers only", hint: "Footer numbering", category: "utility", settings: { text: "", includePageNumbers: true, footerText: "", opacity: 0.5, fontSize: 10, fontId: "Helvetica" } },
  { id: "scan-line", label: "SCAN COPY", hint: "Monospace tile", category: "utility", settings: { text: "SCAN COPY", color: "#5d6d7e", opacity: 0.18, position: "tile", fontSize: 20, fontId: "CourierBold", tileSpacingX: 200, tileSpacingY: 150 } },
  { id: "watermarked", label: "WATERMARKED", hint: "Light diagonal", category: "utility", settings: { text: "WATERMARKED", color: "#85929e", opacity: 0.18, rotation: -35, position: "diagonal", fontId: "HelveticaOblique", fontSize: 46 } },
  { id: "toolnest", label: "ToolNest branded", hint: "Brand footer", category: "utility", settings: { text: "ToolNest.io", color: "#6366f1", opacity: 0.22, rotation: -35, position: "diagonal", fontId: "HelveticaBold", fontSize: 44, footerText: "Processed with ToolNest" } },
];

export interface WatermarkRecommendation {
  title: string;
  detail: string;
  action?: keyof WatermarkSettings | "template-confidential" | "template-draft";
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.75, 0.75, 0.75];
  const n = parseInt(m[1], 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

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

export function detectDigitalSignature(bytes: ArrayBuffer): boolean {
  const sample = new Uint8Array(bytes.slice(0, Math.min(bytes.byteLength, 600_000)));
  const text = new TextDecoder("latin1").decode(sample);
  return /\/Type\s*\/Sig\b/.test(text) || /\/SubFilter\s*\/adbe\.pkcs7/.test(text);
}

export function pageMatchesScope(
  pageIndex: number,
  pageCount: number,
  scope: PageScope,
  range: string,
): boolean {
  if (scope === "all") return true;
  if (scope === "odd") return pageIndex % 2 === 0;
  if (scope === "even") return pageIndex % 2 === 1;
  if (scope === "first") return pageIndex === 0;
  if (scope === "last") return pageIndex === pageCount - 1;
  if (scope === "first-last") return pageIndex === 0 || pageIndex === pageCount - 1;
  if (scope === "range") {
    const indices = parsePageRange(range, pageCount);
    return indices.length ? indices.includes(pageIndex) : true;
  }
  return true;
}

export function formatTimestamp(fmt: WatermarkSettings["timestampFormat"]): string {
  const d = new Date();
  if (fmt === "date") return d.toLocaleDateString();
  if (fmt === "iso") return d.toISOString();
  return d.toLocaleString();
}

/** Normalized anchor on page (0..1, PDF bottom-left origin). */
export function anchorForPosition(pos: WatermarkPosition): { x: number; y: number } {
  const m = 0.14;
  switch (pos) {
    case "top-left":
      return { x: m, y: 1 - m };
    case "top-right":
      return { x: 1 - m, y: 1 - m };
    case "bottom-left":
      return { x: m, y: m };
    case "bottom-right":
      return { x: 1 - m, y: m };
    case "center":
    case "diagonal":
    case "custom":
    case "tile":
    default:
      return { x: 0.5, y: 0.5 };
  }
}

export function resolveWatermarkAnchor(settings: WatermarkSettings): { x: number; y: number } {
  if (settings.position === "custom") {
    return { x: settings.customX, y: settings.customY };
  }
  if (settings.position === "tile") {
    return { x: 0.5, y: 0.5 };
  }
  return anchorForPosition(settings.position);
}

export function watermarkSizeValue(settings: WatermarkSettings): number {
  if (settings.type === "text") return settings.fontSize * settings.scale;
  if (settings.type === "image") return settings.imageScale * settings.scale;
  return settings.qrSize * settings.scale;
}

export function patchWatermarkSize(settings: WatermarkSettings, value: number): Partial<WatermarkSettings> {
  if (settings.type === "text") {
    const fontSize = Math.round(value / settings.scale);
    return { fontSize: Math.min(160, Math.max(8, fontSize)) };
  }
  if (settings.type === "image") {
    const imageScale = value / settings.scale;
    return { imageScale: Math.min(1.2, Math.max(0.03, imageScale)) };
  }
  const qrSize = Math.round(value / settings.scale);
  return { qrSize: Math.min(320, Math.max(24, qrSize)) };
}

export function nudgeWatermarkSize(settings: WatermarkSettings, factor: number): Partial<WatermarkSettings> {
  return patchWatermarkSize(settings, watermarkSizeValue(settings) * factor);
}

export function smartWatermarkTips(
  pageCount: number,
  hasSignature: boolean,
  settings: WatermarkSettings,
  fileSize: number,
): string[] {
  const tips: string[] = [];
  if (hasSignature) tips.push("Digital signature detected — watermarking may invalidate the signature.");
  if (settings.opacity > 0.5) tips.push("High opacity may obscure document content — try 0.15–0.35 for diagonal watermarks.");
  if (settings.position === "tile" && settings.opacity > 0.25) tips.push("Tiled watermarks work best at lower opacity (≤ 0.2).");
  if (pageCount > 100) tips.push(`${pageCount} pages — batch processing may take a moment.`);
  if (fileSize > 40 * 1024 * 1024) tips.push("Large PDF — enable Compress in output settings.");
  if (settings.type === "text" && !settings.text.trim() && !settings.includeTimestamp) {
    tips.push("Enter watermark text or enable timestamp.");
  }
  return tips;
}

export function aiWatermarkRecommendations(
  pageCount: number,
  settings: WatermarkSettings,
  hasSignature: boolean,
): WatermarkRecommendation[] {
  const recs: WatermarkRecommendation[] = [];
  if (hasSignature) {
    recs.push({ title: "Signed document", detail: "Preview before sharing — watermark overlays may break signature validity." });
  }
  if (settings.type === "text" && settings.text.toUpperCase().includes("CONFIDENTIAL") && settings.position !== "diagonal") {
    recs.push({ title: "Use diagonal placement", detail: "Confidential marks are harder to remove when placed diagonally at ~35°.", action: "rotation" });
  }
  if (settings.opacity > 0.45) {
    recs.push({ title: "Reduce opacity", detail: "0.20–0.30 keeps text readable while marking every page.", action: "opacity" });
  }
  if (pageCount > 1 && settings.scope === "all" && settings.includePageNumbers) {
    recs.push({ title: "Page numbers enabled", detail: "Footer page numbers help track multi-page watermarked copies." });
  }
  if (!settings.text.trim() && settings.type === "text") {
    recs.push({ title: "Apply CONFIDENTIAL template", detail: "One-click enterprise preset for legal documents.", action: "template-confidential" });
  }
  return recs.slice(0, 4);
}

async function embedFont(pdf: PDFDocument, fontId: PdfFontId): Promise<PDFFont> {
  return pdf.embedFont(FONT_MAP[fontId] ?? StandardFonts.Helvetica);
}

async function qrToPngBytes(content: string, size: number): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(content || " ", { width: size, margin: 1, errorCorrectionLevel: "M" });
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function drawTextMark(
  page: PDFPage,
  font: PDFFont,
  text: string,
  settings: WatermarkSettings,
  pageW: number,
  pageH: number,
  x: number,
  y: number,
) {
  const [r, g, b] = hexToRgb(settings.color);
  const size = settings.fontSize * settings.scale;
  const tw = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: x - tw / 2,
    y: y - size / 2,
    size,
    font,
    color: rgb(r, g, b),
    opacity: settings.layer === "background" ? settings.opacity * 0.7 : settings.opacity,
    rotate: degrees(settings.rotation),
  });
}

async function applyTextWatermark(
  page: PDFPage,
  pdf: PDFDocument,
  settings: WatermarkSettings,
) {
  const font = await embedFont(pdf, settings.fontId);
  const pageW = page.getWidth();
  const pageH = page.getHeight();
  let text = settings.text.trim();
  if (settings.includeTimestamp) {
    const ts = formatTimestamp(settings.timestampFormat);
    text = text ? `${text} · ${ts}` : ts;
  }
  if (!text) return;

  const pos = settings.position;
  const rot = settings.position === "diagonal" ? (settings.rotation === -35 ? -35 : settings.rotation) : settings.rotation;

  if (pos === "tile") {
    const size = settings.fontSize * settings.scale;
    for (let y = size; y < pageH; y += settings.tileSpacingY) {
      for (let x = size; x < pageW; x += settings.tileSpacingX) {
        drawTextMark(page, font, text, { ...settings, rotation: rot }, pageW, pageH, x, y);
      }
    }
    return;
  }

  const anchor = resolveWatermarkAnchor(settings);
  const positions = [{ x: anchor.x * pageW, y: anchor.y * pageH }];

  for (const p of positions) {
    drawTextMark(page, font, text, { ...settings, rotation: rot }, pageW, pageH, p.x, p.y);
  }
}

async function applyImageWatermark(
  page: PDFPage,
  pdf: PDFDocument,
  settings: WatermarkSettings,
) {
  if (!settings.imageBytes?.byteLength) return;
  const img =
    settings.imageMime === "png"
      ? await pdf.embedPng(settings.imageBytes)
      : await pdf.embedJpg(settings.imageBytes);

  const pageW = page.getWidth();
  const pageH = page.getHeight();
  const scale = settings.imageScale * settings.scale;
  const w = img.width * scale;
  const h = img.height * scale;

  const drawOne = (x: number, y: number) => {
    page.drawImage(img, {
      x: x - w / 2,
      y: y - h / 2,
      width: w,
      height: h,
      opacity: settings.opacity,
      rotate: degrees(settings.rotation),
    });
  };

  if (settings.position === "tile") {
    for (let y = h / 2; y < pageH; y += settings.tileSpacingY) {
      for (let x = w / 2; x < pageW; x += settings.tileSpacingX) drawOne(x, y);
    }
  } else {
    const anchor = resolveWatermarkAnchor(settings);
    drawOne(anchor.x * pageW, anchor.y * pageH);
  }
}

async function applyQrWatermark(
  page: PDFPage,
  pdf: PDFDocument,
  settings: WatermarkSettings,
) {
  const png = await qrToPngBytes(settings.qrContent, settings.qrSize);
  const img = await pdf.embedPng(png);
  const pageW = page.getWidth();
  const pageH = page.getHeight();
  const s = settings.qrSize * settings.scale;
  if (settings.position === "tile") {
    for (let y = s / 2; y < pageH; y += settings.tileSpacingY) {
      for (let x = s / 2; x < pageW; x += settings.tileSpacingX) {
        page.drawImage(img, { x: x - s / 2, y: y - s / 2, width: s, height: s, opacity: settings.opacity });
      }
    }
    return;
  }
  const anchor = resolveWatermarkAnchor(settings);
  page.drawImage(img, {
    x: anchor.x * pageW - s / 2,
    y: anchor.y * pageH - s / 2,
    width: s,
    height: s,
    opacity: settings.opacity,
    rotate: degrees(settings.rotation),
  });
}

async function applyHeaderFooter(
  page: PDFPage,
  pdf: PDFDocument,
  settings: WatermarkSettings,
  pageIndex: number,
  pageCount: number,
) {
  const font = await embedFont(pdf, "Helvetica");
  const pageW = page.getWidth();
  const pageH = page.getHeight();
  const [r, g, b] = hexToRgb(settings.color);
  const color = rgb(r * 0.6, g * 0.6, b * 0.6);

  if (settings.headerText.trim()) {
    page.drawText(settings.headerText.trim(), {
      x: 36,
      y: pageH - 28,
      size: 10,
      font,
      color,
      opacity: settings.opacity + 0.3,
    });
  }
  if (settings.footerText.trim()) {
    page.drawText(settings.footerText.trim(), {
      x: 36,
      y: 24,
      size: 10,
      font,
      color,
      opacity: settings.opacity + 0.3,
    });
  }
  if (settings.includePageNumbers) {
    const label = `${pageIndex + 1} / ${pageCount}`;
    const tw = font.widthOfTextAtSize(label, 9);
    page.drawText(label, {
      x: pageW - 36 - tw,
      y: 24,
      size: 9,
      font,
      color,
      opacity: settings.opacity + 0.35,
    });
  }
}

export async function buildWatermarkedPdf(
  sourceBytes: ArrayBuffer,
  settings: WatermarkSettings,
  options: WatermarkOutputOptions,
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

  if (options.title.trim()) pdf.setTitle(options.title.trim());
  if (options.author.trim()) pdf.setAuthor(options.author.trim());
  pdf.setProducer(options.pdfA ? "ToolNest.io PDF Watermark Ultra (PDF/A)" : "ToolNest.io PDF Watermark Ultra");
  pdf.setCreator("ToolNest.io");

  const pages = pdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    if (!pageMatchesScope(i, pageCount, settings.scope, settings.pageRange)) continue;
    const page = pages[i]!;

    if (settings.layer === "background") {
      /* pdf-lib draws on top — use reduced opacity for background-style marks */
    }

    if (settings.type === "text") await applyTextWatermark(page, pdf, settings);
    else if (settings.type === "image") await applyImageWatermark(page, pdf, settings);
    else if (settings.type === "qr") await applyQrWatermark(page, pdf, settings);

    if (settings.headerText || settings.footerText || settings.includePageNumbers) {
      await applyHeaderFooter(page, pdf, settings, i, pageCount);
    }

    onProgress?.(Math.round(((i + 1) / pageCount) * 100));
  }

  const saveOpts = {
    useObjectStreams: options.compress,
    ...(options.password.trim()
      ? { userPassword: options.password.trim(), ownerPassword: options.password.trim() }
      : {}),
  } as Parameters<PDFDocument["save"]>[0];

  onProgress?.(100);
  return pdf.save(saveOpts);
}

export interface WatermarkedFile {
  name: string;
  data: Uint8Array;
}

export async function executeBatchWatermark(
  sources: { name: string; bytes: ArrayBuffer }[],
  settings: WatermarkSettings,
  options: WatermarkOutputOptions,
  onProgress?: (pct: number) => void,
): Promise<WatermarkedFile[]> {
  const results: WatermarkedFile[] = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]!;
    const opts = { ...options, fileName: src.name.replace(/\.pdf$/i, "") || "watermarked" };
    const data = await buildWatermarkedPdf(src.bytes, settings, opts);
    results.push({ name: sanitizeFilename(`${opts.fileName}-watermarked`), data });
    onProgress?.(Math.round(((i + 1) / sources.length) * 100));
  }
  return results;
}

export async function zipWatermarkedFiles(files: WatermarkedFile[], zipName: string): Promise<Blob> {
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

export interface ApiWatermarkRequest {
  watermark?: Partial<WatermarkSettings>;
  options?: Partial<WatermarkOutputOptions>;
}

export async function watermarkPdfFromBytes(
  pdfBytes: Uint8Array,
  request: ApiWatermarkRequest,
): Promise<Uint8Array> {
  const ab = pdfBytes.slice().buffer;
  const settings: WatermarkSettings = { ...DEFAULT_WATERMARK, ...(request.watermark ?? {}) };
  const options: WatermarkOutputOptions = {
    ...DEFAULT_WATERMARK_OUTPUT,
    ...(request.options ?? {}),
  };
  return buildWatermarkedPdf(ab, settings, options);
}
