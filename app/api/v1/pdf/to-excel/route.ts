import { NextResponse } from "next/server";
import { createRequire } from "module";
import { Worker } from "worker_threads";
import {
  DEFAULT_CONVERT_OPTIONS,
  buildCsv,
  buildOds,
  buildXls,
  buildXlsx,
  type ConvertOptions,
  type OutputFormat,
  type PageContent,
  type TableCell,
  type TextItemLite,
  type DetectedTable,
} from "@/components/tools/pdf-to-excel-utils";
import { parsePageRange } from "@/components/tools/pdf-merge-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 50 * 1024 * 1024;
const require = createRequire(import.meta.url);

let _pdfjsReady: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

async function loadServerPdfJs(): Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> {
  if (!_pdfjsReady) {
    _pdfjsReady = (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
      (pdfjs.GlobalWorkerOptions as { workerPort: unknown }).workerPort = new Worker(workerPath);
      return pdfjs;
    })();
  }
  return _pdfjsReady;
}

interface RequestBody {
  pdf?: string;
  options?: Partial<ConvertOptions>;
}

function decodePdf(input: string): { bytes: Buffer } {
  if (!input) throw new Error("pdf (base64 or data URI) required");
  const dataUri = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (dataUri) return { bytes: Buffer.from(dataUri[2], "base64") };
  return { bytes: Buffer.from(input, "base64") };
}

// Mirror of the client-side table detector, kept lightweight for the server.
function detectColumns(items: TextItemLite[], pageWidth: number): { x0: number; x1: number; index: number }[] {
  if (!items.length) return [{ x0: 0, x1: pageWidth, index: 0 }];
  const xs = items.map((i) => i.x).sort((a, b) => a - b);
  const gaps: { from: number; to: number; size: number }[] = [];
  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i] - xs[i - 1];
    if (gap > 12) gaps.push({ from: xs[i - 1], to: xs[i], size: gap });
  }
  gaps.sort((a, b) => b.size - a.size);
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)].size : 0;
  const threshold = Math.max(12, medianGap * 0.8);
  const seps = gaps.filter((g) => g.size >= threshold).slice(0, 31).map((g) => (g.from + g.to) / 2).sort((a, b) => a - b);
  const cols: { x0: number; x1: number; index: number }[] = [];
  let prev = 0;
  for (const s of seps) { cols.push({ x0: prev, x1: s, index: cols.length }); prev = s; }
  cols.push({ x0: prev, x1: pageWidth, index: cols.length });
  const used = cols.filter((c) => items.some((i) => i.x >= c.x0 - 2 && i.x < c.x1 + 2));
  return used.length ? used.map((c, i) => ({ ...c, index: i })) : [{ x0: 0, x1: pageWidth, index: 0 }];
}

function assignCol(item: TextItemLite, cols: { x0: number; x1: number }[]): number {
  const cx = item.x + item.w / 2;
  for (let i = 0; i < cols.length; i++) {
    if (cx >= cols[i].x0 && cx < cols[i].x1) return i;
  }
  let best = 0; let bestOv = -1;
  for (let i = 0; i < cols.length; i++) {
    const ov = Math.min(item.x + item.w, cols[i].x1) - Math.max(item.x, cols[i].x0);
    if (ov > bestOv) { bestOv = ov; best = i; }
  }
  return best;
}

function groupRows(items: TextItemLite[], pageHeight: number): { y: number; items: TextItemLite[] }[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => (pageHeight - a.y) - (pageHeight - b.y) || a.x - b.x);
  const rows: { y: number; items: TextItemLite[] }[] = [];
  let cur: TextItemLite[] = [];
  let curY = sorted[0].y;
  for (const it of sorted) {
    if (cur.length && Math.abs(it.y - curY) > 4) {
      rows.push({ y: curY, items: cur });
      cur = [];
    }
    cur.push(it);
    curY = it.y;
  }
  if (cur.length) rows.push({ y: curY, items: cur });
  return rows;
}

function isNumeric(s: string): boolean {
  const c = s.replace(/[,$%\s€£¥₹]/g, "").replace(/[()]$/, "").trim();
  if (!c) return false;
  return /^-?\d+([.,]\d+)?([eE][-+]?\d+)?$/.test(c) || /^\d{1,3}(,\d{3})*(\.\d+)?$/.test(c);
}

function isFormula(s: string): boolean {
  return /^=[A-Z0-9.+\-*/(), :]+$/i.test(s.trim()) && s.trim().length > 2;
}

