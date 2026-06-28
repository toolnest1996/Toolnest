import { NextResponse } from "next/server";
import {
  hashText,
  type DigestAlgorithm,
  type OutputEncoding,
  DIGEST_ALGORITHMS,
} from "@/lib/hash";

const ENCODINGS: OutputEncoding[] = ["hex-lower", "hex-upper", "base64"];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = body.input as string;
    if (typeof input !== "string") {
      return NextResponse.json({ ok: false, error: "input must be a string" }, { status: 400 });
    }
    if (input.length > 10_000_000) {
      return NextResponse.json({ ok: false, error: "input exceeds 10 MB limit" }, { status: 413 });
    }

    const algorithms = (body.algorithms as DigestAlgorithm[]) ?? ["sha256"];
    if (!Array.isArray(algorithms) || !algorithms.every((a) => DIGEST_ALGORITHMS.includes(a))) {
      return NextResponse.json({ ok: false, error: "Invalid algorithms array" }, { status: 400 });
    }

    const encoding = (body.encoding as OutputEncoding) ?? "hex-lower";
    if (!ENCODINGS.includes(encoding)) {
      return NextResponse.json({ ok: false, error: "Invalid encoding" }, { status: 400 });
    }

    const hmac = !!body.hmac;
    const hmacKey = typeof body.hmacKey === "string" ? body.hmacKey : undefined;

    const hashes = await hashText(input, { algorithms, encoding, hmac, hmacKey });
    return NextResponse.json({ ok: true, hashes, count: hashes.length });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Hash failed" },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/hash",
    methods: ["POST"],
    description: "Hash text with MD5, SHA-2/3, BLAKE, RIPEMD, Whirlpool, CRC32, Adler-32, HMAC",
    limits: { maxInputChars: 10_000_000 },
    body: {
      input: "string",
      algorithms: DIGEST_ALGORITHMS,
      encoding: ENCODINGS.join(" | "),
      hmac: "boolean",
      hmacKey: "string (when hmac=true)",
    },
  });
}
