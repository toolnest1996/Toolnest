import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";
import {
  type Rotation,
  loadPdfJs,
  nextRotation,
  parsePageRange,
  parsePdf,
  renderThumb,
  reorder,
  sanitizeFilename,
} from "./pdf-merge-utils";

export type SplitMode = "every-page" | "extract" | "by-ranges" | "every-n" | "by-bookmarks";

export interface SplitPage {
  id: string;
  pageIndex: number;
  included: boolean;
  rotation: Rotation;
  thumb?: string;
}

export interface SplitOutputOptions {
  filePrefix: string;
  sourceBaseName: string;
  compress: boolean;
  password: string;
  pageNumbers: boolean;
  watermark: string;
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  preserveMetadata: boolean;
  fitToA4: boolean;
}

export const DEFAULT_SPLIT_OUTPUT: Omit<SplitOutputOptions, "filePrefix" | "sourceBaseName"> = {
  compress: true,
  password: "",
  pageNumbers: false,
  watermark: "",
  title: "",
  author: "ToolNest.io",
  subject: "",
  keywords: [],
  preserveMetadata: true,
  fitToA4: false,
};

export interface SplitFile {
  name: string;
  data: Uint8Array;
}

export interface BookmarkGroup {
  title: string;
  pageIndices: number[];
}

export { nextRotation, parsePdf, renderThumb, reorder, sanitizeFilename };

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 36;

/** Parse "1-3; 4-8; 9" into groups of 0-based page indices. */
export function parseRangeGroups(input: string, pageCount: number): number[][] {
  const groups = input
    .split(/[;\n]+/)
    .map((g) => g.trim())
    .filter(Boolean);
  if (!groups.length) return [];
  return groups.map((g) => parsePageRange(g, pageCount)).filter((g) => g.length > 0);
}

export function chunkPages(pages: number[], size: number): number[][] {
  if (size < 1) return [pages];
  const chunks: number[][] = [];
  for (let i = 0; i < pages.length; i += size) {
    chunks.push(pages.slice(i, i + size));
  }
  return chunks;
}

export function smartSplitSuggestions(
  pageCount: number,
  includedCount: number,
  mode: SplitMode,
  estOutputs: number,
  fileSize: number,
): string[] {
  const tips: string[] = [];
  if (includedCount < pageCount) tips.push(`${pageCount - includedCount} page(s) excluded — only selected pages are split.`);
  if (mode === "every-page" && estOutputs > 25) tips.push(`${estOutputs} files — output will download as ZIP. Consider "Every N pages" for fewer files.`);
  if (fileSize > 40 * 1024 * 1024) tips.push("Large PDF — enable Compress and preview before download.");
  if (mode === "by-bookmarks") tips.push("Bookmark split uses top-level PDF outline entries as section breaks.");
  if (mode === "by-ranges") tips.push('Use semicolons between groups: e.g. 1-3; 4-8; 9-12');
  return tips;
}

/** Top-level PDF bookmarks → page groups (pdf.js). */
export async function extractBookmarkGroups(bytes: ArrayBuffer): Promise<BookmarkGroup[]> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  const outline = await doc.getOutline();
  if (!outline?.length) {
    doc.destroy();
    return [];
  }

  const points: { title: string; pageIndex: number }[] = [];
  for (const item of outline) {
    if (!item.dest && !item.url) continue;
    try {
      let dest = item.dest;
      if (typeof dest === "string") dest = await doc.getDestination(dest);
      if (Array.isArray(dest) && dest[0]) {
        const pageIndex = await doc.getPageIndex(dest[0]);
        points.push({ title: item.title || "Section", pageIndex });
      }
    } catch {
      /* skip invalid dest */
    }
  }

  points.sort((a, b) => a.pageIndex - b.pageIndex);
  const pageCount = doc.numPages;
  doc.destroy();

  if (!points.length) return [];

  const groups: BookmarkGroup[] = [];
  for (let i = 0; i < points.length; i++) {
    const start = points[i]!.pageIndex;
    const end = i + 1 < points.length ? points[i + 1]!.pageIndex - 1 : pageCount - 1;
    if (start <= end) {
      groups.push({
        title: points[i]!.title,
        pageIndices: Array.from({ length: end - start + 1 }, (_, j) => start + j),
      });
    }
  }
  return groups;
}

