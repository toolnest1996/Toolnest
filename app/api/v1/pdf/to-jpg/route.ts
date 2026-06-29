import { NextResponse } from "next/server";
import { createRequire } from "module";
import { Worker } from "worker_threads";
import { parsePageRange } from "@/components/tools/pdf-merge-utils";
import {
  DEFAULT_PDF_TO_IMAGE_SETTINGS,
  IMAGE_FORMAT_OPTIONS,
  type ImageExportFormat,
  type PdfToImageSettings,
} from "@/components/tools/pdf-to-jpg-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 50 * 1024 * 1024;
const require = createRequire(import.meta.url);

let _pdfjsReady: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

async function loadServerPdfJs() {
  if (!_pdfjsReady) {
    _pdfjsReady = (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
      (pdfjs.GlobalWorkerOptions as { workerPort: unknown }).workerPort = new Worker(workerPath);
      return pdfjs;
    })();
  }
  return _pdfjsReady;
}

interface RequestBody {
  pdf?: string;
  filename?: string;
  settings?: Partial<PdfToImageSettings>;
  password?: string;
}

function decodePdf(input: string): Buffer {
  const dataUri = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (dataUri) return Buffer.from(dataUri[2]!, "base64");
  return Buffer.from(input, "base64");
}

async function renderPageToBuffer(
  page: import("pdfjs-dist").PDFPageProxy,
  dpi: number,
  format: ImageExportFormat,
  quality: number,
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;

  const fmt = IMAGE_FORMAT_OPTIONS.find((f) => f.id === format)!;
  if (format === "jpeg") {
    return { buffer: canvas.toBuffer("image/jpeg", quality), mime: fmt.mime, ext: fmt.ext };
  }
  if (format === "webp") {
    return { buffer: canvas.toBuffer("image/webp"), mime: fmt.mime, ext: fmt.ext };
  }
  return { buffer: canvas.toBuffer("image/png"), mime: fmt.mime, ext: fmt.ext };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.pdf) {
      return NextResponse.json({ ok: false, error: "pdf (base64) required" }, { status: 400 });
    }

    const pdfBuf = decodePdf(body.pdf);
    if (pdfBuf.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "PDF exceeds 50 MB limit" }, { status: 413 });
    }

    const settings: PdfToImageSettings = {
      ...DEFAULT_PDF_TO_IMAGE_SETTINGS,
      ...(body.settings ?? {}),
    };
    const stem = (body.filename ?? "document").replace(/\.pdf$/i, "").replace(/[^a-z0-9._-]+/gi, "-") || "document";

    const pdfjs = await loadServerPdfJs();
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(pdfBuf),
      password: body.password || undefined,
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;

    const pageCount = doc.numPages;
    const indices = settings.pageRange.trim()
      ? parsePageRange(settings.pageRange, pageCount)
      : Array.from({ length: pageCount }, (_, i) => i);

    const pages: { page: number; base64: string; mimeType: string; name: string }[] = [];

    for (const idx of indices) {
      const page = await doc.getPage(idx + 1);
      const { buffer, mime, ext } = await renderPageToBuffer(page, settings.dpi, settings.format, settings.quality);
      const pad = String(idx + 1).padStart(String(pageCount).length, "0");
      pages.push({
        page: idx + 1,
        base64: buffer.toString("base64"),
        mimeType: mime,
        name: `${stem}-page-${pad}.${ext}`,
      });
    }

    return NextResponse.json({
      ok: true,
      pages,
      pageCount: pages.length,
      settings,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/pdf/to-jpg",
    methods: ["POST"],
    limits: { maxBytes: MAX_BYTES },
    body: {
      pdf: "base64 string",
      filename: "optional source filename for output naming",
      settings: "Partial<PdfToImageSettings> — format (jpeg|png|webp), dpi 72-300, quality, pageRange",
      password: "optional PDF password",
    },
    response: { pages: "array of { page, base64, mimeType, name }" },
  });
}
