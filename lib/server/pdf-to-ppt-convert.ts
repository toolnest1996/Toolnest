/**
 * Server-only PDF → PPTX (text-layout slides). Not imported from client components.
 */

import { createRequire } from "module";
import { Worker } from "worker_threads";
import PptxGenJS from "pptxgenjs";
import { parsePageRange } from "@/components/tools/pdf-merge-utils";
import { sanitizeFileStem } from "@/components/tools/pdf-canvas-utils";
import type { PdfToPptSettings } from "@/components/tools/pdf-to-ppt-utils";

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

export async function convertPdfToPptxServer(
  bytes: ArrayBuffer,
  fileName: string,
  settings: PdfToPptSettings,
): Promise<Buffer> {
  const pdfjs = await loadServerPdfJs();
  const doc = await pdfjs.getDocument({
    data: bytes.slice(0),
    password: settings.password || undefined,
  }).promise;

  const indices = settings.pageRange.trim()
    ? parsePageRange(settings.pageRange, doc.numPages)
    : Array.from({ length: doc.numPages }, (_, i) => i);

  const pptx = new PptxGenJS();
  pptx.layout = settings.layout === "16x9" ? "LAYOUT_16x9" : "LAYOUT_4x3";
  pptx.author = "ToolNest.io";
  pptx.title = sanitizeFileStem(fileName);

  for (const idx of indices) {
    const page = await doc.getPage(idx + 1);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    const slide = pptx.addSlide();
    slide.addText(text || `Page ${idx + 1}`, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 5,
      fontSize: 14,
      valign: "top",
    });
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
