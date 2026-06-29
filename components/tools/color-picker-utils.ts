/**
 * Ultra Image Color Picker — conversions, WCAG, palette extraction, exports.
 * 100% client-side via Canvas. Worker-accelerated dominant color detection.
 */

import { isSupportedInput } from "./image-compressor-utils";

export type ColorFormat =
  | "hex"
  | "hexa"
  | "rgb"
  | "rgba"
  | "hsl"
  | "hsla"
  | "hsv"
  | "hsb"
  | "cmyk"
  | "lab"
  | "lch"
  | "xyz"
  | "css"
  | "tailwind"
  | "material";

export type PaletteExportFormat = "css" | "json" | "txt" | "gpl" | "ase" | "svg" | "pdf";
export type ColorBlindMode = "normal" | "protanopia" | "deuteranopia" | "tritanopia";
export type PaletteSort = "frequency" | "hue" | "lightness" | "saturation";

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface PickedColor {
  id: string;
  rgba: Rgba;
  x: number;
  y: number;
  ts: number;
}

export interface ColorValues {
  hex: string;
  hexa: string;
  rgb: string;
  rgba: string;
  hsl: string;
  hsla: string;
  hsv: string;
  hsb: string;
  cmyk: string;
  lab: string;
  lch: string;
  xyz: string;
  cssVar: string;
}

export interface ContrastResult {
  ratio: number;
  aaNormal: boolean;
  aaLarge: boolean;
  aaaNormal: boolean;
  aaaLarge: boolean;
}

export interface NamedMatch {
  name: string;
  hex: string;
  deltaE: number;
}

export interface GradientHint {
  direction: "horizontal" | "vertical" | "diagonal";
  start: string;
  end: string;
  confidence: number;
}

export interface ColorRecommendation {
  title: string;
  detail: string;
  action?: "extract" | "contrast" | "complement" | "tailwind";
}

export interface ImageColorMeta {
  width: number;
  height: number;
  hasAlpha: boolean;
  name: string;
  bytes: number;
}

export { isSupportedInput };

/* ─── Math helpers ─── */

function clamp(v: number, lo: number, hi: number): number {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function pad2(n: number): string {
  return Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
}

export function rgbaToHex(r: number, g: number, b: number, a = 255): { hex: string; hexa: string } {
  const hex = `#${pad2(r)}${pad2(g)}${pad2(b)}`;
  const hexa = a >= 255 ? hex : `${hex}${pad2(a)}`;
  return { hex, hexa };
}

export function hexToRgba(hex: string): Rgba | null {
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
    a: m[2] ? parseInt(m[2], 16) : 255,
  };
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
}

export function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k >= 1) return [0, 0, 0, 100];
  const c = ((1 - rr - k) / (1 - k)) * 100;
  const m = ((1 - gg - k) / (1 - k)) * 100;
  const y = ((1 - bb - k) / (1 - k)) * 100;
  return [Math.round(c), Math.round(m), Math.round(y), Math.round(k * 100)];
}

function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  let rr = r / 255;
  let gg = g / 255;
  let bb = b / 255;
  rr = rr > 0.04045 ? ((rr + 0.055) / 1.055) ** 2.4 : rr / 12.92;
  gg = gg > 0.04045 ? ((gg + 0.055) / 1.055) ** 2.4 : gg / 12.92;
  bb = bb > 0.04045 ? ((bb + 0.055) / 1.055) ** 2.4 : bb / 12.92;
  return [
    (rr * 0.4124564 + gg * 0.3575761 + bb * 0.1804375) * 100,
    (rr * 0.2126729 + gg * 0.7151522 + bb * 0.072175) * 100,
    (rr * 0.0193339 + gg * 0.119192 + bb * 0.9503041) * 100,
  ];
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const refX = 95.047;
  const refY = 100;
  const refZ = 108.883;
  let xx = x / refX;
  let yy = y / refY;
  let zz = z / refZ;
  const f = (t: number) => (t > 0.008856 ? t ** (1 / 3) : 7.787 * t + 16 / 116);
  xx = f(xx);
  yy = f(yy);
  zz = f(zz);
  return [
    Math.round(116 * yy - 16),
    Math.round(500 * (xx - yy)),
    Math.round(200 * (yy - zz)),
  ];
}

