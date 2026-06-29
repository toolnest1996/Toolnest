"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  Check,
  ClipboardPaste,
  Download,
  Eye,
  FileArchive,
  FolderUp,
  History,
  Languages,
  Loader2,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  Redo2,
  UploadCloud,
  ZoomIn,
  ZoomOut,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  DEFAULT_SVG_RASTER,
  DPI_PRESETS,
  SVG_SIZE_PRESETS,
  aiRecommendSvgRaster,
  analyzeSvg,
  buildOutputName,
  computeRasterSize,
  isSvgFile,
  loadSvgFromFile,
  optimizeSvgMarkup,
  prepareSvg,
  rasterizeSvgBatch,
  rasterizeSvgInWorker,
  rasterizeSvgToBlob,
  zipRasterOutputs,
  type DpiPreset,
  type SvgAnalysis,
  type SvgRasterSettings,
} from "./svg-to-png-utils";
import { FORMAT_LABELS, LOSSY_FORMATS, type OutputFormat } from "./image-compressor-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";
type Tab = "studio" | "compare" | "batch" | "history" | "api";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", compare: "Compare", batch: "Batch", history: "History", api: "API",
    drop: "Drop SVG files, paste, or browse", dropHint: "SVG · folder upload · batch ZIP — 100% in-browser",
    addFiles: "Add SVGs", addFolder: "Folder", paste: "Paste", convert: "Convert & Download", preview: "Preview", clear: "Clear",
    exportFmt: "Format", quality: "Quality", private: "100% private · in-browser", favorite: "Favorite", favorited: "Favorited",
    ai: "AI tips", undo: "Undo", redo: "Redo", batchZip: "ZIP all", emptyHistory: "No conversions yet.",
    dpi: "DPI / PPI", lockRatio: "Lock aspect ratio", optimize: "Optimize SVG", transparent: "Transparent bg",
    antiAlias: "Anti-aliasing", useDpi: "DPI-based sizing", worker: "Web Worker", width: "Width (px)", height: "Height (px)",
    scale: "Scale", preset: "Size preset", background: "Background",
  },
  es: { studio: "Estudio", compare: "Comparar", batch: "Lote", history: "Historial", api: "API", drop: "Suelta SVG", dropHint: "100% navegador", addFiles: "Añadir", addFolder: "Carpeta", paste: "Pegar", convert: "Convertir", preview: "Vista", clear: "Limpiar", exportFmt: "Formato", quality: "Calidad", private: "100% privado", favorite: "Favorito", favorited: "Favorito", ai: "Consejos IA", undo: "Deshacer", redo: "Rehacer", batchZip: "ZIP", emptyHistory: "Sin conversiones.", dpi: "DPI", lockRatio: "Bloquear ratio", optimize: "Optimizar SVG", transparent: "Fondo transparente", antiAlias: "Anti-aliasing", useDpi: "Tamaño por DPI", worker: "Web Worker", width: "Ancho", height: "Alto", scale: "Escala", preset: "Preset", background: "Fondo" },
  de: { studio: "Studio", compare: "Vergleich", batch: "Stapel", history: "Verlauf", api: "API", drop: "SVG ablegen", dropHint: "100% Browser", addFiles: "Hinzufügen", addFolder: "Ordner", paste: "Einfügen", convert: "Konvertieren", preview: "Vorschau", clear: "Löschen", exportFmt: "Format", quality: "Qualität", private: "100% privat", favorite: "Favorit", favorited: "Favorit", ai: "KI-Tipps", undo: "Rückgängig", redo: "Wiederholen", batchZip: "ZIP", emptyHistory: "Keine.", dpi: "DPI", lockRatio: "Seitenverhältnis", optimize: "SVG optimieren", transparent: "Transparenz", antiAlias: "Anti-Aliasing", useDpi: "DPI-Größe", worker: "Web Worker", width: "Breite", height: "Höhe", scale: "Skala", preset: "Preset", background: "Hintergrund" },
  fr: { studio: "Studio", compare: "Comparer", batch: "Lot", history: "Historique", api: "API", drop: "Déposez SVG", dropHint: "100% navigateur", addFiles: "Ajouter", addFolder: "Dossier", paste: "Coller", convert: "Convertir", preview: "Aperçu", clear: "Effacer", exportFmt: "Format", quality: "Qualité", private: "100% privé", favorite: "Favori", favorited: "Favori", ai: "Conseils IA", undo: "Annuler", redo: "Rétablir", batchZip: "ZIP", emptyHistory: "Aucune.", dpi: "DPI", lockRatio: "Ratio verrouillé", optimize: "Optimiser SVG", transparent: "Fond transparent", antiAlias: "Anti-crénelage", useDpi: "Taille DPI", worker: "Web Worker", width: "Largeur", height: "Hauteur", scale: "Échelle", preset: "Preset", background: "Fond" },
  tr: { studio: "Stüdyo", compare: "Karşılaştır", batch: "Toplu", history: "Geçmiş", api: "API", drop: "SVG bırakın", dropHint: "%100 tarayıcı", addFiles: "Ekle", addFolder: "Klasör", paste: "Yapıştır", convert: "Dönüştür", preview: "Önizleme", clear: "Temizle", exportFmt: "Format", quality: "Kalite", private: "%100 özel", favorite: "Favori", favorited: "Favori", ai: "AI ipuçları", undo: "Geri", redo: "İleri", batchZip: "ZIP", emptyHistory: "Yok.", dpi: "DPI", lockRatio: "Oran kilidi", optimize: "SVG optimize", transparent: "Şeffaf arka plan", antiAlias: "Anti-aliasing", useDpi: "DPI boyutu", worker: "Web Worker", width: "Genişlik", height: "Yükseklik", scale: "Ölçek", preset: "Preset", background: "Arka plan" },
  hi: { studio: "स्टूडियो", compare: "तुलना", batch: "बैच", history: "इतिहास", api: "API", drop: "SVG छोड़ें", dropHint: "100% ब्राउज़र", addFiles: "जोड़ें", addFolder: "फ़ोल्डर", paste: "पेस्ट", convert: "रूपांतरित", preview: "पूर्वावलोकन", clear: "साफ़", exportFmt: "प्रारूप", quality: "गुणवत्ता", private: "100% निजी", favorite: "पसंदीदा", favorited: "पसंदीदा", ai: "AI सुझाव", undo: "पूर्ववत", redo: "फिर", batchZip: "ZIP", emptyHistory: "कोई नहीं।", dpi: "DPI", lockRatio: "अनुपात लॉक", optimize: "SVG अनुकूलन", transparent: "पारदर्शी पृष्ठभूमि", antiAlias: "Anti-aliasing", useDpi: "DPI आकार", worker: "Web Worker", width: "चौड़ाई", height: "ऊँचाई", scale: "स्केल", preset: "प्रीसेट", background: "पृष्ठभूमि" },
  pt: { studio: "Estúdio", compare: "Comparar", batch: "Lote", history: "Histórico", api: "API", drop: "Solte SVG", dropHint: "100% navegador", addFiles: "Adicionar", addFolder: "Pasta", paste: "Colar", convert: "Converter", preview: "Prévia", clear: "Limpar", exportFmt: "Formato", quality: "Qualidade", private: "100% privado", favorite: "Favorito", favorited: "Favorito", ai: "Dicas IA", undo: "Desfazer", redo: "Refazer", batchZip: "ZIP", emptyHistory: "Nenhum.", dpi: "DPI", lockRatio: "Travar proporção", optimize: "Otimizar SVG", transparent: "Fundo transparente", antiAlias: "Anti-aliasing", useDpi: "Tamanho DPI", worker: "Web Worker", width: "Largura", height: "Altura", scale: "Escala", preset: "Preset", background: "Fundo" },
  ja: { studio: "スタジオ", compare: "比較", batch: "一括", history: "履歴", api: "API", drop: "SVGをドロップ", dropHint: "100%ブラウザ", addFiles: "追加", addFolder: "フォルダ", paste: "ペースト", convert: "変換", preview: "プレビュー", clear: "消去", exportFmt: "形式", quality: "品質", private: "100%プライベート", favorite: "お気に入り", favorited: "お気に入り", ai: "AIヒント", undo: "元に戻す", redo: "やり直し", batchZip: "ZIP", emptyHistory: "なし。", dpi: "DPI", lockRatio: "比率固定", optimize: "SVG最適化", transparent: "透明背景", antiAlias: "アンチエイリアス", useDpi: "DPIサイズ", worker: "Web Worker", width: "幅", height: "高さ", scale: "スケール", preset: "プリセット", background: "背景" },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français", tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

