/**
 * Ultra Excel to PDF Studio — exceljs + jspdf, sheets, layout, batch.
 * 100% client-side; optional REST API mirrors the same pipeline server-side.
 */

import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { sanitizeFilename } from "./pdf-merge-utils";

export type PageSizeId = "a4" | "letter";
export type PageOrientation = "portrait" | "landscape";
export type ExcelFormat = "xlsx" | "csv" | "xls" | "unknown";

export interface ExcelToPdfSettings {
  sheetSelection: "all" | "pick";
  pickedSheetIndexes: number[];
  pageSize: PageSizeId;
  orientation: PageOrientation;
  margin: number;
  fontSize: number;
  showGrid: boolean;
  fitWidth: boolean;
  headerRows: number;
}

export const DEFAULT_EXCEL_TO_PDF: ExcelToPdfSettings = {
  sheetSelection: "all",
  pickedSheetIndexes: [0],
  pageSize: "a4",
  orientation: "portrait",
  margin: 14,
  fontSize: 8,
  showGrid: true,
  fitWidth: true,
  headerRows: 1,
};

export const ACCEPT_EXTENSIONS = ".xlsx,.xls,.csv";

export interface WorkbookProbe {
  format: ExcelFormat;
  sheetNames: string[];
  totalRows: number;
}

export interface ConvertResult {
  blob: Blob;
  bytes: number;
  pageCount: number;
  sheetCount: number;
  rowCount: number;
  durationMs: number;
  previewUrl: string;
}

export interface ConvertItem {
  id: string;
  file: File;
  name: string;
  originalBytes: number;
  format: ExcelFormat;
  sheetNames: string[];
  status: "queued" | "loading" | "converting" | "done" | "error";
  result: ConvertResult | null;
  error?: string;
  previewText: string;
}

const PAGE_DIMS: Record<PageSizeId, [number, number]> = {
  a4: [210, 297],
  letter: [216, 279],
};

export function detectExcelFormat(file: File | string): ExcelFormat {
  const n = (typeof file === "string" ? file : file.name).toLowerCase();
  if (n.endsWith(".xlsx")) return "xlsx";
  if (n.endsWith(".xls")) return "xls";
  if (n.endsWith(".csv")) return "csv";
  return "unknown";
}

export function buildPdfOutputName(sourceName: string): string {
  const stem = sourceName.replace(/\.[^.]+$/, "");
  return sanitizeFilename(`${stem}.pdf`);
}

export async function buildPreviewText(file: File): Promise<string> {
  const fmt = detectExcelFormat(file);
  if (fmt === "xls") return "Legacy .xls — save as .xlsx for best results";
  if (fmt === "unknown") return "Unsupported spreadsheet format";
  try {
    const probe = await probeWorkbook(await file.arrayBuffer(), file.name);
    return `${probe.sheetNames.length} sheet(s): ${probe.sheetNames.slice(0, 4).join(", ")}${probe.sheetNames.length > 4 ? "…" : ""} · ~${probe.totalRows} rows`;
  } catch {
    return fmt.toUpperCase() + " spreadsheet";
  }
}

export function smartExcelToPdfSuggestions(
  items: ConvertItem[],
  settings: ExcelToPdfSettings,
): string[] {
  const tips: string[] = [];
  if (items.some((i) => i.format === "xls")) {
    tips.push("Legacy .xls files may fail — re-save as .xlsx in Excel for reliable conversion.");
  }
  if (items.some((i) => i.sheetNames.length > 5) && settings.sheetSelection === "all") {
    tips.push("Workbooks with many sheets produce long PDFs — pick specific sheets in Settings.");
  }
  if (!settings.fitWidth) {
    tips.push("Enable Fit to page width for wide spreadsheets to avoid clipped columns.");
  }
  if (settings.orientation === "portrait" && items.some((i) => i.sheetNames.length > 0)) {
    tips.push("Landscape orientation often fits wide tables better.");
  }
  return tips;
}