function labToLch(l: number, a: number, b: number): [number, number, number] {
  const c = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [Math.round(l), Math.round(c), Math.round(h)];
}

export function rgbaToValues(c: Rgba): ColorValues {
  const { r, g, b, a } = c;
  const { hex, hexa } = rgbaToHex(r, g, b, a);
  const [h, s, l] = rgbToHsl(r, g, b);
  const [hv, sv, vv] = rgbToHsv(r, g, b);
  const [cc, mm, yy, kk] = rgbToCmyk(r, g, b);
  const [x, y, z] = rgbToXyz(r, g, b);
  const [labL, labA, labB] = xyzToLab(x, y, z);
  const [lchL, lchC, lchH] = labToLch(labL, labA, labB);
  const alphaPct = Math.round((a / 255) * 1000) / 1000;
  return {
    hex,
    hexa,
    rgb: `rgb(${r}, ${g}, ${b})`,
    rgba: `rgba(${r}, ${g}, ${b}, ${alphaPct})`,
    hsl: `hsl(${h}, ${s}%, ${l}%)`,
    hsla: `hsla(${h}, ${s}%, ${l}%, ${alphaPct})`,
    hsv: `hsv(${hv}, ${sv}%, ${vv}%)`,
    hsb: `hsb(${hv}, ${sv}%, ${vv}%)`,
    cmyk: `cmyk(${cc}%, ${mm}%, ${yy}%, ${kk}%)`,
    lab: `lab(${labL} ${labA} ${labB})`,
    lch: `lch(${lchL} ${lchC} ${lchH})`,
    xyz: `xyz(${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)})`,
    cssVar: `--picked-color: ${hex};`,
  };
}

export function formatColor(c: Rgba, fmt: ColorFormat): string {
  const v = rgbaToValues(c);
  if (fmt === "tailwind" || fmt === "material") {
    const match = fmt === "tailwind" ? nearestTailwind(c) : nearestMaterial(c);
    return `${match.name} (${match.hex})`;
  }
  return v[fmt === "css" ? "cssVar" : fmt] ?? v.hex;
}

/* ─── WCAG contrast ─── */

function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs! + 0.7152 * gs! + 0.0722 * bs!;
}

