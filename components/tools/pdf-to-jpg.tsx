"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileArchive,
  FolderUp,
  History,
  Image,
  Loader2,
  Shield,
  Star,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import { PdfEncryptedError, type PdfDocument } from "./pdf-merge-utils";
import {
  DEFAULT_PDF_TO_IMAGE_SETTINGS,
  IMAGE_FORMAT_OPTIONS,
  executeBatchPdfToImages,
  exportPdfToImages,
  parsePdf,
  renderThumb,
  smartPdfToImageTips,
  zipBatchPdfImages,
  zipExportedImages,
  type ExportPackMode,
  type ImageExportFormat,
  type PdfToImageSettings,
} from "./pdf-to-jpg-utils";

type Lang = "en" | "es";
type Tab = "studio" | "preview" | "batch" | "history" | "api";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", preview: "Preview", batch: "Batch", history: "History", api: "API",
    drop: "Drop PDFs to export as images", private: "100% private · in-browser", export: "Export Images",
    favorite: "Favorite", favorited: "Favorited", batchZip: "Batch ZIP", emptyHistory: "No exports yet.",
    format: "Format", dpi: "DPI", quality: "Quality", pack: "Output", range: "Page range",
  },
  es: {
    studio: "Estudio", preview: "Vista previa", batch: "Lote", history: "Historial", api: "API",
    drop: "Suelta PDFs para exportar", private: "100% privado", export: "Exportar",
    favorite: "Favorito", favorited: "Favorito", batchZip: "ZIP", emptyHistory: "Sin historial.",
    format: "Formato", dpi: "DPI", quality: "Calidad", pack: "Salida", range: "Rango",
  },
};

const SETTINGS_KEY = "toolnest-pdf-to-jpg-settings";
const HISTORY_KEY = "toolnest-pdf-to-jpg-history";
const LANG_KEY = "toolnest-pdf-to-jpg-lang";

interface HistoryEntry { id: string; name: string; pages: number; bytes: number; ts: number; }

