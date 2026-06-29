"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  Download,
  Eye,
  FileArchive,
  FileText,
  FolderUp,
  History,
  Loader2,
  Lock,
  Presentation,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  DEFAULT_PDF_TO_PPT,
  buildPptxOutputName,
  buildPreviewText,
  convertPdfToPptBatch,
  convertPdfToPptx,
  probePdfPages,
  smartPdfToPptSuggestions,
  zipPptxFiles,
  type ConvertItem,
  type PdfToPptSettings,
} from "./pdf-to-ppt-utils";
import { PdfEncryptedError } from "./pdf-merge-utils";

type Lang = "en" | "es";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    drop: "Drop PDF files or click to browse",
    dropHint: "PDF → PPTX · one slide per page · image fill · 100% in-browser",
    addFiles: "Add files",
    addFolder: "Add folder",
    convert: "Convert to PowerPoint",
    preview: "Preview info",
    settings: "Settings",
    clear: "Clear all",
    batchZip: "Download all as ZIP",
    dpi: "Render DPI",
    pageRange: "Page range",
    layout: "Slide layout",
    layout169: "16:9 widescreen",
    layout43: "4:3 standard",
    password: "PDF password",
    smart: "Smart conversion assist",
    apply: "Apply recommended",
    studio: "Studio",
    compare: "Preview",
    batch: "Batch",
    history: "History",
    api: "API",
    emptyHistory: "No conversions yet — your history will appear here.",
    cloudNote: "PDFs are processed in your browser. The REST API sends data only when you call it.",
    previewInfo: "Each PDF page becomes one full-bleed slide image in the PPTX.",
    unlock: "Unlock PDF",
  },
  es: {
    drop: "Suelta PDFs o haz clic",
    dropHint: "PDF → PPTX — una diapositiva por página — 100% en el navegador",
    addFiles: "Añadir archivos",
    addFolder: "Añadir carpeta",
    convert: "Convertir a PowerPoint",
    preview: "Vista previa",
    settings: "Ajustes",
    clear: "Limpiar todo",
    batchZip: "Descargar como ZIP",
    dpi: "DPI de renderizado",
    pageRange: "Rango de páginas",
    layout: "Formato de diapositiva",
    layout169: "16:9 panorámico",
    layout43: "4:3 estándar",
    password: "Contraseña PDF",
    smart: "Asistente de conversión",
    apply: "Aplicar recomendado",
    studio: "Estudio",
    compare: "Vista",
    batch: "Lote",
    history: "Historial",
    api: "API",
    emptyHistory: "Aún no hay conversiones.",
    cloudNote: "Los PDFs se procesan en tu navegador.",
    previewInfo: "Cada página del PDF se convierte en una diapositiva con imagen a pantalla completa.",
    unlock: "Desbloquear PDF",
  },
};

interface HistoryEntry {
  id: string;
  name: string;
  originalBytes: number;
  convertedBytes: number;
  slideCount: number;
  pageCount: number;
  ts: number;
}

const HISTORY_KEY = "toolnest-pdf-to-ppt-history";
const SETTINGS_KEY = "toolnest-pdf-to-ppt-settings";
const LANG_KEY = "toolnest-pdf-to-ppt-lang";

type Tab = "studio" | "compare" | "batch" | "history" | "api";

let _idCounter = 0;
const nextId = () => `pdf2ppt-${Date.now()}-${++_idCounter}`;

