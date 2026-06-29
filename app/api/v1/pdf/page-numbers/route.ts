import { NextResponse } from "next/server";
import {
  DEFAULT_PAGE_NUMBER_OUTPUT,
  pageNumbersPdfFromBytes,
  type ApiPageNumbersRequest,
} from "@/components/tools/pdf-page-numbers-utils";

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

    const request: ApiPageNumbersRequest = {
      settings: body.settings,
      options: {
        ...DEFAULT_PAGE_NUMBER_OUTPUT,
        ...(body.options ?? {}),
      },
    };

    const out = await pageNumbersPdfFromBytes(pdfBytes, request);
    return NextResponse.json({
      ok: true,
      output: Buffer.from(out).toString("base64"),
      mimeType: "application/pdf",
      size: out.byteLength,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Page numbering failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/pdf/page-numbers",
    methods: ["POST"],
    limits: { maxBytes: MAX_BYTES },
    body: {
      pdf: "base64 string",
      settings: "Partial<PageNumberSettings> — format, position, fontId, fontSize, color, opacity, margin, startNumber, skipFirstPage, scope, pageRange",
      options: "PageNumberOutputOptions (compress, preserveMetadata)",
    },
    formats: ["1", "1/10", "Page 1", "Page 1 of 10", "i", "I", "a", "A"],
  });
}
