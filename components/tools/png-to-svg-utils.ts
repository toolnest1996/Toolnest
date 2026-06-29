/**
 * Ultra PNG/JPG → SVG Vector Studio — ImageTracer engine, preprocessing, AI, exports.
 */

import ImageTracer from "imagetracerjs";
import { removeBackgroundFromCanvas, type BgRemoveSettings, DEFAULT_BG_REMOVE } from "./bg-remover-utils";

/* ─── Types ─────────────────────────────────────────────────────────────── */

export type TracePresetKey =
  | "default"
  | "posterized1"
  | "posterized2"
  | "posterized3"
  | "curvy"
  | "sharp"
  | "detailed"
  | "smoothed"
  | "grayscale"
  | "fixedpalette"
  | "artistic1"
  | "artistic2"
  | "artistic3"
  | "artistic4"
  | "randomsampling1"
  | "randomsampling2";

export type VectorMode =
  | "auto"
  | "logo"
  | "icon"
  | "lineart"
  | "sketch"
  | "handwriting"
  | "photo"
  | "monochrome"
  | "color"
  | "technical";

export type ExportVectorFormat = "svg" | "svg-ai" | "eps" | "pdf";

export interface VectorSettings {
  mode: VectorMode;
  preset: TracePresetKey;
  numberofcolors: number;
  ltres: number;
  qtres: number;
  pathomit: number;
  roundcoords: number;
  strokewidth: number;
  linefilter: boolean;
  viewbox: boolean;
  scale: number;
  maxDimension: number;
  rightangleenhance: boolean;
  blurradius: number;
  blurdelta: number;
  colorsampling: 0 | 1 | 2;
  colorquantcycles: number;
  layering: 0 | 1;
  removeBackground: boolean;
  bgMode: BgRemoveSettings["mode"];
  bgThreshold: number;
  bgFeather: number;
  preserveTransparency: boolean;
  noiseReduction: number;
  edgeEnhance: boolean;
  simplifyPaths: boolean;
  layerGroups: boolean;
  desc: boolean;
  exportFormat: ExportVectorFormat;
}

export interface VectorResult {
  svg: string;
  width: number;
  height: number;
  pathCount: number;
  layerCount: number;
  paletteSize: number;
  bytes: number;
}

export interface ImageAnalysis {
  width: number;
  height: number;
  hasAlpha: boolean;
  uniqueColors: number;
  edgeDensity: number;
  grayscaleRatio: number;
  isSmallIcon: boolean;
  isLineDominant: boolean;
  recommended: Partial<VectorSettings>;
  tips: string[];
}

export interface AiRecommendation {
  settings: Partial<VectorSettings>;
  tips: string[];
  confidence: "high" | "medium" | "low";
  label: string;
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

export const SUPPORTED_VECTOR_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/bmp",
  "image/gif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/tiff",
]);

export const SUPPORTED_VECTOR_EXT =
  /\.(png|jpe?g|webp|bmp|gif|ico|tiff?|tif)$/i;

export const DEFAULT_VECTOR: VectorSettings = {
  mode: "auto",
  preset: "default",
  numberofcolors: 16,
  ltres: 1,
  qtres: 1,
  pathomit: 8,
  roundcoords: 1,
  strokewidth: 1,
  linefilter: false,
  viewbox: true,
  scale: 1,
  maxDimension: 4096,
  rightangleenhance: true,
  blurradius: 0,
  blurdelta: 20,
  colorsampling: 2,
  colorquantcycles: 3,
  layering: 0,
  removeBackground: false,
  bgMode: "auto",
  bgThreshold: 42,
  bgFeather: 8,
  preserveTransparency: true,
  noiseReduction: 0,
  edgeEnhance: false,
  simplifyPaths: true,
  layerGroups: true,
  desc: false,
  exportFormat: "svg",
};

