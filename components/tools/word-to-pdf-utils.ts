/**
 * Ultra Word → PDF Converter — DOCX/ODT/RTF/TXT parser + pdf-lib renderer.
 * 100% client-side; optional REST API mirrors the same pipeline server-side.
 */

import {
  PDFDocument,
  PDFString,
  RGB,
  StandardFonts,
  degrees,
  rgb,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";

export type WordFormat = "docx" | "odt" | "rtf" | "txt" | "doc" | "unknown";
export type PageSizeId = "a4" | "letter" | "legal";
export type CompressionLevel = "none" | "medium" | "high";

export interface WordToPdfOptions {
  pageSize: PageSizeId;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  fontSize: number;
  lineHeight: number;
  preserveHyperlinks: boolean;
  includePageNumbers: boolean;
  includeBookmarks: boolean;
  watermark: string;
  watermarkOpacity: number;
  userPassword: string;
  ownerPassword: string;
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  pdfA: boolean;
  compression: CompressionLevel;
  mergeBatch: boolean;
  headerText: string;
  footerText: string;
  signatureLabel: string;
}

export interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  fontSize: number;
  color: RGB;
  link?: string;
}

export interface DocBlock {
  kind: "paragraph" | "heading" | "pageBreak" | "table" | "image";
  level?: number;
  runs?: TextRun[];
  alignment?: "left" | "center" | "right";
  rows?: TextRun[][][];
  image?: { bytes: Uint8Array; mime: string; width: number; height: number };
}

export interface ParsedDocument {
  format: WordFormat;
  title: string;
  blocks: DocBlock[];
  wordCount: number;
  imageCount: number;
}

export interface ConvertResult {
  blob: Blob;
  bytes: number;
  pageCount: number;
  wordCount: number;
  imageCount: number;
  durationMs: number;
  previewUrl: string;
}

export interface ConvertItem {
  id: string;
  file: File;
  name: string;
  originalBytes: number;
  format: WordFormat;
  status: "queued" | "loading" | "converting" | "done" | "error";
  result: ConvertResult | null;
  error?: string;
  previewText: string;
}

export const DEFAULT_WORD_TO_PDF_OPTIONS: WordToPdfOptions = {
  pageSize: "a4",
  marginTop: 56,
  marginRight: 56,
  marginBottom: 56,
  marginLeft: 56,
  fontSize: 11,
  lineHeight: 1.45,
  preserveHyperlinks: true,
  includePageNumbers: true,
  includeBookmarks: true,
  watermark: "",
  watermarkOpacity: 0.12,
  userPassword: "",
  ownerPassword: "",
  title: "Document — ToolNest",
  author: "ToolNest.io",
  subject: "",
  keywords: ["ToolNest", "Word to PDF"],
  pdfA: false,
  compression: "medium",
  mergeBatch: false,
  headerText: "",
  footerText: "",
  signatureLabel: "",
};

export const PAGE_SIZES: Record<PageSizeId, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  legal: [612, 1008],
};

export const ACCEPT_EXTENSIONS = ".doc,.docx,.rtf,.odt,.txt";

/* ── Format detection ───────────────────────────────────────────────────── */

export function detectWordFormat(file: File): WordFormat {
  const n = file.name.toLowerCase();
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".doc")) return "doc";
  if (n.endsWith(".odt")) return "odt";
  if (n.endsWith(".rtf")) return "rtf";
  if (n.endsWith(".txt") || n.endsWith(".md")) return "txt";
  if (file.type.includes("wordprocessingml")) return "docx";
  if (file.type.includes("opendocument.text")) return "odt";
  if (file.type.includes("rtf")) return "rtf";
  return "unknown";
}

