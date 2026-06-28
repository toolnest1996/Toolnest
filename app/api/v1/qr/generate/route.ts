import { NextResponse } from "next/server";
import QRCode from "qrcode";
import {
  DEFAULT_DESIGN,
  DEFAULT_FIELDS,
  buildEncodedPayload,
  analyzeQr,
  aiRecommend,
  type ExportFormat,
  type QrContentType,
  type QrDesign,
} from "@/components/tools/qr-generator-utils";

export const runtime = "nodejs";

interface RequestBody {
  type?: QrContentType;
  content?: string;
  fields?: Partial<typeof DEFAULT_FIELDS>;
  label?: string;
  design?: Partial<QrDesign>;
  format?: ExportFormat;
}

function mergeFields(type: QrContentType, content?: string, fields?: Partial<typeof DEFAULT_FIELDS>) {
  const f = { ...DEFAULT_FIELDS, ...fields };
  if (content) {
    switch (type) {
      case "url": f.url = content; break;
      case "text": f.text = content; break;
      case "custom": f.custom = content; break;
      default: f.mediaUrl = content; f.url = content;
    }
  }
  return f;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const type = body.type ?? "url";
    const design: QrDesign = { ...DEFAULT_DESIGN, ...(body.design ?? {}) };
    const fields = mergeFields(type, body.content, body.fields);
    const encoded = buildEncodedPayload(type, fields);

    if (!encoded) {
      return NextResponse.json({ ok: false, error: "Empty payload — provide content or fields" }, { status: 400 });
    }

    const format = body.format ?? "png";
    const info = analyzeQr(encoded, design.errorCorrection);
    const ai = aiRecommend({ type, fields, design, label: body.label ?? "QR" }, info);

    if (format === "svg") {
      const svg = await QRCode.toString(encoded, {
        type: "svg",
        errorCorrectionLevel: design.errorCorrection,
        margin: design.margin,
        color: { dark: design.foreground, light: design.transparentBg ? "#0000" : design.background },
        width: design.size,
      });
      return NextResponse.json({
        ok: true,
        format: "svg",
        output: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
        encoded,
        info,
        aiRecommendations: ai,
      });
    }

    const pngBuffer = await QRCode.toBuffer(encoded, {
      errorCorrectionLevel: design.errorCorrection,
      margin: design.margin,
      color: { dark: design.foreground, light: design.transparentBg ? "#0000" : design.background },
      width: design.size,
      type: "png",
    });

    let mime = "image/png";
    let outBuf = pngBuffer;

    if (format === "webp" || format === "jpg") {
      const sharp = (await import("sharp")).default;
      outBuf = await sharp(pngBuffer)
        [format === "webp" ? "webp" : "jpeg"]({ quality: 92 })
        .toBuffer();
      mime = format === "webp" ? "image/webp" : "image/jpeg";
    } else if (format === "pdf") {
      const { jsPDF } = await import("jspdf");
      const dataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
      const doc = new jsPDF({ unit: "px", format: [design.size, design.size] });
      doc.addImage(dataUrl, "PNG", 0, 0, design.size, design.size);
      outBuf = Buffer.from(doc.output("arraybuffer"));
      mime = "application/pdf";
    }

    return NextResponse.json({
      ok: true,
      format,
      output: `data:${mime};base64,${outBuf.toString("base64")}`,
      encoded,
      info,
      aiRecommendations: ai,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "QR generation failed" }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/qr/generate",
    methods: ["POST"],
    body: {
      type: "QrContentType (url, text, wifi, vcard, email, sms, phone, whatsapp, telegram, zoom, meet, maps, geo, instagram, facebook, twitter, linkedin, tiktok, youtube, calendar, bitcoin, ethereum, upi, pdf, image, video, audio, menu, form, api, appstore, playstore, custom)",
      content: "shortcut string for simple types",
      fields: "full field object for complex types (wifi, vcard, calendar, etc.)",
      design: "foreground, background, transparentBg, errorCorrection (L/M/Q/H), margin, size, moduleStyle, eyeStyle, frame, logoSize",
      format: "png | svg | webp | jpg | pdf",
    },
    note: "Advanced styling (gradients, logos, custom modules) is available in the in-browser studio. API uses qrcode + sharp for raster output.",
  });
}