export const VECTOR_MODE_PRESETS: {
  id: VectorMode;
  label: string;
  desc: string;
  patch: Partial<VectorSettings>;
}[] = [
  { id: "auto", label: "Auto (AI)", desc: "Smart analysis picks optimal trace", patch: {} },
  {
    id: "logo",
    label: "Logo",
    desc: "Smooth curves, flat colors, corner polish",
    patch: { preset: "curvy", numberofcolors: 8, pathomit: 4, linefilter: true, rightangleenhance: false },
  },
  {
    id: "icon",
    label: "Icon / UI",
    desc: "Crisp edges, limited palette",
    patch: { preset: "sharp", numberofcolors: 12, qtres: 0.01, pathomit: 2, roundcoords: 2 },
  },
  {
    id: "lineart",
    label: "Line art",
    desc: "Black & white outlines",
    patch: { preset: "posterized3", numberofcolors: 2, linefilter: true, strokewidth: 0, edgeEnhance: true },
  },
  {
    id: "sketch",
    label: "Sketch",
    desc: "Hand-drawn pencil look",
    patch: { preset: "artistic1", numberofcolors: 12, blurradius: 3, linefilter: true },
  },
  {
    id: "handwriting",
    label: "Handwriting",
    desc: "Smooth strokes for signatures & notes",
    patch: { preset: "smoothed", numberofcolors: 4, blurradius: 4, linefilter: true, ltres: 0.5 },
  },
  {
    id: "photo",
    label: "Photo",
    desc: "High color fidelity posterization",
    patch: { preset: "detailed", numberofcolors: 32, pathomit: 2, colorsampling: 2 },
  },
  {
    id: "monochrome",
    label: "Monochrome",
    desc: "Grayscale vector",
    patch: { preset: "grayscale", numberofcolors: 7, colorsampling: 0, colorquantcycles: 1 },
  },
  {
    id: "color",
    label: "Full color",
    desc: "Balanced general tracing",
    patch: { preset: "default", numberofcolors: 24 },
  },
  {
    id: "technical",
    label: "Technical",
    desc: "Diagrams, blueprints, sharp corners",
    patch: { preset: "sharp", numberofcolors: 8, rightangleenhance: true, qtres: 0.01, pathomit: 0 },
  },
];

export const TRACE_PRESET_CATALOG: { id: TracePresetKey; label: string; desc: string }[] = [
  { id: "default", label: "Balanced", desc: "General-purpose" },
  { id: "curvy", label: "Curvy", desc: "Smooth Bézier curves" },
  { id: "sharp", label: "Sharp", desc: "Crisp polygon edges" },
  { id: "detailed", label: "Detailed", desc: "Maximum path fidelity" },
  { id: "smoothed", label: "Smoothed", desc: "Pre-blur + soft paths" },
  { id: "posterized1", label: "Poster 2-color", desc: "Flat dual-tone" },
  { id: "posterized2", label: "Poster 4-color", desc: "Flat quad-tone" },
  { id: "posterized3", label: "Poster B&W", desc: "Line-friendly poster" },
  { id: "grayscale", label: "Grayscale", desc: "Monochrome palette" },
  { id: "artistic1", label: "Artistic sketch", desc: "Stroke-heavy" },
  { id: "artistic2", label: "Artistic minimal", desc: "Minimal strokes" },
  { id: "artistic3", label: "Artistic coarse", desc: "Chunky paths" },
  { id: "artistic4", label: "Artistic rich", desc: "64-color artistic" },
  { id: "fixedpalette", label: "Fixed palette", desc: "27-color preset" },
  { id: "randomsampling1", label: "Sampled 8", desc: "Random color sample" },
  { id: "randomsampling2", label: "Sampled 64", desc: "Rich random sample" },
];

/* ─── ImageTracer bridge ────────────────────────────────────────────────── */

type TracerOptions = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Tracer = ImageTracer as any;

function getPresetBase(preset: TracePresetKey): TracerOptions {
  return { ...(Tracer.optionpresets?.[preset] ?? Tracer.optionpresets?.default ?? {}) };
}

