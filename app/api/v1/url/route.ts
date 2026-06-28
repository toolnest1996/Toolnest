import { NextResponse } from "next/server";
import {
  DEFAULT_URL_OPTIONS,
  transformUrl,
  type UrlOperation,
  type UrlOptions,
} from "@/components/tools/url-encode-utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action as UrlOperation;
    const input = body.input as string;

    if (!action || !["encode", "decode"].includes(action)) {
      return NextResponse.json({ ok: false, error: "action must be 'encode' or 'decode'" }, { status: 400 });
    }
    if (typeof input !== "string") {
      return NextResponse.json({ ok: false, error: "input must be a string" }, { status: 400 });
    }
    if (input.length > 2_000_000) {
      return NextResponse.json({ ok: false, error: "input exceeds 2 MB limit" }, { status: 413 });
    }

    const options: UrlOptions = {
      ...DEFAULT_URL_OPTIONS,
      ...(body.options ?? {}),
    };

    const result = transformUrl(input, action, options);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      output: result.output,
      stats: result.stats,
      mode: result.mode,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/url",
    methods: ["POST"],
    description: "RFC 3986 URL encode and decode",
    limits: { maxInputChars: 2_000_000 },
    body: {
      action: "encode | decode",
      input: "string",
      options: {
        encodeMode: "component | uri | path | query | form | rfc3986",
        decodeMode: "component | uri | form | auto",
        uppercaseHex: "boolean",
        encodeSpacesAsPlus: "boolean",
        preserveLineBreaks: "boolean",
      },
    },
  });
}
