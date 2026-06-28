import { NextResponse } from "next/server";
import {
  DEFAULT_ROTATE_OUTPUT,
  rotatePdfFromBytes,
  type ApiRotateRequest,
} from "@/components/tools/pdf-rotate-utils";

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

    const request: ApiRotateRequest = {
      globalRotation: body.globalRotation,
      pages: body.pages,
      options: {
        ...DEFAULT_ROTATE_OUTPUT,
        ...(body.options ?? {}),
        keywords: body.options?.keywords ?? DEFAULT_ROTATE_OUTPUT.keywords,
      },
    };

    const out = await rotatePdfFromBytes(pdfBytes, request);
    const base64 = Buffer.from(out).toString("base64");

    return NextResponse.json({
      ok: true,
      output: base64,
      mimeType: "application/pdf",
      size: out.byteLength,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Rotate failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/pdf/rotate",
    methods: ["POST"],
    description: "Rotate PDF pages server-side (base64 in, base64 out)",
    limits: { maxBytes: MAX_BYTES },
    body: {
      pdf: "base64 string",
      globalRotation: "optional number — applied to all pages when pages[] omitted (default 90)",
      pages: "optional [{ pageIndex, rotation?, included? }] — per-page control",
      options: "RotateOutputOptions (compress, preserveMetadata, password, title, author, pdfA, ...)",
    },
    note: "In-place rotation preserves bookmarks when page order is unchanged. Studio supports full visual editing client-side.",
  });
}