export function contrastRatio(a: Rgba, b: Rgba): ContrastResult {
  const l1 = relativeLuminance(a.r, a.g, a.b);
  const l2 = relativeLuminance(b.r, b.g, b.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const ratio = Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}

/* ─── Color blindness simulation (Brettel/Vienot matrices) ─── */

const CB_MATRICES: Record<Exclude<ColorBlindMode, "normal">, number[][]> = {
  protanopia: [
    [0.56667, 0.43333, 0],
    [0.55833, 0.44167, 0],
    [0, 0.24167, 0.75833],
  ],
  deuteranopia: [
    [0.625, 0.375, 0],
    [0.7, 0.3, 0],
    [0, 0.3, 0.7],
  ],
  tritanopia: [
    [0.95, 0.05, 0],
    [0, 0.43333, 0.56667],
    [0, 0.475, 0.525],
  ],
};

export function simulateColorBlindness(c: Rgba, mode: ColorBlindMode): Rgba {
  if (mode === "normal") return c;
  const m = CB_MATRICES[mode];
  return {
    r: clamp(Math.round(c.r * m[0]![0]! + c.g * m[0]![1]! + c.b * m[0]![2]!), 0, 255),
    g: clamp(Math.round(c.r * m[1]![0]! + c.g * m[1]![1]! + c.b * m[1]![2]!), 0, 255),
    b: clamp(Math.round(c.r * m[2]![0]! + c.g * m[2]![1]! + c.b * m[2]![2]!), 0, 255),
    a: c.a,
  };
}

/* ─── Named color libraries ─── */

const TAILWIND_COLORS: { name: string; hex: string }[] = [
  { name: "slate-500", hex: "#64748b" }, { name: "gray-500", hex: "#6b7280" },
  { name: "zinc-500", hex: "#71717a" }, { name: "neutral-500", hex: "#737373" },
  { name: "stone-500", hex: "#78716c" }, { name: "red-500", hex: "#ef4444" },
  { name: "orange-500", hex: "#f97316" }, { name: "amber-500", hex: "#f59e0b" },
  { name: "yellow-500", hex: "#eab308" }, { name: "lime-500", hex: "#84cc16" },
  { name: "green-500", hex: "#22c55e" }, { name: "emerald-500", hex: "#10b981" },
  { name: "teal-500", hex: "#14b8a6" }, { name: "cyan-500", hex: "#06b6d4" },
  { name: "sky-500", hex: "#0ea5e9" }, { name: "blue-500", hex: "#3b82f6" },
  { name: "indigo-500", hex: "#6366f1" }, { name: "violet-500", hex: "#8b5cf6" },
  { name: "purple-500", hex: "#a855f7" }, { name: "fuchsia-500", hex: "#d946ef" },
  { name: "pink-500", hex: "#ec4899" }, { name: "rose-500", hex: "#f43f5e" },
  { name: "white", hex: "#ffffff" }, { name: "black", hex: "#000000" },
];

const MATERIAL_COLORS: { name: string; hex: string }[] = [
  { name: "Red 500", hex: "#f44336" }, { name: "Pink 500", hex: "#e91e63" },
  { name: "Purple 500", hex: "#9c27b0" }, { name: "Deep Purple 500", hex: "#673ab7" },
  { name: "Indigo 500", hex: "#3f51b5" }, { name: "Blue 500", hex: "#2196f3" },
  { name: "Light Blue 500", hex: "#03a9f4" }, { name: "Cyan 500", hex: "#00bcd4" },
  { name: "Teal 500", hex: "#009688" }, { name: "Green 500", hex: "#4caf50" },
  { name: "Light Green 500", hex: "#8bc34a" }, { name: "Lime 500", hex: "#cddc39" },
  { name: "Yellow 500", hex: "#ffeb3b" }, { name: "Amber 500", hex: "#ffc107" },
  { name: "Orange 500", hex: "#ff9800" }, { name: "Deep Orange 500", hex: "#ff5722" },
  { name: "Brown 500", hex: "#795548" }, { name: "Grey 500", hex: "#9e9e9e" },
  { name: "Blue Grey 500", hex: "#607d8b" },
];

const PANTONE_APPROX: { name: string; hex: string }[] = [
  { name: "PMS 186 C", hex: "#c8102e" }, { name: "PMS 286 C", hex: "#0033a0" },
  { name: "PMS 347 C", hex: "#009639" }, { name: "PMS 109 C", hex: "#ffd100" },
  { name: "PMS Orange 021 C", hex: "#fe5000" }, { name: "PMS 877 C", hex: "#8a8d8f" },
  { name: "PMS Black C", hex: "#2d2926" }, { name: "PMS 485 C", hex: "#da291c" },
  { name: "PMS 300 C", hex: "#005eb8" }, { name: "PMS 376 C", hex: "#78be20" },
  { name: "PMS 2597 C", hex: "#5c068c" }, { name: "PMS 7406 C", hex: "#f0b323" },
  { name: "PMS 3278 C", hex: "#008675" }, { name: "PMS Reflex Blue C", hex: "#001489" },
  { name: "PMS 199 C", hex: "#d50032" },
];

function deltaE76(lab1: [number, number, number], lab2: [number, number, number]): number {
  return Math.sqrt(
    (lab1[0] - lab2[0]) ** 2 + (lab1[1] - lab2[1]) ** 2 + (lab1[2] - lab2[2]) ** 2,
  );
}

function rgbaToLab(c: Rgba): [number, number, number] {
  const [x, y, z] = rgbToXyz(c.r, c.g, c.b);
  return xyzToLab(x, y, z);
}

function nearestInList(c: Rgba, list: { name: string; hex: string }[]): NamedMatch {
  const lab = rgbaToLab(c);
  let best = list[0]!;
  let bestD = Infinity;
  for (const item of list) {
    const rgb = hexToRgba(item.hex)!;
    const d = deltaE76(lab, rgbaToLab(rgb));
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return { name: best.name, hex: best.hex, deltaE: Math.round(bestD * 10) / 10 };
}

export function nearestTailwind(c: Rgba): NamedMatch {
  return nearestInList(c, TAILWIND_COLORS);
}

export function nearestMaterial(c: Rgba): NamedMatch {
  return nearestInList(c, MATERIAL_COLORS);
}

export function nearestPantone(c: Rgba): NamedMatch {
  return nearestInList(c, PANTONE_APPROX);
}

export function complementaryColor(c: Rgba): Rgba {
  const [h, s, l] = rgbToHsl(c.r, c.g, c.b);
  const nh = (h + 180) % 360;
  return hslToRgba(nh, s, l, c.a);
}

function hslToRgba(h: number, s: number, l: number, a: number): Rgba {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a,
  };
}

/* ─── Image loading & picking ─── */

export async function loadImageToCanvas(file: File): Promise<{ canvas: HTMLCanvasElement; meta: ImageColorMeta }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 16) {
    if (data[i]! < 255) { hasAlpha = true; break; }
  }
  return {
    canvas,
    meta: { width: canvas.width, height: canvas.height, hasAlpha, name: file.name, bytes: file.size },
  };
}

