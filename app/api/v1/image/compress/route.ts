import { NextResponse } from "next/server";
import sharp from "sharp";
import {
  DEFAULT_COMPRESS_OPTIONS,
  COMPRESS_PRESETS,
  type CompressOptions,
  type OutputFormat,
} from "@/components/tools/image-compressor-utils";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB upload cap

interface RequestBody {
  image?: string;
  options?: Partial<CompressOptions>;
}

function decodeImage(input: string): { bytes: Buffer; mime: string } {
  if (!input) throw new Error("image (base64 or data URI) required");
  const dataUri = /^data:([^;]+);base64,(.*)$/s.exec(input);
  if (dataUri) {
    return { bytes: Buffer.from(dataUri[2], "base64"), mime: dataUri[1] };
  }
  // Raw base64 — assume image/jpeg by default; sharp will sniff the format anyway.
  return { bytes: Buffer.from(input, "base64"), mime: "image/jpeg" };
}

function pickQuality(opts: CompressOptions): number {
  if (opts.mode === "lossless") return 100;
  if (opts.mode === "custom") return Math.round(opts.quality * 100);
  const preset = COMPRESS_PRESETS[opts.mode as Exclude<CompressOptions["mode"], "custom" | "target">];
  return preset ? Math.round(preset.quality * 100) : 78;
}

