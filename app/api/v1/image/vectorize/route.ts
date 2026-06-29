import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  DEFAULT_VECTOR,
  traceRawBufferToSvg,
  type ExportVectorFormat,
  type VectorSettings,
} from "@/components/tools/png-to-svg-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024;

interface RequestBody {
  image?: string;
  settings?: Partial<VectorSettings>;
  format?: ExportVectorFormat;
}

function decodeImage(input: string): Buffer {
  if (!input) throw new Error("image (base64 or data URI) required");
  const dataUri = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (dataUri) return Buffer.from(dataUri[2], "base64");
  return Buffer.from(input, "base64");
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

    const settings: VectorSettings = {
      ...DEFAULT_VECTOR,
      ...body.settings,
      exportFormat: body.format ?? body.settings?.exportFormat ?? "svg",
    };

    const { data, info } = await sharp(bytes)
      .rotate()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const rgba = new Uint8ClampedArray(data.length);
    rgba.set(data);

    const result = traceRawBufferToSvg(rgba, info.width, info.height, settings);

    return NextResponse.json({
      ok: true,
      svg: result.svg,
      width: result.width,
      height: result.height,
      pathCount: result.pathCount,
      layerCount: result.layerCount,
      paletteSize: result.paletteSize,
      bytes: result.bytes,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Vectorize failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/v1/image/vectorize",
    method: "POST",
    maxBytes: MAX_BYTES,
    formats: ["svg", "svg-ai", "eps", "pdf"],
    inputFormats: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "ico", "tiff"],
  });
}