interface SvgItem {
  id: string;
  name: string;
  svg: string;
  bytes: number;
  analysis: SvgAnalysis;
  svgPreviewUrl: string;
}

interface HistoryEntry { id: string; name: string; w: number; h: number; bytes: number; ts: number; dataUrl: string; }

const HISTORY_KEY = "toolnest-svg-raster-history";
const SETTINGS_KEY = "toolnest-svg-raster-settings";
const LANG_KEY = "toolnest-svg-raster-lang";

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
let _id = 0;
const nextId = () => `svg-${Date.now()}-${++_id}`;

export function SvgToPng() {
  const favorites = useFavorites();
  const slug = "svg-to-png";

  const [items, setItems] = useState<SvgItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [settings, setSettings] = useState<SvgRasterSettings>({ ...DEFAULT_SVG_RASTER });
  const [tab, setTab] = useState<Tab>("studio");
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [compareSlider, setCompareSlider] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [useWorker, setUseWorker] = useState(true);

  const settingsUndo = useRef<SvgRasterSettings[]>([]);
  const settingsRedo = useRef<SvgRasterSettings[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const t = useCallback((k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k, [lang]);
  const active = items[activeIdx];

  const patchSettings = useCallback((patch: Partial<SvgRasterSettings>) => {
    setSettings((prev) => {
      settingsUndo.current.push(prev);
      if (settingsUndo.current.length > 40) settingsUndo.current.shift();
      settingsRedo.current = [];
      return { ...prev, ...patch };
    });
  }, []);

  const undoSettings = () => {
    if (!settingsUndo.current.length) return;
    const prev = settingsUndo.current.pop()!;
    setSettings((cur) => { settingsRedo.current.push(cur); return prev; });
  };
  const redoSettings = () => {
    if (!settingsRedo.current.length) return;
    const next = settingsRedo.current.pop()!;
    setSettings((cur) => { settingsUndo.current.push(cur); return next; });
  };

  useEffect(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (p.settings) setSettings((o) => ({ ...o, ...p.settings }));
        if (typeof p.useWorker === "boolean") setUseWorker(p.useWorker);
      }
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ settings, useWorker })); } catch { /* ignore */ }
  }, [settings, useWorker]);
  useEffect(() => { try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ } }, [lang]);

  useEffect(() => () => {
    items.forEach((i) => URL.revokeObjectURL(i.svgPreviewUrl));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    const accepted: SvgItem[] = [];
    for (const file of files) {
      if (!isSvgFile(file)) { toast.error(`Unsupported: ${file.name}`); continue; }
      try {
        const svg = await loadSvgFromFile(file);
        const blob = new Blob([svg], { type: "image/svg+xml" });
        accepted.push({
          id: nextId(), name: file.name, svg, bytes: file.size,
          analysis: analyzeSvg(svg),
          svgPreviewUrl: URL.createObjectURL(blob),
        });
      } catch {
        toast.error(`${file.name}: invalid SVG`);
      }
    }
    if (accepted.length) {
      setItems((prev) => [...prev, ...accepted]);
      if (!items.length) setActiveIdx(0);
      toast.success(`${accepted.length} SVG(s) added`);
    }
  }, [items.length]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text/plain")?.trim();
      if (text && /<svg[\s>]/i.test(text)) {
        const blob = new Blob([text], { type: "image/svg+xml" });
        setItems((prev) => [...prev, {
          id: nextId(), name: `pasted-${Date.now()}.svg`, svg: text, bytes: blob.size,
          analysis: analyzeSvg(text), svgPreviewUrl: URL.createObjectURL(blob),
        }]);
        toast.success("SVG pasted");
        return;
      }
      const clipItems = e.clipboardData?.items;
      if (!clipItems) return;
      const files: File[] = [];
      for (const it of clipItems) {
        if (it.type === "image/svg+xml" || it.kind === "file") {
          const f = it.getAsFile();
          if (f && isSvgFile(f)) files.push(f);
        }
      }
      if (files.length) void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const outSize = useMemo(
    () => (active ? computeRasterSize(prepareSvg(active.svg, settings), settings) : null),
    [active, settings],
  );

  const recs = useMemo(
    () => (active ? aiRecommendSvgRaster(active.analysis, settings) : []),
    [active, settings],
  );

  const optimizedBytes = useMemo(
    () => (active && settings.optimizeSvg
      ? new Blob([optimizeSvgMarkup(active.svg, settings)]).size
      : null),
    [active, settings],
  );

  const runExport = useCallback(async (download = true) => {
    if (!active) return;
    setBusy(true);
    try {
      let result;
      if (useWorker) {
        const workerBlob = await rasterizeSvgInWorker(active.svg, settings);
        if (workerBlob) {
          const size = computeRasterSize(prepareSvg(active.svg, settings), settings);
          result = {
            blob: workerBlob,
            bytes: workerBlob.size,
            width: size.w,
            height: size.h,
            format: settings.format,
            previewUrl: URL.createObjectURL(workerBlob),
            durationMs: 0,
            svgUsed: prepareSvg(active.svg, settings),
          };
        } else {
          result = await rasterizeSvgToBlob(active.svg, settings);
        }
      } else {
        result = await rasterizeSvgToBlob(active.svg, settings);
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(result.previewUrl);
      if (download) downloadBlob(result.blob, buildOutputName(active.name, result.format));
      const entry: HistoryEntry = {
        id: nextId(), name: active.name, w: result.width, h: result.height,
        bytes: result.bytes, ts: Date.now(), dataUrl: result.previewUrl,
      };
      setHistory((h) => {
        const n = [entry, ...h].slice(0, 50);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(n));
        return n;
      });
      toast.success(`${result.width}×${result.height} · ${formatBytes(result.bytes)} · ${Math.round(result.durationMs)}ms`);
      if (!download) setTab("compare");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }, [active, settings, useWorker, previewUrl]);

  const runBatchZip = async () => {
    if (!items.length) return;
    setBusy(true);
    setProgress(0);
    try {
      const out = await rasterizeSvgBatch(
        items.map((i) => ({ name: i.name, svg: i.svg })),
        settings,
        setProgress,
      );
      downloadBlob(await zipRasterOutputs(out), "toolnest-svg-rasterized.zip");
      toast.success(`ZIP ready · ${out.length} file(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  };

  const copyToClipboard = async () => {
    if (!previewUrl) { toast.error("Export or preview first"); return; }
    try {
      const blob = await fetch(previewUrl).then((r) => r.blob());
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Clipboard not supported");
    }
  };

  const applyRec = (action?: string) => {
    if (action === "png") patchSettings({ format: "image/png", transparent: true });
    if (action === "webp") patchSettings({ format: "image/webp", transparent: true });
    if (action === "dpi300") patchSettings({ useDpi: true, dpi: 300 });
    if (action === "optimize") patchSettings({ optimizeSvg: true });
    if (action === "transparent") patchSettings({ transparent: true, format: "image/png" });
    if (action === "ico") patchSettings({ format: "image/x-icon", width: 256, height: 256, transparent: true });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void addFiles(Array.from(e.dataTransfer.files));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undoSettings(); }
    if ((e.key === "y" && (e.ctrlKey || e.metaKey)) || (e.key === "z" && e.shiftKey && (e.ctrlKey || e.metaKey))) { e.preventDefault(); redoSettings(); }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom((z) => clamp(z + 0.1, 0.25, 4)); }
    if (e.key === "-") { e.preventDefault(); setZoom((z) => clamp(z - 0.1, 0.25, 4)); }
  };

  const applyPreset = (id: string) => {
    const p = SVG_SIZE_PRESETS.find((x) => x.id === id);
    if (!p) return;
    patchSettings({ width: p.w, height: p.h, useDpi: id === "intrinsic" });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6" onKeyDown={onKeyDown} tabIndex={0}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <ImageIcon className="h-3.5 w-3.5" /> {t("private")}
          </span>
          {useWorker && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Check className="h-3.5 w-3.5" /> {t("worker")}
            </span>
          )}
          <button type="button" onClick={() => favorites.toggle(slug)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", favorites.isFavorite(slug) ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-card")}>
            <Star className="h-3.5 w-3.5" /> {favorites.isFavorite(slug) ? t("favorited") : t("favorite")}
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <Languages className="h-3.5 w-3.5" />
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-md border border-border bg-card px-2 py-1 text-xs">
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-14 text-center", dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50")}
        >
          <ImageIcon className="mb-4 h-14 w-14 text-primary" />
          <p className="font-display text-xl font-semibold">{t("drop")}</p>
          <p className="mt-2 text-sm text-muted">{t("dropHint")}</p>
          <div className="mt-5 flex gap-2">
            <Button variant="gradient" type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}><UploadCloud className="h-4 w-4" /> {t("addFiles")}</Button>
            <Button variant="outline" type="button" onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}><FolderUp className="h-4 w-4" /> {t("addFolder")}</Button>
          </div>
          <input ref={fileInputRef} type="file" accept=".svg,image/svg+xml" multiple className="hidden" onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} />
          <input ref={folderInputRef} type="file" multiple className="hidden" {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><UploadCloud className="h-4 w-4" /> {t("addFiles")}</Button>
          <Button variant="outline" size="sm" onClick={() => folderInputRef.current?.click()}><FolderUp className="h-4 w-4" /> {t("addFolder")}</Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Ctrl+V to paste SVG")}><ClipboardPaste className="h-4 w-4" /> {t("paste")}</Button>
          <input ref={fileInputRef} type="file" accept=".svg,image/svg+xml" multiple className="hidden" onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} />
          <input ref={folderInputRef} type="file" multiple className="hidden" {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} />
          <Button variant="outline" size="sm" className="ml-auto text-error" onClick={() => { items.forEach((i) => URL.revokeObjectURL(i.svgPreviewUrl)); if (previewUrl) URL.revokeObjectURL(previewUrl); setItems([]); setPreviewUrl(""); }}><Trash2 className="h-4 w-4" /> {t("clear")}</Button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {([["studio", t("studio"), ImageIcon], ["compare", t("compare"), Eye], ["batch", t("batch"), FileArchive], ["history", t("history"), History], ["api", t("api"), Settings2]] as const).map(([k, lbl, Icon]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium", tab === k ? "bg-primary text-white" : "text-muted hover:text-foreground")}>
                <Icon className="h-4 w-4" /><span className="hidden sm:inline">{lbl}</span>
              </button>
            ))}
          </div>

          {tab === "studio" && active && (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                {items.length > 1 && (
                  <select value={activeIdx} onChange={(e) => setActiveIdx(Number(e.target.value))} className={cn(inputClass(), "w-auto max-w-full")}>
                    {items.map((it, i) => <option key={it.id} value={i}>{it.name}</option>)}
                  </select>
                )}
                <div className="relative flex min-h-[320px] max-h-[560px] items-center justify-center overflow-auto rounded-2xl border border-border bg-[repeating-conic-gradient(var(--card)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={active.svgPreviewUrl} alt="" className="max-h-[520px] max-w-full object-contain transition-transform" style={{ transform: `scale(${zoom})` }} draggable={false} />
                </div>
                <p className="text-center text-xs text-muted tabular-nums">
                  {active.analysis.intrinsicW}×{active.analysis.intrinsicH} intrinsic · {formatBytes(active.bytes)}
                  {outSize && ` → ${outSize.w}×${outSize.h}px output`}
                  {optimizedBytes != null && settings.optimizeSvg && ` · optimized ${formatBytes(optimizedBytes)}`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={undoSettings}><Undo2 className="h-4 w-4" /> {t("undo")}</Button>
                  <Button size="sm" variant="outline" onClick={redoSettings}><Redo2 className="h-4 w-4" /> {t("redo")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setZoom((z) => clamp(z + 0.1, 0.25, 4))}><ZoomIn className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setZoom((z) => clamp(z - 0.1, 0.25, 4))}><ZoomOut className="h-4 w-4" /></Button>
                </div>
                {active.analysis.hasExternalRefs && (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                    External linked assets detected — embed as data URIs for reliable offline rasterization.
                  </p>
                )}
              </div>

              <div className="space-y-4">
                <Field label={t("preset")}>
                  <select className={inputClass()} defaultValue="1024" onChange={(e) => applyPreset(e.target.value)}>
                    {SVG_SIZE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </Field>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.useDpi} onChange={(e) => patchSettings({ useDpi: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
                  {t("useDpi")}
                </label>

                {settings.useDpi ? (
                  <Field label={t("dpi")}>
                    <select value={settings.dpi} onChange={(e) => patchSettings({ dpi: Number(e.target.value) as DpiPreset })} className={inputClass()}>
                      {DPI_PRESETS.map((d) => <option key={d.value} value={d.value}>{d.label} — {d.hint}</option>)}
                    </select>
                  </Field>
                ) : (
                  <>
                    <Field label={t("width")}>
                      <input type="number" min={0} value={settings.width || ""} placeholder="auto" onChange={(e) => patchSettings({ width: Number(e.target.value) || 0 })} className={inputClass()} />
                    </Field>
                    <Field label={t("height")}>
                      <input type="number" min={0} value={settings.height || ""} placeholder="auto" onChange={(e) => patchSettings({ height: Number(e.target.value) || 0 })} className={inputClass()} />
                    </Field>
                  </>
                )}

                <Field label={t("scale")}>
                  <input type="range" min={0.25} max={8} step={0.25} value={settings.scale} onChange={(e) => patchSettings({ scale: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                  <span className="text-xs text-muted">{settings.scale}×</span>
                </Field>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.lockAspectRatio} onChange={(e) => patchSettings({ lockAspectRatio: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
                  {t("lockRatio")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.antiAlias} onChange={(e) => patchSettings({ antiAlias: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
                  {t("antiAlias")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.optimizeSvg} onChange={(e) => patchSettings({ optimizeSvg: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
                  {t("optimize")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useWorker} onChange={(e) => setUseWorker(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                  {t("worker")}
                </label>

                <Field label={t("exportFmt")}>
                  <select value={settings.format} onChange={(e) => patchSettings({ format: e.target.value as OutputFormat })} className={inputClass()}>
                    {Object.entries(FORMAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                {LOSSY_FORMATS.includes(settings.format) && (
                  <Field label={t("quality")}>
                    <input type="range" min={10} max={100} value={Math.round(settings.quality * 100)} onChange={(e) => patchSettings({ quality: Number(e.target.value) / 100 })} className="w-full accent-[var(--primary)]" />
                  </Field>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={settings.transparent} onChange={(e) => patchSettings({ transparent: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
                  {t("transparent")}
                </label>
                {!settings.transparent && (
                  <Field label={t("background")}>
                    <input type="color" value={settings.background} onChange={(e) => patchSettings({ background: e.target.value })} className="h-9 w-full cursor-pointer rounded border border-border bg-card p-1" />
                  </Field>
                )}

                {recs.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4" /> {t("ai")}</p>
                    {recs.map((r, i) => (
                      <button key={i} type="button" onClick={() => applyRec(r.action)} className="block w-full text-left text-xs hover:opacity-80">
                        <p className="font-medium">{r.title}</p>
                        <p className="text-muted">{r.detail}</p>
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button variant="gradient" disabled={busy} onClick={() => void runExport(true)}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("convert")}
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => void runExport(false)}><Eye className="h-4 w-4" /> {t("preview")}</Button>
                  <Button variant="outline" disabled={!previewUrl} onClick={() => void copyToClipboard()}><ClipboardPaste className="h-4 w-4" /> Clipboard</Button>
                </div>
              </div>
            </div>
          )}

          {tab === "compare" && active && (
            <div className="space-y-4">
              {previewUrl ? (
                <div className="relative overflow-hidden rounded-2xl border border-border">
                  <div className="relative flex min-h-[280px] items-center justify-center bg-[repeating-conic-gradient(var(--card)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Rasterized" className="max-h-[400px] max-w-full object-contain" />
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ clipPath: `inset(0 ${100 - compareSlider}% 0 0)` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={active.svgPreviewUrl} alt="SVG" className="max-h-[400px] max-w-full object-contain" />
                    </div>
                    <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-primary" style={{ left: `${compareSlider}%` }} />
                  </div>
                  <input type="range" min={0} max={100} value={compareSlider} onChange={(e) => setCompareSlider(Number(e.target.value))} className="w-full accent-[var(--primary)]" aria-label="Compare slider" />
                  <div className="flex justify-between px-2 text-xs text-muted"><span>SVG</span><span>Raster</span></div>
                </div>
              ) : (
                <p className="py-16 text-center text-muted">Run Preview or Convert first.</p>
              )}
            </div>
          )}

          {tab === "batch" && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <p className="text-sm text-muted">{items.length} SVG(s) — same settings applied to all.</p>
              <Button variant="gradient" disabled={busy} onClick={() => void runBatchZip()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} {t("batchZip")}
              </Button>
              {busy && (
                <div className="h-2 rounded-full bg-muted/30">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
              <ul className="divide-y divide-border text-sm max-h-64 overflow-y-auto">
                {items.map((it) => (
                  <li key={it.id} className="flex justify-between gap-2 py-2">
                    <span className="truncate">{it.name}</span>
                    <span className="shrink-0 text-xs text-muted">{it.analysis.intrinsicW}×{it.analysis.intrinsicH}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "history" && (
            <div className="rounded-xl border border-border bg-card p-4">
              {history.length === 0 ? <p className="py-12 text-center text-sm text-muted">{t("emptyHistory")}</p> : (
                <ul className="grid gap-3 sm:grid-cols-3">
                  {history.map((h) => (
                    <li key={h.id} className="rounded-lg border border-border p-2 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={h.dataUrl} alt="" className="mx-auto h-20 w-20 object-contain" />
                      <p className="truncate text-xs font-medium">{h.name}</p>
                      <p className="text-[10px] text-muted">{h.w}×{h.h} · {formatBytes(h.bytes)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <p className="font-medium">POST /api/v1/image/svg-to-png</p>
              <p className="text-sm text-muted">Server-side rasterization via sharp — supports TIFF and high-DPI print output.</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/image/svg-to-png \\
  -H "Content-Type: application/json" \\
  -d '{
    "svg": "<svg xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>",
    "width": 2048,
    "height": 2048,
    "dpi": 300,
    "format": "image/png",
    "transparent": true,
    "quality": 0.92,
    "optimizeSvg": true
  }'`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
