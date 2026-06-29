/**
 * Shared video downloader — URL parsing, API types, helpers.
 */

export type VideoPlatform = "youtube" | "instagram";

export type VideoDownloaderKind =
  | "youtube-download"
  | "youtube-mp3"
  | "youtube-thumbnail"
  | "instagram-video"
  | "instagram-reel"
  | "instagram-photo";

export interface VideoStream {
  url: string;
  quality: string;
  mime: string;
  size?: number;
  hasAudio?: boolean;
  hasVideo?: boolean;
}

export interface VideoResolveResult {
  platform: VideoPlatform;
  title: string;
  author?: string;
  thumbnail?: string;
  duration?: number;
  videoStreams: VideoStream[];
  audioStreams: VideoStream[];
  imageUrl?: string;
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#/]+)/,
    /youtube\.com\/shorts\/([^&\n?#/]+)/,
    /youtube\.com\/live\/([^&\n?#/]+)/,
  ];
  for (const p of patterns) {
    const m = url.trim().match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function extractInstagramShortcode(url: string): string | null {
  const m = url.trim().match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}

export function normalizeVideoUrl(url: string, kind: VideoDownloaderKind): string {
  const u = url.trim();
  if (kind.startsWith("youtube")) {
    const id = extractYouTubeId(u);
    if (id) return `https://www.youtube.com/watch?v=${id}`;
  }
  if (kind.startsWith("instagram")) {
    const code = extractInstagramShortcode(u);
    if (code) {
      if (kind === "instagram-reel") return `https://www.instagram.com/reel/${code}/`;
      return `https://www.instagram.com/p/${code}/`;
    }
  }
  return u;
}

export function validateUrl(url: string, kind: VideoDownloaderKind): string | null {
  if (!url.trim()) return "Enter a URL";
  if (kind.startsWith("youtube") && !extractYouTubeId(url)) return "Invalid YouTube URL";
  if (kind.startsWith("instagram") && !extractInstagramShortcode(url)) return "Invalid Instagram post/reel URL";
  return null;
}

export const YOUTUBE_THUMB_QUALITIES = ["maxresdefault", "sddefault", "hqdefault", "mqdefault", "default"] as const;

export function youtubeThumbUrl(videoId: string, quality: string): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

export async function resolveVideoViaApi(
  url: string,
  kind: VideoDownloaderKind,
): Promise<VideoResolveResult> {
  const endpoint =
    kind.startsWith("youtube") ? "/api/v1/video/youtube/resolve" : "/api/v1/video/instagram/resolve";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: normalizeVideoUrl(url, kind), kind }),
  });
  const data = (await res.json()) as VideoResolveResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Failed to resolve media");
  return data;
}

export function proxyDownloadUrl(streamUrl: string, filename: string): string {
  const params = new URLSearchParams({ url: streamUrl, filename });
  return `/api/v1/video/proxy?${params.toString()}`;
}

export const DOWNLOADER_META: Record<
  VideoDownloaderKind,
  { title: string; subtitle: string; placeholder: string; acceptAudio?: boolean }
> = {
  "youtube-download": {
    title: "YouTube Downloader",
    subtitle: "Download YouTube videos in MP4 — quality picker, metadata & batch URLs",
    placeholder: "https://youtube.com/watch?v=...",
  },
  "youtube-mp3": {
    title: "YouTube to MP3",
    subtitle: "Extract audio from YouTube — M4A/WebM audio streams",
    placeholder: "https://youtube.com/watch?v=...",
    acceptAudio: true,
  },
  "youtube-thumbnail": {
    title: "YouTube Thumbnail",
    subtitle: "Grab max-res and fallback thumbnails from any video",
    placeholder: "https://youtube.com/watch?v=...",
  },
  "instagram-video": {
    title: "Instagram Video",
    subtitle: "Download video from Instagram posts",
    placeholder: "https://instagram.com/p/...",
  },
  "instagram-reel": {
    title: "Instagram Reel",
    subtitle: "Download Instagram reels in HD",
    placeholder: "https://instagram.com/reel/...",
  },
  "instagram-photo": {
    title: "Instagram Photo",
    subtitle: "Download photos from Instagram posts",
    placeholder: "https://instagram.com/p/...",
  },
};
