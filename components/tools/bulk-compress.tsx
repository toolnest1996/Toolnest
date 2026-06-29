"use client";

import { useRef, useState } from "react";
import { FileArchive, FolderUp, Loader2, Star, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  COMPRESS_PRESETS,
  DEFAULT_COMPRESS_OPTIONS,
  analyzeImage,
  buildOutputName,
  compressBatch,
  detectMime,
  isSupportedInput,
  type CompressMode,
  type CompressOptions,
  type ImageItem,
} from "./image-compressor-utils";

function nextId() {
  return crypto.randomUUID();
}

export function BulkCompress() {
  const favorites = useFavorites();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ImageItem[]>([]);
  const [opts, setOpts] = useState<CompressOptions>({ ...DEFAULT_COMPRESS_OPTIONS });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const addFiles = async (files: FileList | File[]) => {
    const accepted: ImageItem[] = [];
    for (const file of Array.from(files)) {
      if (!isSupportedInput(file)) continue;
      const item: ImageItem = {
        id: nextId(),
        file,
        name: file.name,
        originalBytes: file.size,
        originalMime: detectMime(file),
        outputName: file.name,
        meta: null,
        status: "queued",
        result: null,
        thumbUrl: URL.createObjectURL(file),
      };
      accepted.push(item);
      try {
        const { meta } = await analyzeImage(file);
        item.meta = meta;
      } catch {
        item.status = "error";
        item.error = "Could not decode";
      }
    }
    if (accepted.length) {
      setItems((p) => [...p, ...accepted]);
      toast.success(`${accepted.length} image(s) queued`);
    } else toast.error("No supported images");
  };

  const run = async () => {
    if (!items.length) return toast.error("Add images");
    setBusy(true);
    setProgress(0);
    try {
      const updated = await compressBatch(items, opts, (done, total) => setProgress(Math.round((done / total) * 100)), false);
      setItems(updated);
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      updated.forEach((i) => {
        if (i.result) zip.file(buildOutputName(i.name, i.result.format), i.result.blob);
      });
      downloadBlob(await zip.generateAsync({ type: "blob", compression: "DEFLATE" }), "bulk-compressed.zip");
      toast.success(`ZIP ready · ${updated.filter((i) => i.result).length} files`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  };

  const totalIn = items.reduce((s, i) => s + i.originalBytes, 0);
  const modes = Object.keys(COMPRESS_PRESETS) as Exclude<CompressMode, "custom" | "target">[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex justify-between"><p className="text-sm text-muted">Ultra Bulk Image Compressor · folder · presets · ZIP</p><button type="button" onClick={() => favorites.toggle("bulk-compress")} className={cn("rounded-lg border px-3 py-1.5 text-xs", favorites.isFavorite("bulk-compress") ? "border-primary text-primary" : "border-border")}><Star className="inline h-3.5 w-3.5" /> Favorite</button></div>
      <div className="flex flex-wrap justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-card p-8">
        <Button variant="outline" onClick={() => inputRef.current?.click()}><UploadCloud className="h-4 w-4" /> Add images</Button>
        <Button variant="outline" onClick={() => folderRef.current?.click()}><FolderUp className="h-4 w-4" /> Folder</Button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={folderRef} type="file" accept="image/*" multiple className="hidden" {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
      </div>
      {items.length > 0 && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <p className="text-sm">{items.length} files · {formatBytes(totalIn)}</p>
          <Field label="Preset"><select value={opts.mode} onChange={(e) => { const m = e.target.value as Exclude<CompressMode, "custom" | "target">; const p = COMPRESS_PRESETS[m]; setOpts({ ...opts, mode: m, quality: p.quality }); }} className={inputClass()}>{modes.map((m) => <option key={m} value={m}>{COMPRESS_PRESETS[m].label}</option>)}</select></Field>
          <Field label="Format"><select value={opts.format} onChange={(e) => setOpts({ ...opts, format: e.target.value as CompressOptions["format"] })} className={inputClass()}><option value="image/webp">WebP</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></Field>
          <Button variant="gradient" disabled={busy} onClick={() => void run()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} Compress all → ZIP</Button>
          {busy && <div className="h-2 rounded-full bg-muted/30"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div>}
        </div>
      )}
    </div>
  );
}
