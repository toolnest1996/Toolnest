import { NextResponse } from "next/server";
import {
  DEFAULT_EXCEL_TO_PDF,
  convertExcelToPdf,
  detectExcelFormat,
  type ExcelToPdfSettings,
} from "@/components/tools/excel-to-pdf-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

interface RequestBody {
  document?: string;
  filename?: string;
  options?: Partial<ExcelToPdfSettings>;
}

function decodeDocument(input: string): Buffer {
  if (!input) throw new Error("document (base64 or data URI) required");
  const dataUri = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (dataUri) return Buffer.from(dataUri[2], "base64");
  return Buffer.from(input, "base64");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.document) {
      return NextResponse.json({ ok: false, error: "document (base64) required" }, { status: 400 });
    }
    const bytes = decodeDocument(body.document);
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: `Document exceeds ${MAX_BYTES / 1024 / 1024} MB limit` }, { status: 413 });
    }

    const options: ExcelToPdfSettings = { ...DEFAULT_EXCEL_TO_PDF, ...(body.options ?? {}) };
    const filename = body.filename ?? "spreadsheet.xlsx";
    const format = detectExcelFormat(filename);
    if (format === "xls") {
      return NextResponse.json({ ok: false, error: "Legacy .xls not supported — use .xlsx" }, { status: 422 });
    }

    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const result = await convertExcelToPdf(arrayBuffer, filename, options);

    return NextResponse.json({
      ok: true,
      output: `data:application/pdf;base64,${Buffer.from(await result.blob.arrayBuffer()).toString("base64")}`,
      stats: {
        originalBytes: bytes.byteLength,
        convertedBytes: result.bytes,
        pageCount: result.pageCount,
        sheetCount: result.sheetCount,
        rowCount: result.rowCount,
        format,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Conversion failed" },
      { status: 422 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/pdf/excel-to-pdf",
    methods: ["POST"],
    limits: { maxBytes: MAX_BYTES },
    supportedFormats: ["xlsx", "csv"],
    body: {
      document: "base64 string or data URI",
      filename: "original filename for format detection",
      options: "pageSize, orientation, margin, fontSize, showGrid, fitWidth, headerRows, sheetSelection, pickedSheetIndexes",
    },
    note: "Legacy .xls (binary Excel) is not supported — convert to .xlsx first.",
  });
}
