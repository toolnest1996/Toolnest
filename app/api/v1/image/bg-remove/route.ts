import { NextResponse } from "next/server";
import sharp from "sharp";
import { DEFAULT_BG_REMOVE, type BgRemoveSettings } from "@/components/tools/bg-remover-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

interface RequestBody {
  image?: string;
  mode?: BgRemoveSettings["mode"];
  pickColor?: string;
  threshold?: number;
  feather?: number;
  spill?: number;
}

function decodeImage(input: string): Buffer {
  if (!input) throw new Error("image required");
  const dataUri = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (dataUri) return Buffer.from(dataUri[2], "base64");
  return Buffer.from(input, "base64");
}

function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function sampleCorners(data: Uint8Array, w: number, h: number): [number, number, number] {
  const pts = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], [Math.floor(w / 2), 0], [0, Math.floor(h / 2)]];
  let r = 0, g = 0, b = 0;
  for (const [x, y] of pts) {
    const i = (y * w + x) * 4;
    r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  const n = pts.length;
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.image) return NextResponse.json({ ok: false, error: "image required" }, { status: 400 });

    const bytes = decodeImage(body.image);
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Image exceeds 25 MB limit" }, { status: 413 });
    }

    const settings: BgRemoveSettings = {
      ...DEFAULT_BG_REMOVE,
      mode: body.mode ?? DEFAULT_BG_REMOVE.mode,
      pickColor: body.pickColor ?? DEFAULT_BG_REMOVE.pickColor,
      threshold: body.threshold ?? DEFAULT_BG_REMOVE.threshold,
      feather: body.feather ?? DEFAULT_BG_REMOVE.feather,
      spill: body.spill ?? DEFAULT_BG_REMOVE.spill,
    };

    const { data, info } = await sharp(bytes).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    const pixels = new Uint8Array(data);

    let [tr, tg, tb] = parseHex(settings.pickColor);
    if (settings.mode === "auto") [tr, tg, tb] = sampleCorners(pixels, w, h);
    if (settings.mode === "green") [tr, tg, tb] = [80, 180, 80];

    const thresh = settings.threshold;
    const feather = Math.max(1, settings.feather);

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const dist = Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2);
      if (dist <= thresh) {
        pixels[i + 3] = 0;
      } else if (dist <= thresh + feather) {
        const t = (dist - thresh) / feather;
        pixels[i + 3] = Math.round(t * 255);
        if (settings.spill > 0) pixels[i + 1] = Math.round(g * (1 - settings.spill / 100));
      }
    }

    const outBuf = await sharp(pixels, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();

    return NextResponse.json({
      ok: true,
      output: `data:image/png;base64,${outBuf.toString("base64")}`,
      stats: {
        originalBytes: bytes.byteLength,
        outputBytes: outBuf.byteLength,
        width: w,
        height: h,
        detectedBackground: settings.mode === "auto" ? { r: tr, g: tg, b: tb } : undefined,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "bg-remove failed" }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/image/bg-remove",
    methods: ["POST"],
    body: {
      image: "base64 or data URI",
      mode: "auto | color | green",
      pickColor: "hex for color mode",
      threshold: "5-120",
      feather: "0-30",
      spill: "green spill reduction 0-100",
    },
    note: "Client-side studio uses the same algorithm — no external AI API.",
  });
}
