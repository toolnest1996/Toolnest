import { NextResponse } from "next/server";
import sharp from "sharp";
import type { ApiResizeRequest, OutputFormat, ResizeFit } from "@/components/tools/image-resize-utils";
import { physicalToPixels } from "@/components/tools/image-resize-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

interface RequestBody extends ApiResizeRequest {
  image?: string;
  format?: OutputFormat;
  quality?: number;
  preserveTransparency?: boolean;
  flattenBackground?: string;
  padColor?: string;
}

function decodeImage(input: string): Buffer {
  if (!input) throw new Error("image (base64) required");
  const dataUri = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (dataUri) return Buffer.from(dataUri[2], "base64");
  return Buffer.from(input, "base64");
}

function resolvePixels(
  width: number,
  height: number,
  unit: string,
  dpi: number,
  metaW: number,
  metaH: number,
): { w: number; h: number } {
  if (unit === "%") {
    return {
      w: Math.max(1, Math.round(metaW * (width / 100))),
      h: Math.max(1, Math.round(metaH * (height / 100))),
    };
  }
  if (unit === "px") return { w: Math.max(1, Math.round(width)), h: Math.max(1, Math.round(height)) };
  const w = physicalToPixels(width, unit as "in" | "cm" | "mm", dpi);
  const h = physicalToPixels(height, unit as "in" | "cm" | "mm", dpi);
  return { w, h };
}

function sharpFit(fit: ResizeFit): keyof sharp.FitEnum {
  if (fit === "stretch") return "fill";
  if (fit === "cover" || fit === "content-aware") return "cover";
  return "contain";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.image) {
      return NextResponse.json({ ok: false, error: "image required" }, { status: 400 });
    }
    if (body.width == null || body.height == null) {
      return NextResponse.json({ ok: false, error: "width and height required" }, { status: 400 });
    }

    const bytes = decodeImage(body.image);
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Image exceeds 25 MB limit" }, { status: 413 });
    }

    const meta = await sharp(bytes).metadata();
    const metaW = meta.width ?? 1;
    const metaH = meta.height ?? 1;
    const unit = body.unit ?? "px";
    const dpi = body.dpi ?? 300;
    const fit = body.fit ?? "contain";
    const format = body.format ?? "image/webp";
    const quality = Math.round((body.quality ?? 0.92) * 100);
    const padColor = body.padColor ?? "#ffffff";

    let { w, h } = resolvePixels(body.width, body.height, unit, dpi, metaW, metaH);

    if (body.lockAspect !== false && unit !== "%") {
      const ratio = metaW / metaH;
      if (w / h > ratio) w = Math.round(h * ratio);
      else h = Math.round(w / ratio);
    }

    let pipeline = sharp(bytes).rotate();

    if (body.rotate) pipeline = pipeline.rotate(body.rotate);
    if (body.flipH) pipeline = pipeline.flop();
    if (body.flipV) pipeline = pipeline.flip();

    const resizeOpts: sharp.ResizeOptions = {
      width: w,
      height: h,
      fit: sharpFit(fit),
      withoutEnlargement: !body.upscale,
      background: padColor,
    };

    if (fit === "content-aware") {
      resizeOpts.position = sharp.strategy.attention;
    }

    pipeline = pipeline.resize(resizeOpts);

    if (format === "image/jpeg" || !body.preserveTransparency) {
      pipeline = pipeline.flatten({ background: body.flattenBackground ?? "#ffffff" });
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
      case "image/avif":
        outBuf = await pipeline.avif({ quality }).toBuffer();
        break;
      case "image/png":
        outBuf = await pipeline.png({ compressionLevel: 9 }).toBuffer();
        break;
      case "image/tiff":
        outBuf = await pipeline.tiff({ quality }).toBuffer();
        break;
      case "image/gif":
        outBuf = await pipeline.gif().toBuffer();
        break;
      default:
        outBuf = await pipeline.png().toBuffer();
        mime = "image/png";
    }

    const outMeta = await sharp(outBuf).metadata();

    return NextResponse.json({
      ok: true,
      output: `data:${mime};base64,${outBuf.toString("base64")}`,
      stats: {
        originalBytes: bytes.byteLength,
        outputBytes: outBuf.byteLength,
        width: outMeta.width,
        height: outMeta.height,
        format: mime,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "resize failed" }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/image/resize",
    methods: ["POST"],
    limits: { maxBytes: MAX_BYTES },
    body: {
      image: "base64 or data URI",
      width: "number",
      height: "number",
      unit: "px | % | in | cm | mm",
      dpi: "number (for physical units, default 300)",
      fit: "stretch | contain | cover | content-aware",
      lockAspect: "boolean",
      upscale: "boolean",
      rotate: "0 | 90 | 180 | 270",
      flipH: "boolean",
      flipV: "boolean",
      format: "image/jpeg | image/png | image/webp | image/avif | image/tiff | image/gif",
      quality: "0.1-1.0",
      padColor: "hex for contain mode",
    },
    note: "content-aware uses sharp attention strategy server-side; client studio uses saliency detection.",
  });
}
