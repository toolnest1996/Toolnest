import { NextResponse } from "next/server";
import sharp from "sharp";
import type { OutputFormat } from "@/components/tools/image-compressor-utils";
import { optimizeSvgMarkup } from "@/components/tools/svg-to-png-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

interface RequestBody {
  svg?: string;
  width?: number;
  height?: number;
  dpi?: number;
  scale?: number;
  format?: OutputFormat;
  quality?: number;
  transparent?: boolean;
  background?: string;
  optimizeSvg?: boolean;
}

function mimeToSharp(format: OutputFormat): keyof sharp.FormatEnum {
  switch (format) {
    case "image/jpeg":
      return "jpeg";
    case "image/webp":
      return "webp";
    case "image/avif":
      return "avif";
    case "image/gif":
      return "gif";
    case "image/tiff":
      return "tiff";
    case "image/bmp":
    case "image/x-icon":
      // sharp types omit bmp/ico — rasterize as PNG on server
      return "png";
    default:
      return "png";
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.svg?.trim()) {
      return NextResponse.json({ ok: false, error: "svg required" }, { status: 400 });
    }

    let svgText = body.svg.trim();
    if (svgText.length > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "SVG exceeds 10 MB limit" }, { status: 413 });
    }

    if (body.optimizeSvg !== false) {
      svgText = optimizeSvgMarkup(svgText, { optimizePrecision: 2, stripSvgMetadata: true });
    }

    const dpi = body.dpi ?? 96;
    const scale = body.scale ?? 1;
    const format = body.format ?? "image/png";
    const quality = Math.round((body.quality ?? 0.92) * 100);
    const transparent = body.transparent !== false && format !== "image/jpeg";
    const background = body.background ?? "#ffffff";

    let pipeline = sharp(Buffer.from(svgText), {
      density: Math.round(dpi * scale),
      unlimited: true,
    });

    const meta = await pipeline.metadata();
    let w = body.width ?? meta.width ?? 1024;
    let h = body.height ?? meta.height ?? 1024;

    if (body.width && !body.height && meta.width && meta.height) {
      h = Math.round(w * (meta.height / meta.width));
    } else if (body.height && !body.width && meta.width && meta.height) {
      w = Math.round(h * (meta.width / meta.height));
    }

    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));

    pipeline = pipeline.resize(w, h, { fit: "fill", background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : background });

    if (!transparent && format !== "image/png") {
      pipeline = pipeline.flatten({ background });
    }

    const sharpFmt = mimeToSharp(format);
    const out = await pipeline
      .toFormat(sharpFmt, {
        quality,
        compressionLevel: format === "image/png" ? 9 : undefined,
        effort: format === "image/avif" ? 4 : undefined,
      })
      .toBuffer({ resolveWithObject: true });

    const b64 = out.data.toString("base64");
    return NextResponse.json({
      ok: true,
      width: out.info.width,
      height: out.info.height,
      bytes: out.data.byteLength,
      format,
      dataUri: `data:${format};base64,${b64}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Rasterization failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
