import { NextResponse } from "next/server";
import {
  DEFAULT_WATERMARK_OUTPUT,
  watermarkPdfFromBytes,
  type ApiWatermarkRequest,
} from "@/components/tools/pdf-watermark-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 50 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pdfBase64 = body.pdf as string | undefined;
    if (!pdfBase64) {
      return NextResponse.json({ ok: false, error: "pdf (base64) required" }, { status: 400 });
    }

    const pdfBytes = new Uint8Array(Buffer.from(pdfBase64, "base64"));
    if (pdfBytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "PDF exceeds 50 MB limit" }, { status: 413 });
    }

    const request: ApiWatermarkRequest = {
      watermark: body.watermark,
      options: {
        ...DEFAULT_WATERMARK_OUTPUT,
        ...(body.options ?? {}),
      },
    };

    const out = await watermarkPdfFromBytes(pdfBytes, request);
    const base64 = Buffer.from(out).toString("base64");

    return NextResponse.json({
      ok: true,
      output: base64,
      mimeType: "application/pdf",
      size: out.byteLength,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Watermark failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/pdf/watermark",
    methods: ["POST"],
    limits: { maxBytes: MAX_BYTES },
    body: {
      pdf: "base64 string",
      watermark: "Partial<WatermarkSettings> — type, text, opacity, rotation, position, scope, pageRange, qrContent, image (base64 for API image type)",
      options: "WatermarkOutputOptions (compress, preserveMetadata, password, pdfA)",
    },
    templates: ["CONFIDENTIAL", "DRAFT", "COPY", "SAMPLE", "DO NOT COPY", "APPROVED", "VOID"],
    note: "Full visual studio with logo upload, tiling, headers/footers, and QR runs client-side.",
  });
}