export function buildTraceOptions(settings: VectorSettings): TracerOptions {
  const noiseBlur = settings.noiseReduction > 0 ? Math.min(5, Math.ceil(settings.noiseReduction / 25)) : 0;
  const blurRadius = Math.max(settings.blurradius, noiseBlur);
  const pathomit = settings.simplifyPaths ? settings.pathomit : Math.min(settings.pathomit, 2);

  const merged: TracerOptions = {
    ...getPresetBase(settings.preset),
    numberofcolors: settings.numberofcolors,
    ltres: settings.ltres,
    qtres: settings.qtres,
    pathomit,
    roundcoords: settings.roundcoords,
    strokewidth: settings.strokewidth,
    linefilter: settings.linefilter,
    viewbox: settings.viewbox,
    scale: settings.scale,
    rightangleenhance: settings.rightangleenhance,
    blurradius: blurRadius,
    blurdelta: settings.blurdelta,
    colorsampling: settings.colorsampling,
    colorquantcycles: settings.colorquantcycles,
    layering: settings.layering,
    desc: settings.desc,
  };

  return Tracer.checkoptions(merged);
}

/* ─── Load & preprocess ─────────────────────────────────────────────────── */

export function isSupportedVectorInput(file: File): boolean {
  if (SUPPORTED_VECTOR_MIMES.has(file.type)) return true;
  return SUPPORTED_VECTOR_EXT.test(file.name);
}

export async function loadImageBitmapFromFile(file: File): Promise<ImageBitmap> {
  if (!isSupportedVectorInput(file)) throw new Error(`Unsupported format: ${file.name}`);
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function bitmapToCanvas(bitmap: ImageBitmap, maxDim: number): HTMLCanvasElement {
  let w = bitmap.width;
  let h = bitmap.height;
  if (Math.max(w, h) > maxDim) {
    const r = maxDim / Math.max(w, h);
    w = Math.round(w * r);
    h = Math.round(h * r);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas;
}

function medianDenoise(data: Uint8ClampedArray, w: number, h: number, strength: number): void {
  if (strength <= 0) return;
  const radius = strength > 60 ? 2 : 1;
  const copy = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rs: number[] = [];
      const gs: number[] = [];
      const bs: number[] = [];
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const cx = Math.min(w - 1, Math.max(0, x + dx));
          const cy = Math.min(h - 1, Math.max(0, y + dy));
          const i = (cy * w + cx) * 4;
          rs.push(copy[i]!);
          gs.push(copy[i + 1]!);
          bs.push(copy[i + 2]!);
        }
      }
      rs.sort((a, b) => a - b);
      gs.sort((a, b) => a - b);
      bs.sort((a, b) => a - b);
      const mid = Math.floor(rs.length / 2);
      const o = (y * w + x) * 4;
      data[o] = rs[mid]!;
      data[o + 1] = gs[mid]!;
      data[o + 2] = bs[mid]!;
    }
  }
}

function sobelEdgeEnhance(data: Uint8ClampedArray, w: number, h: number, amount: number): void {
  if (amount <= 0) return;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    gray[i] = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!;
  }
  const out = new Uint8ClampedArray(data);
  const sx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0;
      let gy = 0;
      let k = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const v = gray[(y + j) * w + (x + i)]!;
          gx += v * sx[k]!;
          gy += v * sy[k]!;
          k++;
        }
      }
      const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy) * (amount / 50));
      const o = (y * w + x) * 4;
      out[o] = mag;
      out[o + 1] = mag;
      out[o + 2] = mag;
      out[o + 3] = 255;
    }
  }
  data.set(out);
}

export function preprocessToImageData(canvas: HTMLCanvasElement, settings: VectorSettings): ImageData {
  let work = canvas;

  if (settings.removeBackground) {
    const bg: BgRemoveSettings = {
      ...DEFAULT_BG_REMOVE,
      mode: settings.bgMode,
      threshold: settings.bgThreshold,
      feather: settings.bgFeather,
    };
    work = removeBackgroundFromCanvas(work, bg);
  }

  const ctx = work.getContext("2d")!;
  const { width: w, height: h } = work;
  const img = ctx.getImageData(0, 0, w, h);

  if (settings.noiseReduction > 0 && settings.noiseReduction !== settings.blurradius) {
    medianDenoise(img.data, w, h, settings.noiseReduction);
  }

  if (settings.edgeEnhance) {
    sobelEdgeEnhance(img.data, w, h, 80);
  }

  if (!settings.preserveTransparency) {
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
  }

  return img;
}

