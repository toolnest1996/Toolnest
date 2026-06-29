/**
 * Ultra Image Editor — light, color, detail, effects, transform, presets.
 */

export type EditorRotation = 0 | 90 | 180 | 270;
export type EditorExportFormat = "image/png" | "image/jpeg" | "image/webp";

export interface EditorAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  hue: number;
  gamma: number;
  highlights: number;
  shadows: number;
  fade: number;
  temperature: number;
  tint: number;
  blur: number;
  sharpen: number;
  clarity: number;
  noiseReduction: number;
  grayscale: boolean;
  sepia: boolean;
  invert: boolean;
  vignette: number;
  rotation: EditorRotation;
  flipH: boolean;
  flipV: boolean;
}

export const DEFAULT_ADJUSTMENTS: EditorAdjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  hue: 0,
  gamma: 1,
  highlights: 0,
  shadows: 0,
  fade: 0,
  temperature: 0,
  tint: 0,
  blur: 0,
  sharpen: 0,
  clarity: 0,
  noiseReduction: 0,
  grayscale: false,
  sepia: false,
  invert: false,
  vignette: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
};

export interface EditorPreset {
  id: string;
  label: string;
  hint: string;
  category: "portrait" | "cinematic" | "creative" | "fix";
  settings: Partial<EditorAdjustments>;
}

export const EDITOR_PRESETS: EditorPreset[] = [
  { id: "auto", label: "Auto enhance", hint: "Smart balance", category: "fix", settings: {} },
  { id: "vivid", label: "Vivid", hint: "Punchy colors", category: "creative", settings: { saturation: 22, contrast: 12, clarity: 18, sharpen: 12 } },
  { id: "portrait", label: "Portrait", hint: "Soft skin tones", category: "portrait", settings: { brightness: 6, contrast: -4, shadows: 18, highlights: -8, temperature: 8, clarity: 8 } },
  { id: "landscape", label: "Landscape", hint: "Sky & greens", category: "creative", settings: { saturation: 15, clarity: 22, sharpen: 15, contrast: 8, temperature: -5 } },
  { id: "cinematic", label: "Cinematic", hint: "Moody teal-orange", category: "cinematic", settings: { contrast: 14, saturation: -8, shadows: 16, vignette: 28, fade: 12, temperature: 6 } },
  { id: "vintage", label: "Vintage", hint: "Faded film", category: "creative", settings: { sepia: true, fade: 28, vignette: 22, contrast: -8, saturation: -12 } },
  { id: "bw-film", label: "B&W Film", hint: "Classic mono", category: "cinematic", settings: { grayscale: true, contrast: 18, clarity: 14, vignette: 12 } },
  { id: "hdr", label: "HDR pop", hint: "Local contrast", category: "fix", settings: { clarity: 35, sharpen: 20, shadows: 22, highlights: -15, contrast: 10 } },
  { id: "soft", label: "Soft glow", hint: "Dreamy look", category: "portrait", settings: { brightness: 8, blur: 1.5, fade: 18, saturation: -6, contrast: -10 } },
  { id: "crisp", label: "Crisp product", hint: "E-commerce", category: "fix", settings: { clarity: 30, sharpen: 35, contrast: 12, saturation: 5, noiseReduction: 8 } },
  { id: "warm", label: "Warm sunset", hint: "Golden hour", category: "creative", settings: { temperature: 35, saturation: 12, contrast: 6, vignette: 10 } },
  { id: "cool", label: "Cool tone", hint: "Blue hour", category: "creative", settings: { temperature: -30, tint: -8, saturation: 5, contrast: 4 } },
];

export interface EditorRecommendation {
  title: string;
  detail: string;
  presetId?: string;
  patch?: Partial<EditorAdjustments>;
}

