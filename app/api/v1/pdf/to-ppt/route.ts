import { NextResponse } from "next/server";
import { DEFAULT_PDF_TO_PPT, type PdfToPptSettings } from "@/components/tools/pdf-to-ppt-utils";
import { convertPdfToPptxServer } from "@/lib/server/pdf-to-ppt-convert";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 50 * 1024 * 1024;

interface RequestBody {
  pdf?: string;
  filename?: string;
  options?: Partial<PdfToPptSettings>;
}

function decodePdf(input: string): Buffer {
  if (!input) throw new Error("pdf (base64 or data URI) required");
  const dataUri = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (dataUri) return Buffer.from(dataUri[2], "base64");
  return Buffer.from(input, "base64");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.pdf) {
      return NextResponse.json({ ok: false, error: "pdf (base64) required" }, { status: 400 });
    }
    const bytes = decodePdf(body.pdf);
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: `PDF exceeds ${MAX_BYTES / 1024 / 1024} MB limit` }, { status: 413 });
    }

    const options: PdfToPptSettings = { ...DEFAULT_PDF_TO_PPT, ...(body.options ?? {}) };
    const filename = body.filename ?? "document.pdf";

    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const outBytes = await convertPdfToPptxServer(arrayBuffer, filename, options);

    return NextResponse.json({
      ok: true,
      output: `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${outBytes.toString("base64")}`,
      stats: {
        originalBytes: bytes.byteLength,
        convertedBytes: outBytes.byteLength,
        filename,
        layout: options.layout,
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
    endpoint: "/api/v1/pdf/to-ppt",
    methods: ["POST"],
    limits: { maxBytes: MAX_BYTES },
    body: {
      pdf: "base64 string or data URI",
      filename: "original filename",
      options: "dpi, pageRange, password, layout (16x9|4x3), jpegQuality",
    },
    note: "Server API creates text-layout slides via pdfjs. For full image-fill slides use the in-browser studio.",
  });
}
