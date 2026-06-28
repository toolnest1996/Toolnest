import { PDFDocument, StandardFonts, degrees, rgb, type PDFPage } from "pdf-lib";

export type Rotation = 0 | 90 | 180 | 270;
export type MergePreset = "append" | "reverse-pages" | "reverse-docs" | "interleave" | "reverse-queue";

export interface PdfDocument {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  bytes: ArrayBuffer;
  contentHash: string;
  encrypted?: boolean;
}

export class PdfEncryptedError extends Error {
  constructor(public fileName: string) {
    super(`"${fileName}" is password-protected. Enter the password to unlock.`);
    this.name = "PdfEncryptedError";
  }
}

export interface QueuePage {
  id: string;
  included: boolean;
  kind: "page" | "blank" | "cover";
  sourceId?: string;
  pageIndex?: number;
  rotation: Rotation;
  fileName?: string;
  thumb?: string;
  coverBytes?: ArrayBuffer;
  coverType?: "png" | "jpg";
}

export interface MergeOutputOptions {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  compress: boolean;
  password: string;
  pageNumbers: boolean;
  watermark: string;
  fitToA4: boolean;
}

export const DEFAULT_MERGE_OUTPUT: MergeOutputOptions = {
  title: "Merged PDF — ToolNest",
  author: "ToolNest.io",
  subject: "",
  keywords: [],
  compress: true,
  password: "",
  pageNumbers: true,
  watermark: "",
  fitToA4: false,
};

const A4_SIZE: [number, number] = [595.28, 841.89];
const PAGE_MARGIN = 36;

