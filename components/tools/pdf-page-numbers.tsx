"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  FileArchive,
  FolderUp,
  Hash,
  History,
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
import type { PageScope } from "./pdf-watermark-utils";
import {
  DEFAULT_PAGE_NUMBER_OUTPUT,
  DEFAULT_PAGE_NUMBER_SETTINGS,
  PAGE_NUMBER_FORMATS,
  PAGE_NUMBER_POSITIONS,
  PDF_FONT_OPTIONS,
  buildNumberedPdf,
  executeBatchPageNumbers,
  parsePdf,
  renderThumb,
  smartPageNumberTips,
  zipNumberedFiles,
  type PageNumberFormat,
  type PageNumberPosition,
  type PageNumberSettings,
  type PdfFontId,
} from "./pdf-page-numbers-utils";

type Lang = "en" | "es";
type Tab = "studio" | "preview" | "batch" | "history" | "api";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", preview: "Preview", batch: "Batch", history: "History", api: "API",
    drop: "Drop PDFs or browse", private: "100% private · in-browser", apply: "Apply & Download",
    previewBtn: "Preview", favorite: "Favorite", favorited: "Favorited", batchZip: "Batch ZIP",
    emptyHistory: "No exports yet.", format: "Format", position: "Position", font: "Font",
    scope: "Pages", margin: "Margin", startNum: "Start number", skipFirst: "Skip first page",
  },
  es: {
    studio: "Estudio", preview: "Vista previa", batch: "Lote", history: "Historial", api: "API",
    drop: "Suelta PDFs", private: "100% privado", apply: "Aplicar", previewBtn: "Vista previa",
    favorite: "Favorito", favorited: "Favorito", batchZip: "ZIP", emptyHistory: "Sin historial.",
    format: "Formato", position: "Posición", font: "Fuente", scope: "Páginas", margin: "Margen",
    startNum: "Número inicial", skipFirst: "Omitir primera página",
  },
};

const SCOPES: { id: PageScope; label: string }[] = [
  { id: "all", label: "All pages" },
  { id: "odd", label: "Odd pages" },
  { id: "even", label: "Even pages" },
  { id: "range", label: "Custom range" },
];

const SETTINGS_KEY = "toolnest-pdf-page-numbers-settings";
const HISTORY_KEY = "toolnest-pdf-page-numbers-history";
const LANG_KEY = "toolnest-pdf-page-numbers-lang";

interface HistoryEntry { id: string; name: string; pages: number; bytes: number; ts: number; }