async function loadWorkbook(bytes: ArrayBuffer, fileName: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) {
    const text = new TextDecoder().decode(bytes);
    const delimiter = text.includes("\t") && !text.includes(",") ? "\t" : ",";
    const ws = wb.addWorksheet("Sheet1");
    text.split(/\r?\n/).filter((line) => line.length > 0).forEach((line) => {
      const cols = line.split(delimiter).map((c) => c.replace(/^"|"$/g, "").trim());
      ws.addRow(cols);
    });
    return wb;
  }
  if (lower.endsWith(".xls")) {
    throw new Error("Legacy .xls is not supported — save as .xlsx and retry.");
  }
  await wb.xlsx.load(bytes);
  return wb;
}

export async function probeWorkbook(bytes: ArrayBuffer, fileName: string): Promise<WorkbookProbe> {
  const format = detectExcelFormat(fileName);
  if (format === "xls") {
    return { format, sheetNames: [], totalRows: 0 };
  }
  const wb = await loadWorkbook(bytes, fileName);
  const sheetNames = wb.worksheets.map((s) => s.name);
  const totalRows = wb.worksheets.reduce((n, s) => n + (s.rowCount || 0), 0);
  return { format, sheetNames, totalRows };
}

function cellDisplay(row: unknown[] | undefined, col: number): string {
  if (!row) return "";
  const raw = row[col + 1];
  if (raw == null) return "";
  if (typeof raw === "object" && raw !== null && "text" in raw) return String((raw as { text: string }).text);
  if (raw instanceof Date) return raw.toLocaleDateString();
  return String(raw).slice(0, 120);
}

function drawHeaderRow(
  doc: jsPDF,
  row: unknown[] | undefined,
  colCount: number,
  colW: number,
  y: number,
  settings: ExcelToPdfSettings,
  m: number,
) {
  doc.setFont("helvetica", "bold");
  for (let c = 0; c < colCount; c++) {
    const x = m + c * colW;
    const text = cellDisplay(row, c);
    if (settings.showGrid) {
      doc.setDrawColor(180);
      doc.setFillColor(240, 240, 240);
      doc.rect(x, y - settings.fontSize, colW, settings.fontSize * 0.55 + 4, "FD");
    }
    doc.text(text, x + 2, y, { maxWidth: colW - 4 });
  }
  doc.setFont("helvetica", "normal");
}

function drawSheet(
  doc: jsPDF,
  sheet: ExcelJS.Worksheet,
  settings: ExcelToPdfSettings,
  isFirst: boolean,
) {
  if (!isFirst) doc.addPage();
  const [pw, ph] = PAGE_DIMS[settings.pageSize];
  const landscape = settings.orientation === "landscape";
  const pageW = landscape ? ph : pw;
  const pageH = landscape ? pw : ph;
  const m = settings.margin;
  const usableW = pageW - m * 2;

  const rows = sheet.getSheetValues().slice(1) as unknown[][];
  if (!rows.length) {
    doc.setFontSize(12);
    doc.text(`Sheet: ${sheet.name} (empty)`, m, m + 10);
    return;
  }

  const colCount = Math.max(...rows.map((r) => (Array.isArray(r) ? r.length - 1 : 0)), 1);
  const colW = settings.fitWidth ? usableW / colCount : Math.min(usableW / colCount, 35);
  const rowH = settings.fontSize * 0.55 + 4;
  let y = m + settings.fontSize;

  doc.setFontSize(settings.fontSize);
  const headerRowsData = rows.slice(0, settings.headerRows);

  rows.forEach((row, ri) => {
    if (y > pageH - m) {
      doc.addPage();
      y = m + settings.fontSize;
      if (settings.headerRows > 0) {
        headerRowsData.forEach((hr) => {
          drawHeaderRow(doc, hr, colCount, colW, y, settings, m);
          y += rowH;
        });
      }
    }
    if (!Array.isArray(row)) return;
    const isHeader = ri < settings.headerRows;
    for (let c = 0; c < colCount; c++) {
      const x = m + c * colW;
      const text = cellDisplay(row, c);
      if (settings.showGrid) {
        doc.setDrawColor(200);
        if (isHeader) {
          doc.setFillColor(240, 240, 240);
          doc.rect(x, y - settings.fontSize, colW, rowH, "FD");
        } else {
          doc.rect(x, y - settings.fontSize, colW, rowH);
        }
      }
      if (isHeader) doc.setFont("helvetica", "bold");
      else doc.setFont("helvetica", "normal");
      doc.text(text, x + 2, y, { maxWidth: colW - 4 });
    }
    y += rowH;
  });
}

