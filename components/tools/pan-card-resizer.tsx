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
  PenTool,
  Settings2,
  Shield,
  UploadCloud,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import { isSupportedInput, type OutputFormat } from "./image-compressor-utils";
import { parsePdf, PdfEncryptedError, type PdfDocument } from "./pdf-merge-utils";
import { PanCardEditor, type PanResult } from "./pan-card-editor";

const SETTINGS_KEY = "toolnest-pan-card-resizer-settings";

type Step = 1 | 2 | 3;
type EditorMode = "pan" | "custom";
type Authority = "nsdl" | "uti";
type DocType = "photo" | "signature" | "document";
type ResizeMode = "original" | "selected-area";

interface Preset {
  label: string;
  cmW: number;
  cmH: number;
  pxW: number;
  pxH: number;
  maxKb: number;
  dpi: number;
  hint: string;
}

const PRESETS: Record<EditorMode, Record<Authority, Partial<Record<DocType, Preset>>>> = {
  pan: {
    nsdl: {
      photo: {
        label: "Photo",
        cmW: 3.5,
        cmH: 4.5,
        pxW: 213,
        pxH: 274,
        maxKb: 50,
        dpi: 150,
        hint: "NSDL photo — recent color, plain background",
      },
      signature: {
        label: "Signature",
        cmW: 3.5,
        cmH: 1.5,
        pxW: 213,
        pxH: 97,
        maxKb: 20,
        dpi: 150,
        hint: "NSDL signature — black ink on white paper",
      },
      document: {
        label: "Document (PDF)",
        cmW: 0,
        cmH: 0,
        pxW: 0,
        pxH: 0,
        maxKb: 300,
        dpi: 150,
        hint: "NSDL scanned document — Aadhaar / proof of identity",
      },
    },
    uti: {
      photo: {
        label: "Photo",
        cmW: 4.5,
        cmH: 3.5,
        pxW: 274,
        pxH: 213,
        maxKb: 50,
        dpi: 150,
        hint: "UTIITSL photo — recent color",
      },
      signature: {
        label: "Signature",
        cmW: 5.0,
        cmH: 2.0,
        pxW: 305,
        pxH: 122,
        maxKb: 20,
        dpi: 150,
        hint: "UTIITSL signature — black ink on white paper",
      },
      document: {
        label: "Document (PDF)",
        cmW: 0,
        cmH: 0,
        pxW: 0,
        pxH: 0,
        maxKb: 300,
        dpi: 150,
        hint: "UTIITSL scanned document",
      },
    },
  },
  custom: {
    nsdl: {},
    uti: {},
  },
};

const TYPE_ICONS: Record<DocType, typeof User> = {
  photo: User,
  signature: PenTool,
  document: FileText,
};

function pxFromCm(cmW: number, cmH: number, dpi: number): { w: number; h: number } {
  // 1 inch = 2.54 cm; pixels = cm / 2.54 * dpi
  return {
    w: Math.round((cmW / 2.54) * dpi),
    h: Math.round((cmH / 2.54) * dpi),
  };
}

