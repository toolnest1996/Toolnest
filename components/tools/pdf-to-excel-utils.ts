/**
 * Ultra PDF → Excel Converter — table detection, OCR, XLSX/CSV/ODS/XLS builders.
 * 100% client-side using pdfjs-dist + exceljs + jszip. OCR via Tesseract.js
 * (lazy-loaded from CDN).
 */

import { parsePageRange } from "./pdf-merge-utils";

export type OutputFormat = "xlsx" | "csv" | "ods" | "xls";
export type OcrMode = "auto" | "always" | "scanned-only" | "never";
export type TableMode = "auto" | "grid" | "lines";

export interface ConvertOptions {
  pageRanges: string;
  password: string;
  ocrMode: OcrMode;
  ocrLanguage: string;
  tableMode: TableMode;
  outputFormat: OutputFormat;
  oneSheetPerPage: boolean;
  detectMergedCells: boolean;
  trimWhitespace: boolean;
  cleanData: boolean;
  detectHeaders: boolean;
  numberFormat: boolean;
  csvDelimiter: "," | ";" | "\t" | "|";
  includeHeaders: boolean;
  includeFooters: boolean;
}

export interface TableCell {
  text: string;
  rowSpan: number;
  colSpan: number;
  isHeader: boolean;
  isNumber: boolean;
  isFormula: boolean;
}

export interface DetectedTable {
  /** 2D matrix [row][col] of cells */
  rows: TableCell[][];
  rowCount: number;
  colCount: number;
  page: number;
  /** Source bbox of the table region on the page (PDF coords) */
  bbox: { x0: number; y0: number; x1: number; y1: number };
  /** OCR confidence if extracted via OCR */
  ocrConfidence: number | null;
}

export interface PageContent {
  pageNumber: number;
  tables: DetectedTable[];
  /** Raw text fallback when no tabular structure is found */
  rawText: string;
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
  sheetCount: number;
  rowCount: number;
  cellCount: number;
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
  status: "queued" | "converting" | "done" | "error";
  result: ConvertResult | null;
  error?: string;
  pages: PageContent[];
  thumbUrl: string;
}

export const DEFAULT_CONVERT_OPTIONS: ConvertOptions = {
  pageRanges: "",
  password: "",
  ocrMode: "scanned-only",
  ocrLanguage: "eng",
  tableMode: "auto",
  outputFormat: "xlsx",
  oneSheetPerPage: false,
  detectMergedCells: true,
  trimWhitespace: true,
  cleanData: true,
  detectHeaders: true,
  numberFormat: true,
  csvDelimiter: ",",
  includeHeaders: true,
  includeFooters: true,
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
 * pdfjs loader
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
 * OCR — tesseract.js lazy-loaded from CDN
 * ──────────────────────────────────────────────────────────────────────────── */

interface TesseractWord { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number }
interface TesseractLine { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; words?: TesseractWord[]; confidence: number }
interface TesseractResultData {
  text: string;
  confidence: number;
  lines?: TesseractLine[];
  words?: TesseractWord[];
}
interface TesseractResult { data: TesseractResultData }
interface TesseractStatic {
  recognize: (image: HTMLCanvasElement | string, langs: string, opts?: unknown) => Promise<TesseractResult>;
}

let _tesseractPromise: Promise<TesseractStatic> | null = null;

function loadTesseract(): Promise<TesseractStatic> {
  if (_tesseractPromise) return _tesseractPromise;
  _tesseractPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById("toolnest-tesseract-script-xls") as HTMLScriptElement | null;
    const onload = () => {
      const T = (window as unknown as { Tesseract?: TesseractStatic }).Tesseract;
      if (T) resolve(T);
      else reject(new Error("Tesseract failed to initialise"));
    };
    if (existing) { existing.addEventListener("load", onload); return; }
    const script = document.createElement("script");
    script.id = "toolnest-tesseract-script-xls";
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    script.async = true;
    script.onload = onload;
    script.onerror = () => reject(new Error("Could not load OCR engine from CDN"));
    document.head.appendChild(script);
  });
  return _tesseractPromise;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Table detection — cluster text items into rows & columns
 * ──────────────────────────────────────────────────────────────────────────── */

export interface TextItemLite {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  fontName: string;
}

interface Column {
  x0: number;
  x1: number;
  index: number;
}

