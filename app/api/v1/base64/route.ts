import { NextResponse } from "next/server";
import {
  decodeBase64,
  DEFAULT_BASE64_OPTIONS,
  encodeBase64,
  type Base64Options,
  type InputKind,
} from "@/components/tools/base64-utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action as string;
    const input = body.input as string;
    const inputKind = (body.inputKind as InputKind) ?? "text";

    if (!action || !["encode", "decode"].includes(action)) {
      return NextResponse.json({ ok: false, error: "action must be 'encode' or 'decode'" }, { status: 400 });
    }
    if (typeof input !== "string") {
      return NextResponse.json({ ok: false, error: "input must be a string" }, { status: 400 });
    }

    const options: Base64Options = {
      ...DEFAULT_BASE64_OPTIONS,
      ...(body.options ?? {}),
    };

    const result =
      action === "encode"
        ? encodeBase64(input, inputKind, null, options)
        : decodeBase64(input, options);

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      output: result.output,
      stats: result.stats,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/base64",
    methods: ["POST"],
    description: "Encode or decode Base64 text",
    body: {
      action: "encode | decode",
      input: "string",
      inputKind: "text | hex (encode only)",
      options: {
        alphabet: "standard | url-safe",
        padding: "boolean",
        outputFormat: "plain | mime-wrap | data-uri",
        mimeType: "string",
        mimeLineWidth: "number",
      },
    },
  });
}
