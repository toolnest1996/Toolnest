import { NextResponse } from "next/server";
import sharp from "sharp";
import { DEFAULT_ENHANCE, type EnhanceSettings } from "@/components/tools/photo-enhancer-utils";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 25 * 1024 * 1024;

interface RequestBody {
  image?: string;
  settings?: Partial<EnhanceSettings>;
  upscale?: number;
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

    const s: EnhanceSettings = { ...DEFAULT_ENHANCE, ...body.settings };
    const factor = body.upscale ?? s.upscale;
    const format = s.format ?? "image/jpeg";
    const quality = Math.round((s.quality ?? 0.92) * 100);

    let pipeline = sharp(bytes).rotate();

    const meta = await pipeline.metadata();
    const w = meta.width ?? 1;
    const h = meta.height ?? 1;
    const maxDim = s.maxDimension ?? 8192;
    const effFactor = Math.min(factor, Math.max(1, Math.floor(maxDim / Math.max(w, h))));
    if (effFactor > 1) {
      pipeline = pipeline.resize(Math.round(w * effFactor), Math.round(h * effFactor), {
        kernel: sharp.kernel.lanczos3,
        fit: "fill",
      });
    }

    if (s.denoise > 0) pipeline = pipeline.median(Math.min(3, Math.ceil(s.denoise / 30)));
    if (s.sharpen > 0) pipeline = pipeline.sharpen({ sigma: s.sharpen / 40 });
    if (s.clarity > 0) pipeline = pipeline.sharpen({ sigma: s.clarity / 35, m1: 1, m2: 2 });

    pipeline = pipeline.modulate({
      brightness: (100 + s.brightness + s.exposure * 0.5) / 100,
      saturation: (100 + s.saturation + s.vibrance * 0.6) / 100,
    });

    if (s.contrast) {
      const c = (100 + s.contrast) / 100;
      pipeline = pipeline.linear(c, 128 * (1 - c));
    }
    if (s.temperature) {
      const t = s.temperature / 100;
      pipeline = pipeline.linear([1 + t * 0.08, 1, 1 - t * 0.08], [0, 0, 0]);
    }
    if (s.tint) {
      const t = s.tint / 100;
      pipeline = pipeline.linear([1, 1 + t * 0.06, 1], [0, 0, 0]);
    }

    let outBuf: Buffer;
    switch (format) {
      case "image/jpeg":
        outBuf = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
        break;
      case "image/webp":
        outBuf = await pipeline.webp({ quality }).toBuffer();
        break;
      case "image/avif":
        outBuf = await pipeline.avif({ quality }).toBuffer();
        break;
      case "image/png":
      default:
        outBuf = await pipeline.png({ compressionLevel: 9 }).toBuffer();
        break;
    }

    const outMeta = await sharp(outBuf).metadata();
    const b64 = outBuf.toString("base64");
    const mime = format === "image/jpeg" ? "image/jpeg" : format;

    return NextResponse.json({
      ok: true,
      width: outMeta.width,
      height: outMeta.height,
      bytes: outBuf.byteLength,
      format,
      dataUri: `data:${mime};base64,${b64}`,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Enhance failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/v1/image/enhance",
    method: "POST",
    maxBytes: MAX_BYTES,
    upscale: [1, 2, 4, 8, 16],
    formats: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  });
}