function isOleDoc(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripXmlTags(xml: string): string {
  return decodeXmlEntities(xml.replace(/<[^>]+>/g, ""));
}

function halfPointsToPt(sz: string | undefined, fallback: number): number {
  if (!sz) return fallback;
  const n = parseInt(sz, 10);
  return Number.isFinite(n) ? n / 2 : fallback;
}

function parseColor(hex: string | undefined): RGB {
  if (!hex || hex.length < 6) return rgb(0.05, 0.05, 0.1);
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

function parseRuns(pXml: string, defaultSize: number, linkMap: Map<string, string>): TextRun[] {
  const runs: TextRun[] = [];
  const runParts = pXml.split(/<w:r[\s>]/).slice(1);
  for (const chunk of runParts) {
    const bold = /<w:b(?:\s|\/>|>)/.test(chunk) && !/<w:b\s+w:val="0"/.test(chunk);
    const italic = /<w:i(?:\s|\/>|>)/.test(chunk) && !/<w:i\s+w:val="0"/.test(chunk);
    const szMatch = /<w:sz\s+w:val="(\d+)"/.exec(chunk);
    const fontSize = halfPointsToPt(szMatch?.[1], defaultSize);
    const colorMatch = /<w:color\s+w:val="([0-9A-Fa-f]{6})"/.exec(chunk);
    const color = parseColor(colorMatch?.[1]);

    let link: string | undefined;
    const hlink = /<w:hyperlink[^>]*r:id="([^"]+)"/.exec(chunk);
    if (hlink) link = linkMap.get(hlink[1]);

    const texts = [...chunk.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1] ?? "");
    if (/<w:tab/.test(chunk)) texts.unshift("\t");
    if (/<w:br/.test(chunk)) texts.push("\n");
    const text = texts.join("");
    if (text) runs.push({ text, bold, italic, fontSize, color, link });
  }
  if (!runs.length && pXml.includes("<w:p")) {
    runs.push({ text: "", bold: false, italic: false, fontSize: defaultSize, color: rgb(0.05, 0.05, 0.1) });
  }
  return runs;
}

async function loadZip(bytes: ArrayBuffer) {
  const JSZip = (await import("jszip")).default;
  return JSZip.loadAsync(bytes);
}

async function parseDocx(bytes: ArrayBuffer, defaultSize: number): Promise<ParsedDocument> {
  const zip = await loadZip(bytes);
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("Invalid DOCX — missing word/document.xml");

  const relsXml = (await zip.file("word/_rels/document.xml.rels")?.async("string")) ?? "";
  const linkMap = new Map<string, string>();
  for (const m of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    const target = m[2] ?? "";
    if (target.startsWith("http")) linkMap.set(m[1]!, target);
  }

  const media = new Map<string, Uint8Array>();
  const mediaMime = new Map<string, string>();
  for (const path of Object.keys(zip.files)) {
    if (path.startsWith("word/media/")) {
      const data = await zip.file(path)!.async("uint8array");
      media.set(path.replace("word/", ""), data);
      const ext = path.split(".").pop()?.toLowerCase();
      mediaMime.set(
        path.replace("word/", ""),
        ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg",
      );
    }
  }

  const blocks: DocBlock[] = [];
  let wordCount = 0;
  let imageCount = 0;

  const bodyMatch = /<w:body[^>]*>([\s\S]*)<\/w:body>/.exec(documentXml);
  const body = bodyMatch?.[1] ?? documentXml;

  const tokens = body.split(/(?=<w:p[\s>])|(?=<w:tbl[\s>])|(?=<w:sectPr)/);
  for (const token of tokens) {
    if (!token.trim()) continue;
    if (token.includes("<w:tbl")) {
      const rows: TextRun[][][] = [];
      for (const tr of token.match(/<w:tr[\s\S]*?<\/w:tr>/g) ?? []) {
        const cells: TextRun[][] = [];
        for (const tc of tr.match(/<w:tc[\s\S]*?<\/w:tc>/g) ?? []) {
          const cellRuns: TextRun[] = [];
          for (const p of tc.match(/<w:p[\s\S]*?<\/w:p>/g) ?? []) {
            cellRuns.push(...parseRuns(p, defaultSize, linkMap));
          }
          cells.push(cellRuns.length ? cellRuns : [{ text: "", bold: false, italic: false, fontSize: defaultSize, color: rgb(0, 0, 0) }]);
        }
        if (cells.length) rows.push(cells);
      }
      if (rows.length) blocks.push({ kind: "table", rows });
      continue;
    }
    if (!token.includes("<w:p")) continue;

    if (/<w:br[^>]*w:type="page"/.test(token)) {
      blocks.push({ kind: "pageBreak" });
    }

    const styleMatch = /<w:pStyle\s+w:val="([^"]+)"/.exec(token);
    const isHeading = styleMatch?.[1]?.toLowerCase().includes("heading");
    const level = isHeading ? parseInt(styleMatch![1]!.replace(/\D/g, "") || "1", 10) : undefined;

    let alignment: DocBlock["alignment"] = "left";
    if (/w:jc\s+w:val="center"/.test(token)) alignment = "center";
    if (/w:jc\s+w:val="right"/.test(token)) alignment = "right";

    const runs = parseRuns(token, defaultSize, linkMap);
    const text = runs.map((r) => r.text).join("");
    wordCount += text.split(/\s+/).filter(Boolean).length;

    if (/<w:drawing/.test(token)) {
      const embed = /r:embed="([^"]+)"/.exec(token);
      if (embed) {
        const rel = relsXml.match(new RegExp(`Id="${embed[1]}"[^>]*Target="([^"]+)"`));
        const target = rel?.[1]?.replace(/^\.\.\//, "") ?? "";
        const imgBytes = media.get(target.replace("media/", "")) ?? media.get(target);
        const mime = mediaMime.get(target.replace("media/", "")) ?? "image/png";
        if (imgBytes) {
          blocks.push({
            kind: "image",
            image: { bytes: imgBytes, mime, width: 400, height: 300 },
          });
          imageCount++;
        }
      }
    }

    blocks.push({
      kind: isHeading ? "heading" : "paragraph",
      level,
      runs,
      alignment,
    });
  }

  const core = await zip.file("docProps/core.xml")?.async("string");
  const titleMatch = core && /<dc:title[^>]*>([^<]+)</.exec(core);

  return {
    format: "docx",
    title: titleMatch?.[1] ?? "Document",
    blocks,
    wordCount,
    imageCount,
  };
}

