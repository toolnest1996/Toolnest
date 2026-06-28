import { NextResponse } from "next/server";
import {
  generateBulk,
  type GenerateOptions,
  type UuidOutputFormat,
  type UuidVersion,
  UUID_VERSIONS,
} from "@/lib/uuid";

const FORMATS: UuidOutputFormat[] = [
  "standard", "uppercase", "lowercase", "no-hyphens", "braces", "urn",
];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const version = body.version as UuidVersion;
    const count = Math.min(Math.max(Number(body.count) || 1, 1), 10_000);

    if (!version || !UUID_VERSIONS.includes(version)) {
      return NextResponse.json(
        { ok: false, error: `version must be one of: ${UUID_VERSIONS.join(", ")}` },
        { status: 400 },
      );
    }

    const format = (body.format as UuidOutputFormat) ?? "standard";
    if (!FORMATS.includes(format)) {
      return NextResponse.json({ ok: false, error: "Invalid format" }, { status: 400 });
    }

    const options: GenerateOptions = {
      version,
      count,
      format,
      namespace: body.namespace,
      name: body.name,
      seed: body.seed,
      v8Prefix: body.v8Prefix,
    };

    const uuids = await generateBulk(options);
    return NextResponse.json({ ok: true, uuids, count: uuids.length, version, format });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/uuid",
    methods: ["POST"],
    description: "Generate UUIDs (v1, v3, v4, v5, v6, v7, v8, nil, max)",
    limits: { maxCount: 10_000 },
    body: {
      version: UUID_VERSIONS.join(" | "),
      count: "number (1–10000)",
      format: FORMATS.join(" | "),
      namespace: "dns | url | oid | x500 | custom UUID string (v3/v5)",
      name: "string (v3/v5)",
      seed: "string (optional, v4 deterministic testing)",
      v8Prefix: "hex string (optional, v8)",
    },
  });
}