export async function convertExcelToPdf(
  bytes: ArrayBuffer,
  fileName: string,
  settings: ExcelToPdfSettings,
  onProgress?: (pct: number) => void,
): Promise<ConvertResult> {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  onProgress?.(10);
  const wb = await loadWorkbook(bytes, fileName);
  onProgress?.(30);

  let sheets: ExcelJS.Worksheet[];
  if (settings.sheetSelection === "all") {
    sheets = wb.worksheets;
  } else {
    const picks = settings.pickedSheetIndexes.length ? settings.pickedSheetIndexes : [0];
    sheets = picks.map((i) => wb.worksheets[i]).filter(Boolean) as ExcelJS.Worksheet[];
    if (!sheets.length) sheets = [wb.worksheets[0]!];
  }

  const doc = new jsPDF({
    orientation: settings.orientation,
    unit: "mm",
    format: settings.pageSize,
  });

  sheets.forEach((sheet, i) => {
    drawSheet(doc, sheet, settings, i === 0);
    onProgress?.(30 + Math.round(((i + 1) / sheets.length) * 60));
  });

  doc.setProperties({ title: fileName.replace(/\.[^.]+$/, ""), creator: "ToolNest.io" });
  const ab = doc.output("arraybuffer");
  const blob = new Blob([ab], { type: "application/pdf" });
  const rowCount = sheets.reduce((n, s) => n + (s.rowCount || 0), 0);
  onProgress?.(100);

  return {
    blob,
    bytes: ab.byteLength,
    pageCount: doc.getNumberOfPages(),
    sheetCount: sheets.length,
    rowCount,
    durationMs: Math.round(typeof performance !== "undefined" ? performance.now() - t0 : 0),
    previewUrl: typeof URL !== "undefined" && "createObjectURL" in URL ? URL.createObjectURL(blob) : "",
  };
}

export async function convertExcelBatch(
  files: File[],
  settings: ExcelToPdfSettings,
  onProgress?: (idx: number, total: number) => void,
): Promise<ConvertResult[]> {
  const results: ConvertResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    onProgress?.(i, files.length);
    results.push(await convertExcelToPdf(await f.arrayBuffer(), f.name, settings));
  }
  onProgress?.(files.length, files.length);
  return results;
}

export async function executeBatchExcelToPdf(
  sources: { name: string; bytes: ArrayBuffer }[],
  settings: ExcelToPdfSettings,
  onProgress?: (pct: number) => void,
): Promise<{ name: string; data: Uint8Array }[]> {
  const out: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]!;
    const result = await convertExcelToPdf(src.bytes, src.name, settings);
    out.push({ name: buildPdfOutputName(src.name), data: new Uint8Array(await result.blob.arrayBuffer()) });
    onProgress?.(Math.round(((i + 1) / sources.length) * 100));
  }
  return out;
}

export async function zipPdfOutputs(files: { name: string; data: Uint8Array }[] | { name: string; blob: Blob }[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const f of files) {
    const name = f.name.endsWith(".pdf") ? f.name : `${f.name}.pdf`;
    if ("blob" in f) zip.file(name, f.blob);
    else zip.file(name, f.data);
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