function clamp255(v: number) {
  return Math.min(255, Math.max(0, v));
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export async function loadImageBitmap(file: File | Blob): Promise<ImageBitmap> {
  return createImageBitmap(file);
}

function buildCssFilter(adj: EditorAdjustments): string {
  const parts: string[] = [];
  const bright = 100 + adj.brightness + adj.exposure * 0.45;
  if (bright !== 100) parts.push(`brightness(${bright}%)`);
  if (adj.contrast) parts.push(`contrast(${100 + adj.contrast}%)`);
  if (adj.saturation) parts.push(`saturate(${100 + adj.saturation}%)`);
  if (adj.hue) parts.push(`hue-rotate(${adj.hue}deg)`);
  if (adj.grayscale) parts.push("grayscale(100%)");
  if (adj.sepia) parts.push("sepia(100%)");
  if (adj.invert) parts.push("invert(100%)");
  if (adj.blur > 0) parts.push(`blur(${adj.blur}px)`);
  return parts.length ? parts.join(" ") : "none";
}

function applyPixelAdjustments(data: Uint8ClampedArray, w: number, h: number, adj: EditorAdjustments) {
  const gamma = adj.gamma > 0 ? adj.gamma : 1;
  const invGamma = 1 / gamma;
  const shadowLift = adj.shadows / 100;
  const highlightCut = adj.highlights / 100;
  const temp = adj.temperature / 100;
  const tintAmt = adj.tint / 100;
  const fade = adj.fade / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]!;
    let g = data[i + 1]!;
    let b = data[i + 2]!;

    if (gamma !== 1) {
      r = clamp255(255 * (r / 255) ** invGamma);
      g = clamp255(255 * (g / 255) ** invGamma);
      b = clamp255(255 * (b / 255) ** invGamma);
    }

    if (temp !== 0) {
      r = clamp255(r + temp * 40);
      b = clamp255(b - temp * 40);
    }
    if (tintAmt !== 0) {
      g = clamp255(g + tintAmt * 30);
      r = clamp255(r - tintAmt * 10);
      b = clamp255(b - tintAmt * 10);
    }

    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (shadowLift !== 0 && lum < 0.5) {
      const t = 1 - lum * 2;
      r = clamp255(r + shadowLift * 55 * t);
      g = clamp255(g + shadowLift * 55 * t);
      b = clamp255(b + shadowLift * 55 * t);
    }
    if (highlightCut !== 0 && lum > 0.5) {
      const t = (lum - 0.5) * 2;
      r = clamp255(r - highlightCut * 45 * t);
      g = clamp255(g - highlightCut * 45 * t);
      b = clamp255(b - highlightCut * 45 * t);
    }

    if (fade > 0) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = clamp255(r * (1 - fade * 0.35) + gray * fade * 0.35);
      g = clamp255(g * (1 - fade * 0.35) + gray * fade * 0.35);
      b = clamp255(b * (1 - fade * 0.35) + gray * fade * 0.35);
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

function applyClarity(canvas: HTMLCanvasElement, amount: number) {
  if (amount <= 0) return;
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const copy = new Uint8ClampedArray(d);
  const k = (amount / 100) * 0.6;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = copy[i + c]!;
        const avg =
          (copy[i - 4 + c]! + copy[i + 4 + c]! + copy[i - width * 4 + c]! + copy[i + width * 4 + c]!) / 4;
        d[i + c] = clamp255(center + (center - avg) * k * 3);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function applyNoiseReduction(canvas: HTMLCanvasElement, amount: number) {
  if (amount <= 0) return;
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const tmp = document.createElement("canvas");
  tmp.width = width;
  tmp.height = height;
  const tctx = tmp.getContext("2d")!;
  tctx.filter = `blur(${Math.min(2, amount / 40)}px)`;
  tctx.drawImage(canvas, 0, 0);
  ctx.globalAlpha = Math.min(0.65, amount / 120);
  ctx.drawImage(tmp, 0, 0);
  ctx.globalAlpha = 1;
}

function sharpenCanvas(canvas: HTMLCanvasElement, amount: number) {
  if (amount <= 0) return;
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  const copy = new Uint8ClampedArray(d);
  const k = amount / 100;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = copy[i + c]!;
        const avg =
          (copy[i - 4 + c]! + copy[i + 4 + c]! + copy[i - width * 4 + c]! + copy[i + width * 4 + c]!) / 4;
        d[i + c] = clamp255(center + (center - avg) * k * 4);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

function applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number) {
  const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${clamp01(strength / 100) * 0.85})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function applyTransform(canvas: HTMLCanvasElement, rotation: EditorRotation, flipH: boolean, flipV: boolean): HTMLCanvasElement {
  if (rotation === 0 && !flipH && !flipV) return canvas;
  const out = document.createElement("canvas");
  const swap = rotation === 90 || rotation === 270;
  out.width = swap ? canvas.height : canvas.width;
  out.height = swap ? canvas.width : canvas.height;
  const ctx = out.getContext("2d")!;
  ctx.translate(out.width / 2, out.height / 2);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return out;
}

export function applyAdjustmentsToCanvas(source: ImageBitmap, adj: EditorAdjustments): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d")!;
  ctx.filter = buildCssFilter(adj);
  ctx.drawImage(source, 0, 0);

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyPixelAdjustments(img.data, canvas.width, canvas.height, adj);
  ctx.putImageData(img, 0, 0);

  applyClarity(canvas, adj.clarity);
  applyNoiseReduction(canvas, adj.noiseReduction);
  sharpenCanvas(canvas, adj.sharpen);
  if (adj.vignette > 0) applyVignette(ctx, canvas.width, canvas.height, adj.vignette);

  return applyTransform(canvas, adj.rotation, adj.flipH, adj.flipV);
}

export function autoEnhanceAdjustments(source: ImageBitmap): Partial<EditorAdjustments> {
  const c = document.createElement("canvas");
  c.width = Math.min(source.width, 320);
  c.height = Math.min(source.height, 320);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(source, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let sum = 0;
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    sum += lum;
    min = Math.min(min, lum);
    max = Math.max(max, lum);
  }
  const pixels = data.length / 4;
  const avg = sum / pixels;
  const spread = max - min;
  const brightness = avg < 110 ? Math.round((128 - avg) / 3) : avg > 175 ? Math.round((128 - avg) / 4) : 0;
  const contrast = spread < 90 ? Math.round((120 - spread) / 4) : spread > 200 ? -8 : 0;
  const shadows = min > 25 ? Math.round((min - 20) / 3) : 0;
  const highlights = max < 230 ? 0 : -Math.round((max - 230) / 4);
  return {
    brightness: Math.max(-25, Math.min(25, brightness)),
    contrast: Math.max(-15, Math.min(25, contrast)),
    shadows: Math.max(0, Math.min(35, shadows)),
    highlights: Math.max(-30, Math.min(0, highlights)),
    clarity: spread < 100 ? 15 : 8,
    sharpen: 10,
  };
}

export function aiEditorRecommendations(w: number, h: number, adj: EditorAdjustments): EditorRecommendation[] {
  const recs: EditorRecommendation[] = [];
  if (adj.brightness === 0 && adj.contrast === 0 && adj.saturation === 0) {
    recs.push({ title: "Try Auto enhance", detail: "One-click smart balance for exposure and contrast.", presetId: "auto" });
  }
  if (w > h * 1.4) recs.push({ title: "Landscape preset", detail: "Boost clarity and saturation for wide photos.", presetId: "landscape" });
  if (h > w * 1.2) recs.push({ title: "Portrait preset", detail: "Soft shadows and warm tones for people shots.", presetId: "portrait" });
  if (adj.sharpen === 0 && adj.clarity < 10) recs.push({ title: "Add clarity", detail: "Product and text photos benefit from +15–25 clarity.", patch: { clarity: 20, sharpen: 12 } });
  if (adj.noiseReduction === 0 && w * h > 4_000_000) recs.push({ title: "Reduce noise", detail: "Large images from phones — light noise reduction helps.", patch: { noiseReduction: 12 } });
  return recs.slice(0, 4);
}

export function smartEditorTips(w: number, h: number): string[] {
  const tips: string[] = [];
  if (w * h > 12_000_000) tips.push("Large image — preview may take a moment.");
  tips.push("Use Presets for one-click looks, then fine-tune sliders.");
  tips.push("Compare tab shows before/after with a drag slider.");
  return tips;
}

export function mergePreset(preset: EditorPreset): EditorAdjustments {
  return { ...DEFAULT_ADJUSTMENTS, ...preset.settings };
}

export async function exportCanvas(canvas: HTMLCanvasElement, format: EditorExportFormat, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), format, quality);
  });
}

export async function editImageFile(
  file: File,
  adj: EditorAdjustments,
  format: EditorExportFormat,
  quality: number,
): Promise<Blob> {
  const bmp = await loadImageBitmap(file);
  const canvas = applyAdjustmentsToCanvas(bmp, adj);
  bmp.close();
  return exportCanvas(canvas, format, quality);
}

export async function editBatchImages(
  files: File[],
  adj: EditorAdjustments,
  format: EditorExportFormat,
  quality: number,
  onProgress?: (pct: number) => void,
): Promise<{ name: string; blob: Blob }[]> {
  const out: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const blob = await editImageFile(f, adj, format, quality);
    const ext = format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg";
    out.push({ name: f.name.replace(/\.[^.]+$/, "") + `-edited.${ext}`, blob });
    onProgress?.(Math.round(((i + 1) / files.length) * 100));
  }
  return out;
}

export async function zipEditedImages(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.name, f.blob));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
