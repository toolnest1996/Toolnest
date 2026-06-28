import { NextResponse } from "next/server";
import { createRequire } from "module";
import { Worker } from "worker_threads";
import {
  DEFAULT_CONVERT_OPTIONS,
  buildDocx,
  buildDoc,
  buildRtf,
  type ConvertOptions,
  type PageContent,
  type OutputFormat,
} from "@/components/tools/pdf-to-word-utils";
import { parsePageRange } from "@/components/tools/pdf-merge-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 50 * 1024 * 1024;

const require = createRequire(import.meta.url);

let _pdfjsReady: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

async function loadServerPdfJs(): Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> {
  if (!_pdfjsReady) {
    _pdfjsReady = (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
      // pdfjs types expect a DOM Worker; Node's worker_threads Worker is
      // interface-compatible at runtime (postMessage / onmessage / terminate).
      (pdfjs.GlobalWorkerOptions as { workerPort: unknown }).workerPort = new Worker(workerPath);
      return pdfjs;
    })();
  }
  return _pdfjsReady;
}

interface RequestBody {
  pdf?: string;
  options?: Partial<ConvertOptions>;
}

function decodePdf(input: string): { bytes: Buffer; mime: string } {
  if (!input) throw new Error("pdf (base64 or data URI) required");
  const dataUri = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (dataUri) {
    return { bytes: Buffer.from(dataUri[2], "base64"), mime: dataUri[1] };
  }
  return { bytes: Buffer.from(input, "base64"), mime: "application/pdf" };
}

/** Server-side page content extraction (no OCR — Tesseract isn't installed server-side). */
async function extractPages(
  bytes: Buffer,
  options: ConvertOptions,
): Promise<{ pages: PageContent[]; pageCount: number }> {
  const pdfjs = await loadServerPdfJs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    password: options.password || undefined,
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;
  const pageCount = doc.numPages;
  const indices = parsePageRange(options.pageRanges, pageCount);
  const pages: PageContent[] = [];

  for (const pageIndex of indices) {
    const pageNum = pageIndex + 1;
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });

    // Group items into lines then blocks — mirror the client logic.
    interface ItemLite { str: string; x: number; y: number; w: number; h: number; fontSize: number; fontName: string }
    const items: ItemLite[] = [];
    for (const raw of content.items) {
      if (!("str" in raw)) continue;
      const it = raw as { str: string; transform: number[]; width: number; height: number; fontName: string };
      if (!it.str) continue;
      const fontSize = Math.hypot(it.transform[2], it.transform[3]) || it.height || 12;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || fontSize, fontSize, fontName: it.fontName });
    }

    // Group into lines by Y
    const sorted = [...items].sort((a, b) => (viewport.height - a.y) - (viewport.height - b.y) || a.x - b.x);
    const lines: { items: ItemLite[]; y: number; x0: number; x1: number; fontSize: number; text: string }[] = [];
    let current: ItemLite[] = [];
    let currentY = sorted[0]?.y ?? 0;
    for (const it of sorted) {
      if (current.length && Math.abs(it.y - currentY) > 3) {
        lines.push(buildLine(current));
        current = [];
      }
      current.push(it);
      currentY = it.y;
    }
    if (current.length) lines.push(buildLine(current));

    const medianFs = lines.length ? lines.reduce((s, l) => s + l.fontSize, 0) / lines.length : 12;
    const gap = medianFs * 0.8;
    const blocks: PageContent["blocks"] = [];
    let buffer: typeof lines = [];
    let lastY = lines[0]?.y ?? 0;
    for (const line of lines) {
      if (buffer.length && Math.abs(lastY - line.y) > gap) {
        blocks.push(buildBlock(buffer, pageNum, medianFs));
        buffer = [];
      }
      buffer.push(line);
      lastY = line.y;
    }
    if (buffer.length) blocks.push(buildBlock(buffer, pageNum, medianFs));

    pages.push({
      pageNumber: pageNum,
      blocks,
      images: [],
      thumbDataUrl: "",
      hasText: blocks.length > 0,
      isScanned: blocks.length === 0,
      ocrConfidence: null,
    });
    page.cleanup();
  }
  doc.destroy();
  return { pages, pageCount };
}

