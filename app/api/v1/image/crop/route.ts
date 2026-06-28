import { NextResponse } from "next/server";
import sharp from "sharp";
import type { CropRect, OutputFormat } from "@/components/tools/image-crop-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

interface RequestBody {
  image?: string;
  crop?: CropRect;
  rotate?: 0 | 90 | 180 | 270;
  flipH?: boolean;
  flipV?: boolean;
  format?: OutputFormat;
  quality?: number;
  outputWidth?: number;
  outputHeight?: number;
  shape?: "rect" | "circle";
  flattenBackground?: string;
}

function decodeImage(input: string): Buffer {
  if (!input) throw new Error("image (base64) required");
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

    const crop = body.crop ?? { x: 0, y: 0, w: 1, h: 1 };
    const format = body.format ?? "image/png";
    const quality = Math.round((body.quality ?? 0.92) * 100);

    let pipeline = sharp(bytes).rotate().rotate(body.rotate ?? 0);
    if (body.flipH) pipeline = pipeline.flop();
    if (body.flipV) pipeline = pipeline.flip();

    const meta = await pipeline.metadata();
    const iw = meta.width ?? 1;
    const ih = meta.height ?? 1;
    const left = Math.max(0, Math.round(crop.x * iw));
    const top = Math.max(0, Math.round(crop.y * ih));
    const width = Math.max(1, Math.min(iw - left, Math.round(crop.w * iw)));
    const height = Math.max(1, Math.min(ih - top, Math.round(crop.h * ih)));

    pipeline = pipeline.extract({ left, top, width, height });

    if (body.outputWidth || body.outputHeight) {
      pipeline = pipeline.resize(body.outputWidth || undefined, body.outputHeight || undefined, { fit: "fill" });
    }

    if (body.shape === "circle") {
      const size = Math.min(body.outputWidth || width, body.outputHeight || height);
      const svg = `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`;
      pipeline = pipeline.resize(size, size).composite([{ input: Buffer.from(svg), blend: "dest-in" }]);
    }

    let outBuf: Buffer;
    let mime = format;
    switch (format) {
      case "image/jpeg":
        outBuf = await pipeline.jpeg({ quality }).toBuffer();
        break;
      case "image/webp":
        outBuf = await pipeline.webp({ quality }).toBuffer();
        break;
      case "image/avif":
        outBuf = await pipeline.avif({ quality }).toBuffer();
        break;
      case "image/png":
      default:
        outBuf = await pipeline.png().toBuffer();
        mime = "image/png";
        break;
    }

    const outMeta = await sharp(outBuf).metadata();

    return NextResponse.json({
      ok: true,
      output: `data:${mime};base64,${outBuf.toString("base64")}`,
      stats: {
        originalBytes: bytes.byteLength,
        croppedBytes: outBuf.byteLength,
        width: outMeta.width,
        height: outMeta.height,
        format: mime,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "crop failed" }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/image/crop",
    methods: ["POST"],
    body: {
      image: "base64 or data URI",
      crop: "{ x, y, w, h } normalized 0..1",
      rotate: "0 | 90 | 180 | 270",
      flipH: "boolean",
      flipV: "boolean",
      format: "image/png | image/jpeg | image/webp | image/avif",
      quality: "0.1-1.0 for lossy formats",
      outputWidth: "optional px",
      outputHeight: "optional px",
      shape: "rect | circle",
    },
    note: "Advanced client features (perspective warp, smart face crop) are available in the in-browser studio.",
  });
}
