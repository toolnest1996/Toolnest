"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  Check,
  Download,
  Eye,
  FileText,
  Gauge,
  Loader2,
  Lock,
  Shield,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import {
  compressPdfToTarget,
  type CompressOptions,
  type CompressResult,
} from "./pdf-compress-utils";
import { bytesFromSizeInput, formatSizeUnit } from "./image-compressor-utils";
import { parsePdf, PdfEncryptedError, type PdfDocument } from "./pdf-merge-utils";

const SETTINGS_KEY = "toolnest-pdf-resize-kb-settings";

const PRESETS_KB = [100, 200, 500, 1024, 2048];

type Tab = "studio" | "compare" | "api";

export function PdfResizeKb() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [tab, setTab] = useState<Tab>("studio");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [progressInfo, setProgressInfo] = useState("");
  const [error, setError] = useState("");
  const [pendingUnlock, setPendingUnlock] = useState<{ file: File; password: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [hit, setHit] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [outputName, setOutputName] = useState("resized");

  const [targetValue, setTargetValue] = useState(200);
  const [targetUnit, setTargetUnit] = useState<"B" | "KB" | "MB">("KB");
  const [grayscale, setGrayscale] = useState(false);
  const [outputPassword, setOutputPassword] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (typeof s.targetValue === "number") setTargetValue(s.targetValue);
      if (s.targetUnit === "B" || s.targetUnit === "KB" || s.targetUnit === "MB") setTargetUnit(s.targetUnit);
      if (typeof s.grayscale === "boolean") setGrayscale(s.grayscale);
      if (typeof s.outputPassword === "string") setOutputPassword(s.outputPassword);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ targetValue, targetUnit, grayscale, outputPassword }),
      );
    } catch { /* ignore */ }
  }, [targetValue, targetUnit, grayscale, outputPassword]);

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

  const targetBytes = useMemo(
    () => bytesFromSizeInput(targetValue, targetUnit),
    [targetValue, targetUnit],
  );

  const targetLabel = useMemo(() => {
    const { value, unit } = formatSizeUnit(targetBytes);
    return `${value} ${unit}`;
  }, [targetBytes]);

  const baseOptions: CompressOptions = useMemo(
    () => ({
      level: "custom",
      jpegQuality: 0.72,
      dpi: 110,
      stripMetadata: true,
      grayscale,
      useObjectStreams: true,
      outputPassword,
    }),
    [grayscale, outputPassword],
  );

  const loadFile = async (file: File, password?: string) => {
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please select a PDF");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setHit(false);
    setAttempts(0);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    try {
      const parsed = await parsePdf(file, password);
      setDoc(parsed);
      setOutputName(parsed.name.replace(/\.pdf$/i, "") + "-resized");
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

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void loadFile(f);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) void loadFile(f);
  };

  const runResize = useCallback(
    async (autoDownload: boolean) => {
      if (!doc) {
        toast.error("Add a PDF first");
        return;
      }
      setBusy(true);
      setProgress(0);
      setAttempt(0);
      setProgressInfo("");
      setError("");
      try {
        const { result: res, hit: reached, attempts: tries } = await compressPdfToTarget(
          doc.bytes,
          targetBytes,
          baseOptions,
          (pct, att, info) => {
            setProgress(pct);
            setAttempt(att);
            setProgressInfo(info);
          },
        );
        setResult(res);
        setHit(reached);
        setAttempts(tries);
        const blob = new Blob([res.data as BlobPart], { type: "application/pdf" });
        if (autoDownload) {
          downloadBlob(blob, `${outputName}.pdf`);
          toast.success(
            reached
              ? `Hit target · ${formatBytes(res.compressedBytes)} (−${res.savingsPercent}%, ${tries} pass${tries === 1 ? "" : "es"})`
              : `Closest match · ${formatBytes(res.compressedBytes)} (target ${targetLabel} not reachable)`,
          );
        } else {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(blob));
          setTab("compare");
          toast.success(
            reached
              ? `Preview ready · ${formatBytes(res.compressedBytes)} on target`
              : `Preview ready · closest ${formatBytes(res.compressedBytes)}`,
          );
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Resize failed";
        setError(msg);
        toast.error(msg);
      } finally {
        setBusy(false);
        setProgress(0);
        setAttempt(0);
        setProgressInfo("");
      }
    },
    [doc, targetBytes, targetLabel, baseOptions, outputName, previewUrl],
  );

  const clearAll = () => {
    setDoc(null);
    setResult(null);
    setHit(false);
    setAttempts(0);
    setError("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const onTarget = (kb: number) => {
    setTargetValue(kb);
    setTargetUnit("KB");
  };

  const withinTolerance = result ? result.compressedBytes <= targetBytes * 1.05 : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Lock className="h-3.5 w-3.5" /> 100% private · in-browser
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
            <FileText className="h-3.5 w-3.5 text-primary" /> pdf-lib + pdfjs-dist
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Original", value: doc ? formatBytes(doc.size) : "—", color: "text-violet-400" },
          { label: "Target", value: targetLabel, color: "text-amber-400" },
          { label: "Result", value: result ? formatBytes(result.compressedBytes) : "—", color: "text-emerald-500" },
          { label: "Saved", value: result ? `${result.savingsPercent}%` : "—", color: "text-primary" },
          { label: "Pages", value: doc?.pageCount ?? "—", color: "text-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className={cn("font-display text-lg font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {!doc ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !loading && inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all sm:p-14",
            dragging ? "scale-[1.01] border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
            loading && "pointer-events-none opacity-70",
          )}
        >
          {loading ? <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" /> : <UploadCloud className="mb-3 h-10 w-10 text-primary" />}
          <p className="font-display text-xl font-semibold">Resize PDF to a target file size in KB</p>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Drop a PDF or click to browse. The engine rasterizes pages and tunes DPI + JPEG quality to hit your target — 100% in-browser.
          </p>
          <Button variant="gradient" type="button" className="mt-5" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
            <UploadCloud className="h-4 w-4" /> Add PDF
          </Button>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onInputChange} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <UploadCloud className="h-4 w-4" /> Replace PDF
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} className="text-error">
            <Trash2 className="h-4 w-4" /> Clear
          </Button>
          <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onInputChange} />
        </div>
      )}

      {doc && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
            <Gauge className="h-3.5 w-3.5" /> Target file size
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Target size">
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={targetValue}
                  onChange={(e) => setTargetValue(Math.max(1, Number(e.target.value)))}
                  className={inputClass()}
                />
                <select
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value as "B" | "KB" | "MB")}
                  className={cn(inputClass(), "w-24")}
                >
                  <option value="B">B</option>
                  <option value="KB">KB</option>
                  <option value="MB">MB</option>
                </select>
              </div>
            </Field>
            <div className="flex flex-wrap gap-2 pb-1">
              {PRESETS_KB.map((kb) => (
                <button
                  key={kb}
                  type="button"
                  onClick={() => onTarget(kb)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs transition-colors",
                    targetUnit === "KB" && targetValue === kb
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  {kb >= 1024 ? `${kb / 1024} MB` : `${kb} KB`}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            The engine sweeps DPI (144→72) and JPEG quality (85%→32%) to find the smallest output at or below your target. Pages are rasterized, so text may soften at aggressive targets.
          </p>
        </div>
      )}

      {doc && (
        <div className="flex flex-wrap gap-2">
          <Button variant="gradient" disabled={busy} onClick={() => void runResize(true)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Resize & Download
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void runResize(false)}>
            <Eye className="h-4 w-4" /> Preview first
          </Button>
        </div>
      )}

      {doc && (
        <details className="rounded-xl border border-border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium">Options</summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Field label="Output filename">
              <input value={outputName} onChange={(e) => setOutputName(e.target.value)} className={inputClass()} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={grayscale}
                onChange={(e) => setGrayscale(e.target.checked)}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Grayscale (smaller)
            </label>
            <Field label="Output password (optional)">
              <input
                type="password"
                value={outputPassword}
                onChange={(e) => setOutputPassword(e.target.value)}
                className={inputClass()}
              />
            </Field>
          </div>
        </details>
      )}

      {busy && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted">
            <span>Compressing… attempt {attempt} · {progressInfo}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {result && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm",
            withinTolerance ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5",
          )}
        >
          <span className="flex items-center gap-2 font-medium">
            {withinTolerance ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Sparkles className="h-4 w-4 text-amber-500" />
            )}
            {withinTolerance ? "On target" : "Closest match"}
          </span>
          <span className="text-muted">Target {targetLabel}</span>
          <span className="text-foreground">→ got {formatBytes(result.compressedBytes)}</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-500">−{result.savingsPercent}%</span>
          <span className="text-xs text-muted">{attempts} attempt{attempts === 1 ? "" : "s"}</span>
        </div>
      )}

      {doc && (
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {(
            [
              ["studio", "Studio", FileText],
              ["compare", "Compare", Eye],
              ["api", "API", Shield],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
                tab === key ? "bg-primary text-white" : "text-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "compare" && result && doc && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-medium">Before · {formatBytes(result.originalBytes)}</p>
            <iframe src={originalPreviewUrl ?? undefined} title="Original" className="h-[min(50vh,480px)] w-full rounded-lg bg-white" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 font-medium text-emerald-500">
              After · {formatBytes(result.compressedBytes)} (−{result.savingsPercent}%)
            </p>
            {previewUrl ? (
              <iframe src={previewUrl} title="Resized" className="h-[min(50vh,480px)] w-full rounded-lg bg-white" />
            ) : (
              <p className="py-20 text-center text-muted">Run preview to compare</p>
            )}
          </div>
        </div>
      )}

      {tab === "api" && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-medium">
            <Shield className="h-4 w-4 text-primary" /> POST /api/v1/pdf/compress (target mode)
          </p>
          <p className="mt-2 text-sm text-muted">
            Reuse the existing compress endpoint with <code>options.targetBytes</code> to hit a specific size. The server sweeps DPI + JPEG quality just like the browser studio.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/pdf/compress \\
  -H "Content-Type: application/json" \\
  -d '{
    "pdf": "data:application/pdf;base64,...",
    "options": {
      "level": "custom",
      "targetBytes": 204800,
      "grayscale": false
    }
  }'`}</pre>
        </div>
      )}

      {error && <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

      {pendingUnlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <h3 className="font-semibold">Unlock PDF</h3>
            <div className="mt-4">
              <Field label="Password">
                <input
                  type="password"
                  value={pendingUnlock.password}
                  onChange={(e) => setPendingUnlock({ ...pendingUnlock, password: e.target.value })}
                  className={inputClass()}
                  onKeyDown={(e) => e.key === "Enter" && void unlockPending()}
                />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="gradient" onClick={() => void unlockPending()}>Unlock</Button>
              <Button variant="outline" onClick={() => setPendingUnlock(null)}>
                <X className="h-4 w-4" /> Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