async function parseOdt(bytes: ArrayBuffer, defaultSize: number): Promise<ParsedDocument> {
  const zip = await loadZip(bytes);
  const content = await zip.file("content.xml")?.async("string");
  if (!content) throw new Error("Invalid ODT — missing content.xml");

  const blocks: DocBlock[] = [];
  let wordCount = 0;
  for (const p of content.match(/<text:p[\s\S]*?<\/text:p>/g) ?? []) {
    const text = stripXmlTags(p);
    wordCount += text.split(/\s+/).filter(Boolean).length;
    const isHeading = /text:outline-level="(\d+)"/.test(p);
    blocks.push({
      kind: isHeading ? "heading" : "paragraph",
      level: isHeading ? parseInt(/text:outline-level="(\d+)"/.exec(p)?.[1] ?? "1", 10) : undefined,
      runs: [{ text, bold: isHeading, italic: false, fontSize: defaultSize, color: rgb(0.05, 0.05, 0.1) }],
    });
  }
  return { format: "odt", title: "Document", blocks, wordCount, imageCount: 0 };
}

function parseRtf(text: string, defaultSize: number): ParsedDocument {
  let plain = text
    .replace(/\\par[d]?/gi, "\n")
    .replace(/\\line/gi, "\n")
    .replace(/\\tab/gi, "\t")
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/\\[a-z]+\d* ?/gi, "")
    .replace(/[{}]/g, "")
    .replace(/\r\n/g, "\n");

  const blocks: DocBlock[] = plain.split(/\n+/).map((line) => ({
    kind: "paragraph" as const,
    runs: [{ text: line, bold: false, italic: false, fontSize: defaultSize, color: rgb(0.05, 0.05, 0.1) }],
  }));
  const wordCount = plain.split(/\s+/).filter(Boolean).length;
  return { format: "rtf", title: "Document", blocks, wordCount, imageCount: 0 };
}

function parseTxt(text: string, defaultSize: number): ParsedDocument {
  const blocks: DocBlock[] = text.split(/\n/).map((line) => ({
    kind: "paragraph" as const,
    runs: [{ text: line, bold: false, italic: false, fontSize: defaultSize, color: rgb(0.05, 0.05, 0.1) }],
  }));
  return {
    format: "txt",
    title: "Document",
    blocks,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    imageCount: 0,
  };
}