function stampPage(
  page: ReturnType<PDFDocument["getPages"]>[0],
  index: number,
  total: number,
  options: SplitOutputOptions,
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

async function applyMetadata(
  out: PDFDocument,
  sourceBytes: ArrayBuffer,
  options: SplitOutputOptions,
  docTitle?: string,
) {
  if (docTitle?.trim()) out.setTitle(docTitle.trim());
  else if (options.title.trim()) out.setTitle(options.title.trim());

  if (options.preserveMetadata) {
    try {
      const src = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
      if (!docTitle && !options.title.trim() && src.getTitle()) out.setTitle(src.getTitle()!);
      if (src.getAuthor()) out.setAuthor(src.getAuthor()!);
      if (src.getSubject()) out.setSubject(src.getSubject()!);
      const kw = src.getKeywords();
      if (kw) out.setKeywords(typeof kw === "string" ? kw.split(",").map((k) => k.trim()) : kw);
    } catch {
      /* ignore */
    }
  }

  if (options.author.trim()) out.setAuthor(options.author.trim());
  if (options.subject.trim()) out.setSubject(options.subject.trim());
  if (options.keywords.length) out.setKeywords(options.keywords.filter(Boolean));
  out.setProducer("ToolNest.io PDF Split Ultra");
  out.setCreator("ToolNest.io");
}

export async function buildPdfFromPageIndices(
  sourceBytes: ArrayBuffer,
  pageIndices: number[],
  rotations: Map<number, Rotation>,
  options: SplitOutputOptions,
  docTitle?: string,
): Promise<Uint8Array> {
  const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  await applyMetadata(out, sourceBytes, options, docTitle);

  const font =
    options.pageNumbers || options.watermark.trim()
      ? await out.embedFont(StandardFonts.Helvetica)
      : null;

  for (const idx of pageIndices) {
    if (options.fitToA4) {
      const srcPage = source.getPages()[idx];
      if (!srcPage) continue;
      const embedded = await out.embedPage(srcPage);
      const newPage = out.addPage(A4);
      let w = embedded.width;
      let h = embedded.height;
      const rot = rotations.get(idx) ?? 0;
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
      const rot = rotations.get(idx) ?? 0;
      if (rot) page.setRotation(degrees(rot));
      out.addPage(page);
    }
  }

  if (font) {
    const outPages = out.getPages();
    outPages.forEach((page, i) => stampPage(page, i, outPages.length, options, font));
  }

  const saveOpts = {
    useObjectStreams: options.compress,
    ...(options.password.trim()
      ? { userPassword: options.password.trim(), ownerPassword: options.password.trim() }
      : {}),
  } as Parameters<PDFDocument["save"]>[0];

  return out.save(saveOpts);
}

function slugify(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 48) || "section";
}

export async function executeSplit(
  sourceBytes: ArrayBuffer,
  pages: SplitPage[],
  mode: SplitMode,
  rangeGroupsInput: string,
  everyN: number,
  options: SplitOutputOptions,
  onProgress?: (pct: number) => void,
): Promise<SplitFile[]> {
  const included = pages.filter((p) => p.included).sort((a, b) => a.pageIndex - b.pageIndex);
  const rotations = new Map(included.map((p) => [p.pageIndex, p.rotation]));
  const prefix = options.filePrefix.trim() || options.sourceBaseName || "split";
  const includedSet = new Set(included.map((p) => p.pageIndex));
  const results: SplitFile[] = [];

  const progress = (done: number, total: number) => {
    onProgress?.(Math.round((done / Math.max(total, 1)) * 100));
  };

  if (mode === "extract") {
    if (!included.length) return [];
    const data = await buildPdfFromPageIndices(
      sourceBytes,
      included.map((p) => p.pageIndex),
      rotations,
      options,
      `${options.title || prefix} — extract`,
    );
    progress(1, 1);
    return [{ name: sanitizeFilename(`${prefix}-extract`), data }];
  }

  if (mode === "every-page") {
    const total = included.length;
    for (let i = 0; i < total; i++) {
      const p = included[i]!;
      const data = await buildPdfFromPageIndices(
        sourceBytes,
        [p.pageIndex],
        rotations,
        options,
        `Page ${p.pageIndex + 1}`,
      );
      results.push({
        name: sanitizeFilename(`${prefix}-page-${String(p.pageIndex + 1).padStart(3, "0")}`),
        data,
      });
      progress(i + 1, total);
    }
    return results;
  }

  if (mode === "by-ranges") {
    const source = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    const groups = parseRangeGroups(rangeGroupsInput, source.getPageCount());
    if (!groups.length) return [];

    for (let i = 0; i < groups.length; i++) {
      const indices = groups[i]!.filter((idx) => includedSet.has(idx));
      if (!indices.length) continue;
      const data = await buildPdfFromPageIndices(
        sourceBytes,
        indices,
        rotations,
        options,
        `${prefix} part ${i + 1}`,
      );
      results.push({ name: sanitizeFilename(`${prefix}-part-${i + 1}`), data });
      progress(i + 1, groups.length);
    }
    return results;
  }

  if (mode === "every-n") {
    const indices = included.map((p) => p.pageIndex);
    const chunks = chunkPages(indices, Math.max(1, everyN));
    for (let i = 0; i < chunks.length; i++) {
      const data = await buildPdfFromPageIndices(
        sourceBytes,
        chunks[i]!,
        rotations,
        options,
        `${prefix} chunk ${i + 1}`,
      );
      results.push({ name: sanitizeFilename(`${prefix}-chunk-${i + 1}`), data });
      progress(i + 1, chunks.length);
    }
    return results;
  }

  if (mode === "by-bookmarks") {
    const groups = await extractBookmarkGroups(sourceBytes);
    if (!groups.length) return [];

    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]!;
      const indices = g.pageIndices.filter((idx) => includedSet.has(idx));
      if (!indices.length) continue;
      const data = await buildPdfFromPageIndices(
        sourceBytes,
        indices,
        rotations,
        options,
        g.title,
      );
      results.push({ name: sanitizeFilename(`${prefix}-${slugify(g.title)}`), data });
      progress(i + 1, groups.length);
    }
    return results;
  }

  return results;
}

