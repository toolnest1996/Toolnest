/**
 * Ultra Image Watermark Studio — text/logo, tile, drag position.
 */

export type ImgWatermarkPosition =
  | "center"
  | "diagonal"
  | "tile"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "custom";

export interface ImageWatermarkSettings {
  type: "text" | "image";
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  position: ImgWatermarkPosition;
  customX: number;
  customY: number;
  tileSpacingX: number;
  tileSpacingY: number;
  logoBlob: Blob | null;
  logoScale: number;
}

export const DEFAULT_IMAGE_WATERMARK: ImageWatermarkSettings = {
  type: "text",
  text: "CONFIDENTIAL",
  fontSize: 48,
  color: "#c0392b",
  opacity: 0.35,
  rotation: -35,
  position: "diagonal",
  customX: 0.5,
  customY: 0.5,
  tileSpacingX: 200,
  tileSpacingY: 160,
  logoBlob: null,
  logoScale: 0.25,
};

function anchorForPosition(pos: ImgWatermarkPosition): { x: number; y: number } {
  const m = 0.12;
  switch (pos) {
    case "top-left":
      return { x: m, y: m };
    case "top-right":
      return { x: 1 - m, y: m };
    case "bottom-left":
      return { x: m, y: 1 - m };
    case "bottom-right":
      return { x: 1 - m, y: 1 - m };
    case "custom":
    case "center":
    case "diagonal":
    case "tile":
    default:
      return { x: 0.5, y: 0.5 };
  }
}

export function resolveImgAnchor(s: ImageWatermarkSettings): { x: number; y: number } {
  if (s.position === "custom") return { x: s.customX, y: s.customY };
  return anchorForPosition(s.position);
}

async function drawTextMark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: ImageWatermarkSettings,
  x: number,
  y: number,
) {
  ctx.save();
  ctx.globalAlpha = s.opacity;
  ctx.fillStyle = s.color;
  ctx.font = `bold ${s.fontSize}px Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(x * w, y * h);
  ctx.rotate((s.rotation * Math.PI) / 180);
  ctx.fillText(s.text, 0, 0);
  ctx.restore();
}

async function drawLogoMark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: ImageWatermarkSettings,
  x: number,
  y: number,
) {
  if (!s.logoBlob) return;
  const bmp = await createImageBitmap(s.logoBlob);
  const lw = w * s.logoScale;
  const lh = (bmp.height / bmp.width) * lw;
  ctx.save();
  ctx.globalAlpha = s.opacity;
  ctx.translate(x * w, y * h);
  ctx.rotate((s.rotation * Math.PI) / 180);
  ctx.drawImage(bmp, -lw / 2, -lh / 2, lw, lh);
  ctx.restore();
  bmp.close();
}

export async function applyWatermarkToCanvas(
  source: ImageBitmap,
  settings: ImageWatermarkSettings,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);

  if (settings.position === "tile") {
    const stepX = settings.tileSpacingX;
    const stepY = settings.tileSpacingY;
    for (let y = stepY / 2; y < canvas.height; y += stepY) {
      for (let x = stepX / 2; x < canvas.width; x += stepX) {
        if (settings.type === "text") {
          ctx.save();
          ctx.globalAlpha = settings.opacity;
          ctx.fillStyle = settings.color;
          ctx.font = `bold ${settings.fontSize * 0.5}px Helvetica, Arial, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.translate(x, y);
          ctx.rotate((settings.rotation * Math.PI) / 180);
          ctx.fillText(settings.text, 0, 0);
          ctx.restore();
        }
      }
    }
    return canvas;
  }

  const anchor = resolveImgAnchor(settings);
  const nx = settings.position === "custom" ? settings.customX : anchor.x;
  const ny = settings.position === "custom" ? settings.customY : anchor.y;

  if (settings.type === "text") await drawTextMark(ctx, canvas.width, canvas.height, settings, nx, ny);
  else await drawLogoMark(ctx, canvas.width, canvas.height, settings, nx, ny);

  return canvas;
}

export async function watermarkImageFile(
  file: File,
  settings: ImageWatermarkSettings,
  format: "image/png" | "image/jpeg" | "image/webp" = "image/png",
  quality = 0.92,
): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const canvas = await applyWatermarkToCanvas(bmp, settings);
  bmp.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), format, quality);
  });
}

export async function watermarkBatch(
  files: File[],
  settings: ImageWatermarkSettings,
  format: "image/png" | "image/jpeg" | "image/webp",
  onProgress?: (pct: number) => void,
): Promise<{ name: string; blob: Blob }[]> {
  const ext = format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg";
  const out: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const blob = await watermarkImageFile(f, settings, format);
    out.push({ name: f.name.replace(/\.[^.]+$/, "") + `-watermarked.${ext}`, blob });
    onProgress?.(Math.round(((i + 1) / files.length) * 100));
  }
  return out;
}

export async function zipWatermarkedImages(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name, f.blob));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
