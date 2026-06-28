import { NextResponse } from "next/server";
import {
  checkPalindrome,
  DEFAULT_REVERSE_OPTIONS,
  transformReverse,
  type ReverseMode,
  type ReverseOptions,
} from "@/components/tools/reverse-text-utils";

const VALID_MODES: ReverseMode[] = [
  "characters", "words", "sentences", "lines", "paragraphs", "mirror", "upside-down", "rtl",
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = body.input as string;
    const mode = body.mode as ReverseMode;
    const includePalindrome = body.checkPalindrome === true;

    if (typeof input !== "string") {
      return NextResponse.json({ ok: false, error: "input must be a string" }, { status: 400 });
    }
    if (!mode || !VALID_MODES.includes(mode)) {
      return NextResponse.json({ ok: false, error: `mode must be one of: ${VALID_MODES.join(", ")}` }, { status: 400 });
    }
    if (input.length > 2_000_000) {
      return NextResponse.json({ ok: false, error: "input exceeds 2 MB limit" }, { status: 413 });
    }

    const options: ReverseOptions = {
      ...DEFAULT_REVERSE_OPTIONS,
      ...(body.options ?? {}),
    };

    const result = transformReverse(input, mode, options);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message }, { status: 422 });
    }

    const payload: Record<string, unknown> = {
      ok: true,
      output: result.output,
      mode: result.mode,
      stats: result.stats,
    };

    if (includePalindrome) {
      payload.palindrome = checkPalindrome(input);
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/reverse",
    methods: ["POST"],
    description: "Reverse text with 8 modes, grapheme-aware Unicode, palindrome check",
    limits: { maxInputChars: 2_000_000 },
    body: {
      input: "string",
      mode: VALID_MODES.join(" | "),
      checkPalindrome: "boolean (optional)",
      options: {
        graphemeAware: "boolean",
        preserveWhitespace: "boolean",
        preservePunctuation: "boolean",
        trimLines: "boolean",
        perLine: "boolean",
        rtlWrap: "boolean",
      },
    },
  });
}