export async function fileToImageData(file: File, settings: VectorSettings): Promise<ImageData> {
  const bmp = await loadImageBitmapFromFile(file);
  try {
    const canvas = bitmapToCanvas(bmp, settings.maxDimension);
    return preprocessToImageData(canvas, settings);
  } finally {
    bmp.close();
  }
}

/* ─── Trace ─────────────────────────────────────────────────────────────── */

export function traceImageDataToSvg(imageData: ImageData, settings: VectorSettings): VectorResult {
  const opts = buildTraceOptions(settings);
  const td = Tracer.imagedataToTracedata(imageData, opts) as {
    width: number;
    height: number;
    layers: unknown[][];
    palette: unknown[];
  };

  let svg: string;
  if (settings.layerGroups) {
    const w = td.width * (opts.scale as number);
    const h = td.height * (opts.scale as number);
    const parts = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`,
    ];
    for (let l = 0; l < td.layers.length; l++) {
      parts.push(`<g id="layer-${l + 1}" inkscape:label="Layer ${l + 1}" inkscape:groupmode="layer">`);
      const layer = td.layers[l]!;
      for (let p = 0; p < layer.length; p++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(layer[p] as any).isholepath) {
          parts.push(Tracer.svgpathstring(td, l, p, opts));
        }
      }
      parts.push("</g>");
    }
    parts.push("</svg>");
    svg = parts.join("");
  } else {
    svg = Tracer.getsvgstring(td, opts) as string;
  }

  if (settings.exportFormat === "svg-ai" || settings.layerGroups) {
    svg = wrapIllustratorSvg(svg, td.width, td.height);
  }

  let pathCount = 0;
  for (const layer of td.layers) pathCount += layer.length;

  return {
    svg,
    width: td.width,
    height: td.height,
    pathCount,
    layerCount: td.layers.length,
    paletteSize: td.palette.length,
    bytes: new Blob([svg]).size,
  };
}

function wrapIllustratorSvg(svg: string, w: number, h: number): string {
  if (svg.includes("Adobe Illustrator")) return svg;
  const header = `<!-- Generator: ToolNest Ultra Vector Studio -->
<metadata>
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title>ToolNest Vector Export</dc:title>
      <dc:creator>ToolNest</dc:creator>
    </rdf:Description>
  </rdf:RDF>
</metadata>`;
  if (!svg.startsWith("<?xml")) {
    svg = `<?xml version="1.0" encoding="UTF-8"?>\n${svg}`;
  }
  return svg.replace(/<svg([^>]*)>/, `<svg$1 xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">\n${header}`);
}

/* ─── AI analysis ───────────────────────────────────────────────────────── */

export function analyzeImageData(imageData: ImageData): ImageAnalysis {
  const { width, height, data } = imageData;
  const colors = new Set<string>();
  let alphaPixels = 0;
  let grayPixels = 0;
  let edgeSum = 0;
  const total = width * height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const a = data[i + 3]!;
    if (a < 250) alphaPixels++;
    colors.add(`${r >> 4},${g >> 4},${b >> 4}`);
    if (Math.abs(r - g) < 12 && Math.abs(g - b) < 12) grayPixels++;
  }

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const i = (y * width + x) * 4;
      const i2 = (y * width + x + 1) * 4;
      edgeSum += Math.abs(data[i]! - data[i2]!) + Math.abs(data[i + 1]! - data[i2 + 1]!);
    }
  }

  const uniqueColors = colors.size;
  const hasAlpha = alphaPixels / total > 0.02;
  const grayscaleRatio = grayPixels / total;
  const edgeDensity = edgeSum / (total * 255 * 2);
  const isSmallIcon = Math.max(width, height) <= 256 && uniqueColors < 48;
  const isLineDominant = grayscaleRatio > 0.85 && uniqueColors < 24 && edgeDensity > 0.08;

  const recommended = deriveRecommendedSettings({
    uniqueColors,
    hasAlpha,
    edgeDensity,
    grayscaleRatio,
    isSmallIcon,
    isLineDominant,
    width,
    height,
  });

  const tips: string[] = [];
  if (hasAlpha) tips.push("Transparency detected — enable preserve alpha & optional background removal.");
  if (isSmallIcon) tips.push("Small icon — use Icon mode with sharp preset and ≤12 colors.");
  if (isLineDominant) tips.push("Line-dominant image — Line art or Monochrome mode recommended.");
  if (uniqueColors > 128) tips.push("High color count — reduce colors or use Photo mode with 32+ palette.");
  if (Math.max(width, height) > 2048) tips.push("Large image — max dimension cap improves trace speed.");

  return {
    width,
    height,
    hasAlpha,
    uniqueColors,
    edgeDensity,
    grayscaleRatio,
    isSmallIcon,
    isLineDominant,
    recommended,
    tips,
  };
}

