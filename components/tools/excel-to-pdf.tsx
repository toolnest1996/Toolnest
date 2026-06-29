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
  FileSpreadsheet,
  FolderUp,
  History,
  Loader2,
  Lock,
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
  ACCEPT_EXTENSIONS,
  DEFAULT_EXCEL_TO_PDF,
  buildPdfOutputName,
  buildPreviewText,
  convertExcelBatch,
  convertExcelToPdf,
  detectExcelFormat,
  probeWorkbook,
  smartExcelToPdfSuggestions,
  zipPdfOutputs,
  type ConvertItem,
  type ExcelToPdfSettings,
} from "./excel-to-pdf-utils";

type Lang = "en" | "es";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    drop: "Drop spreadsheets or click to browse",
    dropHint: "XLSX, XLS & CSV → PDF · sheet pick, grid, fit width · 100% in-browser",
    addFiles: "Add files",
    addFolder: "Add folder",
    convert: "Convert to PDF",
    preview: "Preview PDF",
    settings: "Settings",
    clear: "Clear all",
    batchZip: "Download all as ZIP",
    pageSize: "Page size",
    orientation: "Orientation",
    margin: "Margin (mm)",
    fontSize: "Font size",
    grid: "Grid lines",
    fitWidth: "Fit to page width",
    headerRows: "Header rows (repeat)",
    sheets: "Sheets",
    sheetsAll: "All sheets",
    sheetsPick: "Pick sheets",
    portrait: "Portrait",
    landscape: "Landscape",
    smart: "Smart conversion assist",
    apply: "Apply recommended",
    studio: "Studio",
    compare: "Preview",
    batch: "Batch",
    history: "History",
    api: "API",
    emptyHistory: "No conversions yet — your history will appear here.",
    cloudNote: "Spreadsheets are processed in your browser. The REST API sends data only when you call it.",
  },
  es: {
    drop: "Suelta hojas de cálculo o haz clic",
    dropHint: "XLSX, XLS y CSV → PDF — 100% en el navegador",
    addFiles: "Añadir archivos",
    addFolder: "Añadir carpeta",
    convert: "Convertir a PDF",
    preview: "Vista previa PDF",
    settings: "Ajustes",
    clear: "Limpiar todo",
    batchZip: "Descargar como ZIP",
    pageSize: "Tamaño de página",
    orientation: "Orientación",
    margin: "Margen (mm)",
    fontSize: "Tamaño de fuente",
    grid: "Líneas de cuadrícula",
    fitWidth: "Ajustar al ancho",
    headerRows: "Filas de encabezado",
    sheets: "Hojas",
    sheetsAll: "Todas las hojas",
    sheetsPick: "Elegir hojas",
    portrait: "Vertical",
    landscape: "Horizontal",
    smart: "Asistente de conversión",
    apply: "Aplicar recomendado",
    studio: "Estudio",
    compare: "Vista",
    batch: "Lote",
    history: "Historial",
    api: "API",
    emptyHistory: "Aún no hay conversiones.",
    cloudNote: "Las hojas se procesan en tu navegador.",
  },
};

interface HistoryEntry {
  id: string;
  name: string;
  format: string;
  originalBytes: number;
  convertedBytes: number;
  pageCount: number;
  sheetCount: number;
  ts: number;
}

const HISTORY_KEY = "toolnest-excel-to-pdf-history";
const SETTINGS_KEY = "toolnest-excel-to-pdf-settings";
const LANG_KEY = "toolnest-excel-to-pdf-lang";

type Tab = "studio" | "compare" | "batch" | "history" | "api";

let _idCounter = 0;
const nextId = () => `x2pdf-${Date.now()}-${++_idCounter}`;
const EXT_OK = /\.(xlsx|xls|csv)$/i;

