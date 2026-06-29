import { NextResponse } from "next/server";
import sharp from "sharp";
import { DEFAULT_IMAGE_WATERMARK, type ImageWatermarkSettings } from "@/components/tools/image-watermark-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

interface RequestBody {
  image?: string;
  watermark?: Partial<ImageWatermarkSettings>;
  logo?: string;
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

    const wm: ImageWatermarkSettings = { ...DEFAULT_IMAGE_WATERMARK, ...(body.watermark ?? {}) };
    const format = body.format ?? "image/png";
    const quality = Math.round((body.quality ?? 0.92) * 100);

    const meta = await sharp(bytes).metadata();
    const w = meta.width ?? 1;
    const h = meta.height ?? 1;

    let pipeline = sharp(bytes).rotate();

    if (wm.type === "text" || !body.logo) {
      const cx = wm.position === "custom" ? wm.customX : 0.5;
      const cy = wm.position === "custom" ? wm.customY : 0.5;
      const rot = wm.position === "diagonal" ? -35 : wm.rotation;
      const text = wm.text.replace(/[<>&"']/g, "");
      const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="${cx * w}" y="${cy * h}" fill="${wm.color}" opacity="${wm.opacity}" font-size="${wm.fontSize}" font-family="Arial" font-weight="bold" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rot} ${cx * w} ${cy * h})">${text}</text></svg>`;
      pipeline = pipeline.composite([{ input: Buffer.from(svg), blend: "over" }]);
    } else {
      const logoBytes = decodeImage(body.logo);
      const logoMeta = await sharp(logoBytes).metadata();
      const maxDim = Math.min(w, h) * wm.logoScale;
      const lw = logoMeta.width ?? 1;
      const lh = logoMeta.height ?? 1;
      const scale = maxDim / Math.max(lw, lh);
      const logoResized = await sharp(logoBytes).resize(Math.round(lw * scale), Math.round(lh * scale)).png().toBuffer();
      const cx = Math.round(wm.customX * w);
      const cy = Math.round(wm.customY * h);
      pipeline = pipeline.composite([
        {
          input: logoResized,
          blend: "over",
          top: Math.max(0, cy - Math.round(lh * scale / 2)),
          left: Math.max(0, cx - Math.round(lw * scale / 2)),
        },
      ]);
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
      default:
        outBuf = await pipeline.png().toBuffer();
        mime = "image/png";
    }

    return NextResponse.json({
      ok: true,
      output: `data:${mime};base64,${outBuf.toString("base64")}`,
      stats: { originalBytes: bytes.byteLength, outputBytes: outBuf.byteLength, format: mime },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "watermark failed" }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/image/watermark",
    methods: ["POST"],
    body: {
      image: "base64 or data URI",
      watermark: "text, fontSize, color, opacity, rotation, position, customX, customY, logoScale",
      logo: "optional base64 logo when type is image",
      format: "image/png | image/jpeg | image/webp",
    },
  });
}
