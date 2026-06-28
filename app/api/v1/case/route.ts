import { NextResponse } from "next/server";
import {
  DEFAULT_CASE_OPTIONS,
  transformCase,
  type CaseMode,
  type CaseTransformOptions,
} from "@/components/tools/case-converter-utils";

const VALID_MODES: CaseMode[] = [
  "uppercase", "lowercase", "title", "sentence", "capitalize", "toggle",
  "camel", "pascal", "snake", "screaming-snake", "kebab", "train",
  "dot", "path", "constant", "header", "inverse", "alternating", "random",
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = body.input as string;
    const mode = body.mode as CaseMode;

    if (typeof input !== "string") {
      return NextResponse.json({ ok: false, error: "input must be a string" }, { status: 400 });
    }
    if (!mode || !VALID_MODES.includes(mode)) {
      return NextResponse.json({ ok: false, error: `mode must be one of: ${VALID_MODES.join(", ")}` }, { status: 400 });
    }
    if (input.length > 2_000_000) {
      return NextResponse.json({ ok: false, error: "input exceeds 2 MB limit" }, { status: 413 });
    }

    const options: CaseTransformOptions = {
      ...DEFAULT_CASE_OPTIONS,
      ...(body.options ?? {}),
    };

    const result = transformCase(input, mode, options);
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
    endpoint: "/api/v1/case",
    methods: ["POST"],
    description: "Convert text case with 19 modes and preprocessing options",
    limits: { maxInputChars: 2_000_000 },
    body: {
      input: "string",
      mode: VALID_MODES.join(" | "),
      options: {
        locale: "string (BCP 47)",
        trimInput: "boolean",
        trimLines: "boolean",
        collapseSpaces: "boolean",
        sortLines: "none | asc | desc",
        dedupeLines: "boolean",
        smartTitle: "boolean",
        preserveLineBreaks: "boolean",
      },
    },
  });
}