export function ExcelToPdf() {
  const favorites = useFavorites();
  const slug = "excel-to-pdf";

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
  const [options, setOptions] = useState<ExcelToPdfSettings>(DEFAULT_EXCEL_TO_PDF);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);

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

  useEffect(() => () => {
    items.forEach((i) => i.result?.previewUrl && URL.revokeObjectURL(i.result.previewUrl));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const first = items[0];
    if (first?.sheetNames.length) {
      setAvailableSheets(first.sheetNames);
    }
  }, [items]);

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const accepted: ConvertItem[] = [];
    for (const file of files) {
      if (!EXT_OK.test(file.name)) {
        toast.error(`Unsupported: ${file.name}`);
        continue;
      }
      const format = detectExcelFormat(file);
      let sheetNames: string[] = [];
      if (format !== "xls" && format !== "unknown") {
        try {
          const probe = await probeWorkbook(await file.arrayBuffer(), file.name);
          sheetNames = probe.sheetNames;
        } catch { /* ignore */ }
      }
      const previewText = await buildPreviewText(file);
      accepted.push({
        id: nextId(),
        file,
        name: file.name,
        originalBytes: file.size,
        format,
        sheetNames,
        status: "queued",
        result: null,
        previewText,
      });
    }
    if (accepted.length) {
      setItems((prev) => [...prev, ...accepted]);
      toast.success(`${accepted.length} file(s) added`);
    }
  }, []);

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
    totalPages: items.reduce((s, i) => s + (i.result?.pageCount ?? 0), 0),
  }), [items]);

  const suggestions = useMemo(() => smartExcelToPdfSuggestions(items, options), [items, options]);

  const applySmart = () => {
    setOptions((o) => ({
      ...o,
      orientation: "landscape",
      fitWidth: true,
      showGrid: true,
      headerRows: 1,
      fontSize: 8,
    }));
    toast.success("Smart settings applied");
  };

  const runConvertAll = useCallback(async (autoDownload: boolean) => {
    if (!items.length) { toast.error("Add spreadsheets first"); return; }
    setBusy(true);
    setProgress(0);
    try {
      const files = items.map((i) => i.file);
      setItems((prev) => prev.map((p) => ({ ...p, status: "converting" as const })));

      const results = await convertExcelBatch(files, options, (idx, total) => {
        setProgress(Math.round((idx / total) * 100));
      });

      const updated = items.map((item, i) => ({
        ...item,
        status: "done" as const,
        result: results[i] ?? null,
        error: results[i] ? undefined : "Conversion failed",
      }));
      setItems(updated);

      const newEntries: HistoryEntry[] = updated
        .filter((i) => i.result)
        .map((i) => ({
          id: i.id,
          name: i.name,
          format: i.format,
          originalBytes: i.originalBytes,
          convertedBytes: i.result!.bytes,
          pageCount: i.result!.pageCount,
          sheetCount: i.result!.sheetCount,
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
          downloadBlob(updated[0].result.blob, buildPdfOutputName(updated[0].name));
        } else {
          const zip = await zipPdfOutputs(
            updated.filter((i) => i.result).map((i) => ({ name: buildPdfOutputName(i.name), blob: i.result!.blob })),
          );
          downloadBlob(zip, "toolnest-excel-to-pdf.zip");
        }
        toast.success(`Done — ${newEntries.length} PDF(s)`);
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
      const result = await convertExcelToPdf(await item.file.arrayBuffer(), item.file.name, options, setProgress);
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, result, status: "done" } : p)));
      downloadBlob(result.blob, buildPdfOutputName(item.name));
      toast.success(`Converted · ${result.pageCount} pages · ${result.sheetCount} sheet(s)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Conversion failed";
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "error", error: msg } : p)));
      toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, [options]);

  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.result?.previewUrl) URL.revokeObjectURL(item.result.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearAll = () => {
    items.forEach((i) => i.result?.previewUrl && URL.revokeObjectURL(i.result.previewUrl));
    setItems([]);
  };

  const previewItem = items[previewIndex];
  const previewUrl = previewItem?.result?.previewUrl;

  const TABS: { id: Tab; label: string; icon: typeof FileSpreadsheet }[] = [
    { id: "studio", label: t("studio"), icon: FileSpreadsheet },
    { id: "compare", label: t("compare"), icon: Eye },
    { id: "batch", label: t("batch"), icon: FileArchive },
    { id: "history", label: t("history"), icon: History },
    { id: "api", label: t("api"), icon: Sparkles },
  ];

  const toggleSheet = (idx: number) => {
    setOptions((o) => {
      const picked = o.pickedSheetIndexes.includes(idx)
        ? o.pickedSheetIndexes.filter((i) => i !== idx)
        : [...o.pickedSheetIndexes, idx].sort((a, b) => a - b);
      return { ...o, pickedSheetIndexes: picked.length ? picked : [idx] };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                tab === id ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => favorites.toggle(slug)} className="rounded-lg border border-border p-2 hover:bg-muted/50" aria-label="Favorite">
            <Star className={cn("h-4 w-4", favorites.isFavorite(slug) ? "fill-amber-400 text-amber-400" : "text-muted")} />
          </button>
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={cn(inputClass(), "w-auto py-1.5 text-xs")} aria-label="Language">
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
          <button type="button" onClick={() => setShowSettings((s) => !s)} className={cn("rounded-lg border border-border p-2 hover:bg-muted/50", showSettings && "bg-muted")} aria-label={t("settings")}>
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showSmart && suggestions.length > 0 && tab === "studio" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4 text-primary" />{t("smart")}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={applySmart}>{t("apply")}</Button>
              <button type="button" onClick={() => setShowSmart(false)} aria-label="Dismiss"><X className="h-4 w-4 text-muted" /></button>
            </div>
          </div>
          <ul className="space-y-1 text-sm text-muted">{suggestions.map((s, i) => <li key={i}>• {s}</li>)}</ul>
        </div>
      )}

      {showSettings && (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("pageSize")}>
            <select value={options.pageSize} onChange={(e) => setOptions((o) => ({ ...o, pageSize: e.target.value as ExcelToPdfSettings["pageSize"] }))} className={inputClass()}>
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
            </select>
          </Field>
          <Field label={t("orientation")}>
            <select value={options.orientation} onChange={(e) => setOptions((o) => ({ ...o, orientation: e.target.value as ExcelToPdfSettings["orientation"] }))} className={inputClass()}>
              <option value="portrait">{t("portrait")}</option>
              <option value="landscape">{t("landscape")}</option>
            </select>
          </Field>
          <Field label={t("fontSize")}>
            <input type="number" min={6} max={16} value={options.fontSize} onChange={(e) => setOptions((o) => ({ ...o, fontSize: +e.target.value }))} className={inputClass()} />
          </Field>
          <Field label={t("margin")}>
            <input type="number" min={5} max={40} value={options.margin} onChange={(e) => setOptions((o) => ({ ...o, margin: +e.target.value }))} className={inputClass()} />
          </Field>
          <Field label={t("headerRows")}>
            <input type="number" min={0} max={5} value={options.headerRows} onChange={(e) => setOptions((o) => ({ ...o, headerRows: +e.target.value }))} className={inputClass()} />
          </Field>
          <Field label={t("sheets")}>
            <select value={options.sheetSelection} onChange={(e) => setOptions((o) => ({ ...o, sheetSelection: e.target.value as ExcelToPdfSettings["sheetSelection"] }))} className={inputClass()}>
              <option value="all">{t("sheetsAll")}</option>
              <option value="pick">{t("sheetsPick")}</option>
            </select>
          </Field>
          {options.sheetSelection === "pick" && availableSheets.length > 0 && (
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
              {availableSheets.map((name, idx) => (
                <label key={idx} className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-sm">
                  <input type="checkbox" checked={options.pickedSheetIndexes.includes(idx)} onChange={() => toggleSheet(idx)} />
                  {name}
                </label>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.showGrid} onChange={(e) => setOptions((o) => ({ ...o, showGrid: e.target.checked }))} />{t("grid")}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.fitWidth} onChange={(e) => setOptions((o) => ({ ...o, fitWidth: e.target.checked }))} />{t("fitWidth")}</label>
          </div>
        </div>
      )}

      {tab === "studio" && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn("relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors", dragging ? "border-primary bg-primary/5" : "border-border bg-card/50")}
          >
            <UploadCloud className="mx-auto mb-3 h-10 w-10 text-muted" />
            <p className="font-medium">{t("drop")}</p>
            <p className="mt-1 text-sm text-muted">{t("dropHint")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => fileInputRef.current?.click()}>{t("addFiles")}</Button>
              <Button type="button" variant="outline" onClick={() => folderInputRef.current?.click()}><FolderUp className="mr-1.5 h-4 w-4" />{t("addFolder")}</Button>
            </div>
            <input ref={fileInputRef} type="file" accept={ACCEPT_EXTENSIONS} multiple className="hidden" onChange={onInputChange} />
            <input ref={folderInputRef} type="file" accept={ACCEPT_EXTENSIONS} multiple {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} className="hidden" onChange={onInputChange} />
          </div>

          {items.length > 0 && (
            <>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-muted">
                        {item.format.toUpperCase()} · {formatBytes(item.originalBytes)}
                        {item.result && ` → ${formatBytes(item.result.bytes)} · ${item.result.pageCount} pg`}
                        {item.error && <span className="text-destructive"> · {item.error}</span>}
                      </p>
                      {!item.result && <p className="mt-1 truncate text-xs text-muted/80">{item.previewText}</p>}
                    </div>
                    {item.status === "converting" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {item.status === "done" && item.result && (
                      <Button size="sm" variant="outline" onClick={() => downloadBlob(item.result!.blob, buildPdfOutputName(item.name))}><Download className="h-3.5 w-3.5" /></Button>
                    )}
                    <button type="button" onClick={() => void convertOne(item)} disabled={busy} className="text-xs text-primary hover:underline">1×</button>
                    <button type="button" onClick={() => removeItem(item.id)} aria-label="Remove"><Trash2 className="h-4 w-4 text-muted hover:text-destructive" /></button>
                  </li>
                ))}
              </ul>
              {busy && (
                <div className="space-y-1">
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
                  <p className="text-center text-xs text-muted">{progress}%</p>
                </div>
              )}
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
          {previewUrl ? (
            <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
              <iframe src={previewUrl} title="PDF preview" className="h-[70vh] w-full" />
            </div>
          ) : (
            <p className="py-12 text-center text-muted">Convert spreadsheets first to preview PDF output.</p>
          )}
          {previewUrl && previewItem?.result && (
            <Button onClick={() => downloadBlob(previewItem.result!.blob, buildPdfOutputName(previewItem.name))}><Download className="mr-2 h-4 w-4" />Download PDF</Button>
          )}
        </div>
      )}

      {tab === "batch" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Batch-convert multiple spreadsheets and download as ZIP.</p>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-medium">{items.length} file(s) · {formatBytes(stats.totalOriginal)}</p>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => void runConvertAll(true)} disabled={!items.length || busy}>{t("convert")}</Button>
              <Button variant="outline" disabled={!stats.done} onClick={async () => {
                const zip = await zipPdfOutputs(items.filter((i) => i.result).map((i) => ({ name: buildPdfOutputName(i.name), blob: i.result!.blob })));
                downloadBlob(zip, "toolnest-excel-to-pdf.zip");
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
                <p className="text-xs text-muted">{h.format.toUpperCase()} · {formatBytes(h.originalBytes)} → {formatBytes(h.convertedBytes)} · {h.pageCount} pg · {h.sheetCount} sheet(s)</p>
              </div>
              <span className="text-xs text-muted">{new Date(h.ts).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 font-mono text-sm">
          <p className="font-sans text-muted">Convert spreadsheets programmatically via REST API.</p>
          <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs">{`POST /api/v1/pdf/excel-to-pdf
Content-Type: application/json

{
  "document": "<base64 or data URI>",
  "filename": "report.xlsx",
  "options": {
    "pageSize": "a4",
    "orientation": "landscape",
    "fitWidth": true,
    "showGrid": true,
    "headerRows": 1,
    "sheetSelection": "all"
  }
}`}</pre>
          <p className="font-sans text-xs text-muted">Max 25 MB. Legacy .xls not supported — use .xlsx.</p>
        </div>
      )}
    </div>
  );
}