export async function loadImageFromUrl(url: string): Promise<{ canvas: HTMLCanvasElement; meta: ImageColorMeta }> {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error(`Failed to fetch image (${res.status})`);
  const blob = await res.blob();
  const file = new File([blob], "url-image", { type: blob.type || "image/png" });
  return loadImageToCanvas(file);
}

export function pickPixel(canvas: HTMLCanvasElement, x: number, y: number): Rgba {
  const cx = clamp(Math.floor(x), 0, canvas.width - 1);
  const cy = clamp(Math.floor(y), 0, canvas.height - 1);
  const [r, g, b, a] = canvas.getContext("2d")!.getImageData(cx, cy, 1, 1).data;
  return { r: r!, g: g!, b: b!, a: a! };
}

export function clientToImageCoords(
  clientX: number,
  clientY: number,
  imgRect: DOMRect,
  imgNaturalW: number,
  imgNaturalH: number,
): { x: number; y: number } {
  const x = clamp(Math.floor(((clientX - imgRect.left) / imgRect.width) * imgNaturalW), 0, imgNaturalW - 1);
  const y = clamp(Math.floor(((clientY - imgRect.top) / imgRect.height) * imgNaturalH), 0, imgNaturalH - 1);
  return { x, y };
}

/** Magnifier lens: returns data URL of zoomed pixel grid. */
export function renderMagnifierLens(
  canvas: HTMLCanvasElement,
  cx: number,
  cy: number,
  zoom: number,
  displaySize = 160,
): string {
  const z = clamp(zoom, 2, 1000);
  const srcPx = Math.max(1, Math.ceil(displaySize / z));
  const half = Math.floor(srcPx / 2);
  const sx = clamp(cx - half, 0, canvas.width - srcPx);
  const sy = clamp(cy - half, 0, canvas.height - srcPx);
  const out = document.createElement("canvas");
  out.width = displaySize;
  out.height = displaySize;
  const ctx = out.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, sx, sy, srcPx, srcPx, 0, 0, displaySize, displaySize);
  // grid lines at high zoom
  if (z >= 8) {
    const cell = displaySize / srcPx;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= srcPx; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, displaySize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(displaySize, i * cell);
      ctx.stroke();
    }
    // center crosshair
    ctx.strokeStyle = "#ff0066";
    ctx.lineWidth = 2;
    const mid = displaySize / 2;
    ctx.beginPath();
    ctx.moveTo(mid - 8, mid);
    ctx.lineTo(mid + 8, mid);
    ctx.moveTo(mid, mid - 8);
    ctx.lineTo(mid, mid + 8);
    ctx.stroke();
  }
  return out.toDataURL();
}

/* ─── Dominant colors (median-cut style) ─── */

export interface PaletteColor {
  rgba: Rgba;
  hex: string;
  count: number;
  percentage: number;
}

function quantizeChannel(v: number, bits: number): number {
  const step = 255 / (2 ** bits - 1);
  return Math.round(v / step) * step;
}

