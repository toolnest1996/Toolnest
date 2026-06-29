import { NextResponse } from "next/server";
import {
  DEFAULT_REPAIR_OPTIONS,
  repairPdfFromBytes,
  type ApiRepairRequest,
} from "@/components/tools/pdf-repair-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

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

    const request: ApiRepairRequest = {
      options: {
        ...DEFAULT_REPAIR_OPTIONS,
        ...(body.options ?? {}),
        ...(body.strategy ? { strategy: body.strategy } : {}),
      },
    };

    const out = await repairPdfFromBytes(pdfBytes, request);
    return NextResponse.json({
      ok: true,
      output: Buffer.from(out).toString("base64"),
      mimeType: "application/pdf",
      size: out.byteLength,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Repair failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/pdf/repair",
    methods: ["POST"],
    limits: { maxBytes: MAX_BYTES },
    body: {
      pdf: "base64 string",
      options: "Partial<RepairOptions> — strategy (resave | flatten | rasterize), password, dpi, jpegQuality",
    },
    note: "Rasterize strategy is client-only. API supports resave and flatten.",
    strategies: ["resave", "flatten", "rasterize"],
  });
}