export async function hashBuffer(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function findDuplicateDocuments(docs: PdfDocument[]): { name: string; duplicateOf: string }[] {
  const byHash = new Map<string, string>();
  const dupes: { name: string; duplicateOf: string }[] = [];
  for (const doc of docs) {
    if (!doc.contentHash) continue;
    const first = byHash.get(doc.contentHash);
    if (first) dupes.push({ name: doc.name, duplicateOf: first });
    else byHash.set(doc.contentHash, doc.name);
  }
  return dupes;
}

export function dedupeQueuePages(queue: QueuePage[]): QueuePage[] {
  const seen = new Set<string>();
  return queue.filter((p) => {
    if (p.kind !== "page" || p.sourceId === undefined || p.pageIndex === undefined) return true;
    const key = `${p.sourceId}:${p.pageIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function smartMergeSuggestions(docs: PdfDocument[], queue: QueuePage[]): string[] {
  const tips: string[] = [];
  const dupes = findDuplicateDocuments(docs);
  if (dupes.length) tips.push(`${dupes.length} duplicate file(s) detected — remove copies to avoid repeated pages.`);
  const excluded = queue.filter((p) => !p.included).length;
  if (excluded > 0) tips.push(`${excluded} page(s) excluded from output — open Page Studio to review.`);
  if (docs.length >= 3) tips.push("3+ documents: try Interleave preset for alternating pages across files.");
  const totalMb = docs.reduce((s, d) => s + d.size, 0) / (1024 * 1024);
  if (totalMb > 40) tips.push(`Large batch (~${totalMb.toFixed(0)} MB) — enable Compress and preview before download.`);
  const encrypted = docs.filter((d) => d.encrypted).length;
  if (encrypted) tips.push(`${encrypted} PDF(s) were unlocked with a password — passwords are not stored.`);
  if (queue.some((p) => p.rotation !== 0)) tips.push("Rotated pages detected — enable Fit to A4 if page sizes differ.");
  return tips;
}

export function autoTitleFromDocuments(docs: PdfDocument[]): string {
  if (!docs.length) return "Merged PDF — ToolNest";
  if (docs.length === 1) return docs[0]!.name.replace(/\.pdf$/i, "");
  const stem = docs[0]!.name.replace(/\.pdf$/i, "");
  return `${stem} + ${docs.length - 1} more — ToolNest`;
}

export function nextRotation(current: Rotation): Rotation {
  return ((current + 90) % 360) as Rotation;
}

export function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** Parse "1-3, 5, 8-10" into 0-based page indices. */
export function parsePageRange(input: string, pageCount: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) return Array.from({ length: pageCount }, (_, i) => i);

  const set = new Set<number>();
  for (const part of trimmed.split(",")) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes("-")) {
      const [a, b] = p.split("-").map((s) => parseInt(s.trim(), 10));
      if (Number.isNaN(a) || Number.isNaN(b)) continue;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let i = lo; i <= hi; i++) {
        if (i >= 1 && i <= pageCount) set.add(i - 1);
      }
    } else {
      const n = parseInt(p, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= pageCount) set.add(n - 1);
    }
  }
  return [...set].sort((a, b) => a - b);
}

export function buildQueueFromDocuments(
  docs: PdfDocument[],
  pageRanges?: Record<string, string>,
): QueuePage[] {
  const items: QueuePage[] = [];
  for (const doc of docs) {
    const indices = parsePageRange(pageRanges?.[doc.id] ?? "", doc.pageCount);
    for (const pageIndex of indices) {
      items.push({
        id: crypto.randomUUID(),
        included: true,
        kind: "page",
        sourceId: doc.id,
        pageIndex,
        rotation: 0,
        fileName: doc.name,
      });
    }
  }
  return items;
}

export function applyMergePreset(
  preset: MergePreset,
  docs: PdfDocument[],
  queue: QueuePage[],
): QueuePage[] {
  const clone = (p: QueuePage): QueuePage => ({ ...p, id: crypto.randomUUID(), thumb: undefined });

  if (preset === "reverse-queue") {
    return [...queue].reverse().map(clone);
  }

  if (preset === "reverse-pages") {
    const pages = queue.filter((p) => p.kind === "page" || p.kind === "blank" || p.kind === "cover");
    return [...pages].reverse().map(clone);
  }

  if (preset === "reverse-docs") {
    return buildQueueFromDocuments([...docs].reverse());
  }

  if (preset === "interleave") {
    const byDoc = new Map<string, QueuePage[]>();
    for (const item of queue) {
      if (item.kind !== "page" || !item.sourceId) continue;
      if (!byDoc.has(item.sourceId)) byDoc.set(item.sourceId, []);
      byDoc.get(item.sourceId)!.push(item);
    }
    const docOrder = docs.map((d) => d.id).filter((id) => byDoc.has(id));
    const maxLen = Math.max(0, ...[...byDoc.values()].map((a) => a.length));
    const result: QueuePage[] = [];
    for (let i = 0; i < maxLen; i++) {
      for (const docId of docOrder) {
        const pages = byDoc.get(docId)!;
        if (pages[i]) result.push(clone(pages[i]));
      }
    }
    const extras = queue.filter((p) => p.kind !== "page");
    return [...result, ...extras.map(clone)];
  }

  return buildQueueFromDocuments(docs);
}

export async function parsePdf(file: File, password?: string): Promise<PdfDocument> {
  const bytes = await file.arrayBuffer();
  const contentHash = await hashBuffer(bytes);

  try {
    const pdfjs = await loadPdfJs();
    const task = pdfjs.getDocument({ data: bytes.slice(0), password: password ?? "" });
    await task.promise;
  } catch (e: unknown) {
    const name = e && typeof e === "object" && "name" in e ? String((e as { name: string }).name) : "";
    const msg = e instanceof Error ? e.message : String(e);
    if (name === "PasswordException" || /password/i.test(msg)) {
      if (!password) throw new PdfEncryptedError(file.name);
      throw new Error("Incorrect PDF password");
    }
  }

  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    return {
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      pageCount: pdf.getPageCount(),
      bytes,
      contentHash,
      encrypted: !!password,
    };
  } catch (e) {
    throw e instanceof Error ? e : new Error("Failed to read PDF");
  }
}

let pdfjsReady: Promise<typeof import("pdfjs-dist")> | null = null;

export function loadPdfJs() {
  if (!pdfjsReady) {
    pdfjsReady = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return pdfjsReady;
}

export async function renderThumb(bytes: ArrayBuffer, pageIndex: number, scale = 0.22): Promise<string> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  const page = await doc.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  await page.render({ canvasContext: ctx, viewport }).promise;
  doc.destroy();
  return canvas.toDataURL("image/jpeg", 0.72);
}

function stampPageDecorations(
  page: PDFPage,
  index: number,
  total: number,
  options: { pageNumbers: boolean; watermark: string },
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

  if (!options.pageNumbers) return;

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

export async function buildMergedPdf(
  pages: QueuePage[],
  docMap: Map<string, PdfDocument>,
  options: MergeOutputOptions,
  onProgress?: (pct: number) => void,
): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  if (options.title.trim()) merged.setTitle(options.title.trim());
  if (options.author.trim()) merged.setAuthor(options.author.trim());
  if (options.subject.trim()) merged.setSubject(options.subject.trim());
  if (options.keywords.length) merged.setKeywords(options.keywords.filter(Boolean));
  merged.setProducer("ToolNest.io PDF Merge Ultra");
  merged.setCreator("ToolNest.io");

  const pdfCache = new Map<string, PDFDocument>();
  const font = options.pageNumbers || options.watermark.trim()
    ? await merged.embedFont(StandardFonts.Helvetica)
    : null;

  const included = pages.filter((p) => p.included);

  for (let i = 0; i < included.length; i++) {
    const item = included[i];
    onProgress?.(Math.round(((i + 1) / included.length) * 100));

    if (item.kind === "blank") {
      merged.addPage([595.28, 841.89]);
      continue;
    }

    if (item.kind === "cover" && item.coverBytes) {
      const page = merged.addPage([595.28, 841.89]);
      const img =
        item.coverType === "png"
          ? await merged.embedPng(item.coverBytes)
          : await merged.embedJpg(item.coverBytes);
      const margin = 36;
      const maxW = page.getWidth() - margin * 2;
      const maxH = page.getHeight() - margin * 2;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, {
        x: (page.getWidth() - w) / 2,
        y: (page.getHeight() - h) / 2,
        width: w,
        height: h,
      });
      continue;
    }

    const doc = docMap.get(item.sourceId!);
    if (!doc || item.pageIndex === undefined) continue;

    let pdf = pdfCache.get(doc.id);
    if (!pdf) {
      pdf = await PDFDocument.load(doc.bytes);
      pdfCache.set(doc.id, pdf);
    }

    if (options.fitToA4) {
      const srcPage = pdf.getPages()[item.pageIndex];
      if (!srcPage) continue;
      const embedded = await merged.embedPage(srcPage);
      const newPage = merged.addPage(A4_SIZE);
      let w = embedded.width;
      let h = embedded.height;
      if (item.rotation === 90 || item.rotation === 270) [w, h] = [h, w];
      const scale = Math.min((A4_SIZE[0] - PAGE_MARGIN * 2) / w, (A4_SIZE[1] - PAGE_MARGIN * 2) / h);
      const dw = w * scale;
      const dh = h * scale;
      newPage.drawPage(embedded, {
        x: (A4_SIZE[0] - dw) / 2,
        y: (A4_SIZE[1] - dh) / 2,
        width: dw,
        height: dh,
        rotate: degrees(item.rotation),
      });
    } else {
      const [page] = await merged.copyPages(pdf, [item.pageIndex]);
      if (item.rotation) page.setRotation(degrees(item.rotation));
      merged.addPage(page);
    }
  }

  if (font && (options.pageNumbers || options.watermark.trim())) {
    const outPages = merged.getPages();
    outPages.forEach((page, idx) => {
      stampPageDecorations(page, idx, outPages.length, options, font);
    });
  }

  onProgress?.(100);

  const saveOpts = {
    useObjectStreams: options.compress,
    ...(options.password.trim()
      ? { userPassword: options.password.trim(), ownerPassword: options.password.trim() }
      : {}),
  } as Parameters<PDFDocument["save"]>[0];

  return merged.save(saveOpts);
}

export { sanitizeFilename } from "@/lib/utils";

/** Server/API merge — bytes-based documents (no File objects). */
export interface ApiMergeFile {
  name: string;
  bytes: Uint8Array;
}

export interface ApiMergePageRef {
  fileIndex: number;
  pageIndex: number;
  rotation?: Rotation;
  included?: boolean;
}

export async function mergePdfFromApi(
  files: ApiMergeFile[],
  pageRefs: ApiMergePageRef[] | null,
  options: MergeOutputOptions,
): Promise<Uint8Array> {
  const docs: PdfDocument[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const bytes = new Uint8Array(f.bytes);
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const pdf = await PDFDocument.load(bytes);
    docs.push({
      id: `api-${i}`,
      file: new File([bytes], f.name, { type: "application/pdf" }),
      name: f.name,
      size: bytes.byteLength,
      pageCount: pdf.getPageCount(),
      bytes: buf,
      contentHash: await hashBuffer(buf),
    });
  }

  const docMap = new Map(docs.map((d) => [d.id, d]));
  let queue: QueuePage[];

  if (pageRefs?.length) {
    queue = pageRefs.map((ref) => ({
      id: crypto.randomUUID(),
      included: ref.included !== false,
      kind: "page" as const,
      sourceId: `api-${ref.fileIndex}`,
      pageIndex: ref.pageIndex,
      rotation: (ref.rotation ?? 0) as Rotation,
      fileName: files[ref.fileIndex]?.name,
    }));
  } else {
    queue = buildQueueFromDocuments(docs);
  }

  return buildMergedPdf(queue.filter((p) => p.included), docMap, options);
}
