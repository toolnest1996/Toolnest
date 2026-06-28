import { NextResponse } from "next/server";

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local")) return false;
    if (/^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = body.url as string;
    if (!url || typeof url !== "string") {
      return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });
    }
    if (!isSafeUrl(url)) {
      return NextResponse.json({ ok: false, error: "Invalid or blocked URL" }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ToolNest-TTS/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `HTTP ${res.status}` }, { status: 422 });
    }
    const html = await res.text();
    const text = htmlToText(html).slice(0, 120_000);
    if (!text) {
      return NextResponse.json({ ok: false, error: "No extractable text on page" }, { status: 422 });
    }

    return NextResponse.json({ ok: true, text, title: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Extract failed" },
      { status: 422 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/v1/tts/extract",
    methods: ["POST"],
    body: { url: "https://example.com/article" },
  });
}