/** Cluster X positions into column boundaries by gap detection. */
function detectColumns(items: TextItemLite[], pageWidth: number): Column[] {
  if (!items.length) return [];
  // Collect item start-X positions
  const xs = items.map((i) => i.x).sort((a, b) => a - b);
  // Build column boundaries via 1D gap clustering
  const gaps: { from: number; to: number; size: number }[] = [];
  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i] - xs[i - 1];
    if (gap > 12) gaps.push({ from: xs[i - 1], to: xs[i], size: gap });
  }
  // Sort gaps by size desc and use top gaps as column separators
  gaps.sort((a, b) => b.size - a.size);
  const minCols = 1;
  const maxCols = 32;
  // Use gaps that are at least 25% of the median gap, capped by maxCols
  const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)].size : 0;
  const threshold = Math.max(12, medianGap * 0.8);
  const separators = gaps
    .filter((g) => g.size >= threshold)
    .slice(0, maxCols - 1)
    .map((g) => (g.from + g.to) / 2)
    .sort((a, b) => a - b);

  const cols: Column[] = [];
  let prev = 0;
  for (const sep of separators) {
    cols.push({ x0: prev, x1: sep, index: cols.length });
    prev = sep;
  }
  cols.push({ x0: prev, x1: pageWidth, index: cols.length });
  // Filter out empty/tiny columns
  const used = cols.filter((c) => items.some((i) => i.x >= c.x0 - 2 && i.x < c.x1 + 2));
  if (used.length < minCols) return [{ x0: 0, x1: pageWidth, index: 0 }];
  // Reindex
  return used.map((c, i) => ({ ...c, index: i }));
}

function assignToColumn(item: TextItemLite, cols: Column[]): number {
  // Use item center-X for assignment, fall back to start-X
  const cx = item.x + item.w / 2;
  for (const c of cols) {
    if (cx >= c.x0 && cx < c.x1) return c.index;
    if (item.x >= c.x0 && item.x < c.x1) return c.index;
  }
  // If straddling, pick the column with most overlap
  let best = cols[0];
  let bestOverlap = -1;
  for (const c of cols) {
    const ov = Math.min(item.x + item.w, c.x1) - Math.max(item.x, c.x0);
    if (ov > bestOverlap) { bestOverlap = ov; best = c; }
  }
  return best.index;
}

interface RowLite {
  y: number;
  items: TextItemLite[];
  rowIndex: number;
}

/** Group items into rows by Y proximity. */
function groupRows(items: TextItemLite[], pageHeight: number): RowLite[] {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => (pageHeight - a.y) - (pageHeight - b.y) || a.x - b.x);
  const yTol = 4;
  const rows: RowLite[] = [];
  let current: TextItemLite[] = [];
  let currentY = sorted[0].y;
  for (const it of sorted) {
    if (current.length && Math.abs(it.y - currentY) > yTol) {
      rows.push({ y: currentY, items: current, rowIndex: rows.length });
      current = [];
    }
    current.push(it);
    currentY = it.y;
  }
  if (current.length) rows.push({ y: currentY, items: current, rowIndex: rows.length });
  return rows;
}

function isNumeric(s: string): boolean {
  const cleaned = s.replace(/[,$%\s€£¥₹]/g, "").replace(/[()]$/, "").trim();
  if (!cleaned) return false;
  // Match integers, decimals, negative, scientific, percentages
  return /^-?\d+([.,]\d+)?([eE][-+]?\d+)?$/.test(cleaned) || /^\d{1,3}(,\d{3})*(\.\d+)?$/.test(cleaned);
}

function isFormulaLike(s: string): boolean {
  return /^=[A-Z0-9.+\-*/(), :]+$/i.test(s.trim()) && s.trim().length > 2;
}

function cleanCell(s: string, opts: ConvertOptions): string {
  let v = s;
  if (opts.trimWhitespace) v = v.replace(/\s+/g, " ").trim();
  if (opts.cleanData) {
    // Collapse repeated dashes, fix common OCR artifacts
    v = v.replace(/[|]/g, "I").replace(/^[“”"]/, "").replace(/[”"]$/, "");
  }
  return v;
}