export function PdfToPpt() {
  const favorites = useFavorites();
  const slug = "pdf-to-ppt";

  const [items, setItems] = useState<ConvertItem[]>([]);
  const [tab, setTab] = useState<Tab>("studio");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showSmart, setShowSmart] = useState(true);
  const [lang, setLang] = useState<Lang>("en");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [options, setOptions] = useState<PdfToPptSettings>(DEFAULT_PDF_TO_PPT);
  const [pendingUnlock, setPendingUnlock] = useState<{ itemId: string; file: File } | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const t = useCallback((key: string) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key, [lang]);

  useEffect(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) setOptions((prev) => ({ ...prev, ...JSON.parse(s) }));
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h).slice(0, 50));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(options)); } catch { /* ignore */ }
  }, [options]);

  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  const addFiles = useCallback(async (files: File[], password?: string) => {
    if (!files.length) return;
    const accepted: ConvertItem[] = [];
    for (const file of files) {
      if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
        toast.error(`Not a PDF: ${file.name}`);
        continue;
      }
      let pageCount = 0;
      try {
        pageCount = await probePdfPages(await file.arrayBuffer(), password ?? options.password);
      } catch (e) {
        if (e instanceof PdfEncryptedError || String(e).includes("password")) {
          setPendingUnlock({ itemId: nextId(), file });
          toast.error("PDF is password-protected");
          continue;
        }
      }
      accepted.push({
        id: nextId(),
        file,
        name: file.name,
        originalBytes: file.size,
        pageCount,
        status: "queued",
        result: null,
        previewText: await buildPreviewText(file),
      });
    }
    if (accepted.length) {
      setItems((prev) => [...prev, ...accepted]);
      toast.success(`${accepted.length} PDF(s) added`);
    }
  }, [options.password]);

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void addFiles(Array.from(e.dataTransfer.files));
  };

  const stats = useMemo(() => ({
    total: items.length,
    done: items.filter((i) => i.status === "done" && i.result).length,
    totalOriginal: items.reduce((s, i) => s + i.originalBytes, 0),
    totalSlides: items.reduce((s, i) => s + (i.result?.slideCount ?? 0), 0),
  }), [items]);

  const suggestions = useMemo(() => smartPdfToPptSuggestions(items, options), [items, options]);

  const applySmart = () => {
    setOptions((o) => ({ ...o, dpi: 150, layout: "16x9", pageRange: "" }));
    toast.success("Smart settings applied");
  };

  const runConvertAll = useCallback(async (autoDownload: boolean) => {
    if (!items.length) { toast.error("Add PDFs first"); return; }
    setBusy(true);
    setProgress(0);
    try {
      setItems((prev) => prev.map((p) => ({ ...p, status: "converting" as const })));
      const results = await convertPdfToPptBatch(items.map((i) => i.file), options, (idx, total) => {
        setProgress(Math.round((idx / total) * 100));
      });
      const updated = items.map((item, i) => ({
        ...item,
        status: "done" as const,
        result: results[i] ?? null,
        error: results[i] ? undefined : "Conversion failed",
      }));
      setItems(updated);

      const newEntries: HistoryEntry[] = updated.filter((i) => i.result).map((i) => ({
        id: i.id,
        name: i.name,
        originalBytes: i.originalBytes,
        convertedBytes: i.result!.bytes,
        slideCount: i.result!.slideCount,
        pageCount: i.result!.pageCount,
        ts: Date.now(),
      }));
      if (newEntries.length) {
        setHistory((h) => {
          const next = [...newEntries, ...h].slice(0, 50);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
          return next;
        });
      }

      if (autoDownload) {
        if (updated.length === 1 && updated[0].result) {
          downloadBlob(updated[0].result.blob, buildPptxOutputName(updated[0].name));
        } else {
          const zip = await zipPptxFiles(updated.filter((i) => i.result).map((i) => ({ name: buildPptxOutputName(i.name), blob: i.result!.blob })));
          downloadBlob(zip, "toolnest-pdf-to-ppt.zip");
        }
        toast.success(`Done — ${newEntries.length} PPTX file(s)`);
      } else {
        setTab("compare");
        toast.success("Conversion ready — view Preview tab");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Conversion failed");
      setItems((prev) => prev.map((p) => ({ ...p, status: "error" as const, error: e instanceof Error ? e.message : "Failed" })));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, [items, options]);

  const convertOne = useCallback(async (item: ConvertItem) => {
    setBusy(true);
    try {
      const result = await convertPdfToPptx(await item.file.arrayBuffer(), item.file.name, options, setProgress);
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, result, status: "done" } : p)));
      downloadBlob(result.blob, buildPptxOutputName(item.name));
      toast.success(`Converted · ${result.slideCount} slide(s)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Conversion failed";
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "error", error: msg } : p)));
      toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, [options]);

  const removeItem = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));
  const clearAll = () => setItems([]);

  const previewItem = items[previewIndex];

  const TABS: { id: Tab; label: string; icon: typeof Presentation }[] = [
    { id: "studio", label: t("studio"), icon: Presentation },
    { id: "compare", label: t("compare"), icon: Eye },
    { id: "batch", label: t("batch"), icon: FileArchive },
    { id: "history", label: t("history"), icon: History },
    { id: "api", label: t("api"), icon: Sparkles },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors", tab === id ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground")}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => favorites.toggle(slug)} className="rounded-lg border border-border p-2 hover:bg-muted/50" aria-label="Favorite">
            <Star className={cn("h-4 w-4", favorites.isFavorite(slug) ? "fill-amber-400 text-amber-400" : "text-muted")} />
          </button>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={cn(inputClass(), "w-auto py-1.5 text-xs")}>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
          <button type="button" onClick={() => setShowSettings((s) => !s)} className={cn("rounded-lg border border-border p-2 hover:bg-muted/50", showSettings && "bg-muted")}><Settings2 className="h-4 w-4" /></button>
        </div>
      </div>

      {pendingUnlock && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-medium">{pendingUnlock.file.name} is encrypted</p>
          <div className="flex gap-2">
            <input type="password" value={unlockPassword} onChange={(e) => setUnlockPassword(e.target.value)} className={inputClass()} placeholder={t("password")} />
            <Button onClick={() => {
              setOptions((o) => ({ ...o, password: unlockPassword }));
              void addFiles([pendingUnlock.file], unlockPassword);
              setPendingUnlock(null);
              setUnlockPassword("");
            }}>{t("unlock")}</Button>
            <Button variant="ghost" onClick={() => setPendingUnlock(null)}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {showSmart && suggestions.length > 0 && tab === "studio" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" />{t("smart")}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={applySmart}>{t("apply")}</Button>
              <button type="button" onClick={() => setShowSmart(false)}><X className="h-4 w-4 text-muted" /></button>
            </div>
          </div>
          <ul className="space-y-1 text-sm text-muted">{suggestions.map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
      )}

      {showSettings && (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("dpi")}>
            <input type="number" min={72} max={300} step={10} value={options.dpi} onChange={(e) => setOptions((o) => ({ ...o, dpi: +e.target.value }))} className={inputClass()} />
          </Field>
          <Field label={t("pageRange")}>
            <input value={options.pageRange} onChange={(e) => setOptions((o) => ({ ...o, pageRange: e.target.value }))} className={inputClass()} placeholder="1-5, 8" />
          </Field>
          <Field label={t("layout")}>
            <select value={options.layout} onChange={(e) => setOptions((o) => ({ ...o, layout: e.target.value as PdfToPptSettings["layout"] }))} className={inputClass()}>
              <option value="16x9">{t("layout169")}</option>
              <option value="4x3">{t("layout43")}</option>
            </select>
          </Field>
          <Field label={t("password")}>
            <input type="password" value={options.password} onChange={(e) => setOptions((o) => ({ ...o, password: e.target.value }))} className={inputClass()} autoComplete="new-password" />
          </Field>
        </div>
      )}

      {tab === "studio" && (
        <>
          <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} className={cn("relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors", dragging ? "border-primary bg-primary/5" : "border-border bg-card/50")}>
            <UploadCloud className="mx-auto mb-3 h-10 w-10 text-muted" />
            <p className="font-medium">{t("drop")}</p>
            <p className="mt-1 text-sm text-muted">{t("dropHint")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => fileInputRef.current?.click()}>{t("addFiles")}</Button>
              <Button type="button" variant="outline" onClick={() => folderInputRef.current?.click()}><FolderUp className="mr-1.5 h-4 w-4" />{t("addFolder")}</Button>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={onInputChange} />
            <input ref={folderInputRef} type="file" accept=".pdf,application/pdf" multiple {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} className="hidden" onChange={onInputChange} />
          </div>
          {items.length > 0 && (
            <>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-muted">
                        {item.pageCount} pages · {formatBytes(item.originalBytes)}
                        {item.result && ` → ${formatBytes(item.result.bytes)} · ${item.result.slideCount} slides`}
                        {item.error && <span className="text-destructive"> · {item.error}</span>}
                      </p>
                      {!item.result && <p className="mt-1 text-xs text-muted/80">{item.previewText}</p>}
                    </div>
                    {item.status === "converting" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {item.status === "done" && item.result && (
                      <Button size="sm" variant="outline" onClick={() => downloadBlob(item.result!.blob, buildPptxOutputName(item.name))}><Download className="h-3.5 w-3.5" /></Button>
                    )}
                    <button type="button" onClick={() => void convertOne(item)} disabled={busy} className="text-xs text-primary hover:underline">1×</button>
                    <button type="button" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4 text-muted hover:text-destructive" /></button>
                  </li>
                ))}
              </ul>
              {busy && <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void runConvertAll(true)} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}{t("convert")}</Button>
                <Button variant="outline" onClick={() => void runConvertAll(false)} disabled={busy}>{t("preview")}</Button>
                <Button variant="ghost" onClick={clearAll} disabled={busy}>{t("clear")}</Button>
              </div>
            </>
          )}
          <p className="flex items-center gap-2 text-xs text-muted"><Lock className="h-3 w-3" />{t("cloudNote")}</p>
        </>
      )}

      {tab === "compare" && (
        <div className="space-y-4">
          {items.length > 1 && (
            <select value={previewIndex} onChange={(e) => setPreviewIndex(+e.target.value)} className={inputClass()}>
              {items.map((item, i) => <option key={item.id} value={i}>{item.name}</option>)}
            </select>
          )}
          {previewItem?.result ? (
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-sm text-muted">{t("previewInfo")}</p>
              <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                <div><dt className="text-xs text-muted">File</dt><dd className="font-medium">{previewItem.name}</dd></div>
                <div><dt className="text-xs text-muted">Slides</dt><dd className="font-medium">{previewItem.result.slideCount}</dd></div>
                <div><dt className="text-xs text-muted">Layout</dt><dd className="font-medium">{options.layout === "16x9" ? "16:9" : "4:3"}</dd></div>
                <div><dt className="text-xs text-muted">Output size</dt><dd className="font-medium">{formatBytes(previewItem.result.bytes)}</dd></div>
                <div><dt className="text-xs text-muted">Duration</dt><dd className="font-medium">{previewItem.result.durationMs} ms</dd></div>
              </dl>
              <Button className="mt-4" onClick={() => downloadBlob(previewItem.result!.blob, buildPptxOutputName(previewItem.name))}><Download className="mr-2 h-4 w-4" />Download PPTX</Button>
            </div>
          ) : (
            <p className="py-12 text-center text-muted">Convert PDFs first to see output info.</p>
          )}
        </div>
      )}

      {tab === "batch" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-medium">{items.length} PDF(s) · {formatBytes(stats.totalOriginal)} · {stats.totalSlides} slides when done</p>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => void runConvertAll(true)} disabled={!items.length || busy}>{t("convert")}</Button>
              <Button variant="outline" disabled={!stats.done} onClick={async () => {
                const zip = await zipPptxFiles(items.filter((i) => i.result).map((i) => ({ name: buildPptxOutputName(i.name), blob: i.result!.blob })));
                downloadBlob(zip, "toolnest-pdf-to-ppt.zip");
              }}><FileArchive className="mr-2 h-4 w-4" />{t("batchZip")}</Button>
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-2">
          {history.length === 0 ? <p className="py-8 text-center text-muted">{t("emptyHistory")}</p> : history.map((h) => (
            <div key={h.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
              <div>
                <p className="font-medium">{h.name}</p>
                <p className="text-xs text-muted">{h.slideCount} slides · {formatBytes(h.originalBytes)} → {formatBytes(h.convertedBytes)}</p>
              </div>
              <span className="text-xs text-muted">{new Date(h.ts).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 font-mono text-sm">
          <p className="font-sans text-muted">Convert PDFs to PowerPoint via REST API.</p>
          <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs">{`POST /api/v1/pdf/to-ppt
Content-Type: application/json

{
  "pdf": "<base64 or data URI>",
  "filename": "slides.pdf",
  "options": {
    "dpi": 150,
    "pageRange": "1-10",
    "layout": "16x9"
  }
}`}</pre>
          <p className="font-sans text-xs text-muted">Max 50 MB. Server API uses text-layout slides; browser studio produces image-fill slides.</p>
        </div>
      )}
    </div>
  );
}