function deriveRecommendedSettings(input: {
  uniqueColors: number;
  hasAlpha: boolean;
  edgeDensity: number;
  grayscaleRatio: number;
  isSmallIcon: boolean;
  isLineDominant: boolean;
  width: number;
  height: number;
}): Partial<VectorSettings> {
  if (input.isSmallIcon) {
    return {
      mode: "icon",
      preset: "sharp",
      numberofcolors: Math.min(12, Math.max(4, Math.ceil(input.uniqueColors / 4))),
      pathomit: 2,
      qtres: 0.01,
      removeBackground: input.hasAlpha,
    };
  }
  if (input.isLineDominant) {
    return {
      mode: "lineart",
      preset: "posterized3",
      numberofcolors: 2,
      edgeEnhance: true,
      linefilter: true,
      removeBackground: input.hasAlpha,
    };
  }
  if (input.uniqueColors <= 16 && input.edgeDensity < 0.06) {
    return {
      mode: "logo",
      preset: "curvy",
      numberofcolors: Math.min(12, input.uniqueColors),
      pathomit: 4,
      removeBackground: input.hasAlpha,
    };
  }
  if (input.grayscaleRatio > 0.9) {
    return { mode: "monochrome", preset: "grayscale", numberofcolors: 7 };
  }
  if (input.uniqueColors > 64) {
    return {
      mode: "photo",
      preset: "detailed",
      numberofcolors: 32,
      maxDimension: Math.min(2048, Math.max(input.width, input.height)),
    };
  }
  return { mode: "color", preset: "default", numberofcolors: 24, removeBackground: input.hasAlpha };
}

export function aiVectorRecommendations(analysis: ImageAnalysis): AiRecommendation {
  const rec = analysis.recommended;
  let label = "Balanced color trace";
  let confidence: AiRecommendation["confidence"] = "medium";

  if (analysis.isSmallIcon) {
    label = "Icon / UI optimization";
    confidence = "high";
  } else if (analysis.isLineDominant) {
    label = "Line art / monochrome";
    confidence = "high";
  } else if (analysis.uniqueColors <= 16) {
    label = "Logo vectorization";
    confidence = "high";
  } else if (analysis.uniqueColors > 64) {
    label = "Photo posterization";
    confidence = "medium";
  }

  return {
    settings: rec,
    tips: analysis.tips,
    confidence,
    label,
  };
}

export function applyModePreset(settings: VectorSettings, mode: VectorMode): VectorSettings {
  const found = VECTOR_MODE_PRESETS.find((m) => m.id === mode);
  if (!found || mode === "auto") return settings;
  return { ...settings, ...found.patch, mode };
}

/* ─── Vectorize file / batch ────────────────────────────────────────────── */

export async function vectorizeFile(file: File, settings: VectorSettings): Promise<VectorResult> {
  const imageData = await fileToImageData(file, settings);
  return traceImageDataToSvg(imageData, settings);
}