/** Build a DetectedTable from text items on a page. */
function detectTableFromItems(
  items: TextItemLite[],
  pageWidth: number,
  pageHeight: number,
  pageNum: number,
  options: ConvertOptions,
  ocrConfidence: number | null,
): DetectedTable | null {
  if (!items.length) return null;
  const cols = detectColumns(items, pageWidth);
  // Need at least 2 columns to call it a "grid" table.
  // With < 2 columns we fall back to "lines" (one column per text line)
  // unless the user explicitly disabled lines via grid mode.
  if (cols.length < 2) {
    if (options.tableMode === "grid") return null;
    return buildLinesTable(items, pageHeight, pageNum, options, ocrConfidence);
  }
  const rows = groupRows(items, pageHeight);
  const matrix: TableCell[][] = [];
  for (const row of rows) {
    const cells: TableCell[] = new Array(cols.length).fill(null).map(() => ({ text: "", rowSpan: 1, colSpan: 1, isHeader: false, isNumber: false, isFormula: false }));
    for (const it of row.items) {
      const colIdx = assignToColumn(it, cols);
      const existing = cells[colIdx];
      const newText = cleanCell(it.str, options);
      existing.text = existing.text ? `${existing.text} ${newText}` : newText;
      existing.isNumber = isNumeric(existing.text);
      existing.isFormula = isFormulaLike(existing.text);
    }
    matrix.push(cells);
  }

  // Detect header row — typically the first row with mostly bold text
  if (options.detectHeaders && matrix.length > 1) {
    const firstRow = matrix[0];
    const boldCount = rows[0].items.filter((i) => /bold|black|heavy/i.test(i.fontName)).length;
    if (boldCount >= Math.ceil(rows[0].items.length / 2)) {
      firstRow.forEach((c) => { c.isHeader = true; });
    }
  }

  // Detect merged cells — items whose width spans multiple column boundaries
  if (options.detectMergedCells) {
    for (let r = 0; r < rows.length; r++) {
      for (const it of rows[r].items) {
        const startCol = assignToColumn({ ...it, x: it.x }, cols);
        const endCol = assignToColumn({ ...it, x: it.x + it.w - 0.1 }, cols);
        if (endCol > startCol) {
          matrix[r][startCol].colSpan = endCol - startCol + 1;
          for (let k = startCol + 1; k <= endCol; k++) {
            matrix[r][k].text = ""; // merge: empty the covered cells
          }
        }
      }
    }
  }

  const xs = items.map((i) => i.x);
  const ys = items.map((i) => i.y);
  const bbox = {
    x0: Math.min(...xs),
    y0: Math.min(...ys),
    x1: Math.max(...items.map((i) => i.x + i.w)),
    y1: Math.max(...items.map((i) => i.y + i.h)),
  };

  return {
    rows: matrix,
    rowCount: matrix.length,
    colCount: cols.length,
    page: pageNum,
    bbox,
    ocrConfidence,
  };
}

