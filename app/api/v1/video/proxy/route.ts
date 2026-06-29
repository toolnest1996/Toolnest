import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const ALLOWED_HOST_SUFFIXES = [
  "googlevideo.com",
  "youtube.com",
  "ytimg.com",
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
  "akamaized.net",
];

function isAllowedUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    return ALLOWED_HOST_SUFFIXES.some(
      (s) => u.hostname === s || u.hostname.endsWith(`.${s}`),
    );
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  const filename = searchParams.get("filename") ?? "download";

  if (!target || !isAllowedUrl(target)) {
    return NextResponse.json({ error: "Invalid or disallowed URL" }, { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "*/*",
      },
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream HTTP ${upstream.status}` }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const body = upstream.body;
    if (!body) {
      return NextResponse.json({ error: "Empty response" }, { status: 502 });
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.\-]+/g, "_")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Proxy failed" },
      { status: 502 },
    );
  }
}
