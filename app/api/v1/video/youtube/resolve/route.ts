import { NextResponse } from "next/server";
import { resolveYouTube } from "@/lib/server/youtube-resolve";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string };
    if (!body.url?.trim()) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }
    const result = await resolveYouTube(body.url.trim());
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "YouTube resolve failed" },
      { status: 502 },
    );
  }
}