/** Fallback: one column per text line. */
function buildLinesTable(
  items: TextItemLite[],
  pageHeight: number,
  pageNum: number,
  options: ConvertOptions,
  ocrConfidence: number | null,
): DetectedTable {
  const rows = groupRows(items, pageHeight);
  const matrix: TableCell[][] = rows.map((row) => [{
    text: cleanCell(row.items.map((i) => i.str).join(" "), options),
    rowSpan: 1,
    colSpan: 1,
    isHeader: false,
    isNumber: false,
    isFormula: false,
  }]);
  return {
    rows: matrix,
    rowCount: matrix.length,
    colCount: 1,
    page: pageNum,
    bbox: { x0: 0, y0: 0, x1: 0, y1: 0 },
    ocrConfidence,
  };
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

export interface ParseProgress {
  phase: "loading" | "parsing" | "rendering" | "ocr" | "building" | "done";
  page?: number;
  totalPages?: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Core: parse PDF → per-page table content
 * ──────────────────────────────────────────────────────────────────────────── */

export async function parsePdfToTables(
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
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: TextItemLite[] = [];
    for (const raw of content.items) {
      if (!("str" in raw)) continue;
      const it = raw as { str: string; transform: number[]; width: number; height: number; fontName: string };
      if (!it.str || !it.str.trim()) continue;
      const fontSize = Math.hypot(it.transform[2], it.transform[3]) || it.height || 12;
      items.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width,
        h: it.height || fontSize,
        fontSize,
        fontName: it.fontName,
      });
    }

    onProgress({ phase: "rendering", page: i + 1, totalPages: indices.length });
    const thumbCanvas = await renderPageToCanvas(page, 72);
    if (i === 0) thumbUrl = thumbCanvas.toDataURL("image/jpeg", 0.6);

    let tables: DetectedTable[] = [];
    let ocrConfidence: number | null = null;
    let isScanned = items.length < 5;

    const shouldOcr =
      options.ocrMode === "always" ||
      (options.ocrMode === "scanned-only" && isScanned) ||
      (options.ocrMode === "auto" && items.length === 0);

    if (shouldOcr) {
      onProgress({ phase: "ocr", page: i + 1, totalPages: indices.length });
      try {
        const ocrCanvas = await renderPageToCanvas(page, 200);
        const Tesseract = await loadTesseract();
        const result = await Tesseract.recognize(ocrCanvas, options.ocrLanguage);
        if (result.data.lines && result.data.lines.length) {
          // Convert OCR lines to items for table detection
          const ocrItems: TextItemLite[] = [];
          for (const line of result.data.lines) {
            if (line.words) {
              for (const w of line.words) {
                if (!w.text || !w.text.trim()) continue;
                ocrItems.push({
                  str: w.text,
                  x: w.bbox.x0,
                  y: line.bbox.y0,
                  w: w.bbox.x1 - w.bbox.x0,
                  h: line.bbox.y1 - line.bbox.y0,
                  fontSize: line.bbox.y1 - line.bbox.y0,
                  fontName: "",
                });
              }
            } else {
              ocrItems.push({
                str: line.text,
                x: line.bbox.x0,
                y: line.bbox.y0,
                w: line.bbox.x1 - line.bbox.x0,
                h: line.bbox.y1 - line.bbox.y0,
                fontSize: line.bbox.y1 - line.bbox.y0,
                fontName: "",
              });
            }
          }
          if (ocrItems.length) {
            const t = detectTableFromItems(ocrItems, ocrCanvas.width, ocrCanvas.height, pageNum, options, Math.round(result.data.confidence));
            if (t) tables.push(t);
            ocrConfidence = Math.round(result.data.confidence);
            isScanned = true;
          }
        }
      } catch (e) {
        console.warn("OCR failed for page", pageNum, e);
      }
    } else if (items.length) {
      const t = detectTableFromItems(items, viewport.width, viewport.height, pageNum, options, null);
      if (t) tables.push(t);
    }

    const rawText = items.map((i) => i.str).join(" ");

    pages.push({
      pageNumber: pageNum,
      tables,
      rawText,
      thumbDataUrl: thumbCanvas.toDataURL("image/jpeg", 0.55),
      hasText: items.length > 0,
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
 * XLSX builder — exceljs
 * ──────────────────────────────────────────────────────────────────────────── */

function toCellValue(cell: TableCell): string | number {
  const text = cell.text;
  if (!text) return "";
  if (cell.isFormula) return text; // exceljs stores formula strings starting with "="
  if (cell.isNumber && /^-?\d+(\.\d+)?$/.test(text.replace(/[,$%]/g, ""))) {
    const n = parseFloat(text.replace(/[,$%\s]/g, "").replace(/[(]/, "-").replace(/[)]$/, ""));
    if (!Number.isNaN(n)) return n;
  }
  return text;
}

export async function buildXlsx(pages: PageContent[], options: ConvertOptions): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default ?? (await import("exceljs"));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ToolNest.io";
  workbook.created = new Date();
  workbook.modified = new Date();

  let totalRows = 0;
  let totalCells = 0;
  let sheetCount = 0;

  const addTableToSheet = (sheet: import("exceljs").Worksheet, table: DetectedTable, startRow: number) => {
    let r = startRow;
    for (let ri = 0; ri < table.rows.length; ri++) {
      const row = sheet.getRow(r);
      for (let ci = 0; ci < table.rows[ri].length; ci++) {
        const cell = table.rows[ri][ci];
        if (cell.colSpan > 1 || cell.rowSpan > 1) {
          // Merge the cells — exceljs uses top-left anchor
          const start = { row: r, col: ci + 1 };
          const end = { row: r + cell.rowSpan - 1, col: ci + cell.colSpan };
          try {
            sheet.mergeCells(start.row, start.col, end.row, end.col);
          } catch { /* overlap — ignore */ }
        }
        const excelCell = row.getCell(ci + 1);
        const value = toCellValue(cell);
        excelCell.value = value;
        if (cell.isHeader) {
          excelCell.font = { bold: true };
          excelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF7" } };
        }
        if (cell.isNumber && typeof value === "number") {
          excelCell.numFmt = "#,##0.00";
        }
        excelCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
        totalCells++;
      }
      r++;
      totalRows++;
    }
    // Auto-width heuristic — first 80 cols
    for (let ci = 0; ci < 40; ci++) {
      let maxLen = 10;
      for (let ri = 0; ri < table.rows.length; ri++) {
        const cell = table.rows[ri][ci];
        if (cell && cell.text) maxLen = Math.max(maxLen, cell.text.length + 2);
      }
      sheet.getColumn(ci + 1).width = Math.min(60, maxLen);
    }
    return r;
  };

  if (options.oneSheetPerPage) {
    for (const page of pages) {
      const sheet = workbook.addWorksheet(`Page ${page.pageNumber}`);
      sheetCount++;
      let r = 1;
      for (const table of page.tables) {
        r = addTableToSheet(sheet, table, r);
        r += 1; // blank row between tables
      }
      if (page.tables.length === 0 && page.rawText) {
        sheet.getCell(r, 1).value = page.rawText;
      }
    }
  } else {
    const sheet = workbook.addWorksheet("Tables");
    sheetCount = 1;
    let r = 1;
    for (const page of pages) {
      for (const table of page.tables) {
        r = addTableToSheet(sheet, table, r);
        r += 2; // separator between tables/pages
      }
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  void totalRows; void totalCells;
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ────────────────────────────────────────────────────────────────────────────
 * CSV builder — RFC 4180 compliant
 * ──────────────────────────────────────────────────────────────────────────── */

function csvEscape(s: string, delimiter: string): string {
  if (s == null) return "";
  const needsQuote = /[",\n\r]/.test(s) || s.includes(delimiter);
  const escaped = s.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export async function buildCsv(pages: PageContent[], options: ConvertOptions): Promise<Blob> {
  const delim = options.csvDelimiter;
  const lines: string[] = [];
  for (const page of pages) {
    for (const table of page.tables) {
      for (const row of table.rows) {
        // Skip merged-cell duplicates — only emit the cell text once per merge
        const cells = row.map((c) => c.text).join(delim);
        lines.push(cells);
      }
      lines.push(""); // blank line between tables
    }
    if (page.tables.length === 0 && page.rawText) {
      lines.push(csvEscape(page.rawText, delim));
    }
  }
  // Prepend BOM for Excel compatibility with UTF-8
  const bom = "\uFEFF";
  const text = bom + lines.join("\r\n");
  return new Blob([text], { type: "text/csv;charset=utf-8" });
}

/* ────────────────────────────────────────────────────────────────────────────
 * XLS builder — HTML table saved as .xls (Excel opens natively)
 * ──────────────────────────────────────────────────────────────────────────── */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function buildXls(pages: PageContent[], _options: ConvertOptions): Promise<Blob> {
  const body: string[] = [];
  for (const page of pages) {
    for (const table of page.tables) {
      body.push("<table border=1 cellspacing=0 cellpadding=3>");
      for (const row of table.rows) {
        body.push("<tr>");
        for (const cell of row) {
          const tag = cell.isHeader ? "th" : "td";
          const align = cell.isNumber ? "right" : "left";
          const span = cell.colSpan > 1 ? ` colspan=${cell.colSpan}` : "";
          const rspan = cell.rowSpan > 1 ? ` rowspan=${cell.rowSpan}` : "";
          body.push(`<${tag}${span}${rspan} align=${align} style="font-family:Calibri;font-size:11pt">${escapeHtml(cell.text)}</${tag}>`);
        }
        body.push("</tr>");
      }
      body.push("</table><br>");
    }
  }
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>Converted by ToolNest</title>
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Tables</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head><body>${body.join("\n")}</body></html>`;
  return new Blob([html], { type: "application/vnd.ms-excel" });
}

/* ────────────────────────────────────────────────────────────────────────────
 * ODS builder — OpenDocument Spreadsheet via jszip
 * ──────────────────────────────────────────────────────────────────────────── */

function odsEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function odsCellXml(cell: TableCell): string {
  if (!cell.text) return '<table:table-cell/>';
  if (cell.isNumber && /^-?\d+(\.\d+)?$/.test(cell.text.replace(/[,$%]/g, ""))) {
    const n = parseFloat(cell.text.replace(/[,$%\s]/g, "").replace(/[(]/, "-").replace(/[)]$/, ""));
    if (!Number.isNaN(n)) {
      return `<table:table-cell office:value-type="float" office:value="${n}"><text:p>${n}</text:p></table:table-cell>`;
    }
  }
  const colSpan = cell.colSpan > 1 ? ` table:number-columns-repeated="${cell.colSpan}"` : "";
  return `<table:table-cell office:value-type="string"${colSpan}><text:p>${odsEscape(cell.text)}</text:p></table:table-cell>`;
}

export async function buildOds(pages: PageContent[], options: ConvertOptions): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  // mimetype — must be the first file and stored uncompressed
  zip.file("mimetype", "application/vnd.oasis.opendocument.spreadsheet", { compression: "STORE" });

  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.spreadsheet" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
</manifest:manifest>`;
  zip.file("META-INF/manifest.xml", manifest);

  const sheets: string[] = [];
  if (options.oneSheetPerPage) {
    for (const page of pages) {
      const maxCols = Math.max(1, ...page.tables.map((t) => t.colCount));
      let body = `<table:table table:name="${odsEscape("Page " + page.pageNumber)}">`;
      body += `<table:table-column table:number-columns-repeated="${maxCols}"/>`;
      for (const table of page.tables) {
        for (const row of table.rows) {
          body += "<table:table-row>";
          for (const cell of row) body += odsCellXml(cell);
          body += "</table:table-row>";
        }
      }
      body += "</table:table>";
      sheets.push(body);
    }
  } else {
    const maxCols = Math.max(1, ...pages.flatMap((p) => p.tables.map((t) => t.colCount)));
    let body = `<table:table table:name="Tables"><table:table-column table:number-columns-repeated="${maxCols}"/>`;
    for (const page of pages) {
      for (const table of page.tables) {
        for (const row of table.rows) {
          body += "<table:table-row>";
          for (const cell of row) body += odsCellXml(cell);
          body += "</table:table-row>";
        }
        // Blank separator row
        body += '<table:table-row><table:table-cell/></table:table-row>';
      }
    }
    body += "</table:table>";
    sheets.push(body);
  }

  const content = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  office:version="1.2">
  <office:body><office:spreadsheet>${sheets.join("")}</office:spreadsheet></office:body>
</office:document-content>`;
  zip.file("content.xml", content);

  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.oasis.opendocument.spreadsheet", compression: "DEFLATE" });
  return blob;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Convert orchestrator
 * ──────────────────────────────────────────────────────────────────────────── */

export async function convertPdfToExcel(
  file: File,
  options: ConvertOptions,
  onProgress: (p: ParseProgress) => void,
): Promise<ConvertResult> {
  const start = performance.now();
  const { pages, pageCount } = await parsePdfToTables(file, options, onProgress);

  onProgress({ phase: "building" });
  let blob: Blob;
  switch (options.outputFormat) {
    case "xlsx": blob = await buildXlsx(pages, options); break;
    case "csv": blob = await buildCsv(pages, options); break;
    case "xls": blob = await buildXls(pages, options); break;
    case "ods": blob = await buildOds(pages, options); break;
    default: blob = await buildXlsx(pages, options);
  }

  const rowCount = pages.reduce((s, p) => s + p.tables.reduce((ss, t) => ss + t.rowCount, 0), 0);
  const cellCount = pages.reduce((s, p) => s + p.tables.reduce((ss, t) => ss + t.rowCount * t.colCount, 0), 0);
  const sheetCount = options.oneSheetPerPage ? pages.length : 1;
  const ocrPages = pages.filter((p) => p.isScanned && p.ocrConfidence !== null).length;
  const previewUrl = URL.createObjectURL(blob);

  return {
    blob,
    bytes: blob.size,
    format: options.outputFormat,
    pageCount,
    sheetCount,
    rowCount,
    cellCount,
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
      const result = await convertPdfToExcel(item.file, options, (p) => onProgress(item, p));
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

export function buildOutputName(originalName: string, format: OutputFormat): string {
  const stem = originalName.replace(/\.pdf$/i, "") || "spreadsheet";
  return `${stem}.${format}`;
}

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

/** Find duplicate rows across all detected tables (data cleanup assist). */
export function findDuplicateRows(pages: PageContent[]): { page: number; rowIndex: number; text: string }[] {
  const seen = new Map<string, { page: number; rowIndex: number }>();
  const dupes: { page: number; rowIndex: number; text: string }[] = [];
  for (const page of pages) {
    for (const table of page.tables) {
      for (let i = 0; i < table.rows.length; i++) {
        const key = table.rows[i].map((c) => c.text.trim()).join("|").trim();
        if (!key) continue;
        if (seen.has(key)) {
          dupes.push({ page: page.pageNumber, rowIndex: i, text: key });
        } else {
          seen.set(key, { page: page.pageNumber, rowIndex: i });
        }
      }
    }
  }
  return dupes;
}