export async function zipSplitFiles(files: SplitFile[], zipName: string): Promise<Blob> {
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

export function estimateOutputCount(
  mode: SplitMode,
  includedCount: number,
  rangeGroupsInput: string,
  pageCount: number,
  everyN: number,
  bookmarkGroupCount = 0,
): number {
  if (mode === "extract") return includedCount > 0 ? 1 : 0;
  if (mode === "every-page") return includedCount;
  if (mode === "every-n")
    return chunkPages(Array.from({ length: includedCount }, (_, i) => i), Math.max(1, everyN)).length;
  if (mode === "by-ranges") return parseRangeGroups(rangeGroupsInput, pageCount).length;
  if (mode === "by-bookmarks") return bookmarkGroupCount;
  return 0;
}

/** Batch split multiple PDFs with the same settings. */
export async function executeBatchSplit(
  sources: { name: string; bytes: ArrayBuffer; pageCount: number }[],
  mode: SplitMode,
  rangeGroupsInput: string,
  everyN: number,
  options: SplitOutputOptions,
  onProgress?: (pct: number) => void,
): Promise<SplitFile[]> {
  const all: SplitFile[] = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]!;
    const pages: SplitPage[] = Array.from({ length: src.pageCount }, (_, j) => ({
      id: crypto.randomUUID(),
      pageIndex: j,
      included: true,
      rotation: 0 as Rotation,
    }));
    const opts = {
      ...options,
      filePrefix: options.filePrefix || src.name.replace(/\.pdf$/i, ""),
      sourceBaseName: src.name.replace(/\.pdf$/i, "") || "split",
    };
    const files = await executeSplit(src.bytes, pages, mode, rangeGroupsInput, everyN, opts);
    all.push(...files.map((f) => ({ name: `${opts.sourceBaseName}/${f.name}`, data: f.data })));
    onProgress?.(Math.round(((i + 1) / sources.length) * 100));
  }
  return all;
}

export interface ApiSplitRequest {
  mode: SplitMode;
  rangeGroups?: string;
  everyN?: number;
  pageIndices?: number[];
  options?: Partial<SplitOutputOptions>;
}

export async function splitPdfFromBytes(
  pdfBytes: Uint8Array,
  request: ApiSplitRequest,
): Promise<SplitFile[]> {
  const ab = pdfBytes.slice().buffer;
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageCount = pdf.getPageCount();

  const pages: SplitPage[] = Array.from({ length: pageCount }, (_, i) => ({
    id: crypto.randomUUID(),
    pageIndex: i,
    included: request.pageIndices ? request.pageIndices.includes(i) : true,
    rotation: 0 as Rotation,
  }));

  const baseName = "split";
  const options: SplitOutputOptions = {
    ...DEFAULT_SPLIT_OUTPUT,
    filePrefix: baseName,
    sourceBaseName: baseName,
    ...(request.options ?? {}),
    keywords: request.options?.keywords ?? DEFAULT_SPLIT_OUTPUT.keywords,
  };

  return executeSplit(
    ab,
    pages,
    request.mode,
    request.rangeGroups ?? "1-3; 4-6",
    request.everyN ?? 5,
    options,
  );
}