export function extractDominantColors(
  canvas: HTMLCanvasElement,
  count = 8,
  ignoreTransparent = true,
): PaletteColor[] {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
  const step = Math.max(1, Math.floor(Math.min(w, h) / 128));
  const buckets = new Map<string, { rgba: Rgba; count: number }>();
  let total = 0;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      if (ignoreTransparent && a < 128) continue;
      const qr = quantizeChannel(r, 4);
      const qg = quantizeChannel(g, 4);
      const qb = quantizeChannel(b, 4);
      const key = `${qr},${qg},${qb}`;
      const prev = buckets.get(key);
      if (prev) prev.count++;
      else buckets.set(key, { rgba: { r: qr, g: qg, b: qb, a: 255 }, count: 1 });
      total++;
    }
  }

  const sorted = [...buckets.values()].sort((a, b) => b.count - a.count).slice(0, count);
  return sorted.map((b) => ({
    rgba: b.rgba,
    hex: rgbaToHex(b.rgba.r, b.rgba.g, b.rgba.b).hex,
    count: b.count,
    percentage: total ? Math.round((b.count / total) * 1000) / 10 : 0,
  }));
}

export function dedupePalette(colors: PaletteColor[], threshold = 12): PaletteColor[] {
  const out: PaletteColor[] = [];
  for (const c of colors) {
    const lab = rgbaToLab(c.rgba);
    if (out.every((o) => deltaE76(lab, rgbaToLab(o.rgba)) > threshold)) out.push(c);
  }
  return out;
}

export function sortPalette(colors: PaletteColor[], mode: PaletteSort): PaletteColor[] {
  const copy = [...colors];
  if (mode === "frequency") return copy.sort((a, b) => b.count - a.count);
  if (mode === "hue") {
    return copy.sort((a, b) => rgbToHsl(a.rgba.r, a.rgba.g, a.rgba.b)[0] - rgbToHsl(b.rgba.r, b.rgba.g, b.rgba.b)[0]);
  }
  if (mode === "lightness") {
    return copy.sort((a, b) => rgbToHsl(a.rgba.r, a.rgba.g, a.rgba.b)[2] - rgbToHsl(b.rgba.r, b.rgba.g, b.rgba.b)[2]);
  }
  return copy.sort((a, b) => rgbToHsl(a.rgba.r, a.rgba.g, a.rgba.b)[1] - rgbToHsl(b.rgba.r, b.rgba.g, b.rgba.b)[1]);
}

/* ─── Gradient detection (heuristic) ─── */

export function detectGradients(canvas: HTMLCanvasElement): GradientHint[] {
  const { width: w, height: h } = canvas;
  const ctx = canvas.getContext("2d")!;
  const hints: GradientHint[] = [];
  const midY = Math.floor(h / 2);
  const left = pickPixel(canvas, 0, midY);
  const right = pickPixel(canvas, w - 1, midY);
  const hDiff = deltaE76(rgbaToLab(left), rgbaToLab(right));
  if (hDiff > 25) {
    hints.push({
      direction: "horizontal",
      start: rgbaToHex(left.r, left.g, left.b).hex,
      end: rgbaToHex(right.r, right.g, right.b).hex,
      confidence: Math.min(100, Math.round(hDiff)),
    });
  }
  const midX = Math.floor(w / 2);
  const top = pickPixel(canvas, midX, 0);
  const bottom = pickPixel(canvas, midX, h - 1);
  const vDiff = deltaE76(rgbaToLab(top), rgbaToLab(bottom));
  if (vDiff > 25) {
    hints.push({
      direction: "vertical",
      start: rgbaToHex(top.r, top.g, top.b).hex,
      end: rgbaToHex(bottom.r, bottom.g, bottom.b).hex,
      confidence: Math.min(100, Math.round(vDiff)),
    });
  }
  return hints;
}

/* ─── Palette exports ─── */

export function exportPaletteCSS(colors: string[], name = "toolnest-palette"): string {
  const vars = colors.map((c, i) => `  --color-${i + 1}: ${c};`).join("\n");
  const classes = colors.map((c, i) => `.bg-palette-${i + 1} { background-color: ${c}; }`).join("\n");
  return `:root {\n  /* ${name} */\n${vars}\n}\n\n${classes}`;
}

export function exportPaletteJSON(colors: PaletteColor[], name: string): string {
  return JSON.stringify({
    name,
    colors: colors.map((c, i) => ({
      index: i + 1,
      hex: c.hex,
      rgb: [c.rgba.r, c.rgba.g, c.rgba.b],
      percentage: c.percentage,
    })),
  }, null, 2);
}

