import { NextResponse } from "next/server";
import { compressPdfFromBytes, DEFAULT_COMPRESS_OPTIONS, type CompressOptions } from "@/components/tools/pdf-compress-utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pdfBase64 = body.pdf as string;
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return NextResponse.json({ ok: false, error: "pdf (base64) required" }, { status: 400 });
    }

    const bytes = new Uint8Array(Buffer.from(pdfBase64, "base64"));
    if (bytes.byteLength > 50 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "PDF exceeds 50 MB limit" }, { status: 413 });
    }

    const options: CompressOptions = {
      ...DEFAULT_COMPRESS_OPTIONS,
      ...(body.options ?? {}),
    };

    const result = await compressPdfFromBytes(bytes, options);

    return NextResponse.json({
      ok: true,
      output: Buffer.from(result.data).toString("base64"),
      stats: {
        originalBytes: result.originalBytes,
        compressedBytes: result.compressedBytes,
        savingsPercent: result.savingsPercent,
        pageCount: result.pageCount,
        mode: result.mode,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Compression failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/pdf/compress",
    methods: ["POST"],
    limits: { maxBytes: 52428800 },
    body: {
      pdf: "base64 string",
      options: "level, jpegQuality, dpi, stripMetadata, grayscale, outputPassword",
    },
  });
}
