import { NextResponse } from "next/server";
import sharp from "sharp";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 25 * 1024 * 1024;

interface RequestBody {
  image?: string;
  x?: number;
  y?: number;
  extractPalette?: boolean;
  paletteCount?: number;
}

function decodeImage(input: string): Buffer {
  if (!input) throw new Error("image (base64) required");
  const dataUri = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (dataUri) return Buffer.from(dataUri[2], "base64");
  return Buffer.from(input, "base64");
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.image) {
      return NextResponse.json({ ok: false, error: "image required" }, { status: 400 });
    }

    const bytes = decodeImage(body.image);
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Image exceeds 25 MB limit" }, { status: 413 });
    }

    const img = sharp(bytes);
    const meta = await img.metadata();
    const w = meta.width ?? 1;
    const h = meta.height ?? 1;

    let picked: { hex: string; rgb: [number, number, number]; x: number; y: number } | null = null;
    if (body.x != null && body.y != null) {
      const px = Math.min(w - 1, Math.max(0, Math.round(body.x)));
      const py = Math.min(h - 1, Math.max(0, Math.round(body.y)));
      const { data } = await img.clone().extract({ left: px, top: py, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
      const r = data[0] ?? 0;
      const g = data[1] ?? 0;
      const b = data[2] ?? 0;
      picked = { hex: rgbToHex(r, g, b), rgb: [r, g, b], x: px, y: py };
    }

    let palette: { hex: string; rgb: [number, number, number]; percentage: number }[] = [];
    if (body.extractPalette) {
      const count = Math.min(16, Math.max(1, body.paletteCount ?? 8));
      const stats = await img.stats();
      const channels = stats.dominant ? [stats.dominant] : [];
      // sharp dominant is single — supplement with channel means for a small palette
      const base = stats.dominant ?? { r: 128, g: 128, b: 128 };
      palette.push({ hex: rgbToHex(base.r, base.g, base.b), rgb: [base.r, base.g, base.b], percentage: 100 });
      for (const ch of stats.channels.slice(0, 3)) {
        const r = Math.round(ch.mean);
        palette.push({ hex: rgbToHex(r, r, r), rgb: [r, r, r], percentage: Math.round(ch.stdev) });
      }
      palette = palette.slice(0, count);
    }

    return NextResponse.json({
      ok: true,
      width: w,
      height: h,
      picked,
      palette,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Color pick failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
