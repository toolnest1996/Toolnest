"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Download,
  Eye,
  FileArchive,
  Gauge,
  Loader2,
  ScanLine,
  Settings2,
  Shield,
  Trash2,
  UploadCloud,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import {
  COMPRESS_PRESETS,
  compressPdf,
  compressPdfBatch,
  DEFAULT_COMPRESS_OPTIONS,
  estimateCompressedSize,
  smartCompressSuggestions,
  type CompressionLevel,
  type CompressOptions,
  type CompressResult,
} from "./pdf-compress-utils";
import { parsePdf, PdfEncryptedError, type PdfDocument } from "./pdf-merge-utils";
import { zipSplitFiles } from "./pdf-split-utils";

type Tab = "studio" | "compare" | "batch" | "api";

const SETTINGS_KEY = "toolnest-pdf-compress-settings";

export function PdfCompress() {
  const inputRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLInputElement>(null);

  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [batchDocs, setBatchDocs] = useState<PdfDocument[]>([]);
  const [tab, setTab] = useState<Tab>("studio");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [pendingUnlock, setPendingUnlock] = useState<{ file: File; password: string } | null>(null);

  const [level, setLevel] = useState<CompressionLevel>("medium");
  const [jpegQuality, setJpegQuality] = useState(DEFAULT_COMPRESS_OPTIONS.jpegQuality);
  const [dpi, setDpi] = useState(DEFAULT_COMPRESS_OPTIONS.dpi);
  const [stripMetadata, setStripMetadata] = useState(true);
  const [grayscale, setGrayscale] = useState(false);
  const [outputPassword, setOutputPassword] = useState("");
  const [outputName, setOutputName] = useState("compressed");

  const options: CompressOptions = useMemo(
    () => ({
      level,
      jpegQuality,
      dpi,
      stripMetadata,
      grayscale,
      useObjectStreams: true,
      outputPassword,
    }),
    [level, jpegQuality, dpi, stripMetadata, grayscale, outputPassword],
  );

  const estSize = useMemo(
    () => (doc ? estimateCompressedSize(doc.size, options) : 0),
    [doc, options],
  );

  const smartTips = useMemo(
    () => (doc ? smartCompressSuggestions(doc.size, doc.pageCount, level) : []),
    [doc, level],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (typeof s.level === "string") setLevel(s.level as CompressionLevel);
      if (typeof s.jpegQuality === "number") setJpegQuality(s.jpegQuality);
      if (typeof s.dpi === "number") setDpi(s.dpi);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ level, jpegQuality, dpi }));
  }, [level, jpegQuality, dpi]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
  }, [previewUrl, originalPreviewUrl]);

  useEffect(() => {
    if (originalPreviewUrl) URL.revokeObjectURL(originalPreviewUrl);
    if (!doc) {
      setOriginalPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([doc.bytes], { type: "application/pdf" }));
    setOriginalPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [doc]);

  const applyLevel = (l: CompressionLevel) => {
    setLevel(l);
    if (l !== "custom") {
      const p = COMPRESS_PRESETS[l];
      setJpegQuality(p.jpegQuality);
      setDpi(p.dpi);
      setStripMetadata(p.stripMetadata);
    }
  };

  const loadFile = async (file: File, password?: string) => {
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please select a PDF");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    try {
      const parsed = await parsePdf(file, password);
      setDoc(parsed);
      setOutputName(parsed.name.replace(/\.pdf$/i, "") + "-compressed");
      toast.success(`${parsed.pageCount} pages · ${formatBytes(parsed.size)}`);
    } catch (e) {
      if (e instanceof PdfEncryptedError) {
        setPendingUnlock({ file, password: "" });
        toast.info("Password required");
        return;
      }
      const msg = e instanceof Error ? e.message : "Failed to read PDF";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const unlockPending = async () => {
    if (!pendingUnlock?.password.trim()) {
      toast.error("Enter password");
      return;
    }
    const { file, password } = pendingUnlock;
    setPendingUnlock(null);
    await loadFile(file, password);
  };

  const addBatch = async (files: FileList | File[]) => {
    setLoading(true);
    try {
      const loaded: PdfDocument[] = [];
      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith(".pdf")) continue;
        try {
          loaded.push(await parsePdf(file));
        } catch (e) {
          if (e instanceof PdfEncryptedError) {
            toast.error(`"${file.name}" encrypted — unlock in Studio first`);
            continue;
          }
          throw e;
        }
      }
      setBatchDocs((prev) => [...prev, ...loaded]);
      toast.success(`${loaded.length} PDF(s) queued`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch load failed");
    } finally {
      setLoading(false);
    }
  };

  const runCompress = useCallback(
    async (download: boolean) => {
      if (!doc) return null;
      setCompressing(true);
      setProgress(0);
      setError("");
      try {
        const res = await compressPdf(doc.bytes, options, setProgress);
        setResult(res);
        if (download) {
          downloadBlob(new Blob([res.data as BlobPart], { type: "application/pdf" }), `${outputName}.pdf`);
          toast.success(`Saved ${formatBytes(res.compressedBytes)} · ${res.savingsPercent}% smaller`);
        } else {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(new Blob([res.data as BlobPart], { type: "application/pdf" })));
          setTab("compare");
          toast.success(`Preview ready · ${res.savingsPercent}% reduction`);
        }
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Compression failed";
        setError(msg);
        toast.error(msg);
        return null;
      } finally {
        setCompressing(false);
        setProgress(0);
      }
    },
    [doc, options, outputName, previewUrl],
  );

  const runBatch = async () => {
    if (!batchDocs.length) {
      toast.error("Add PDFs to batch");
      return;
    }
    setCompressing(true);
    setProgress(0);
    try {
      const results = await compressPdfBatch(
        batchDocs.map((d) => ({ name: d.name, bytes: d.bytes })),
        options,
        setProgress,
      );
      const files = results.map((r) => ({ name: `${r.name}.pdf`, data: r.result.data }));
      const zip = await zipSplitFiles(files, "compressed-pdfs");
      downloadBlob(zip, "compressed-pdfs.zip");
      toast.success(`Batch ZIP · ${files.length} files`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setCompressing(false);
      setProgress(0);
    }
  };

  const clearAll = () => {
    setDoc(null);
    setBatchDocs([]);
    setResult(null);
    setError("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Original", value: doc ? formatBytes(doc.size) : "—", color: "text-violet-400" },
          { label: "Estimated", value: doc ? formatBytes(estSize) : "—", color: "text-amber-400" },
          { label: "Pages", value: doc?.pageCount ?? "—", color: "text-foreground" },
          { label: "Saved", value: result ? `${result.savingsPercent}%` : "—", color: "text-emerald-500" },
          { label: "Mode", value: level, color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className={cn("font-display text-lg font-bold capitalize", s.color)}>{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => !loading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void loadFile(f);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all sm:p-10",
          dragging ? "scale-[1.01] border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
          loading && "pointer-events-none opacity-70",
        )}
      >
        {loading ? <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" /> : <UploadCloud className="mb-3 h-10 w-10 text-primary" />}
        <p className="font-display text-lg font-semibold">Ultra PDF Compress Studio</p>
        <p className="mt-1 max-w-lg text-sm text-muted">
          Lossless to high compression · smart raster · metadata cleanup · batch ZIP · 100% in-browser
        </p>
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadFile(f); e.target.value = ""; }} />
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
          <Gauge className="h-3.5 w-3.5" /> Compression level
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {(["lossless", "low", "medium", "high", "custom"] as CompressionLevel[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => applyLevel(l)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                level === l ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
              )}
            >
              <p className="font-medium capitalize">{l === "custom" ? "Custom" : COMPRESS_PRESETS[l as Exclude<CompressionLevel, "custom">]?.label ?? l}</p>
              <p className="mt-0.5 text-[10px] text-muted">
                {l === "custom" ? "Your quality & DPI" : COMPRESS_PRESETS[l as Exclude<CompressionLevel, "custom">]?.estReduction + " est."}
              </p>
            </button>
          ))}
        </div>
      </div>

      {(doc || batchDocs.length > 0) && smartTips.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="mb-1 flex items-center gap-2 font-medium text-primary">
            <ScanLine className="h-4 w-4" /> Smart compress assist
          </p>
          <ul className="list-inside list-disc text-muted">{smartTips.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="gradient" disabled={!doc || compressing} onClick={() => void runCompress(true)}>
          {compressing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Compress & Download
        </Button>
        <Button variant="outline" disabled={!doc || compressing} onClick={() => void runCompress(false)}>
          <Eye className="h-4 w-4" /> Preview first
        </Button>
        <Button variant="outline" onClick={() => setShowSettings((s) => !s)}>
          <Settings2 className="h-4 w-4" /> Settings
        </Button>
        <Button variant="outline" onClick={clearAll} className="text-error">
          <Trash2 className="h-4 w-4" /> Clear
        </Button>
      </div>

      {showSettings && (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Output filename">
            <input value={outputName} onChange={(e) => setOutputName(e.target.value)} className={inputClass()} />
          </Field>
          <Field label={`JPEG quality: ${Math.round(jpegQuality * 100)}%`}>
            <input type="range" min={0.3} max={0.95} step={0.01} value={jpegQuality} onChange={(e) => { setJpegQuality(Number(e.target.value)); setLevel("custom"); }} className="w-full accent-[var(--primary)]" />
          </Field>
          <Field label={`Target DPI: ${dpi}`}>
            <input type="range" min={72} max={200} step={1} value={dpi} onChange={(e) => { setDpi(Number(e.target.value)); setLevel("custom"); }} className="w-full accent-[var(--primary)]" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={stripMetadata} onChange={(e) => setStripMetadata(e.target.checked)} /> Strip metadata
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} /> Grayscale (smaller)
          </label>
          <Field label="Output password (optional)">
            <input type="password" value={outputPassword} onChange={(e) => setOutputPassword(e.target.value)} className={inputClass()} />
          </Field>
        </div>
      )}

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {(
          [
            ["studio", "Studio", Zap],
            ["compare", "Compare", Eye],
            ["batch", "Batch", FileArchive],
            ["api", "API", Shield],
          ] as const
        ).map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium", tab === key ? "bg-primary text-white" : "text-muted hover:text-foreground")}>
            <Icon className="h-4 w-4" /><span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === "compare" && result && doc && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-medium">Before · {formatBytes(result.originalBytes)}</p>
            <iframe src={originalPreviewUrl ?? undefined} title="Original" className="h-[min(50vh,480px)] w-full rounded-lg bg-white" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-medium text-emerald-500">After · {formatBytes(result.compressedBytes)} (−{result.savingsPercent}%)</p>
            {previewUrl ? <iframe src={previewUrl} title="Compressed" className="h-[min(50vh,480px)] w-full rounded-lg bg-white" /> : <p className="py-20 text-center text-muted">Run preview to compare</p>}
          </div>
        </div>
      )}

      {tab === "batch" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <Button variant="outline" size="sm" onClick={() => batchRef.current?.click()}><UploadCloud className="h-4 w-4" /> Add PDFs</Button>
          <input ref={batchRef} type="file" accept=".pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) void addBatch(e.target.files); e.target.value = ""; }} />
          {batchDocs.map((d) => (
            <div key={d.id} className="flex justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span className="truncate">{d.name}</span>
              <span className="text-muted">{formatBytes(d.size)} · {d.pageCount} pg</span>
            </div>
          ))}
          <Button variant="gradient" disabled={!batchDocs.length || compressing} onClick={() => void runBatch()}>
            {compressing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
            Batch compress & ZIP
          </Button>
        </div>
      )}

      {tab === "api" && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-medium"><Shield className="h-4 w-4 text-primary" /> POST /api/v1/pdf/compress</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`{ "pdf": "base64...", "options": { "level": "medium", "jpegQuality": 0.72, "dpi": 110 } }`}</pre>
        </div>
      )}

      {compressing && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted"><span>Compressing…</span><span>{progress}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-border"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      {error && <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

      {pendingUnlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold">Unlock PDF</h3>
            <div className="mt-4"><Field label="Password"><input type="password" value={pendingUnlock.password} onChange={(e) => setPendingUnlock({ ...pendingUnlock, password: e.target.value })} className={inputClass()} onKeyDown={(e) => e.key === "Enter" && void unlockPending()} /></Field></div>
            <div className="mt-4 flex gap-2"><Button variant="gradient" onClick={() => void unlockPending()}>Unlock</Button><Button variant="outline" onClick={() => setPendingUnlock(null)}>Cancel</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
