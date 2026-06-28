import { NextResponse } from "next/server";
import {
  DEFAULT_WORD_TO_PDF_OPTIONS,
  detectWordFormat,
  parseWordDocument,
  renderDocumentToPdf,
  type WordFormat,
  type WordToPdfOptions,
} from "@/components/tools/word-to-pdf-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

interface RequestBody {
  document?: string;
  filename?: string;
  options?: Partial<WordToPdfOptions>;
}

function decodeDocument(input: string): Buffer {
  if (!input) throw new Error("document (base64 or data URI) required");
  const dataUri = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (dataUri) return Buffer.from(dataUri[2], "base64");
  return Buffer.from(input, "base64");
}

function formatFromFilename(name: string): WordFormat {
  const n = name.toLowerCase();
  if (n.endsWith(".docx")) return "docx";
  if (n.endsWith(".doc")) return "doc";
  if (n.endsWith(".odt")) return "odt";
  if (n.endsWith(".rtf")) return "rtf";
  if (n.endsWith(".txt")) return "txt";
  return "unknown";
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

    const options: WordToPdfOptions = { ...DEFAULT_WORD_TO_PDF_OPTIONS, ...(body.options ?? {}) };
    const filename = body.filename ?? "document.docx";
    const format =
      formatFromFilename(filename) !== "unknown"
        ? formatFromFilename(filename)
        : detectWordFormat(new File([new Uint8Array(bytes)], filename));

    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const parsed = await parseWordDocument(arrayBuffer, format, options.fontSize);

    const pdfBytes = await renderDocumentToPdf(parsed, { ...options, title: options.title || parsed.title });

    return NextResponse.json({
      ok: true,
      output: `data:application/pdf;base64,${Buffer.from(pdfBytes).toString("base64")}`,
      stats: {
        originalBytes: bytes.byteLength,
        convertedBytes: pdfBytes.length,
        pageCount: (await (await import("pdf-lib")).PDFDocument.load(pdfBytes)).getPageCount(),
        wordCount: parsed.wordCount,
        imageCount: parsed.imageCount,
        format: parsed.format,
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
    endpoint: "/api/v1/pdf/word-to-pdf",
    methods: ["POST"],
    limits: { maxBytes: MAX_BYTES },
    supportedFormats: ["docx", "odt", "rtf", "txt"],
    body: {
      document: "base64 string or data URI",
      filename: "original filename for format detection",
      options: "pageSize, margins, watermark, userPassword, pdfA, compression, mergeBatch, headerText, footerText, preserveHyperlinks, includePageNumbers",
    },
    note: "Legacy .doc (OLE binary) is not supported — convert to .docx first.",
  });
}