export async function vectorizeBatch(
  files: File[],
  settings: VectorSettings,
  onProgress?: (done: number, total: number) => void,
  useWorker = true,
): Promise<{ name: string; result: VectorResult }[]> {
  const out: { name: string; result: VectorResult }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    let result: VectorResult;
    if (useWorker) {
      const w = await vectorizeInWorker(f, settings);
      result = w ?? (await vectorizeFile(f, settings));
    } else {
      result = await vectorizeFile(f, settings);
    }
    const base = f.name.replace(/\.[^.]+$/i, "");
    out.push({ name: `${base}.svg`, result });
    onProgress?.(i + 1, files.length);
  }
  return out;
}

/* ─── Export formats ────────────────────────────────────────────────────── */

export function svgToEps(svg: string, width: number, height: number): string {
  const paths = [...svg.matchAll(/<path[^>]*d="([^"]+)"[^>]*(?:fill="([^"]*)")?[^>]*\/>/g)];
  const lines = [
    "%!PS-Adobe-3.0 EPSF-3.0",
    `%%BoundingBox: 0 0 ${width} ${height}`,
    "%%Creator: ToolNest Ultra Vector Studio",
    "%%EndComments",
    "gsave",
  ];
  for (const m of paths) {
    const d = m[1]!;
    const fill = m[2] ?? "black";
    lines.push(`${fill !== "black" ? `% fill ${fill}` : ""}`);
    lines.push(convertSvgPathToPs(d));
    lines.push("fill");
  }
  lines.push("grestore", "showpage", "%%EOF");
  return lines.join("\n");
}

function convertSvgPathToPs(d: string): string {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const ps: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i]!;
    if (cmd === "M" || cmd === "m") {
      ps.push(`${tokens[i + 1]} ${tokens[i + 2]} moveto`);
      i += 3;
    } else if (cmd === "L" || cmd === "l") {
      ps.push(`${tokens[i + 1]} ${tokens[i + 2]} lineto`);
      i += 3;
    } else if (cmd === "Z" || cmd === "z") {
      ps.push("closepath");
      i += 1;
    } else if (cmd === "Q" || cmd === "q") {
      ps.push(`${tokens[i + 1]} ${tokens[i + 2]} ${tokens[i + 3]} ${tokens[i + 4]} curveto`);
      i += 5;
    } else if (cmd === "C" || cmd === "c") {
      ps.push(
        `${tokens[i + 1]} ${tokens[i + 2]} ${tokens[i + 3]} ${tokens[i + 4]} ${tokens[i + 5]} ${tokens[i + 6]} curveto`,
      );
      i += 7;
    } else {
      i += 1;
    }
  }
  return ps.join("\n");
}

export async function svgToPdfBlob(svg: string, width: number, height: number): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const scale = Math.min(1, 4096 / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("SVG render failed"));
      el.src = url;
    });
    ctx.drawImage(img, 0, 0, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }

  const pdf = new jsPDF({
    orientation: w > h ? "landscape" : "portrait",
    unit: "px",
    format: [w, h],
    hotfixes: ["px_scaling"],
  });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, w, h);
  return pdf.output("blob");
}

export async function exportVectorResult(
  result: VectorResult,
  format: ExportVectorFormat,
  baseName: string,
): Promise<{ blob: Blob; filename: string }> {
  switch (format) {
    case "svg":
      return { blob: new Blob([result.svg], { type: "image/svg+xml;charset=utf-8" }), filename: `${baseName}.svg` };
    case "svg-ai":
      return {
        blob: new Blob([wrapIllustratorSvg(result.svg, result.width, result.height)], {
          type: "image/svg+xml;charset=utf-8",
        }),
        filename: `${baseName}-ai.svg`,
      };
    case "eps":
      return {
        blob: new Blob([svgToEps(result.svg, result.width, result.height)], { type: "application/postscript" }),
        filename: `${baseName}.eps`,
      };
    case "pdf":
      return { blob: await svgToPdfBlob(result.svg, result.width, result.height), filename: `${baseName}.pdf` };
    default:
      return { blob: new Blob([result.svg], { type: "image/svg+xml" }), filename: `${baseName}.svg` };
  }
}