export function PdfToJpg() {
  const favorites = useFavorites();
  const slug = "pdf-to-jpg";

  const inputRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<PdfDocument | null>(null);
  const [batchSources, setBatchSources] = useState<PdfDocument[]>([]);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("studio");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingUnlock, setPendingUnlock] = useState<{ file: File; password: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lang, setLang] = useState<Lang>("en");

  const [settings, setSettings] = useState<PdfToImageSettings>({ ...DEFAULT_PDF_TO_IMAGE_SETTINGS });

  const t = (k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k;

  const tips = useMemo(
    () => (source ? smartPdfToImageTips(source.pageCount, settings) : []),
    [source, settings],
  );

  const patchSettings = (patch: Partial<PdfToImageSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const loadPdf = async (file: File, password?: string) => {
    setLoading(true);
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    setPreviewUrls([]);
    try {
      const doc = await parsePdf(file, password);
      setSource(doc);
      setThumbUrl(await renderThumb(doc.bytes, 0));
      toast.success(`${doc.pageCount} pages loaded`);
    } catch (e) {
      if (e instanceof PdfEncryptedError) {
        setPendingUnlock({ file, password: "" });
        return;
      }
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const addBatch = async (files: FileList | File[]) => {
    const pdfs = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    setLoading(true);
    try {
      const loaded: PdfDocument[] = [];
      for (const f of pdfs) {
        try { loaded.push(await parsePdf(f)); } catch { /* skip */ }
      }
      if (loaded.length) {
        setBatchSources((p) => [...p, ...loaded]);
        if (!source && loaded[0]) await loadPdf(loaded[0].file);
        toast.success(`${loaded.length} PDF(s) queued`);
      }
    } finally {
      setLoading(false);
    }
  };

  const runExport = async (previewOnly = false) => {
    if (!source) return;
    setBusy(true);
    setProgress(0);
    try {
      const stem = source.name.replace(/\.pdf$/i, "") || "pdf";
      const images = await exportPdfToImages(source.bytes, stem, settings, undefined, setProgress);
      const totalBytes = images.reduce((s, i) => s + i.blob.size, 0);

      if (previewOnly) {
        const urls = images.slice(0, 6).map((img) => URL.createObjectURL(img.blob));
        previewUrls.forEach((u) => URL.revokeObjectURL(u));
        setPreviewUrls(urls);
        setTab("preview");
        toast.success(`${images.length} page(s) rendered`);
        return;
      }

      if (settings.packMode === "individual" && images.length === 1) {
        downloadBlob(images[0]!.blob, images[0]!.name);
      } else if (settings.packMode === "individual") {
        for (const img of images) downloadBlob(img.blob, img.name);
      } else {
        downloadBlob(await zipExportedImages(images, `${stem}-images.zip`), `${stem}-images.zip`);
      }

      setHistory((h) => [{ id: crypto.randomUUID(), name: source.name, pages: images.length, bytes: totalBytes, ts: Date.now() }, ...h].slice(0, 20));
      toast.success(`Exported ${images.length} image(s) · ${formatBytes(totalBytes)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const runBatch = async () => {
    const list = batchSources.length ? batchSources : source ? [source] : [];
    if (!list.length) { toast.error("Add PDFs"); return; }
    setBusy(true);
    try {
      const results = await executeBatchPdfToImages(
        list.map((d) => ({ name: d.name, bytes: d.bytes })),
        settings,
        setProgress,
      );
      downloadBlob(await zipBatchPdfImages(results), "batch-pdf-to-images.zip");
      toast.success(`Batch complete · ${results.length} PDF(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<PdfToImageSettings>;
        setSettings((x) => ({ ...x, ...s }));
      }
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h) as HistoryEntry[]);
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => () => { previewUrls.forEach((u) => URL.revokeObjectURL(u)); }, [previewUrls]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t("private")}</p>
        <div className="flex items-center gap-2">
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={cn(inputClass(), "w-auto py-1.5 text-xs")}>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
          <button type="button" onClick={() => favorites.toggle(slug)} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs", favorites.isFavorite(slug) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted")}>
            <Star className={cn("h-3.5 w-3.5", favorites.isFavorite(slug) && "fill-current")} />
            {favorites.isFavorite(slug) ? t("favorited") : t("favorite")}
          </button>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void loadPdf(f); }}
        className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center", dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50")}
      >
        {loading ? <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" /> : <UploadCloud className="mb-3 h-10 w-10 text-primary" />}
        <p className="font-display text-lg font-semibold">Ultra PDF to JPG Studio</p>
        <p className="mt-1 text-sm text-muted">{source ? `${source.name} · ${source.pageCount} pages` : t("drop")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}><UploadCloud className="h-4 w-4" /> Add PDF</Button>
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); batchRef.current?.click(); }}><FolderUp className="h-4 w-4" /> Batch</Button>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadPdf(f); e.target.value = ""; }} />
        <input ref={batchRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) void addBatch(e.target.files); e.target.value = ""; }} />
      </div>

      {pendingUnlock && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <input type="password" value={pendingUnlock.password} onChange={(e) => setPendingUnlock({ ...pendingUnlock, password: e.target.value })} className={cn(inputClass(), "max-w-xs")} placeholder="PDF password" />
          <Button size="sm" onClick={() => { void loadPdf(pendingUnlock.file, pendingUnlock.password); setPendingUnlock(null); }}>Unlock</Button>
        </div>
      )}

      {source && (
        <>
          {tips.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <ul className="list-inside list-disc text-muted">{tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
            </div>
          )}

          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(["studio", "preview", "batch", "history", "api"] as Tab[]).map((key) => (
              <button key={key} type="button" onClick={() => setTab(key)} className={cn("flex flex-1 items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium capitalize", tab === key ? "bg-primary text-white" : "text-muted")}>{t(key)}</button>
            ))}
          </div>

          {tab === "studio" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="rounded-xl border border-border bg-card p-4">
                {thumbUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={thumbUrl} alt="Page 1" className="mx-auto max-w-md rounded-lg border border-border" />
                )}
              </div>
              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <Field label={t("format")}>
                  <select value={settings.format} onChange={(e) => patchSettings({ format: e.target.value as ImageExportFormat })} className={inputClass()}>
                    {IMAGE_FORMAT_OPTIONS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </Field>
                <Field label={`${t("dpi")}: ${settings.dpi}`}><input type="range" min={72} max={300} step={1} value={settings.dpi} onChange={(e) => patchSettings({ dpi: Number(e.target.value) })} className="w-full accent-[var(--primary)]" /></Field>
                <Field label={`${t("quality")}: ${Math.round(settings.quality * 100)}%`}><input type="range" min={50} max={100} value={Math.round(settings.quality * 100)} onChange={(e) => patchSettings({ quality: Number(e.target.value) / 100 })} className="w-full accent-[var(--primary)]" disabled={settings.format === "png"} /></Field>
                <Field label={t("range")} hint="e.g. 1-3, 5"><input value={settings.pageRange} onChange={(e) => patchSettings({ pageRange: e.target.value })} className={inputClass()} placeholder="All pages" /></Field>
                <Field label={t("pack")}>
                  <select value={settings.packMode} onChange={(e) => patchSettings({ packMode: e.target.value as ExportPackMode })} className={inputClass()}>
                    <option value="zip">Single ZIP</option>
                    <option value="individual">Individual files</option>
                  </select>
                </Field>
                <div className="flex flex-col gap-2">
                  <Button variant="gradient" disabled={busy} onClick={() => void runExport(false)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("export")}</Button>
                  <Button variant="outline" disabled={busy} onClick={() => void runExport(true)}><Image className="h-4 w-4" /> Preview pages</Button>
                  {busy && progress > 0 && <div className="h-2 overflow-hidden rounded-full bg-muted/30"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>}
                </div>
              </div>
            </div>
          )}

          {tab === "preview" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-xl border border-border bg-card p-4">
              {previewUrls.length ? previewUrls.map((url, i) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={url} src={url} alt={`Page ${i + 1}`} className="rounded-lg border border-border" />
              )) : <p className="col-span-full py-16 text-center text-muted">Run Preview pages first.</p>}
            </div>
          )}

          {tab === "batch" && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted">{batchSources.length || 1} PDF(s)</p>
              <Button variant="gradient" disabled={busy} onClick={() => void runBatch()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} {t("batchZip")}</Button>
            </div>
          )}

          {tab === "history" && (
            <div className="rounded-xl border border-border bg-card p-4">
              {history.length === 0 ? <p className="py-8 text-center text-muted">{t("emptyHistory")}</p> : (
                <ul className="divide-y divide-border text-sm">{history.map((h) => <li key={h.id} className="flex justify-between py-2"><span>{h.name} · {h.pages} img</span><span className="text-muted">{formatBytes(h.bytes)}</span></li>)}</ul>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 font-medium"><Shield className="h-4 w-4 text-primary" /> POST /api/v1/pdf/to-jpg</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`POST /api/v1/pdf/to-jpg
{
  "pdf": "JVBERi0x...",
  "filename": "document.pdf",
  "settings": {
    "format": "jpeg",
    "dpi": 150,
    "quality": 0.92,
    "pageRange": "1-5"
  }
}`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
