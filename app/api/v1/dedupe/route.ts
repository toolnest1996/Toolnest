import { NextResponse } from "next/server";
import {
  DEFAULT_DEDUPE_OPTIONS,
  transformDedupe,
  type DedupeMode,
  type DedupeOptions,
} from "@/components/tools/remove-duplicates-utils";

const VALID_MODES: DedupeMode[] = [
  "lines", "words", "sentences", "paragraphs", "csv-rows", "json-objects",
  "emails", "urls", "numbers", "custom",
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = body.input as string;
    const mode = body.mode as DedupeMode;

    if (typeof input !== "string") {
      return NextResponse.json({ ok: false, error: "input must be a string" }, { status: 400 });
    }
    if (!mode || !VALID_MODES.includes(mode)) {
      return NextResponse.json({ ok: false, error: `mode must be one of: ${VALID_MODES.join(", ")}` }, { status: 400 });
    }
    if (input.length > 2_000_000) {
      return NextResponse.json({ ok: false, error: "input exceeds 2 MB limit" }, { status: 413 });
    }

    const options: DedupeOptions = {
      ...DEFAULT_DEDUPE_OPTIONS,
      ...(body.options ?? {}),
    };

    const result = transformDedupe(input, mode, options);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.message }, { status: 422 });
    }

    return NextResponse.json({
      ok: true,
      output: result.output,
      mode: result.mode,
      stats: result.stats,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/dedupe",
    methods: ["POST"],
    description: "Remove duplicate lines, words, CSV rows, JSON objects, emails, URLs, and more",
    limits: { maxInputChars: 2_000_000 },
    body: {
      input: "string",
      mode: VALID_MODES.join(" | "),
      options: {
        caseSensitive: "boolean",
        trimWhitespace: "boolean",
        ignorePunctuation: "boolean",
        ignoreEmpty: "boolean",
        keep: "first | last",
        sortWhen: "none | before | after",
        sortOrder: "asc | desc",
        matchMode: "exact | fuzzy",
        fuzzyThreshold: "number 0.7-1",
        customPattern: "string (regex)",
        jsonKey: "string",
      },
    },
  });
}