export function exportPaletteTXT(colors: string[]): string {
  return colors.join("\n");
}

export function exportPaletteGPL(colors: string[], name = "ToolNest"): string {
  const lines = ["GIMP Palette", `Name: ${name}`, "Columns: 8", "#"];
  for (const hex of colors) {
    const c = hexToRgba(hex);
    if (!c) continue;
    lines.push(`${c.r} ${c.g} ${c.b}\t${hex}`);
  }
  return lines.join("\n");
}

export function exportPaletteSVG(colors: string[], name = "Palette"): string {
  const sw = 64;
  const rects = colors.map((c, i) =>
    `<rect x="${i * sw}" y="0" width="${sw}" height="${sw}" fill="${c}"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${colors.length * sw}" height="${sw}" viewBox="0 0 ${colors.length * sw} ${sw}"><title>${name}</title>${rects}</svg>`;
}

/** Minimal ASE (Adobe Swatch Exchange) binary export. */
export function exportPaletteASE(colors: string[], name = "ToolNest"): Blob {
  const blocks: number[] = [];
  const writeU16 = (v: number) => { blocks.push((v >> 8) & 255, v & 255); };
  const writeU32 = (v: number) => { blocks.push((v >> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255); };
  const writeFloat = (v: number) => {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, v, false);
    blocks.push(...new Uint8Array(buf));
  };
  const writeUtf16 = (s: string) => {
    writeU16(s.length);
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      writeU16(code);
    }
    writeU16(0);
  };

  // Header ASEF + version 1.0 + 0 blocks placeholder
  blocks.push(0x41, 0x53, 0x45, 0x46); // ASEF
  writeU32(1);
  writeU32(0);
  writeU32(colors.length);

  colors.forEach((hex, i) => {
    const c = hexToRgba(hex)!;
    writeU16(0x0001); // block type color
    const name = `Color ${i + 1}`;
    const blockStart = blocks.length;
    writeU32(0); // length placeholder
    writeU16(0); // RGB model
    writeFloat(c.r / 255);
    writeFloat(c.g / 255);
    writeFloat(c.b / 255);
    writeU16(0); // color type global
    writeUtf16(name);
    const blockLen = blocks.length - blockStart - 4;
    blocks[blockStart] = (blockLen >> 24) & 255;
    blocks[blockStart + 1] = (blockLen >> 16) & 255;
    blocks[blockStart + 2] = (blockLen >> 8) & 255;
    blocks[blockStart + 3] = blockLen & 255;
  });

  return new Blob([new Uint8Array(blocks)], { type: "application/octet-stream" });
}

export async function exportPalettePDF(colors: string[], name: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: colors.length > 6 ? "landscape" : "portrait" });
  doc.setFontSize(14);
  doc.text(name, 14, 16);
  const sw = 24;
  colors.forEach((hex, i) => {
    const col = i % 8;
    const row = Math.floor(i / 8);
    const x = 14 + col * (sw + 4);
    const y = 24 + row * (sw + 10);
    const c = hexToRgba(hex)!;
    doc.setFillColor(c.r, c.g, c.b);
    doc.rect(x, y, sw, sw, "F");
    doc.setFontSize(8);
    doc.text(hex, x, y + sw + 6);
  });
  return doc.output("blob");
}

export function exportPalette(
  format: PaletteExportFormat,
  colors: PaletteColor[],
  name: string,
): Promise<Blob> | Blob | string {
  const hexes = colors.map((c) => c.hex);
  switch (format) {
    case "css": return exportPaletteCSS(hexes, name);
    case "json": return exportPaletteJSON(colors, name);
    case "txt": return exportPaletteTXT(hexes);
    case "gpl": return exportPaletteGPL(hexes, name);
    case "ase": return exportPaletteASE(hexes, name);
    case "svg": return exportPaletteSVG(hexes, name);
    case "pdf": return exportPalettePDF(hexes, name);
    default: return exportPaletteJSON(colors, name);
  }
}

/* ─── AI recommendations ─── */

