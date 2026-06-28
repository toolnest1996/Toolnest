"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  Lock,
  Settings2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import { isSupportedInput, type OutputFormat } from "./image-compressor-utils";
import { parsePdf, PdfEncryptedError, type PdfDocument } from "./pdf-merge-utils";
import type { PanResult } from "./pan-card-editor";
import { GovPhotoEditor } from "./gov-photo-editor";
import { GOV_PRESETS, cmToPx, type GovVariant } from "@/lib/data/gov-presets";

const SETTINGS_KEY_PREFIX = "toolnest-gov-photo-resizer-settings-";

type Step = 1 | 2 | 3;
type ResizeMode = "original" | "selected-area";

function pxFromCm(cmW: number, cmH: number, dpi: number) {
  return { w: cmToPx(cmW, dpi), h: cmToPx(cmH, dpi) };
}

export function GovPhotoResizer({ slug }: { slug: string }) {
  const preset = GOV_PRESETS[slug];
  const favorites = useFavorites();
  const settingsKey = `${SETTINGS_KEY_PREFIX}${slug}`;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfDocument | null>(null);
  const [pendingUnlock, setPendingUnlock] = useState<{ file: File; password: string } | null>(null);

  const [variantIdx, setVariantIdx] = useState(0);
  const [resizeMode, setResizeMode] = useState<ResizeMode>("selected-area");

  // Custom mode
  const [isCustom, setIsCustom] = useState(false);
  const [customCmW, setCustomCmW] = useState(3.5);
  const [customCmH, setCustomCmH] = useState(4.5);
  const [customDpi, setCustomDpi] = useState(150);
  const [customMaxKb, setCustomMaxKb] = useState(50);
  const [customFormat, setCustomFormat] = useState<OutputFormat>("image/jpeg");

  const [result, setResult] = useState<PanResult | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const isPdf = useMemo(() => {
    if (!file) return false;
    return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  }, [file]);

  // Variants visible for the current uploaded file type.
  // PDF upload → only PDF variants (cmW === 0); image upload → only image variants (cmW > 0).
  const visibleVariants = useMemo(
    () =>
      preset.variants
        .map((v, i) => ({ v, i }))
        .filter(({ v }) => (isPdf ? v.cmW === 0 : v.cmW > 0)),
    [preset.variants, isPdf],
  );

  const variant = useMemo(() => {
    const cur = preset.variants[variantIdx];
    const curVisible = isPdf ? cur?.cmW === 0 : (cur?.cmW ?? 0) > 0;
    if (curVisible) return cur;
    return visibleVariants[0]?.v ?? preset.variants[0];
  }, [preset.variants, variantIdx, isPdf, visibleVariants]);

  // Auto-correct variantIdx when file type changes so it always points to a visible variant.
  useEffect(() => {
    if (visibleVariants.length === 0) return;
    const cur = preset.variants[variantIdx];
    const curVisible = isPdf ? cur?.cmW === 0 : cur?.cmW > 0;
    if (!curVisible) {
      setVariantIdx(visibleVariants[0].i);
      setIsCustom(false);
    }
  }, [isPdf, visibleVariants, preset.variants, variantIdx]);

  // Persist settings per slug
  useEffect(() => {
    try {
      const raw = localStorage.getItem(settingsKey);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (typeof s.variantIdx === "number" && s.variantIdx < preset.variants.length) setVariantIdx(s.variantIdx);
      if (s.resizeMode === "original" || s.resizeMode === "selected-area") setResizeMode(s.resizeMode);
      if (typeof s.isCustom === "boolean") setIsCustom(s.isCustom);
      if (typeof s.customCmW === "number") setCustomCmW(s.customCmW);
      if (typeof s.customCmH === "number") setCustomCmH(s.customCmH);
      if (typeof s.customDpi === "number") setCustomDpi(s.customDpi);
      if (typeof s.customMaxKb === "number") setCustomMaxKb(s.customMaxKb);
      if (typeof s.customFormat === "string") setCustomFormat(s.customFormat as OutputFormat);
    } catch { /* ignore */ }
  }, [settingsKey, preset.variants.length]);

  useEffect(() => {
    try {
      localStorage.setItem(
        settingsKey,
        JSON.stringify({ variantIdx, resizeMode, isCustom, customCmW, customCmH, customDpi, customMaxKb, customFormat }),
      );
    } catch { /* ignore */ }
  }, [settingsKey, variantIdx, resizeMode, isCustom, customCmW, customCmH, customDpi, customMaxKb, customFormat]);

  // Revoke URL on unmount
  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Compute target from variant or custom
  const target = useMemo(() => {
    if (isCustom) {
      const isDoc = preset.supportsDocument && (file?.type === "application/pdf" || file?.name.toLowerCase().endsWith(".pdf"));
      if (isDoc) {
        return { pxW: 0, pxH: 0, maxKb: customMaxKb, dpi: customDpi, label: "Custom (PDF)", hint: "Custom PDF target size", cmW: 0, cmH: 0 };
      }
      const { w, h } = pxFromCm(customCmW, customCmH, customDpi);
      return { pxW: w, pxH: h, maxKb: customMaxKb, dpi: customDpi, label: "Custom", hint: "Custom dimensions", cmW: customCmW, cmH: customCmH };
    }
    const v: GovVariant = variant;
    if (v.cmW === 0 || v.cmH === 0) {
      return { pxW: 0, pxH: 0, maxKb: v.maxKb, dpi: v.dpi, label: v.label, hint: v.hint, cmW: 0, cmH: 0 };
    }
    const { w, h } = pxFromCm(v.cmW, v.cmH, v.dpi);
    return { pxW: w, pxH: h, maxKb: v.maxKb, dpi: v.dpi, label: v.label, hint: v.hint, cmW: v.cmW, cmH: v.cmH };
  }, [isCustom, variant, preset.supportsDocument, file, customCmW, customCmH, customDpi, customMaxKb]);

  /* ── Upload ─ */
  const loadFile = useCallback(
    async (f: File) => {
      setError("");
      setResult(null);
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      setPdfDoc(null);
      setImageNatural(null);

      const isPdfFile = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (isPdfFile) {
        if (!preset.supportsDocument) {
          toast.error("This tool accepts images only. PDF is not supported for this preset.");
          return;
        }
        try {
          const parsed = await parsePdf(f);
          setFile(f);
          setPdfDoc(parsed);
          toast.success(`PDF loaded · ${parsed.pageCount} pages · ${formatBytes(parsed.size)}`);
        } catch (e) {
          if (e instanceof PdfEncryptedError) {
            setPendingUnlock({ file: f, password: "" });
            toast.info("Password required");
            return;
          }
          const msg = e instanceof Error ? e.message : "Failed to read PDF";
          setError(msg);
          toast.error(msg);
        }
        return;
      }

      if (preset.pdfOnly) {
        toast.error("This tool accepts PDF only. Please upload a PDF file.");
        return;
      }

      if (!isSupportedInput(f)) {
        toast.error(`Unsupported: ${f.name}`);
        return;
      }
      const url = URL.createObjectURL(f);
      setFile(f);
      setImageUrl(url);
      const img = new Image();
      img.onload = () => {
        setImageNatural({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => {
        setError("Could not decode this image in your browser");
        toast.error("Could not decode this image");
      };
      img.src = url;
      toast.success(`Image loaded · ${formatBytes(f.size)}`);
    },
    [imageUrl, preset.supportsDocument],
  );

  const unlockPending = async () => {
    if (!pendingUnlock?.password.trim()) {
      toast.error("Enter password");
      return;
    }
    const { file: f, password } = pendingUnlock;
    setPendingUnlock(null);
    try {
      const parsed = await parsePdf(f, password);
      setFile(f);
      setPdfDoc(parsed);
      toast.success(`PDF unlocked · ${parsed.pageCount} pages`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to unlock PDF";
      toast.error(msg);
    }
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

  const clearAll = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    if (result?.url) URL.revokeObjectURL(result.url);
    setFile(null);
    setImageUrl(null);
    setImageNatural(null);
    setPdfDoc(null);
    setResult(null);
    setError("");
    setStep(1);
  };

  const handleResult = useCallback((r: PanResult | null) => {
    setResult((prev) => {
      if (prev?.url && prev.url !== r?.url) URL.revokeObjectURL(prev.url);
      return r;
    });
  }, []);

  const activeFormat: OutputFormat = isCustom ? customFormat : "image/jpeg";

  const next = () => {
    if (step === 1 && !file) {
      toast.error("Upload a file to continue");
      return;
    }
    if (step === 2 && (!target || (!isPdf && !imageUrl))) {
      toast.error("Pick a variant to continue");
      return;
    }
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  };
  const prev = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Lock className="h-3.5 w-3.5" /> 100% private · in-browser
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
            {preset.variants.length} presets
          </span>
          <button
            type="button"
            onClick={() => favorites.toggle(slug)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
              favorites.isFavorite(slug)
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-card hover:bg-card-hover",
            )}
            aria-pressed={favorites.isFavorite(slug)}
          >
            {favorites.isFavorite(slug) ? "Favorited" : "Add favorite"}
          </button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(
          [
            [1, "Upload"],
            [2, "Requirement"],
            [3, "Editor"],
          ] as const
        ).map(([n, label]) => (
          <div key={n} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                step === n
                  ? "bg-primary text-white"
                  : step > n
                    ? "bg-emerald-500 text-white"
                    : "border border-border bg-card text-muted",
              )}
            >
              {step > n ? <Check className="h-4 w-4" /> : n}
            </div>
            <span
              className={cn(
                "text-sm font-medium",
                step === n ? "text-foreground" : step > n ? "text-emerald-500" : "text-muted",
              )}
            >
              {label}
            </span>
            {n < 3 && <div className={cn("mx-1 h-px flex-1", step > n ? "bg-emerald-500/40" : "bg-border")} />}
          </div>
        ))}
      </div>

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all sm:p-14",
              dragging ? "scale-[1.01] border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
            )}
          >
            <UploadCloud className="mb-3 h-12 w-12 text-primary" />
            <p className="font-display text-xl font-semibold">
              Drop your {preset.pdfOnly ? "PDF" : preset.supportsDocument ? "photo, signature, or PDF" : "photo"} here!
            </p>
            <p className="mt-2 max-w-lg text-sm text-muted">
              {preset.pdfOnly ? "PDF only · maximum file size 10 MB · 100% in-browser, nothing uploaded." : "JPG · PNG · WebP" + (preset.supportsDocument ? " · PDF" : "") + " — maximum file size 10 MB · 100% in-browser, nothing uploaded."}
            </p>
            <Button variant="gradient" type="button" className="mt-5" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              <UploadCloud className="h-4 w-4" /> Select File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={preset.pdfOnly ? ".pdf,application/pdf" : preset.supportsDocument ? "image/*,.pdf,application/pdf" : "image/*"}
              className="hidden"
              onChange={onInputChange}
            />
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
              <div className="flex items-center gap-3 min-w-0">
                {isPdf ? <FileText className="h-5 w-5 text-primary" /> : <ImageIcon className="h-5 w-5 text-primary" />}
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-xs text-muted">
                    {formatBytes(file.size)}
                    {imageNatural && ` · ${imageNatural.w}×${imageNatural.h}`}
                    {pdfDoc && ` · ${pdfDoc.pageCount} pages`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); clearAll(); }}
                className="text-muted hover:text-error"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Requirement */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium">
              Preset
              {preset.supportsDocument && !preset.pdfOnly && (
                <span className="ml-2 text-xs font-normal text-muted">
                  · {isPdf ? "PDF document presets" : "photo / signature presets"}
                </span>
              )}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleVariants.length === 0 && (
                <p className="col-span-full rounded-lg border border-border bg-card p-4 text-sm text-muted">
                  No presets match this file type. {isPdf ? "Upload an image" : "Upload a PDF"} to see the other presets, or use Custom below.
                </p>
              )}
              {visibleVariants.map(({ v, i }) => {
                const isActive = !isCustom && variantIdx === i;
                const px = v.cmW > 0 ? pxFromCm(v.cmW, v.cmH, v.dpi) : null;
                return (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => { setVariantIdx(i); setIsCustom(false); }}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
                      isActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                    )}
                  >
                    <p className="font-medium">{v.label}</p>
                    <p className="text-xs text-muted">
                      {v.cmW > 0 ? `${v.cmW} × ${v.cmH} cm` : "PDF document"} · ≤ {v.maxKb >= 1024 ? `${(v.maxKb / 1024).toFixed(0)} MB` : `${v.maxKb} KB`}
                      {px && ` · ${px.w}×${px.h}px`}
                    </p>
                    <p className="text-[11px] text-muted/80">{v.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {preset.supportsCustom && (
            <div>
              <button
                type="button"
                onClick={() => setIsCustom((c) => !c)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl border p-4 text-left transition-colors",
                  isCustom ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                )}
              >
                <Settings2 className="h-4 w-4 text-primary" />
                <span className="font-medium">Custom dimensions</span>
                <span className="ml-auto text-xs text-muted">{isCustom ? "Selected" : "Tap to set manually"}</span>
              </button>

              {isCustom && (
                <div className="mt-3 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {!(preset.supportsDocument && isPdf) && (
                    <>
                      <Field label="Width (cm)">
                        <input
                          type="number"
                          step={0.1}
                          min={0.1}
                          value={customCmW}
                          onChange={(e) => setCustomCmW(Math.max(0.1, Number(e.target.value)))}
                          className={inputClass()}
                        />
                      </Field>
                      <Field label="Height (cm)">
                        <input
                          type="number"
                          step={0.1}
                          min={0.1}
                          value={customCmH}
                          onChange={(e) => setCustomCmH(Math.max(0.1, Number(e.target.value)))}
                          className={inputClass()}
                        />
                      </Field>
                      <Field label={`DPI: ${customDpi}`}>
                        <input
                          type="range"
                          min={72}
                          max={300}
                          step={1}
                          value={customDpi}
                          onChange={(e) => setCustomDpi(Number(e.target.value))}
                          className="w-full accent-[var(--primary)]"
                        />
                      </Field>
                      <Field label="Output format">
                        <select
                          value={customFormat}
                          onChange={(e) => setCustomFormat(e.target.value as OutputFormat)}
                          className={inputClass()}
                        >
                          <option value="image/jpeg">JPG</option>
                          <option value="image/png">PNG</option>
                          <option value="image/webp">WebP</option>
                        </select>
                      </Field>
                    </>
                  )}
                  <Field label="Max file size (KB)">
                    <input
                      type="number"
                      min={1}
                      value={customMaxKb}
                      onChange={(e) => setCustomMaxKb(Math.max(1, Number(e.target.value)))}
                      className={inputClass()}
                    />
                  </Field>
                </div>
              )}
            </div>
          )}

          {/* Resize mode (image only) */}
          {!isPdf && (
            <div>
              <p className="mb-2 text-sm font-medium">Resize</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ["original", "Resize Original", "Use the entire image, no cropping"],
                    ["selected-area", "Resize Selected Area", "Crop to a draggable region first"],
                  ] as const
                ).map(([key, label, desc]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setResizeMode(key)}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                      resizeMode === key ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        resizeMode === key ? "border-primary" : "border-muted",
                      )}
                    >
                      {resizeMode === key && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="mt-0.5 text-xs text-muted">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {target && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-primary">
                <Check className="h-4 w-4" /> {target.label}
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {target.cmW > 0 && (
                  <div>
                    <p className="text-xs text-muted">Dimensions</p>
                    <p className="font-medium">{target.cmW} × {target.cmH} cm</p>
                  </div>
                )}
                {target.pxW > 0 && (
                  <div>
                    <p className="text-xs text-muted">Pixels</p>
                    <p className="font-medium">{target.pxW} × {target.pxH} px</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted">Max file size</p>
                  <p className="font-medium">{target.maxKb} KB</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted">{target.hint}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Editor */}
      {step === 3 && file && target && ((isPdf && pdfDoc) || (imageUrl && imageNatural)) && (
        <GovPhotoEditor
          file={file}
          imageUrl={imageUrl ?? ""}
          imageNatural={imageNatural ?? { w: 0, h: 0 }}
          target={target}
          resizeMode={resizeMode}
          format={activeFormat}
          isPdf={isPdf}
          pdfDoc={pdfDoc}
          onBack={() => setStep(2)}
          onClear={clearAll}
          onResult={handleResult}
          result={result}
        />
      )}

      {step === 3 && error && (
        <p className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>
      )}

      {/* Bottom navigation */}
      {step < 3 && (
        <div className="flex justify-end gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={prev}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
          )}
          <Button variant="gradient" onClick={next}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

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