export async function zipVectorExports(
  items: { name: string; blob: Blob }[],
): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  items.forEach((i) => zip.file(i.name, i.blob));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function svgStringToBlob(svg: string): Blob {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

export function estimateSvgSize(svg: string): number {
  return new Blob([svg]).size;
}

export function mergeVectorSettings(base: VectorSettings, patch: Partial<VectorSettings>): VectorSettings {
  return { ...base, ...patch };
}

/* ─── Web Worker ────────────────────────────────────────────────────────── */

const WORKER_SRC = `
importScripts('https://unpkg.com/imagetracerjs@1.2.6/imagetracer_v1.2.6.js');
self.onmessage = function(e) {
  var d = e.data;
  try {
    var imageData = new ImageData(new Uint8ClampedArray(d.buffer), d.width, d.height);
    var tracer = self.ImageTracer;
    var opts = tracer.checkoptions(d.options);
    var svg;
    if (d.layerGroups) {
      var td = tracer.imagedataToTracedata(imageData, opts);
      var w = td.width * opts.scale;
      var h = td.height * opts.scale;
      var parts = ['<?xml version="1.0" encoding="UTF-8"?><svg viewBox="0 0 '+w+' '+h+'" xmlns="http://www.w3.org/2000/svg">'];
      for (var l = 0; l < td.layers.length; l++) {
        parts.push('<g id="layer-'+(l+1)+'">');
        for (var p = 0; p < td.layers[l].length; p++) {
          if (!td.layers[l][p].isholepath) parts.push(tracer.svgpathstring(td, l, p, opts));
        }
        parts.push('</g>');
      }
      parts.push('</svg>');
      svg = parts.join('');
    } else {
      svg = tracer.imagedataToSVG(imageData, opts);
    }
    self.postMessage({ id: d.id, ok: true, svg: svg, width: d.width, height: d.height });
  } catch (err) {
    self.postMessage({ id: d.id, ok: false, error: String(err && err.message || err) });
  }
};
`;

let workerUrl: string | null = null;
let traceWorker: Worker | null = null;

function getTraceWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!traceWorker) {
    try {
      if (!workerUrl) {
        workerUrl = URL.createObjectURL(new Blob([WORKER_SRC], { type: "application/javascript" }));
      }
      traceWorker = new Worker(workerUrl);
    } catch {
      return null;
    }
  }
  return traceWorker;
}

export async function vectorizeInWorker(
  file: File,
  settings: VectorSettings,
): Promise<VectorResult | null> {
  const w = getTraceWorker();
  if (!w) return null;
  try {
    const imageData = await fileToImageData(file, settings);
    const opts = buildTraceOptions(settings);
    const id = Math.random().toString(36).slice(2);
    const buffer = imageData.data.buffer.slice(0);

    return new Promise((resolve, reject) => {
      const onMsg = (e: MessageEvent) => {
        const d = e.data as { id: string; ok: boolean; svg?: string; error?: string; width?: number; height?: number };
        if (d.id !== id) return;
        w.removeEventListener("message", onMsg);
        if (!d.ok || !d.svg) {
          reject(new Error(d.error ?? "Worker trace failed"));
          return;
        }
        const pathCount = (d.svg.match(/<path/g) ?? []).length;
        const layerCount = (d.svg.match(/<g id="layer-/g) ?? []).length || 1;
        resolve({
          svg: d.svg,
          width: d.width ?? imageData.width,
          height: d.height ?? imageData.height,
          pathCount,
          layerCount,
          paletteSize: settings.numberofcolors,
          bytes: new Blob([d.svg]).size,
        });
      };
      w.addEventListener("message", onMsg);
      w.postMessage(
        {
          id,
          buffer,
          width: imageData.width,
          height: imageData.height,
          options: opts,
          layerGroups: settings.layerGroups,
        },
        [buffer],
      );
    });
  } catch {
    return null;
  }
}

/** Server-side trace helper (Node) — raw RGBA buffer */
export function traceRawBufferToSvg(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  settings: Partial<VectorSettings>,
): VectorResult {
  const full = { ...DEFAULT_VECTOR, ...settings };
  const imageData = { data, width, height } as ImageData;
  return traceImageDataToSvg(imageData, full);
}