export function aiRecommendColors(
  picked: Rgba | null,
  palette: PaletteColor[],
  meta: ImageColorMeta | null,
): ColorRecommendation[] {
  const recs: ColorRecommendation[] = [];
  if (!picked && !palette.length) {
    recs.push({ title: "Upload an image", detail: "Drop, paste, or import from URL to start picking colors." });
    return recs;
  }
  if (meta && meta.width * meta.height > 4_000_000) {
    recs.push({ title: "Large image detected", detail: "Dominant color extraction samples pixels — results remain fast via stepping." });
  }
  if (picked) {
    const tw = nearestTailwind(picked);
    if (tw.deltaE < 8) {
      recs.push({ title: `Near Tailwind ${tw.name}`, detail: `ΔE ${tw.deltaE} — consider ${tw.name} in your design system.`, action: "tailwind" });
    }
    const comp = complementaryColor(picked);
    recs.push({
      title: "Complementary accent",
      detail: `Try ${rgbaToHex(comp.r, comp.g, comp.b).hex} for high-contrast accents.`,
      action: "complement",
    });
    const white: Rgba = { r: 255, g: 255, b: 255, a: 255 };
    const black: Rgba = { r: 0, g: 0, b: 0, a: 255 };
    const cw = contrastRatio(picked, white);
    const cb = contrastRatio(picked, black);
    if (!cw.aaNormal && !cb.aaNormal) {
      recs.push({ title: "Low text contrast", detail: "This color fails WCAG AA against both black and white — check Contrast tab.", action: "contrast" });
    }
  }
  if (!palette.length) {
    recs.push({ title: "Extract palette", detail: "Run AI palette extraction to get dominant colors from the full image.", action: "extract" });
  }
  return recs.slice(0, 5);
}

/* ─── Worker palette extraction ─── */

const PALETTE_WORKER_SRC = `
self.onmessage = (e) => {
  const { id, buffer, width, height, count, ignoreTransparent } = e.data;
  try {
    const data = new Uint8ClampedArray(buffer);
    const step = Math.max(1, Math.floor(Math.min(width, height) / 128));
    const buckets = new Map();
    let total = 0;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
        if (ignoreTransparent && a < 128) continue;
        const qr = Math.round(r / 17) * 17;
        const qg = Math.round(g / 17) * 17;
        const qb = Math.round(b / 17) * 17;
        const key = qr+','+qg+','+qb;
        const prev = buckets.get(key);
        if (prev) prev.count++;
        else buckets.set(key, { r: qr, g: qg, b: qb, count: 1 });
        total++;
      }
    }
    const sorted = [...buckets.values()].sort((a,b)=>b.count-a.count).slice(0, count);
    const out = sorted.map(b => ({
      r: b.r, g: b.g, b: b.b, a: 255,
      hex: '#'+[b.r,b.g,b.b].map(v=>v.toString(16).padStart(2,'0')).join(''),
      count: b.count,
      percentage: total ? Math.round(b.count/total*1000)/10 : 0
    }));
    self.postMessage({ id, ok: true, palette: out });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
`;

let paletteWorkerUrl: string | null = null;
let paletteWorker: Worker | null = null;

function getPaletteWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!paletteWorker) {
    try {
      if (!paletteWorkerUrl) {
        paletteWorkerUrl = URL.createObjectURL(new Blob([PALETTE_WORKER_SRC], { type: "application/javascript" }));
      }
      paletteWorker = new Worker(paletteWorkerUrl);
    } catch {
      return null;
    }
  }
  return paletteWorker;
}

export async function extractDominantColorsWorker(
  canvas: HTMLCanvasElement,
  count = 8,
  ignoreTransparent = true,
): Promise<PaletteColor[] | null> {
  const w = getPaletteWorker();
  if (!w) return null;
  const ctx = canvas.getContext("2d")!;
  const buffer = ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer.slice(0);
  const id = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { id: string; ok: boolean; palette?: PaletteColor[] };
      if (d.id !== id) return;
      w.removeEventListener("message", onMsg);
      resolve(d.ok && d.palette ? d.palette : null);
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ id, buffer, width: canvas.width, height: canvas.height, count, ignoreTransparent }, [buffer]);
  });
}

export function canvasScreenshotBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Screenshot failed"))), "image/png");
  });
}
