import { NextResponse } from "next/server";
import {
  DEFAULT_OPTIONS,
  aiRecommend,
  checkBreach,
  computeStrength,
  generate,
  generateBulk,
  type GenOptions,
} from "@/components/tools/password-generator-utils";

export const runtime = "nodejs";

interface RequestBody {
  count?: number;
  options?: Partial<GenOptions>;
  breachCheck?: boolean;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const options: GenOptions = { ...DEFAULT_OPTIONS, ...(body.options ?? {}) };
    const count = Math.max(1, Math.min(10000, body.count ?? 1));

    const passwords = generateBulk(options, count);

    const results = passwords.map((p) => {
      const strength = computeStrength(p, options);
      return {
        password: p,
        length: p.length,
        entropyBits: Number(strength.entropy.toFixed(2)),
        score: strength.score,
        label: strength.label,
        crackLabel: strength.crackLabel,
        poolSize: strength.poolSize,
      };
    });

    let breach: { checked: boolean; found: boolean; count: number; error?: string } | null = null;
    if (body.breachCheck && results.length === 1) {
      breach = await checkBreach(results[0].password);
    }

    const ai = aiRecommend(results[0].password, options, computeStrength(results[0].password, options));

    return NextResponse.json({
      ok: true,
      count: results.length,
      mode: options.mode,
      passwords: results,
      breach: breach,
      aiRecommendations: ai,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "generation failed" }, { status: 422 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/password",
    methods: ["POST"],
    body: {
      count: "1-10000 (default 1)",
      options: "mode (random|passphrase|pronounceable|pin|wifi), length (1-4096), upper, lower, number, symbol, custom, excludeSimilar, excludeAmbiguous, requireAllSets, wordCount, separator, capitalize, appendNumber, appendSymbol, pronounceLowerOnly, wifiEncryption (WPA|WEP|nopass), wifiSsid, wifiHidden",
      breachCheck: "boolean — checks the first password against HIBP (only when count=1)",
    },
    response: "passwords[] with length, entropy, score, label, crackLabel, poolSize; optional breach + aiRecommendations",
    security: "Server uses Node crypto.randomBytes via the shared engine. For maximum privacy, use the in-browser studio.",
  });
}
