import { NextResponse } from "next/server";
import sharp from "sharp";
import { DEFAULT_ADJUSTMENTS, type EditorAdjustments } from "@/components/tools/image-editor-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

interface RequestBody {
  image?: string;
  adjustments?: Partial<EditorAdjustments>;
  format?: "image/png" | "image/jpeg" | "image/webp";
  quality?: number;
}

function decodeImage(input: string): Buffer {
  if (!input) throw new Error("image required");
  const dataUri = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (dataUri) return Buffer.from(dataUri[2], "base64");
  return Buffer.from(input, "base64");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.image) return NextResponse.json({ ok: false, error: "image required" }, { status: 400 });

    const bytes = decodeImage(body.image);
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Image exceeds 25 MB limit" }, { status: 413 });
    }

    const adj: EditorAdjustments = { ...DEFAULT_ADJUSTMENTS, ...(body.adjustments ?? {}) };
    const format = body.format ?? "image/png";
    const quality = Math.round((body.quality ?? 0.92) * 100);

    let pipeline = sharp(bytes).rotate(adj.rotation || undefined);

    pipeline = pipeline.modulate({
      brightness: (100 + adj.brightness + adj.exposure * 0.5) / 100,
      saturation: (100 + adj.saturation) / 100,
    });

    if (adj.hue) pipeline = pipeline.modulate({ hue: adj.hue });
    if (adj.temperature) {
      const t = adj.temperature / 100;
      pipeline = pipeline.linear([1 + t * 0.08, 1, 1 - t * 0.08], [0, 0, 0]);
    }
    if (adj.tint) {
      const t = adj.tint / 100;
      pipeline = pipeline.linear([1, 1 + t * 0.06, 1], [0, 0, 0]);
    }
    if (adj.contrast) {
      const c = (100 + adj.contrast) / 100;
      pipeline = pipeline.linear(c, 128 * (1 - c));
    }
    if (adj.gamma !== 1) pipeline = pipeline.gamma(adj.gamma);
    if (adj.blur > 0) pipeline = pipeline.blur(Math.min(20, adj.blur));
    if (adj.grayscale) pipeline = pipeline.grayscale();
    if (adj.sepia) pipeline = pipeline.tint({ r: 112, g: 66, b: 20 });
    if (adj.invert) pipeline = pipeline.negate();
    if (adj.sharpen > 0) pipeline = pipeline.sharpen({ sigma: adj.sharpen / 50 });
    if (adj.clarity > 0) pipeline = pipeline.sharpen({ sigma: adj.clarity / 40 });
    if (adj.noiseReduction > 0) pipeline = pipeline.median(Math.min(3, Math.round(adj.noiseReduction / 25)));
    if (adj.flipV) pipeline = pipeline.flip();
    if (adj.flipH) pipeline = pipeline.flop();

    if (adj.vignette > 0) {
      const meta = await sharp(bytes).metadata();
      const w = meta.width ?? 1;
      const h = meta.height ?? 1;
      const svg = `<svg width="${w}" height="${h}"><defs><radialGradient id="v" cx="50%" cy="50%" r="50%"><stop offset="55%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="${(adj.vignette / 100) * 0.75}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`;
      pipeline = pipeline.composite([{ input: Buffer.from(svg), blend: "multiply" }]);
    }

    let outBuf: Buffer;
    let mime = format;
    switch (format) {
      case "image/jpeg":
        outBuf = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
        break;
      case "image/webp":
        outBuf = await pipeline.webp({ quality }).toBuffer();
        break;
      default:
        outBuf = await pipeline.png().toBuffer();
        mime = "image/png";
    }

    const outMeta = await sharp(outBuf).metadata();

    return NextResponse.json({
      ok: true,
      output: `data:${mime};base64,${outBuf.toString("base64")}`,
      stats: { originalBytes: bytes.byteLength, outputBytes: outBuf.byteLength, width: outMeta.width, height: outMeta.height, format: mime },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "edit failed" }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/image/edit",
    methods: ["POST"],
    body: {
      image: "base64 or data URI",
      adjustments: "brightness, contrast, saturation, exposure, hue, gamma, blur, sharpen, grayscale, sepia, invert, vignette (-100..100 offsets except gamma/blur)",
      format: "image/png | image/jpeg | image/webp",
      quality: "0.1-1.0",
    },
  });
}