function buildTable(
  items: TextItemLite[],
  pageWidth: number,
  pageHeight: number,
  pageNum: number,
  options: ConvertOptions,
): DetectedTable | null {
  if (!items.length) return null;
  const cols = detectColumns(items, pageWidth);
  if (cols.length < 2 && options.tableMode !== "lines") return null;
  const rows = groupRows(items, pageHeight);
  const matrix: TableCell[][] = [];
  for (const row of rows) {
    const cells: TableCell[] = new Array(cols.length).fill(null).map(() => ({ text: "", rowSpan: 1, colSpan: 1, isHeader: false, isNumber: false, isFormula: false }));
    for (const it of row.items) {
      const idx = assignCol(it, cols);
      const text = options.trimWhitespace ? it.str.replace(/\s+/g, " ").trim() : it.str;
      cells[idx].text = cells[idx].text ? `${cells[idx].text} ${text}` : text;
      cells[idx].isNumber = isNumeric(cells[idx].text);
      cells[idx].isFormula = isFormula(cells[idx].text);
    }
    matrix.push(cells);
  }
  if (options.detectHeaders && matrix.length > 1) {
    const boldCount = rows[0].items.filter((i) => /bold|black|heavy/i.test(i.fontName)).length;
    if (boldCount >= Math.ceil(rows[0].items.length / 2)) {
      matrix[0].forEach((c) => { c.isHeader = true; });
    }
  }
  return {
    rows: matrix,
    rowCount: matrix.length,
    colCount: cols.length,
    page: pageNum,
    bbox: { x0: 0, y0: 0, x1: pageWidth, y1: pageHeight },
    ocrConfidence: null,
  };
}

async function extractPages(bytes: Buffer, options: ConvertOptions): Promise<{ pages: PageContent[]; pageCount: number }> {
  const pdfjs = await loadServerPdfJs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    password: options.password || undefined,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;
  const pageCount = doc.numPages;
  const indices = parsePageRange(options.pageRanges, pageCount);
  const pages: PageContent[] = [];
  for (const pageIndex of indices) {
    const pageNum = pageIndex + 1;
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: TextItemLite[] = [];
    for (const raw of content.items) {
      if (!("str" in raw)) continue;
      const it = raw as { str: string; transform: number[]; width: number; height: number; fontName: string };
      if (!it.str || !it.str.trim()) continue;
      const fontSize = Math.hypot(it.transform[2], it.transform[3]) || it.height || 12;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || fontSize, fontSize, fontName: it.fontName });
    }
    const tables: DetectedTable[] = [];
    if (items.length) {
      const t = buildTable(items, viewport.width, viewport.height, pageNum, options);
      if (t) tables.push(t);
    }
    pages.push({
      pageNumber: pageNum,
      tables,
      rawText: items.map((i) => i.str).join(" "),
      thumbDataUrl: "",
      hasText: items.length > 0,
      isScanned: items.length < 5,
      ocrConfidence: null,
    });
    page.cleanup();
  }
  doc.destroy();
  return { pages, pageCount };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.pdf) {
      return NextResponse.json({ ok: false, error: "pdf (base64) required" }, { status: 400 });
    }
    const { bytes } = decodePdf(body.pdf);
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: `PDF exceeds ${MAX_BYTES / 1024 / 1024} MB limit` }, { status: 413 });
    }
    const options: ConvertOptions = { ...DEFAULT_CONVERT_OPTIONS, ...(body.options ?? {}) };

    const { pages, pageCount } = await extractPages(bytes, options);

    let blob: Blob;
    switch (options.outputFormat) {
      case "xlsx": blob = await buildXlsx(pages, options); break;
      case "csv": blob = await buildCsv(pages, options); break;
      case "xls": blob = await buildXls(pages, options); break;
      case "ods": blob = await buildOds(pages, options); break;
      default: blob = await buildXlsx(pages, options);
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    const rowCount = pages.reduce((s, p) => s + p.tables.reduce((ss, t) => ss + t.rowCount, 0), 0);
    const cellCount = pages.reduce((s, p) => s + p.tables.reduce((ss, t) => ss + t.rowCount * t.colCount, 0), 0);
    const sheetCount = options.oneSheetPerPage ? pages.length : 1;
    const ocrPages = pages.filter((p) => p.isScanned && p.ocrConfidence !== null).length;
    const mime =
      options.outputFormat === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : options.outputFormat === "csv" ? "text/csv;charset=utf-8"
      : options.outputFormat === "xls" ? "application/vnd.ms-excel"
      : "application/vnd.oasis.opendocument.spreadsheet";

    return NextResponse.json({
      ok: true,
      output: `data:${mime};base64,${buf.toString("base64")}`,
      stats: {
        originalBytes: bytes.byteLength,
        convertedBytes: buf.byteLength,
        pageCount,
        sheetCount,
        rowCount,
        cellCount,
        ocrPages,
        format: options.outputFormat as OutputFormat,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Conversion failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/pdf/to-excel",
    methods: ["POST"],
    limits: { maxBytes: MAX_BYTES },
    body: {
      pdf: "base64 string or data URI",
      options: "outputFormat, tableMode, pageRanges, password, ocrMode, ocrLanguage, detectMergedCells, detectHeaders, cleanData, numberFormat, oneSheetPerPage, csvDelimiter, includeHeaders, includeFooters",
    },
    outputFormats: ["xlsx", "csv", "xls", "ods"],
    note: "Server-side OCR is not available — for scanned PDFs, use the in-browser studio with OCR enabled.",
  });
}
