/**
 * Shared pdf.js canvas rendering for PDF → image / PPT tools.
 */

let _pdfjsReady: Promise<typeof import("pdfjs-dist")> | null = null;

export async function loadPdfJs(): Promise<typeof import("pdfjs-dist")> {
  if (!_pdfjsReady) {
    _pdfjsReady = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      return pdfjs;
    });
  }
  return _pdfjsReady;
}

export async function renderPdfPageToCanvas(
  page: import("pdfjs-dist").PDFPageProxy,
  dpi: number,
): Promise<HTMLCanvasElement> {
  const scale = dpi / 72;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

export interface PdfRenderOptions {
  dpi?: number;
  pageRange?: string;
  password?: string;
  onProgress?: (page: number, total: number) => void;
}

export async function renderPdfPagesToCanvases(
  bytes: ArrayBuffer,
  options: PdfRenderOptions = {},
): Promise<{ canvases: HTMLCanvasElement[]; pageIndices: number[]; pageCount: number }> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({
    data: bytes.slice(0),
    password: options.password || undefined,
  }).promise;
  const pageCount = doc.numPages;
  const { parsePageRange } = await import("./pdf-merge-utils");
  const indices =
    options.pageRange?.trim()
      ? parsePageRange(options.pageRange, pageCount)
      : Array.from({ length: pageCount }, (_, i) => i);
  const dpi = options.dpi ?? 150;
  const canvases: HTMLCanvasElement[] = [];
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i]!;
    options.onProgress?.(i + 1, indices.length);
    const page = await doc.getPage(idx + 1);
    canvases.push(await renderPdfPageToCanvas(page, dpi));
  }
  return { canvases, pageIndices: indices, pageCount };
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: "image/jpeg" | "image/png" | "image/webp",
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), mime, quality);
  });
}

export function sanitizeFileStem(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]+/gi, "-") || "output";
}