export function PdfPageNumbers() {
  const favorites = useFavorites();
  const slug = "pdf-page-numbers";

  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<PdfDocument | null>(null);
  const [batchSources, setBatchSources] = useState<PdfDocument[]>([]);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("studio");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingUnlock, setPendingUnlock] = useState<{ file: File; password: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lang, setLang] = useState<Lang>("en");

  const [settings, setSettings] = useState<PageNumberSettings>({ ...DEFAULT_PAGE_NUMBER_SETTINGS });
  const [outputName, setOutputName] = useState("numbered");
  const [compress, setCompress] = useState(true);
  const [preserveMetadata, setPreserveMetadata] = useState(true);

  const t = (k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k;

  const tips = useMemo(
    () => (source ? smartPageNumberTips(source.pageCount, settings) : []),
    [source, settings],
  );

  const patchSettings = (patch: Partial<PageNumberSettings>) => setSettings((s) => ({ ...s, ...patch }));

  const loadPdf = async (file: File, password?: string) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("Please select a PDF");
      return;
    }
    setLoading(true);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    try {
      const doc = await parsePdf(file, password);
      setSource(doc);
      setOutputName(doc.name.replace(/\.pdf$/i, "") || "numbered");
      setThumbUrl(await renderThumb(doc.bytes, 0));
      toast.success(`${doc.pageCount} pages loaded`);
    } catch (e) {
      if (e instanceof PdfEncryptedError) {
        setPendingUnlock({ file, password: "" });
        toast.info(`"${file.name}" requires a password`);
        return;
      }
      toast.error(e instanceof Error ? e.message : "Failed to read PDF");
    } finally {
      setLoading(false);
    }
  };

  const addBatch = async (files: FileList | File[]) => {
    const pdfs = Array.from(files).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) { toast.error("No PDF files"); return; }
    setLoading(true);
    try {
      const loaded: PdfDocument[] = [];
      for (const f of pdfs) {
        try { loaded.push(await parsePdf(f)); } catch { /* skip encrypted */ }
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

  const runApply = async (download: boolean) => {
    if (!source) return;
    setBusy(true);
    setProgress(0);
    try {
      const data = await buildNumberedPdf(
        source.bytes,
        settings,
        { fileName: outputName, compress, preserveMetadata },
        setProgress,
      );
      const blob = new Blob([data as BlobPart], { type: "application/pdf" });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      if (download) {
        downloadBlob(blob, `${outputName.replace(/[^a-z0-9._-]+/gi, "-") || "numbered"}.pdf`);
        setHistory((h) => [{ id: crypto.randomUUID(), name: source.name, pages: source.pageCount, bytes: data.byteLength, ts: Date.now() }, ...h].slice(0, 20));
        toast.success(`Done · ${formatBytes(data.byteLength)}`);
      } else {
        setTab("preview");
        toast.success("Preview ready");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
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
      const files = await executeBatchPageNumbers(
        list.map((d) => ({ name: d.name, bytes: d.bytes })),
        settings,
        { fileName: outputName, compress, preserveMetadata },
        setProgress,
      );
      if (files.length === 1) {
        downloadBlob(new Blob([files[0]!.data as BlobPart], { type: "application/pdf" }), `${files[0]!.name}.pdf`);
      } else {
        downloadBlob(await zipNumberedFiles(files), "batch-page-numbers.zip");
      }
      toast.success(`Batch complete · ${files.length} file(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { settings?: Partial<PageNumberSettings> };
        if (s.settings) setSettings((x) => ({ ...x, ...s.settings }));
      }
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h) as HistoryEntry[]);
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ settings }));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

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
        <p className="font-display text-lg font-semibold">Ultra PDF Page Numbers Studio</p>
        <p className="mt-1 text-sm text-muted">{source ? `${source.name} · ${source.pageCount} pages` : t("drop")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}><UploadCloud className="h-4 w-4" /> Add PDF</Button>
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); folderRef.current?.click(); }}><FolderUp className="h-4 w-4" /> Folder</Button>
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); batchRef.current?.click(); }}><FileArchive className="h-4 w-4" /> Batch</Button>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadPdf(f); e.target.value = ""; }} />
        <input ref={folderRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} onChange={(e) => { if (e.target.files) void addBatch(e.target.files); e.target.value = ""; }} />
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
                  <div className="relative mx-auto max-w-md overflow-hidden rounded-lg border border-border bg-muted/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbUrl} alt="Page 1" className="w-full object-contain opacity-90" />
                    <div className="absolute inset-x-0 bottom-2 text-center text-xs font-medium" style={{ color: settings.color, opacity: settings.opacity }}>
                      {settings.format === "1" ? "1" : settings.format === "Page 1" ? "Page 1" : "1/10"}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <Field label={t("format")}>
                  <select value={settings.format} onChange={(e) => patchSettings({ format: e.target.value as PageNumberFormat })} className={inputClass()}>
                    {PAGE_NUMBER_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label} — {f.example}</option>)}
                  </select>
                </Field>
                <Field label={t("position")}>
                  <select value={settings.position} onChange={(e) => patchSettings({ position: e.target.value as PageNumberPosition })} className={inputClass()}>
                    {PAGE_NUMBER_POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </Field>
                <Field label={t("font")}>
                  <select value={settings.fontId} onChange={(e) => patchSettings({ fontId: e.target.value as PdfFontId })} className={inputClass()}>
                    {PDF_FONT_OPTIONS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Size"><input type="number" min={6} max={48} value={settings.fontSize} onChange={(e) => patchSettings({ fontSize: Number(e.target.value) })} className={inputClass()} /></Field>
                  <Field label="Color"><input type="color" value={settings.color} onChange={(e) => patchSettings({ color: e.target.value })} className="h-10 w-full cursor-pointer rounded-lg border border-border" /></Field>
                </div>
                <Field label={`Opacity: ${Math.round(settings.opacity * 100)}%`}><input type="range" min={20} max={100} value={Math.round(settings.opacity * 100)} onChange={(e) => patchSettings({ opacity: Number(e.target.value) / 100 })} className="w-full accent-[var(--primary)]" /></Field>
                <Field label={`${t("margin")} (pt)`}><input type="number" min={12} max={120} value={settings.margin} onChange={(e) => patchSettings({ margin: Number(e.target.value) })} className={inputClass()} /></Field>
                <Field label={t("startNum")}><input type="number" min={0} value={settings.startNumber} onChange={(e) => patchSettings({ startNumber: Number(e.target.value) })} className={inputClass()} /></Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.skipFirstPage} onChange={(e) => patchSettings({ skipFirstPage: e.target.checked })} className="accent-[var(--primary)]" /> {t("skipFirst")}</label>
                <Field label={t("scope")}>
                  <select value={settings.scope} onChange={(e) => patchSettings({ scope: e.target.value as PageScope })} className={inputClass()}>
                    {SCOPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </Field>
                {settings.scope === "range" && (
                  <Field label="Page range" hint="e.g. 1-3, 5"><input value={settings.pageRange} onChange={(e) => patchSettings({ pageRange: e.target.value })} className={inputClass()} /></Field>
                )}
                <Field label="Output filename"><input value={outputName} onChange={(e) => setOutputName(e.target.value)} className={inputClass()} /></Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} className="accent-[var(--primary)]" /> Compress output</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preserveMetadata} onChange={(e) => setPreserveMetadata(e.target.checked)} className="accent-[var(--primary)]" /> Preserve metadata</label>
                <div className="flex flex-col gap-2">
                  <Button variant="gradient" disabled={busy} onClick={() => void runApply(true)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hash className="h-4 w-4" />} {t("apply")}</Button>
                  <Button variant="outline" disabled={busy} onClick={() => void runApply(false)}><Eye className="h-4 w-4" /> {t("previewBtn")}</Button>
                  {busy && progress > 0 && <div className="h-2 overflow-hidden rounded-full bg-muted/30"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>}
                </div>
              </div>
            </div>
          )}

          {tab === "preview" && (
            <div className="rounded-xl border border-border bg-card p-2">
              {previewUrl ? <iframe src={previewUrl} title="Preview" className="h-[70vh] w-full rounded-lg" /> : <p className="py-16 text-center text-muted">Run Preview first.</p>}
            </div>
          )}

          {tab === "batch" && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted">{batchSources.length || 1} PDF(s) — same numbering settings.</p>
              {batchSources.length > 0 && <ul className="divide-y divide-border text-sm">{batchSources.map((d) => <li key={d.id} className="truncate py-2">{d.name}</li>)}</ul>}
              <Button variant="gradient" disabled={busy} onClick={() => void runBatch()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} {t("batchZip")}</Button>
            </div>
          )}

          {tab === "history" && (
            <div className="rounded-xl border border-border bg-card p-4">
              {history.length === 0 ? <p className="py-8 text-center text-muted">{t("emptyHistory")}</p> : (
                <ul className="divide-y divide-border text-sm">{history.map((h) => <li key={h.id} className="flex justify-between py-2"><span>{h.name}</span><span className="text-muted">{formatBytes(h.bytes)}</span></li>)}</ul>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 font-medium"><Shield className="h-4 w-4 text-primary" /> POST /api/v1/pdf/page-numbers</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`POST /api/v1/pdf/page-numbers
{
  "pdf": "JVBERi0x...",
  "settings": {
    "format": "1/10",
    "position": "bottom-center",
    "fontSize": 10,
    "startNumber": 1,
    "skipFirstPage": false,
    "scope": "all"
  },
  "options": { "compress": true }
}`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