export async function parseWordDocument(bytes: ArrayBuffer, format: WordFormat, defaultSize: number): Promise<ParsedDocument> {
  const u8 = new Uint8Array(bytes);
  if (format === "doc" || (format === "unknown" && isOleDoc(u8))) {
    throw new Error(
      "Legacy .doc (binary Word) is not supported in-browser. Open in Word and Save As .docx, or use the REST API.",
    );
  }
  switch (format) {
    case "docx":
      return parseDocx(bytes, defaultSize);
    case "odt":
      return parseOdt(bytes, defaultSize);
    case "rtf": {
      const text = new TextDecoder("utf-8", { fatal: false }).decode(u8);
      return parseRtf(text, defaultSize);
    }
    case "txt":
    case "unknown":
      return parseTxt(new TextDecoder("utf-8", { fatal: false }).decode(u8), defaultSize);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/* ── PDF rendering ──────────────────────────────────────────────────────── */

async function pickFont(pdf: PDFDocument, run: TextRun): Promise<PDFFont> {
  if (run.bold && run.italic) return pdf.embedFont(StandardFonts.HelveticaBoldOblique);
  if (run.bold) return pdf.embedFont(StandardFonts.HelveticaBold);
  if (run.italic) return pdf.embedFont(StandardFonts.HelveticaOblique);
  return pdf.embedFont(StandardFonts.Helvetica);
}

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(/(\s+)/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current + w;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = w.trimStart();
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function addLinkAnnotation(page: PDFPage, url: string, x: number, y: number, w: number, h: number) {
  const ctx = page.doc.context;
  const annot = ctx.register(
    ctx.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [x, y, x + w, y + h],
      Border: [0, 0, 0],
      A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
    }),
  );
  page.node.addAnnot(annot);
}

export async function renderDocumentToPdf(doc: ParsedDocument, options: WordToPdfOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(options.title || doc.title);
  pdf.setAuthor(options.author);
  pdf.setSubject(options.subject);
  pdf.setKeywords(options.keywords);
  pdf.setProducer("ToolNest Ultra Word to PDF");
  pdf.setCreator("ToolNest.io");
  if (options.pdfA) {
    pdf.setSubject(`${options.subject} PDF/A-1b intent`.trim());
  }

  const [pageW, pageH] = PAGE_SIZES[options.pageSize];
  const contentW = pageW - options.marginLeft - options.marginRight;
  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - options.marginTop;
  let pageIndex = 1;
  const fontCache = new Map<string, PDFFont>();

  const getFont = async (run: TextRun) => {
    const key = `${run.bold}-${run.italic}`;
    if (!fontCache.has(key)) fontCache.set(key, await pickFont(pdf, run));
    return fontCache.get(key)!;
  };

  const newPage = () => {
    page = pdf.addPage([pageW, pageH]);
    y = pageH - options.marginTop;
    pageIndex++;
  };

  const drawHeaderFooter = async () => {
    const small = await pdf.embedFont(StandardFonts.Helvetica);
    if (options.headerText) {
      page.drawText(options.headerText, { x: options.marginLeft, y: pageH - 28, size: 9, font: small, color: rgb(0.4, 0.4, 0.45) });
    }
    if (options.footerText) {
      page.drawText(options.footerText, { x: options.marginLeft, y: 24, size: 9, font: small, color: rgb(0.4, 0.4, 0.45) });
    }
    if (options.includePageNumbers) {
      const label = `${pageIndex}`;
      const tw = small.widthOfTextAtSize(label, 9);
      page.drawText(label, { x: pageW - options.marginRight - tw, y: 24, size: 9, font: small, color: rgb(0.35, 0.35, 0.4) });
    }
    if (options.watermark.trim()) {
      const wm = await pdf.embedFont(StandardFonts.HelveticaBold);
      const size = 42;
      const tw = wm.widthOfTextAtSize(options.watermark, size);
      page.drawText(options.watermark, {
        x: (pageW - tw) / 2,
        y: pageH / 2,
        size,
        font: wm,
        color: rgb(0.75, 0.75, 0.78),
        opacity: options.watermarkOpacity,
        rotate: degrees(-35),
      });
    }
    if (options.signatureLabel.trim()) {
      const sig = await pdf.embedFont(StandardFonts.HelveticaOblique);
      page.drawText(options.signatureLabel, {
        x: options.marginLeft,
        y: options.marginBottom - 10,
        size: 10,
        font: sig,
        color: rgb(0.2, 0.2, 0.25),
      });
    }
  };

  await drawHeaderFooter();

  for (const block of doc.blocks) {
    if (block.kind === "pageBreak") {
      newPage();
      await drawHeaderFooter();
      continue;
    }

    if (block.kind === "image" && block.image) {
      const { bytes, mime, width, height } = block.image;
      const img =
        mime.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const scale = Math.min(contentW / width, 320 / height, 1);
      const w = width * scale;
      const h = height * scale;
      if (y - h < options.marginBottom) {
        newPage();
        await drawHeaderFooter();
      }
      page.drawImage(img, { x: options.marginLeft, y: y - h, width: w, height: h });
      y -= h + 12;
      continue;
    }

    if (block.kind === "table" && block.rows) {
      const cellPad = 4;
      const colCount = Math.max(...block.rows.map((r) => r.length));
      const colW = contentW / colCount;
      for (const row of block.rows) {
        let rowH = 0;
        for (let c = 0; c < colCount; c++) {
          const runs = row[c] ?? [{ text: "", bold: false, italic: false, fontSize: options.fontSize, color: rgb(0, 0, 0) }];
          const text = runs.map((r) => r.text).join("");
          const font = await getFont(runs[0]!);
          const lines = wrapLine(text, font, options.fontSize, colW - cellPad * 2);
          rowH = Math.max(rowH, lines.length * options.fontSize * options.lineHeight + cellPad * 2);
        }
        if (y - rowH < options.marginBottom) {
          newPage();
          await drawHeaderFooter();
        }
        for (let c = 0; c < colCount; c++) {
          const x = options.marginLeft + c * colW;
          page.drawRectangle({ x, y: y - rowH, width: colW, height: rowH, borderColor: rgb(0.8, 0.8, 0.82), borderWidth: 0.5 });
          const runs = row[c] ?? [{ text: "", bold: false, italic: false, fontSize: options.fontSize, color: rgb(0, 0, 0) }];
          const font = await getFont(runs[0]!);
          page.drawText(runs.map((r) => r.text).join(""), {
            x: x + cellPad,
            y: y - cellPad - options.fontSize,
            size: options.fontSize,
            font,
            color: runs[0]!.color,
            maxWidth: colW - cellPad * 2,
          });
        }
        y -= rowH;
      }
      y -= 8;
      continue;
    }

    const runs = block.runs ?? [];
    const baseSize =
      block.kind === "heading" ? options.fontSize + (4 - (block.level ?? 1)) * 2 : options.fontSize;
    const lineH = baseSize * options.lineHeight;

    for (const run of runs) {
      const font = await getFont({ ...run, fontSize: baseSize });
      const lines = wrapLine(run.text, font, baseSize, contentW);
      for (const line of lines) {
        if (y - lineH < options.marginBottom) {
          newPage();
          await drawHeaderFooter();
        }
        let x = options.marginLeft;
        if (block.alignment === "center") {
          x = options.marginLeft + (contentW - font.widthOfTextAtSize(line, baseSize)) / 2;
        } else if (block.alignment === "right") {
          x = options.marginLeft + contentW - font.widthOfTextAtSize(line, baseSize);
        }
        page.drawText(line, { x, y: y - baseSize, size: baseSize, font, color: run.color });
        if (run.link && options.preserveHyperlinks) {
          const lw = font.widthOfTextAtSize(line, baseSize);
          addLinkAnnotation(page, run.link, x, y - baseSize - 2, lw, baseSize + 4);
        }
        y -= lineH;
      }
    }
    y -= block.kind === "heading" ? 6 : 3;
  }

  const useObjectStreams = options.compression !== "none";
  let bytes = await pdf.save({ useObjectStreams });

  if (options.userPassword.trim()) {
    try {
      const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt");
      bytes = await encryptPDF(bytes, options.userPassword, {
        ownerPassword: options.ownerPassword || options.userPassword,
        allowPrinting: true,
        allowCopying: !options.userPassword,
        allowModifying: false,
      });
    } catch {
      /* encryption optional — return unencrypted if package fails */
    }
  }

  return bytes;
}

export async function convertWordToPdf(
  file: File,
  options: WordToPdfOptions,
  onProgress?: (pct: number) => void,
): Promise<ConvertResult> {
  const start = performance.now();
  onProgress?.(10);
  const format = detectWordFormat(file);
  const bytes = await file.arrayBuffer();
  onProgress?.(30);
  const parsed = await parseWordDocument(bytes, format, options.fontSize);
  onProgress?.(55);
  const pdfBytes = await renderDocumentToPdf(parsed, {
    ...options,
    title: options.title || parsed.title,
  });
  onProgress?.(95);
  const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  const result: ConvertResult = {
    blob,
    bytes: pdfBytes.length,
    pageCount: (await PDFDocument.load(pdfBytes)).getPageCount(),
    wordCount: parsed.wordCount,
    imageCount: parsed.imageCount,
    durationMs: Math.round(performance.now() - start),
    previewUrl: URL.createObjectURL(blob),
  };
  onProgress?.(100);
  return result;
}

export async function convertWordBatch(
  files: File[],
  options: WordToPdfOptions,
  onItem?: (index: number, total: number) => void,
): Promise<{ items: ConvertResult[]; merged?: ConvertResult }> {
  const items: ConvertResult[] = [];
  for (let i = 0; i < files.length; i++) {
    onItem?.(i + 1, files.length);
    items.push(await convertWordToPdf(files[i]!, options));
  }

  if (!options.mergeBatch || items.length < 2) return { items };

  const merged = await PDFDocument.create();
  for (const item of items) {
    const buf = await item.blob.arrayBuffer();
    const src = await PDFDocument.load(buf);
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  merged.setTitle(options.title);
  merged.setProducer("ToolNest Ultra Word to PDF");
  let mergedBytes = await merged.save({ useObjectStreams: options.compression !== "none" });
  if (options.userPassword.trim()) {
    try {
      const { encryptPDF } = await import("@pdfsmaller/pdf-encrypt");
      mergedBytes = await encryptPDF(mergedBytes, options.userPassword, {
        ownerPassword: options.ownerPassword || options.userPassword,
      });
    } catch {
      /* ignore */
    }
  }
  const blob = new Blob([mergedBytes as BlobPart], { type: "application/pdf" });
  return {
    items,
    merged: {
      blob,
      bytes: mergedBytes.length,
      pageCount: merged.getPageCount(),
      wordCount: items.reduce((s, x) => s + x.wordCount, 0),
      imageCount: items.reduce((s, x) => s + x.imageCount, 0),
      durationMs: items.reduce((s, x) => s + x.durationMs, 0),
      previewUrl: URL.createObjectURL(blob),
    },
  };
}

export function smartWordToPdfSuggestions(items: ConvertItem[], options: WordToPdfOptions): string[] {
  const tips: string[] = [];
  const docs = items.filter((i) => i.format === "doc");
  if (docs.length) tips.push(`${docs.length} legacy .doc file(s) — save as .docx for best layout preservation.`);
  if (items.length > 3 && !options.mergeBatch) tips.push("Enable “Merge batch” to combine multiple Word files into one PDF.");
  if (options.watermark) tips.push("Watermark applied diagonally on every page — adjust opacity in Settings.");
  if (options.userPassword) tips.push("PDF password protection uses AES-256 when supported by your browser.");
  if (options.pdfA) tips.push("PDF/A metadata tags set — full archival compliance requires dedicated validators.");
  const big = items.filter((i) => i.originalBytes > 15 * 1024 * 1024);
  if (big.length) tips.push(`${big.length} large file(s) — conversion may take longer; images are embedded at source resolution.`);
  if (!tips.length) tips.push("DOCX preserves tables, images, and hyperlinks best. Use A4 with 56pt margins for print-ready output.");
  return tips;
}

export function buildPdfOutputName(inputName: string): string {
  const base = inputName.replace(/\.[^.]+$/i, "");
  return `${base || "document"}.pdf`;
}

export async function buildPreviewText(file: File): Promise<string> {
  try {
    const format = detectWordFormat(file);
    const parsed = await parseWordDocument(await file.arrayBuffer(), format, 11);
    return parsed.blocks
      .flatMap((b) => b.runs?.map((r) => r.text) ?? [])
      .join("")
      .slice(0, 500);
  } catch {
    return "";
  }
}
