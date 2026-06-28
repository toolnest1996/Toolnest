import { NextResponse } from "next/server";
import { splitPdfFromBytes, type SplitMode } from "@/components/tools/pdf-split-utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const pdfBase64 = body.pdf as string;
    const mode = body.mode as SplitMode;

    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return NextResponse.json({ ok: false, error: "pdf (base64) required" }, { status: 400 });
    }
    if (!mode || !["every-page", "extract", "by-ranges", "every-n", "by-bookmarks"].includes(mode)) {
      return NextResponse.json({ ok: false, error: "Invalid split mode" }, { status: 400 });
    }

    const bytes = new Uint8Array(Buffer.from(pdfBase64, "base64"));
    if (bytes.byteLength > 50 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "PDF exceeds 50 MB limit" }, { status: 413 });
    }

    const files = await splitPdfFromBytes(bytes, {
      mode,
      rangeGroups: body.rangeGroups,
      everyN: body.everyN,
      pageIndices: body.pageIndices,
      options: body.options,
    });

    if (!files.length) {
      return NextResponse.json({ ok: false, error: "No output files — check selection/ranges/bookmarks" }, { status: 422 });
    }

    if (files.length === 1) {
      return NextResponse.json({
        ok: true,
        files: [{ name: files[0]!.name, base64: Buffer.from(files[0]!.data).toString("base64") }],
        count: 1,
      });
    }

    const { zipSplitFiles } = await import("@/components/tools/pdf-split-utils");
    const zip = await zipSplitFiles(files, "split");
    const zipBuf = new Uint8Array(await zip.arrayBuffer());

    return NextResponse.json({
      ok: true,
      zip: Buffer.from(zipBuf).toString("base64"),
      count: files.length,
      mimeType: "application/zip",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Split failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/pdf/split",
    methods: ["POST"],
    description: "Split a PDF server-side",
    limits: { maxBytes: 52428800 },
    body: {
      pdf: "base64 string",
      mode: "every-page | extract | by-ranges | every-n | by-bookmarks",
      rangeGroups: "optional, for by-ranges",
      everyN: "optional number",
      pageIndices: "optional 0-based indices to include",
      options: "SplitOutputOptions partial",
    },
  });
}
