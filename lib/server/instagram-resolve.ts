/**
 * Server-side Instagram media resolution — oEmbed + page meta fallback.
 */

export interface ServerInstagramResult {
  platform: "instagram";
  title: string;
  author?: string;
  thumbnail?: string;
  videoStreams: { url: string; quality: string; mime: string }[];
  audioStreams: [];
  imageUrl?: string;
}

function extractMeta(html: string, property: string): string | null {
  const og = new RegExp(`property=["']og:${property}["']\\s+content=["']([^"']+)["']`, "i").exec(html);
  if (og?.[1]) return og[1];
  const rev = new RegExp(`content=["']([^"']+)["']\\s+property=["']og:${property}["']`, "i").exec(html);
  return rev?.[1] ?? null;
}

function extractVideoUrl(html: string): string | null {
  const patterns = [
    /"video_url":"([^"]+)"/,
    /property="og:video" content="([^"]+)"/,
    /content="([^"]+)" property="og:video"/,
    /"contentUrl":"([^"]+\.mp4[^"]*)"/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return m[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
  }
  return null;
}

function extractImageUrl(html: string): string | null {
  return (
    extractMeta(html, "image") ??
    /"display_url":"([^"]+)"/.exec(html)?.[1]?.replace(/\\u0026/g, "&").replace(/\\\//g, "/") ??
    null
  );
}

export function parseInstagramShortcode(url: string): string | null {
  return url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

export async function resolveInstagram(url: string, kind: string): Promise<ServerInstagramResult> {
  const shortcode = parseInstagramShortcode(url);
  if (!shortcode) throw new Error("Invalid Instagram URL");

  const normalized = url.includes("/reel/") || kind === "instagram-reel"
    ? `https://www.instagram.com/reel/${shortcode}/`
    : `https://www.instagram.com/p/${shortcode}/`;

  let title = "Instagram Media";
  let author: string | undefined;
  let thumbnail: string | undefined;
  let videoUrl: string | null = null;
  let imageUrl: string | null = null;

  try {
    const oembed = await fetch(
      `https://api.instagram.com/oembed?url=${encodeURIComponent(normalized)}`,
      { next: { revalidate: 0 } },
    );
    if (oembed.ok) {
      const data = (await oembed.json()) as Record<string, unknown>;
      title = String(data.title ?? title);
      author = typeof data.author_name === "string" ? data.author_name : undefined;
      thumbnail = typeof data.thumbnail_url === "string" ? data.thumbnail_url : undefined;
    }
  } catch {
    /* oEmbed optional */
  }

  const pageRes = await fetch(normalized, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
    next: { revalidate: 0 },
  });

  if (pageRes.ok) {
    const html = await pageRes.text();
    title = extractMeta(html, "title") ?? title;
    thumbnail = thumbnail ?? extractMeta(html, "image") ?? undefined;
    videoUrl = extractVideoUrl(html);
    imageUrl = extractImageUrl(html);
  }

  const videoStreams: ServerInstagramResult["videoStreams"] = [];
  if (videoUrl && kind !== "instagram-photo") {
    videoStreams.push({ url: videoUrl, quality: "HD", mime: "video/mp4" });
  }

  if (kind === "instagram-photo" && !imageUrl && thumbnail) imageUrl = thumbnail;

  if (kind === "instagram-photo" && !imageUrl) {
    throw new Error("No photo found — post may be private or a video");
  }
  if ((kind === "instagram-video" || kind === "instagram-reel") && !videoStreams.length) {
    throw new Error("No video stream found — reel may be private or unavailable");
  }

  return {
    platform: "instagram",
    title,
    author,
    thumbnail,
    videoStreams,
    audioStreams: [],
    imageUrl: imageUrl ?? undefined,
  };
}
