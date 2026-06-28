import { NextResponse } from "next/server";
import {
  DEFAULT_MERGE_OUTPUT,
  mergePdfFromApi,
  type ApiMergeFile,
  type ApiMergePageRef,
  type MergeOutputOptions,
} from "@/components/tools/pdf-merge-utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawFiles = body.files as { name: string; base64: string }[] | undefined;

    if (!Array.isArray(rawFiles) || rawFiles.length === 0) {
      return NextResponse.json({ ok: false, error: "files[] required (name + base64)" }, { status: 400 });
    }

    if (rawFiles.length > 20) {
      return NextResponse.json({ ok: false, error: "Maximum 20 files per request" }, { status: 400 });
    }

    const files: ApiMergeFile[] = rawFiles.map((f) => ({
      name: f.name || "document.pdf",
      bytes: new Uint8Array(Buffer.from(f.base64, "base64")),
    }));

    const totalBytes = files.reduce((s, f) => s + f.bytes.byteLength, 0);
    if (totalBytes > 50 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Total payload exceeds 50 MB limit" }, { status: 413 });
    }

    const pageRefs = (body.pages as ApiMergePageRef[] | undefined) ?? null;
    const options: MergeOutputOptions = {
      ...DEFAULT_MERGE_OUTPUT,
      ...(body.options ?? {}),
      keywords: body.options?.keywords ?? DEFAULT_MERGE_OUTPUT.keywords,
    };

    const pdfBytes = await mergePdfFromApi(files, pageRefs, options);
    const base64 = Buffer.from(pdfBytes).toString("base64");

    return NextResponse.json({
      ok: true,
      output: base64,
      mimeType: "application/pdf",
      size: pdfBytes.byteLength,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Merge failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/pdf/merge",
    methods: ["POST"],
    description: "Merge multiple PDFs (base64) server-side",
    limits: { maxFiles: 20, maxTotalBytes: 52428800 },
    body: {
      files: [{ name: "string", base64: "string" }],
      pages: "optional [{ fileIndex, pageIndex, rotation?, included? }]",
      options: "MergeOutputOptions (title, author, subject, keywords, compress, password, pageNumbers, watermark, fitToA4)",
    },
  });
}
