/**
 * Server-side YouTube stream resolution via Piped-compatible API.
 */

export interface ServerVideoStream {
  url: string;
  quality: string;
  mime: string;
  size?: number;
  hasAudio?: boolean;
  hasVideo?: boolean;
}

export interface ServerYouTubeResult {
  platform: "youtube";
  title: string;
  author?: string;
  thumbnail?: string;
  duration?: number;
  videoStreams: ServerVideoStream[];
  audioStreams: ServerVideoStream[];
}

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://api.piped.yt",
];

export function parseYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#/]+)/,
    /youtube\.com\/shorts\/([^&\n?#/]+)/,
    /youtube\.com\/live\/([^&\n?#/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

async function fetchPipedStreams(videoId: string): Promise<Record<string, unknown>> {
  let lastErr: Error | null = null;
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 0 },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as Record<string, unknown>;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr ?? new Error("All Piped instances failed");
}

export async function resolveYouTube(url: string): Promise<ServerYouTubeResult> {
  const videoId = parseYouTubeId(url);
  if (!videoId) throw new Error("Invalid YouTube URL");

  const data = await fetchPipedStreams(videoId);
  const videoStreams = ((data.videoStreams as Record<string, unknown>[]) ?? [])
    .filter((s) => typeof s.url === "string" && s.url)
    .map((s) => ({
      url: String(s.url),
      quality: String(s.quality ?? s.resolution ?? "unknown"),
      mime: String(s.mimeType ?? s.mime ?? "video/mp4"),
      size: typeof s.contentLength === "number" ? s.contentLength : undefined,
      hasAudio: Boolean(s.audioTrack),
      hasVideo: true,
    }));

  const audioStreams = ((data.audioStreams as Record<string, unknown>[]) ?? [])
    .filter((s) => typeof s.url === "string" && s.url)
    .map((s) => ({
      url: String(s.url),
      quality: String(s.quality ?? "audio"),
      mime: String(s.mimeType ?? s.mime ?? "audio/mp4"),
      size: typeof s.contentLength === "number" ? s.contentLength : undefined,
      hasAudio: true,
      hasVideo: false,
    }));

  if (!videoStreams.length && !audioStreams.length) {
    throw new Error("No streams found — video may be restricted or unavailable");
  }

  return {
    platform: "youtube",
    title: String(data.title ?? "YouTube Video"),
    author: typeof data.uploader === "string" ? data.uploader : undefined,
    thumbnail: typeof data.thumbnailUrl === "string" ? data.thumbnailUrl : `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    duration: typeof data.duration === "number" ? data.duration : undefined,
    videoStreams,
    audioStreams,
  };
}
