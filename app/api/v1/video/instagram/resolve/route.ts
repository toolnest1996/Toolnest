import { NextResponse } from "next/server";
import { resolveInstagram } from "@/lib/server/instagram-resolve";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string; kind?: string };
    if (!body.url?.trim()) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }
    const result = await resolveInstagram(body.url.trim(), body.kind ?? "instagram-video");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Instagram resolve failed" },
      { status: 502 },
    );
  }
}