function buildLine(items: { str: string; x: number; y: number; w: number; h: number; fontSize: number; fontName: string }[]) {
  const s = [...items].sort((a, b) => a.x - b.x);
  const text = s.map((i) => i.str).join("").replace(/\s+/g, " ").trim();
  return {
    items: s,
    y: s[0].y,
    x0: s[0].x,
    x1: s[s.length - 1].x + s[s.length - 1].w,
    fontSize: s.reduce((m, i) => Math.max(m, i.fontSize), 0) || 12,
    text,
  };
}

function buildBlock(
  lines: { items: { fontName: string }[]; y: number; x0: number; x1: number; fontSize: number; text: string }[],
  pageNumber: number,
  medianFs: number,
): PageContent["blocks"][number] {
  const text = lines.map((l) => l.text).join("\n").replace(/\n+/g, "\n").trim();
  const fs = lines[0].fontSize;
  const bold = /bold|black|heavy/i.test(lines[0].items[0]?.fontName ?? "");
  const italic = /italic|oblique/i.test(lines[0].items[0]?.fontName ?? "");
  const isHeading = fs >= medianFs * 1.4 && text.length < 120;
  const listItem = /^\s*([•\-–—]|\d+[.)])\s+/.test(text);
  const xs0 = Math.min(...lines.map((l) => l.x0));
  const xs1 = Math.max(...lines.map((l) => l.x1));
  const leftAligned = lines.every((l) => Math.abs(l.x0 - xs0) < 10);
  const rightAligned = lines.every((l) => Math.abs(l.x1 - xs1) < 10);
  const centered = lines.every((l) => Math.abs((l.x0 + l.x1) / 2 - (xs0 + xs1) / 2) < 12) && !leftAligned;
  const alignment: "left" | "center" | "right" | "justify" = centered
    ? "center"
    : rightAligned && !leftAligned
      ? "right"
      : "left";
  return { text, fontSize: fs, bold, italic, alignment, isHeading, listItem, page: pageNumber };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.pdf) {
      return NextResponse.json({ ok: false, error: "pdf (base64) required" }, { status: 400 });
    }
    const { bytes } = decodePdf(body.pdf);
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: `PDF exceeds ${MAX_BYTES / 1024 / 1024} MB limit` }, { status: 413 });
    }
    const options: ConvertOptions = {
      ...DEFAULT_CONVERT_OPTIONS,
      ...(body.options ?? {}),
    };

    const { pages, pageCount } = await extractPages(bytes, options);

    let blob: Blob;
    switch (options.outputFormat) {
      case "docx": blob = await buildDocx(pages, options); break;
      case "doc": blob = await buildDoc(pages, options); break;
      case "rtf": blob = await buildRtf(pages, options); break;
      default: blob = await buildDocx(pages, options);
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    const wordCount = pages.reduce((s, p) => s + p.blocks.reduce((ss, b) => ss + b.text.split(/\s+/).filter(Boolean).length, 0), 0);
    const imageCount = pages.reduce((s, p) => s + p.images.length, 0);
    const ocrPages = pages.filter((p) => p.isScanned && p.ocrConfidence !== null).length;
    const mime =
      options.outputFormat === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : options.outputFormat === "doc" ? "application/msword"
      : "application/rtf";

    return NextResponse.json({
      ok: true,
      output: `data:${mime};base64,${buf.toString("base64")}`,
      stats: {
        originalBytes: bytes.byteLength,
        convertedBytes: buf.byteLength,
        pageCount,
        wordCount,
        imageCount,
        ocrPages,
        format: options.outputFormat as OutputFormat,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Conversion failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/pdf/to-word",
    methods: ["POST"],
    limits: { maxBytes: MAX_BYTES },
    body: {
      pdf: "base64 string or data URI",
      options: "outputFormat, pageRanges, password, ocrMode, ocrLanguage, preserveLayout, extractImages, imageDpi, includeHeaders, includeFooters, includeHyperlinks",
    },
    outputFormats: ["docx", "doc", "rtf"],
    note: "Server-side OCR is not available — for scanned PDFs, use the in-browser studio with OCR enabled.",
  });
}
