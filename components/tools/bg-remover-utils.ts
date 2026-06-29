/**
 * Ultra Background Remover — client-side color/chroma matting.
 */

export type BgRemoveMode = "auto" | "color" | "green";

export interface BgRemoveSettings {
  mode: BgRemoveMode;
  pickColor: string;
  threshold: number;
  feather: number;
  spill: number;
}

export const DEFAULT_BG_REMOVE: BgRemoveSettings = {
  mode: "auto",
  pickColor: "#ffffff",
  threshold: 42,
  feather: 8,
  spill: 0,
};

function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function sampleCorners(data: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const pts = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
    [Math.floor(w / 2), 0],
    [0, Math.floor(h / 2)],
  ];
  let r = 0,
    g = 0,
    b = 0;
  pts.forEach(([x, y]) => {
    const i = (y * w + x) * 4;
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  });
  const n = pts.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

function colorDist(
  r: number,
  g: number,
  b: number,
  tr: number,
  tg: number,
  tb: number,
): number {
  return Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2);
}

export function removeBackgroundFromCanvas(
  canvas: HTMLCanvasElement,
  settings: BgRemoveSettings,
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  let [tr, tg, tb] = parseHex(settings.pickColor);
  if (settings.mode === "auto") [tr, tg, tb] = sampleCorners(d, w, h);
  if (settings.mode === "green") [tr, tg, tb] = [80, 180, 80];

  const thresh = settings.threshold;
  const feather = Math.max(1, settings.feather);

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i]!;
    const g = d[i + 1]!;
    const b = d[i + 2]!;
    const dist = colorDist(r, g, b, tr, tg, tb);
    if (dist <= thresh) {
      d[i + 3] = 0;
    } else if (dist <= thresh + feather) {
      const t = (dist - thresh) / feather;
      d[i + 3] = Math.round(t * 255);
      if (settings.spill > 0) {
        d[i + 1] = Math.round(g * (1 - settings.spill / 100));
      }
    }
  }

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  out.getContext("2d")!.putImageData(img, 0, 0);
  return out;
}

export async function removeBackgroundFromFile(
  file: File,
  settings: BgRemoveSettings,
): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0);
  bmp.close();
  const result = removeBackgroundFromCanvas(canvas, settings);
  return new Promise((resolve, reject) => {
    result.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png");
  });
}

export async function removeBackgroundBatch(
  files: File[],
  settings: BgRemoveSettings,
  onProgress?: (pct: number) => void,
): Promise<{ name: string; blob: Blob }[]> {
  const out: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const blob = await removeBackgroundFromFile(f, settings);
    out.push({ name: f.name.replace(/\.[^.]+$/, "") + "-nobg.png", blob });
    onProgress?.(Math.round(((i + 1) / files.length) * 100));
  }
  return out;
}

export async function zipBgRemoved(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name, f.blob));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function smartBgTips(mode: BgRemoveMode): string[] {
  if (mode === "green") return ["Green screen mode works best with uniform green backdrops."];
  if (mode === "color") return ["Use the color picker on a background area for best results."];
  return ["Auto mode samples corners to detect the background color."];
}