export function PanCardResizer() {
  const favorites = useFavorites();
  const slug = "pan-card-resizer";

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<EditorMode>("pan");
  const [step, setStep] = useState<Step>(1);

  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageNatural, setImageNatural] = useState<{ w: number; h: number } | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PdfDocument | null>(null);

  // Step 2 — Requirement
  const [authority, setAuthority] = useState<Authority>("nsdl");
  const [docType, setDocType] = useState<DocType>("photo");
  const [resizeMode, setResizeMode] = useState<ResizeMode>("selected-area");

  // Custom editor dimensions
  const [customCmW, setCustomCmW] = useState(3.5);
  const [customCmH, setCustomCmH] = useState(4.5);
  const [customDpi, setCustomDpi] = useState(150);
  const [customMaxKb, setCustomMaxKb] = useState(50);
  const [customFormat, setCustomFormat] = useState<OutputFormat>("image/jpeg");

  // Step 3 — Editor (result is lifted from the editor for unmount cleanup)
  const [result, setResult] = useState<PanResult | null>(null);
  const [error, setError] = useState("");
  const [pendingUnlock, setPendingUnlock] = useState<{ file: File; password: string } | null>(null);

  // Persist settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Record<string, unknown>;
      if (s.mode === "pan" || s.mode === "custom") setMode(s.mode);
      if (s.authority === "nsdl" || s.authority === "uti") setAuthority(s.authority);
      if (s.docType === "photo" || s.docType === "signature" || s.docType === "document") setDocType(s.docType);
      if (s.resizeMode === "original" || s.resizeMode === "selected-area") setResizeMode(s.resizeMode);
      if (typeof s.customCmW === "number") setCustomCmW(s.customCmW);
      if (typeof s.customCmH === "number") setCustomCmH(s.customCmH);
      if (typeof s.customDpi === "number") setCustomDpi(s.customDpi);
      if (typeof s.customMaxKb === "number") setCustomMaxKb(s.customMaxKb);
      if (typeof s.customFormat === "string") setCustomFormat(s.customFormat as OutputFormat);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ mode, authority, docType, resizeMode, customCmW, customCmH, customDpi, customMaxKb, customFormat }),
      );
    } catch { /* ignore */ }
  }, [mode, authority, docType, resizeMode, customCmW, customCmH, customDpi, customMaxKb, customFormat]);

  // Revoke object URLs on unmount / file change
  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (result?.url) URL.revokeObjectURL(result.url);
  }, [result]);

  // The active preset (pan mode) or computed custom dimensions
  const target = useMemo(() => {
    if (mode === "pan") {
      const p = PRESETS.pan[authority][docType];
      if (!p) return null;
      return { pxW: p.pxW, pxH: p.pxH, maxKb: p.maxKb, dpi: p.dpi, label: p.label, hint: p.hint, cmW: p.cmW, cmH: p.cmH };
    }
    // Custom mode
    const isDoc = docType === "document";
    if (isDoc) {
      return { pxW: 0, pxH: 0, maxKb: customMaxKb, dpi: customDpi, label: "Document (PDF)", hint: "Custom PDF target size", cmW: 0, cmH: 0 };
    }
    const { w, h } = pxFromCm(customCmW, customCmH, customDpi);
    return { pxW: w, pxH: h, maxKb: customMaxKb, dpi: customDpi, label: "Custom", hint: "Custom dimensions", cmW: customCmW, cmH: customCmH };
  }, [mode, authority, docType, customCmW, customCmH, customDpi, customMaxKb]);

  const targetBytes = useMemo(() => (target ? target.maxKb * 1024 : 0), [target]);

  const isPdf = docType === "document" || (file && file.type === "application/pdf") || (file && file.name.toLowerCase().endsWith(".pdf")) ? true : false;

  /* ── Step 1 — Upload ─ */
  const loadFile = useCallback(async (f: File) => {
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
      try {
        const parsed = await parsePdf(f);
        setFile(f);
        setPdfDoc(parsed);
        setDocType("document");
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

    if (!isSupportedInput(f)) {
      toast.error(`Unsupported: ${f.name}`);
      return;
    }
    const url = URL.createObjectURL(f);
    setFile(f);
    setImageUrl(url);
    // Read natural dimensions
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
  }, [imageUrl]);

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
      setDocType("document");
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

  const [dragging, setDragging] = useState(false);

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

  const canProceedFromStep1 = !!file;
  const canProceedFromStep2 = !!target;

  const next = () => {
    if (step === 1 && !canProceedFromStep1) {
      toast.error("Upload a file to continue");
      return;
    }
    if (step === 2 && !canProceedFromStep2) {
      toast.error("Pick a preset to continue");
      return;
    }
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  };
  const prev = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const handleResult = useCallback((r: PanResult | null) => {
    setResult((prevResult) => {
      if (prevResult?.url && prevResult.url !== r?.url) URL.revokeObjectURL(prevResult.url);
      return r;
    });
  }, []);

  const activeFormat: OutputFormat = mode === "custom" ? customFormat : "image/jpeg";

  /* ──────────────────────────────────────────────────────────────────────────
   * Render
   * ────────────────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Lock className="h-3.5 w-3.5" /> 100% private · in-browser
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
            <Shield className="h-3.5 w-3.5 text-primary" /> NSDL · UTIITSL presets
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

      {/* Mode tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {(
          [
            ["pan", "PAN Card Editor", Shield],
            ["custom", "Custom Editor", Settings2],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setMode(key); if (key === "custom") setDocType("photo"); }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
              mode === key ? "bg-primary text-white" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
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
              Drop your {mode === "pan" ? "photo, signature, or document" : "file"} here!
            </p>
            <p className="mt-2 max-w-lg text-sm text-muted">
              JPG · PNG · WebP · PDF — maximum file size 10 MB · 100% in-browser, nothing uploaded.
            </p>
            <Button variant="gradient" type="button" className="mt-5" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              <UploadCloud className="h-4 w-4" /> Select File
            </Button>
            <input ref={fileInputRef} type="file" accept="image/*,.pdf,application/pdf" className="hidden" onChange={onInputChange} />
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
          {mode === "pan" && (
            <>
              <div>
                <p className="mb-2 text-sm font-medium">Application website</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["nsdl", "NSDL", "Protean (formerly NSDL) e-Gov"],
                      ["uti", "UTIITSL", "UTI Infrastructure Technology and Services Limited"],
                    ] as const
                  ).map(([key, label, desc]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAuthority(key)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                        authority === key ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold",
                          authority === key ? "bg-primary text-white" : "bg-card text-foreground",
                        )}
                      >
                        {label.slice(0, 3)}
                      </div>
                      <div>
                        <p className="font-medium">{label}</p>
                        <p className="mt-0.5 text-xs text-muted">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Type</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["photo", "Photograph", "Recent color photo"],
                      ["signature", "Signature", "Black ink on white paper"],
                      ["document", "Document", "Scanned PDF document"],
                    ] as const
                  ).map(([key, label, desc]) => {
                    const Icon = TYPE_ICONS[key];
                    const isPdfInput = !!(isPdf && pdfDoc);
                    const disabled = isPdfInput && key !== "document";
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={disabled}
                        onClick={() => setDocType(key)}
                        className={cn(
                          "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                          docType === key ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                          disabled && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <Icon className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="mt-0.5 text-xs text-muted">{desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {isPdf && pdfDoc && (
                  <p className="mt-2 text-xs text-amber-500">
                    A PDF was uploaded — only the Document type applies.
                  </p>
                )}
              </div>

              {docType !== "document" && (
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
                    <Check className="h-4 w-4" /> {authority.toUpperCase()} · {target.label}
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
            </>
          )}

          {mode === "custom" && (
            <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-sm font-medium">Type</p>
                <div className="flex gap-2">
                  {(
                    [
                      ["photo", "Photo", User],
                      ["signature", "Signature", PenTool],
                      ["document", "Document", FileText],
                    ] as const
                  ).map(([key, label, Icon]) => {
                    const isPdfInput = !!(isPdf && pdfDoc);
                    const disabled = isPdfInput && key !== "document";
                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={disabled}
                        onClick={() => setDocType(key)}
                        className={cn(
                          "flex flex-1 flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors",
                          docType === key ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50",
                          disabled && "cursor-not-allowed opacity-40",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {docType !== "document" && (
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

              {target && (
                <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                  <p className="font-medium text-primary">
                    Target: {docType === "document"
                      ? `${target.maxKb} KB max (PDF)`
                      : `${target.cmW} × ${target.cmH} cm · ${target.pxW} × ${target.pxH} px · ${target.maxKb} KB max`}
                  </p>
                </div>
              )}

              {docType !== "document" && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="mb-2 text-sm font-medium">Resize</p>
                  <div className="flex gap-2">
                    {(
                      [
                        ["original", "Resize Original"],
                        ["selected-area", "Resize Selected Area"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setResizeMode(key)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm transition-colors",
                          resizeMode === key ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Editor */}
      {step === 3 && file && target && imageUrl && imageNatural && (
        <PanCardEditor
          file={file}
          imageUrl={imageUrl}
          imageNatural={imageNatural}
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
