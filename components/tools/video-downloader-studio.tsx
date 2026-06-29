"use client";

import { useState } from "react";
import { Download, Loader2, Star, Youtube } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  DOWNLOADER_META,
  YOUTUBE_THUMB_QUALITIES,
  extractYouTubeId,
  proxyDownloadUrl,
  resolveVideoViaApi,
  validateUrl,
  youtubeThumbUrl,
  type VideoDownloaderKind,
  type VideoResolveResult,
} from "./video-downloader-utils";

interface Props {
  kind: VideoDownloaderKind;
}

export function VideoDownloaderStudio({ kind }: Props) {
  const favorites = useFavorites();
  const meta = DOWNLOADER_META[kind];
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VideoResolveResult | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);

  const slug = kind;

  const resolve = async () => {
    const err = validateUrl(url, kind);
    if (err) return toast.error(err);

    if (kind === "youtube-thumbnail") {
      const id = extractYouTubeId(url);
      if (id) {
        setVideoId(id);
        toast.success("Thumbnails loaded");
      }
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      const data = await resolveVideoViaApi(url, kind);
      setResult(data);
      toast.success("Media resolved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadStream = (streamUrl: string, filename: string) => {
    window.open(proxyDownloadUrl(streamUrl, filename), "_blank", "noopener,noreferrer");
  };

  const downloadThumb = async (quality: string) => {
    if (!videoId) return;
    const imgUrl = youtubeThumbUrl(videoId, quality);
    const res = await fetch(imgUrl);
    if (!res.ok) return toast.error("Thumbnail not available");
    downloadBlob(await res.blob(), `youtube-${videoId}-${quality}.jpg`);
  };

  const downloadImage = async (imageUrl: string) => {
    try {
      const res = await fetch(proxyDownloadUrl(imageUrl, "instagram-photo.jpg"));
      if (!res.ok) throw new Error("Download failed");
      downloadBlob(await res.blob(), "instagram-photo.jpg");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const streams =
    kind === "youtube-mp3"
      ? result?.audioStreams ?? []
      : result?.videoStreams ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex justify-between">
        <div>
          <h2 className="text-lg font-semibold">{meta.title}</h2>
          <p className="text-sm text-muted">{meta.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => favorites.toggle(slug)}
          className={cn(
            "h-fit rounded-lg border px-3 py-1.5 text-xs",
            favorites.isFavorite(slug) ? "border-primary text-primary" : "border-border",
          )}
        >
          <Star className="inline h-3.5 w-3.5" /> Favorite
        </button>
      </div>

      <Field label="URL">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={meta.placeholder}
          className={inputClass()}
          onKeyDown={(e) => e.key === "Enter" && void resolve()}
        />
      </Field>

      <Button variant="gradient" disabled={busy} onClick={() => void resolve()}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
        {kind === "youtube-thumbnail" ? "Get thumbnails" : "Resolve media"}
      </Button>

      {kind === "youtube-thumbnail" && videoId && (
        <div className="grid gap-4 sm:grid-cols-2">
          {YOUTUBE_THUMB_QUALITIES.map((q) => (
            <div key={q} className="overflow-hidden rounded-xl border border-border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={youtubeThumbUrl(videoId, q)}
                alt={q}
                className="aspect-video w-full object-cover"
              />
              <div className="flex items-center justify-between p-3">
                <span className="text-xs font-medium uppercase">{q}</span>
                <button
                  type="button"
                  onClick={() => void downloadThumb(q)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Download className="h-3 w-3" /> Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {result && kind !== "youtube-thumbnail" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex gap-4">
            {result.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.thumbnail}
                alt=""
                className="h-20 w-32 rounded-lg object-cover"
              />
            )}
            <div>
              <p className="font-medium">{result.title}</p>
              {result.author && <p className="text-sm text-muted">{result.author}</p>}
              {result.duration != null && (
                <p className="text-xs text-muted">{Math.floor(result.duration / 60)} min</p>
              )}
            </div>
          </div>

          {kind === "instagram-photo" && result.imageUrl && (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={result.imageUrl} alt="" className="max-h-96 w-full rounded-lg object-contain" />
              <Button variant="gradient" onClick={() => void downloadImage(result.imageUrl!)}>
                <Download className="h-4 w-4" /> Download photo
              </Button>
            </div>
          )}

          {streams.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {kind === "youtube-mp3" ? "Audio streams" : "Video streams"}
              </p>
              {streams.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <span>
                    {s.quality} · {s.mime.split(";")[0]}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      downloadStream(
                        s.url,
                        `${result.title.slice(0, 40).replace(/\W+/g, "_")}-${s.quality}.${kind === "youtube-mp3" ? "m4a" : "mp4"}`,
                      )
                    }
                  >
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </div>
              ))}
            </div>
          )}

          {!streams.length && !result.imageUrl && (
            <p className="text-sm text-muted">No downloadable streams found.</p>
          )}
        </div>
      )}

      <p className="text-xs text-muted">
        Downloads are proxied server-side for CORS. YouTube uses public stream metadata APIs; availability
        depends on the video and region.
      </p>
    </div>
  );
}

/** @deprecated Use VideoDownloaderStudio with kind="youtube-thumbnail" */
export function YoutubeThumbnail() {
  return <VideoDownloaderStudio kind="youtube-thumbnail" />;
}
