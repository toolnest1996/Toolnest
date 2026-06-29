import { NextResponse } from "next/server";
import {
  DEFAULT_PPT_TO_PDF,
  convertPptxToPdf,
  detectPptFormat,
  type PptToPdfSettings,
} from "@/components/tools/ppt-to-pdf-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

interface RequestBody {
  document?: string;
  filename?: string;
  options?: Partial<PptToPdfSettings>;
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

    const options: PptToPdfSettings = { ...DEFAULT_PPT_TO_PDF, ...(body.options ?? {}) };
    const filename = body.filename ?? "presentation.pptx";
    const format = detectPptFormat(filename);
    if (format === "ppt") {
      return NextResponse.json({ ok: false, error: "Legacy .ppt not supported — use .pptx" }, { status: 422 });
    }
    if (format !== "pptx") {
      return NextResponse.json({ ok: false, error: "Only .pptx files are supported" }, { status: 422 });
    }

    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const result = await convertPptxToPdf(arrayBuffer, filename, options);

    return NextResponse.json({
      ok: true,
      output: `data:application/pdf;base64,${Buffer.from(await result.blob.arrayBuffer()).toString("base64")}`,
      stats: {
        originalBytes: bytes.byteLength,
        convertedBytes: result.bytes,
        pageCount: result.pageCount,
        slideCount: result.slideCount,
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
    endpoint: "/api/v1/pdf/ppt-to-pdf",
    methods: ["POST"],
    limits: { maxBytes: MAX_BYTES },
    supportedFormats: ["pptx"],
    body: {
      document: "base64 string or data URI",
      filename: "original filename for format detection",
      options: "pageSize, orientation, margin, fontSize, includeImages",
    },
    note: "Legacy .ppt (binary PowerPoint) is not supported — save as .pptx first.",
  });
}