async function compressToTarget(
  pipeline: sharp.Sharp,
  format: OutputFormat,
  targetBytes: number,
  passes: number,
): Promise<{ data: Buffer; quality: number }> {
  // BMP/ICO have no `toFormat` key in sharp — fall back to PNG for target mode.
  const targetFormat: OutputFormat =
    format === "image/bmp" || format === "image/x-icon" ? "image/png" : format;
  let lo = 5;
  let hi = 95;
  let best: Buffer | null = null;
  let bestQ = lo;
  for (let i = 0; i < passes; i++) {
    const q = Math.round((lo + hi) / 2);
    const data = await pipeline
      .clone()
      .toFormat(targetFormat as unknown as keyof sharp.FormatEnum, { quality: q })
      .toBuffer();
    if (data.byteLength <= targetBytes) {
      best = data;
      bestQ = q;
      lo = q;
    } else {
      hi = q;
    }
    if (hi - lo < 2) break;
  }
  if (!best) {
    best = await pipeline
      .clone()
      .toFormat(targetFormat as unknown as keyof sharp.FormatEnum, { quality: lo })
      .toBuffer();
    bestQ = lo;
  }
  return { data: best, quality: bestQ };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    if (!body.image) {
      return NextResponse.json({ ok: false, error: "image (base64) required" }, { status: 400 });
    }
    const { bytes } = decodeImage(body.image);
    if (bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: `Image exceeds ${MAX_BYTES / 1024 / 1024} MB limit` }, { status: 413 });
    }

    const options: CompressOptions = {
      ...DEFAULT_COMPRESS_OPTIONS,
      ...(body.options ?? {}),
      resize: { ...DEFAULT_COMPRESS_OPTIONS.resize, ...(body.options?.resize ?? {}) },
    };

    const metadata = await sharp(bytes).metadata();
    const format: OutputFormat = options.format;

    let pipeline = sharp(bytes, {
      failOn: "none",
      // Strip metadata by default — preserves color profile only when requested
      // (we always strip in this implementation; client can re-add if needed).
    }).rotate(); // auto-orient from EXIF

    if (options.resize.enabled) {
      const r = options.resize;
      if (r.unit === "%") {
        const s = Math.min(r.width, r.height) / 100;
        pipeline = pipeline.resize({
          width: Math.max(1, Math.round((metadata.width ?? 1) * s)),
          height: Math.max(1, Math.round((metadata.height ?? 1) * s)),
          withoutEnlargement: true,
          fit: (r.fit === "none" ? "inside" : r.fit) as keyof sharp.FitEnum,
        });
      } else {
        pipeline = pipeline.resize({
          width: r.width,
          height: r.height,
          withoutEnlargement: true,
          fit: (r.fit === "none" ? "inside" : r.fit) as keyof sharp.FitEnum,
        });
      }
    }

    if (options.ocrSafe) {
      // Higher quality resampling for OCR-eligible content.
      pipeline = pipeline.ensureAlpha().flatten({ background: options.flattenBackground });
    } else if (format === "image/jpeg") {
      pipeline = pipeline.flatten({ background: options.flattenBackground });
    }

    let output: Buffer;
    let quality = pickQuality(options);

    if (options.mode === "target") {
      const res = await compressToTarget(
        pipeline,
        format,
        options.targetBytes,
        Math.max(4, Math.min(12, options.targetPasses)),
      );
      output = res.data;
      quality = res.quality;
    } else if (options.mode === "lossless") {
      if (format === "image/png") {
        output = await pipeline.png({ compressionLevel: 9, palette: false }).toBuffer();
        quality = 100;
      } else if (format === "image/webp") {
        output = await pipeline.webp({ quality: 100, lossless: true }).toBuffer();
        quality = 100;
      } else if (format === "image/avif") {
        output = await pipeline.avif({ quality: 100, lossless: true }).toBuffer();
        quality = 100;
      } else if (format === "image/tiff") {
        output = await pipeline.tiff({ quality: 100, compression: "lzw" }).toBuffer();
        quality = 100;
      } else if (format === "image/gif") {
        output = await pipeline.gif({ loop: 0, delay: [] }).toBuffer();
        quality = 100;
      } else if (format === "image/bmp" || format === "image/x-icon") {
        // sharp has no BMP/ICO encoder — fall back to PNG (lossless).
        output = await pipeline.png({ compressionLevel: 9 }).toBuffer();
        quality = 100;
      } else {
        output = await pipeline.jpeg({ quality: 100, progressive: false }).toBuffer();
        quality = 100;
      }
    } else {
      const q = quality;
      switch (format) {
        case "image/jpeg":
          output = await pipeline.jpeg({ quality: q, mozjpeg: true, progressive: true }).toBuffer();
          break;
        case "image/png":
          output = await pipeline.png({ compressionLevel: 9, palette: true, quality: q }).toBuffer();
          break;
        case "image/webp":
          output = await pipeline.webp({ quality: q, effort: 6 }).toBuffer();
          break;
        case "image/avif":
          output = await pipeline.avif({ quality: q, effort: 6 }).toBuffer();
          break;
        case "image/tiff":
          output = await pipeline.tiff({ quality: q, compression: "lzw" }).toBuffer();
          break;
        case "image/gif":
          output = await pipeline.gif({ loop: 0, delay: [] }).toBuffer();
          break;
        case "image/bmp":
        case "image/x-icon":
          output = await pipeline.png({ compressionLevel: 9 }).toBuffer();
          break;
        default:
          output = await pipeline.jpeg({ quality: q }).toBuffer();
      }
    }

    const originalBytes = bytes.byteLength;
    const compressedBytes = output.byteLength;
    const savingsPercent = Math.max(0, Math.round((1 - compressedBytes / (originalBytes || 1)) * 100));
    // Target mode with BMP/ICO falls back to PNG — reflect that in the response.
    const outputMime: OutputFormat =
      options.mode === "target" && (format === "image/bmp" || format === "image/x-icon")
        ? "image/png"
        : format === "image/x-icon"
          ? "image/png" // sharp has no ICO encoder — server returns PNG for ICO requests.
          : format;

    return NextResponse.json({
      ok: true,
      output: `data:${outputMime};base64,${output.toString("base64")}`,
      stats: {
        originalBytes,
        compressedBytes,
        savingsPercent,
        format: outputMime,
        quality: quality / 100,
        width: metadata.width,
        height: metadata.height,
        mode: options.mode,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Compression failed";
    return NextResponse.json({ ok: false, error: message }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/image/compress",
    methods: ["POST"],
    limits: { maxBytes: MAX_BYTES },
    body: {
      image: "base64 string or data URI",
      options: "mode, format, quality, targetBytes, resize, stripMetadata, preserveTransparency, ocrSafe, flattenBackground",
    },
    modes: ["lossless", "low", "medium", "high", "extreme", "target", "custom"],
    formats: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/tiff", "image/bmp (→PNG)", "image/x-icon (→PNG)"],
  });
}
