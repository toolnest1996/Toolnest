"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ClipboardPaste,
  Download,
  Eye,
  FileArchive,
  FlipHorizontal2,
  FlipVertical2,
  FolderUp,
  History,
  Loader2,
  Lock,
  Redo2,
  RotateCw,
  ScanLine,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  Unlock,
  UploadCloud,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import { FORMAT_LABELS, LOSSY_FORMATS } from "./image-compressor-utils";
import {
  DEFAULT_DIMENSIONS,
  DEFAULT_EXPORT,
  DEFAULT_TRANSFORM,
  SIZE_PRESETS,
  aiResizeRecommendations,
  buildOutputName,
  computeOutputPixels,
  isSupportedInput,
  loadImageMeta,
  resizeBatch,
  resizeImage,
  smartResizeTips,
  zipResizeResults,
  type ResizeAiRec,
  type ResizeDimensions,
  type ResizeExportOptions,
  type ResizeItem,
  type ResizeTransform,
  type Rotation,
  type SizePreset,
  type SizeUnit,
  type ResizeFit,
  type OutputFormat,
} from "./image-resize-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";
type Tab = "studio" | "compare" | "batch" | "history" | "api";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: { studio: "Studio", compare: "Compare", batch: "Batch", history: "History", api: "API", drop: "Drop images, paste, or browse", dropHint: "JPG · PNG · WebP · AVIF · GIF · BMP · HEIC · SVG — 100% in-browser", addFiles: "Add files", addFolder: "Folder", paste: "Paste", resize: "Resize & Download", preview: "Preview", clear: "Clear", width: "Width", height: "Height", unit: "Unit", lock: "Lock aspect", fit: "Fit mode", dpi: "DPI/PPI", private: "100% private · in-browser", favorite: "Favorite", favorited: "Favorited", ai: "AI tips", apply: "Apply", undo: "Undo", redo: "Redo", batchZip: "ZIP all", emptyHistory: "No resizes yet.", presets: "Presets", upscale: "Allow upscale", sharpen: "Sharpen", quality: "Quality", format: "Format" },
  es: { studio: "Estudio", compare: "Comparar", batch: "Lote", history: "Historial", api: "API", drop: "Suelta imágenes", dropHint: "100% en navegador", addFiles: "Añadir", addFolder: "Carpeta", paste: "Pegar", resize: "Redimensionar", preview: "Vista previa", clear: "Limpiar", width: "Ancho", height: "Alto", unit: "Unidad", lock: "Bloquear ratio", fit: "Ajuste", dpi: "DPI", private: "100% privado", favorite: "Favorito", favorited: "Favorito", ai: "Consejos IA", apply: "Aplicar", undo: "Deshacer", redo: "Rehacer", batchZip: "ZIP", emptyHistory: "Sin historial.", presets: "Presets", upscale: "Ampliar", sharpen: "Enfocar", quality: "Calidad", format: "Formato" },
  de: { studio: "Studio", compare: "Vergleich", batch: "Stapel", history: "Verlauf", api: "API", drop: "Bilder ablegen", dropHint: "100% im Browser", addFiles: "Hinzufügen", addFolder: "Ordner", paste: "Einfügen", resize: "Größe ändern", preview: "Vorschau", clear: "Löschen", width: "Breite", height: "Höhe", unit: "Einheit", lock: "Seitenverhältnis", fit: "Modus", dpi: "DPI", private: "100% privat", favorite: "Favorit", favorited: "Favorit", ai: "KI-Tipps", apply: "Anwenden", undo: "Rückgängig", redo: "Wiederholen", batchZip: "ZIP", emptyHistory: "Kein Verlauf.", presets: "Presets", upscale: "Vergrößern", sharpen: "Schärfen", quality: "Qualität", format: "Format" },
  fr: { studio: "Studio", compare: "Comparer", batch: "Lot", history: "Historique", api: "API", drop: "Déposez images", dropHint: "100% navigateur", addFiles: "Ajouter", addFolder: "Dossier", paste: "Coller", resize: "Redimensionner", preview: "Aperçu", clear: "Effacer", width: "Largeur", height: "Hauteur", unit: "Unité", lock: "Ratio", fit: "Ajustement", dpi: "DPI", private: "100% privé", favorite: "Favori", favorited: "Favori", ai: "Conseils IA", apply: "Appliquer", undo: "Annuler", redo: "Rétablir", batchZip: "ZIP", emptyHistory: "Aucun.", presets: "Presets", upscale: "Agrandir", sharpen: "Netteté", quality: "Qualité", format: "Format" },
  tr: { studio: "Stüdyo", compare: "Karşılaştır", batch: "Toplu", history: "Geçmiş", api: "API", drop: "Görsel bırakın", dropHint: "%100 tarayıcı", addFiles: "Ekle", addFolder: "Klasör", paste: "Yapıştır", resize: "Yeniden boyutlandır", preview: "Önizleme", clear: "Temizle", width: "Genişlik", height: "Yükseklik", unit: "Birim", lock: "Oran kilidi", fit: "Sığdırma", dpi: "DPI", private: "%100 özel", favorite: "Favori", favorited: "Favori", ai: "AI ipuçları", apply: "Uygula", undo: "Geri", redo: "İleri", batchZip: "ZIP", emptyHistory: "Yok.", presets: "Ön ayarlar", upscale: "Büyüt", sharpen: "Keskinleştir", quality: "Kalite", format: "Format" },
  hi: { studio: "स्टूडियो", compare: "तुलना", batch: "बैच", history: "इतिहास", api: "API", drop: "छवियाँ छोड़ें", dropHint: "100% ब्राउज़र", addFiles: "जोड़ें", addFolder: "फ़ोल्डर", paste: "पेस्ट", resize: "आकार बदलें", preview: "पूर्वावलोकन", clear: "साफ़", width: "चौड़ाई", height: "ऊँचाई", unit: "इकाई", lock: "अनुपात लॉक", fit: "फ़िट", dpi: "DPI", private: "100% निजी", favorite: "पसंदीदा", favorited: "पसंदीदा", ai: "AI सुझाव", apply: "लागू", undo: "पूर्ववत", redo: "फिर", batchZip: "ZIP", emptyHistory: "कोई नहीं।", presets: "प्रीसेट", upscale: "अपस्केल", sharpen: "तेज़", quality: "गुणवत्ता", format: "प्रारूप" },
  pt: { studio: "Estúdio", compare: "Comparar", batch: "Lote", history: "Histórico", api: "API", drop: "Solte imagens", dropHint: "100% navegador", addFiles: "Adicionar", addFolder: "Pasta", paste: "Colar", resize: "Redimensionar", preview: "Prévia", clear: "Limpar", width: "Largura", height: "Altura", unit: "Unidade", lock: "Travar proporção", fit: "Ajuste", dpi: "DPI", private: "100% privado", favorite: "Favorito", favorited: "Favorito", ai: "Dicas IA", apply: "Aplicar", undo: "Desfazer", redo: "Refazer", batchZip: "ZIP", emptyHistory: "Nenhum.", presets: "Presets", upscale: "Ampliar", sharpen: "Nitidez", quality: "Qualidade", format: "Formato" },
  ja: { studio: "スタジオ", compare: "比較", batch: "一括", history: "履歴", api: "API", drop: "画像をドロップ", dropHint: "100%ブラウザ", addFiles: "追加", addFolder: "フォルダ", paste: "ペースト", resize: "リサイズ", preview: "プレビュー", clear: "消去", width: "幅", height: "高さ", unit: "単位", lock: "比率固定", fit: "フィット", dpi: "DPI", private: "100%プライベート", favorite: "お気に入り", favorited: "お気に入り", ai: "AIヒント", apply: "適用", undo: "元に戻す", redo: "やり直し", batchZip: "ZIP", emptyHistory: "なし。", presets: "プリセット", upscale: "拡大", sharpen: "シャープ", quality: "品質", format: "形式" },
};

const LANG_LABELS: Record<Lang, string> = { en: "English", es: "Español", de: "Deutsch", fr: "Français", tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語" };

const FIT_OPTIONS: { id: ResizeFit; label: string; hint: string }[] = [
  { id: "contain", label: "Contain (pad)", hint: "Fit inside with letterboxing" },
  { id: "cover", label: "Cover (crop)", hint: "Fill frame, crop edges" },
  { id: "content-aware", label: "Content-aware", hint: "Smart crop to subject" },
  { id: "stretch", label: "Stretch", hint: "Exact dimensions, may distort" },
];

const UNITS: SizeUnit[] = ["px", "%", "in", "cm", "mm"];

interface HistoryEntry { id: string; name: string; w: number; h: number; bytes: number; ts: number; }
interface SettingsSnapshot { dims: ResizeDimensions; transform: ResizeTransform; export: ResizeExportOptions; }

const SETTINGS_KEY = "toolnest-image-resize-settings";
const HISTORY_KEY = "toolnest-image-resize-history";
const LANG_KEY = "toolnest-image-resize-lang";

let _id = 0;
const nextId = () => `resize-${Date.now()}-${++_id}`;

export function ImageResize() {
  const favorites = useFavorites();
  const slug = "image-resize";

  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<SettingsSnapshot[]>([]);
  const redoStack = useRef<SettingsSnapshot[]>([]);

  const [items, setItems] = useState<ResizeItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("studio");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compareSlider, setCompareSlider] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lang, setLang] = useState<Lang>("en");
  const [presetCat, setPresetCat] = useState<SizePreset["category"] | "all">("all");

  const [dims, setDims] = useState<ResizeDimensions>({ ...DEFAULT_DIMENSIONS });
  const [transform, setTransform] = useState<ResizeTransform>({ ...DEFAULT_TRANSFORM });
  const [exportOpts, setExportOpts] = useState<ResizeExportOptions>({ ...DEFAULT_EXPORT });

  const t = (k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k;
  const active = items[activeIdx] ?? null;

  const outputSize = useMemo(() => {
    if (!active) return { outW: 0, outH: 0 };
    return computeOutputPixels(active.naturalW, active.naturalH, dims);
  }, [active, dims]);

  const recs = useMemo(() => {
    if (!active) return [];
    return aiResizeRecommendations(active.naturalW, active.naturalH, active.hasAlpha, dims, exportOpts);
  }, [active, dims, exportOpts]);

  const tips = useMemo(
    () => (active ? smartResizeTips(active.naturalW, active.naturalH, dims, items.length) : []),
    [active, dims, items.length],
  );

  const filteredPresets = useMemo(
    () => (presetCat === "all" ? SIZE_PRESETS : SIZE_PRESETS.filter((p) => p.category === presetCat)),
    [presetCat],
  );

  const snapshot = (): SettingsSnapshot => ({
    dims: { ...dims },
    transform: { ...transform },
    export: { ...exportOpts },
  });

  const pushUndo = useCallback(() => {
    undoStack.current = [...undoStack.current.slice(-24), snapshot()];
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [dims, transform, exportOpts]);

  const patchDims = (patch: Partial<ResizeDimensions>) => {
    pushUndo();
    setDims((d) => ({ ...d, ...patch }));
  };

  const patchTransform = (patch: Partial<ResizeTransform>) => {
    pushUndo();
    setTransform((tr) => ({ ...tr, ...patch }));
  };

  const undo = () => {
    const prev = undoStack.current.pop();
    if (prev) {
      redoStack.current.push(snapshot());
      setDims(prev.dims);
      setTransform(prev.transform);
      setExportOpts(prev.export);
      setCanUndo(undoStack.current.length > 0);
      setCanRedo(true);
    }
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (next) {
      undoStack.current.push(snapshot());
      setDims(next.dims);
      setTransform(next.transform);
      setExportOpts(next.export);
      setCanRedo(redoStack.current.length > 0);
      setCanUndo(true);
    }
  };

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(isSupportedInput);
    if (!files.length) {
      toast.error("No supported images found");
      return;
    }
    const loaded: ResizeItem[] = [];
    for (const file of files) {
      try {
        const meta = await loadImageMeta(file);
        loaded.push({
          id: nextId(),
          file,
          name: file.name,
          originalBytes: meta.bytes,
          naturalW: meta.w,
          naturalH: meta.h,
          thumbUrl: meta.thumbUrl,
          hasAlpha: meta.hasAlpha,
          status: "queued",
          resultUrl: "",
          resultBytes: 0,
          outputW: 0,
          outputH: 0,
        });
      } catch {
        toast.error(`Failed to load ${file.name}`);
      }
    }
    if (!loaded.length) return;
    setItems((prev) => [...prev, ...loaded]);
    if (!items.length) {
      const first = loaded[0]!;
      if (dims.lockAspect) {
        setDims((d) => ({ ...d, width: first.naturalW, height: first.naturalH }));
      }
    }
    toast.success(`${loaded.length} image(s) added`);
  };

  const applyPreset = (preset: SizePreset) => {
    pushUndo();
    setDims((d) => ({
      ...d,
      width: preset.width,
      height: preset.height,
      unit: preset.unit,
      lockAspect: true,
      fit: preset.category === "print" ? "contain" : "cover",
    }));
    toast.success(preset.label);
  };

  const applyRec = (rec: ResizeAiRec) => {
    pushUndo();
    if (rec.action === "webp") setExportOpts((o) => ({ ...o, format: "image/webp" }));
    else if (rec.action === "png") setExportOpts((o) => ({ ...o, format: "image/png", preserveTransparency: true }));
    else if (rec.action === "contain") setDims((d) => ({ ...d, fit: "contain" }));
    else if (rec.action === "cover") setDims((d) => ({ ...d, fit: "cover" }));
    else if (rec.action === "preset-hd") applyPreset(SIZE_PRESETS.find((p) => p.id === "hd")!);
    else if (rec.action === "half") setDims((d) => ({ ...d, width: Math.round(d.width / 2), height: Math.round(d.height / 2) }));
    else if (rec.action === "double") setDims((d) => ({ ...d, width: d.width * 2, height: d.height * 2, upscale: true }));
  };

  const runExport = async (download: boolean) => {
    if (!active) return;
    setBusy(true);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    try {
      const result = await resizeImage(active.file, dims, transform, exportOpts);
      if (download) {
        downloadBlob(result.blob, buildOutputName(active.name, result.format));
        setHistory((h) => [{ id: nextId(), name: active.name, w: result.width, h: result.height, bytes: result.bytes, ts: Date.now() }, ...h].slice(0, 20));
        toast.success(`${result.width}×${result.height} · ${formatBytes(result.bytes)}`);
      }
      setPreviewUrl(result.previewUrl);
      setItems((prev) =>
        prev.map((it, i) =>
          i === activeIdx
            ? { ...it, status: "done", resultUrl: result.previewUrl, resultBytes: result.bytes, outputW: result.width, outputH: result.height }
            : it,
        ),
      );
      if (!download) setTab("compare");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Resize failed");
    } finally {
      setBusy(false);
    }
  };

  const runBatchZip = async () => {
    if (!items.length) return;
    setBusy(true);
    try {
      const done = await resizeBatch(items, dims, transform, exportOpts);
      setItems(done);
      const ok = done.filter((i) => i.status === "done");
      if (!ok.length) {
        toast.error("Batch failed");
        return;
      }
      if (ok.length === 1) {
        const res = await fetch(ok[0]!.resultUrl);
        downloadBlob(await res.blob(), buildOutputName(ok[0]!.name, exportOpts.format));
      } else {
        const zip = await zipResizeResults(ok, exportOpts.format);
        downloadBlob(zip, "resized-images.zip");
      }
      toast.success(`Batch complete · ${ok.length} file(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
      patchTransform({ rotation: ((transform.rotation + 90) % 360) as Rotation });
    }
    if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) || (e.key === "y" && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      redo();
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<SettingsSnapshot>;
        if (s.dims) setDims({ ...DEFAULT_DIMENSIONS, ...s.dims });
        if (s.export) setExportOpts({ ...DEFAULT_EXPORT, ...s.export });
      }
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h) as HistoryEntry[]);
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ dims, export: exportOpts }));
  }, [dims, exportOpts]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  return (
    <div className="mx-auto max-w-6xl space-y-6" onKeyDown={onKeyDown} tabIndex={0}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t("private")}</p>
        <div className="flex items-center gap-2">
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={cn(inputClass(), "w-auto py-1.5 text-xs")} aria-label="Language">
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
          <button type="button" onClick={() => favorites.toggle(slug)} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium", favorites.isFavorite(slug) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted")}>
            <Star className={cn("h-3.5 w-3.5", favorites.isFavorite(slug) && "fill-current")} />
            {favorites.isFavorite(slug) ? t("favorited") : t("favorite")}
          </button>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files); }}
        className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center sm:p-10", dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50")}
      >
        <UploadCloud className="mb-3 h-10 w-10 text-primary" />
        <p className="font-display text-lg font-semibold">Ultra Image Resize Studio</p>
        <p className="mt-1 text-sm text-muted">{t("dropHint")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}><UploadCloud className="h-4 w-4" /> {t("addFiles")}</Button>
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); folderRef.current?.click(); }}><FolderUp className="h-4 w-4" /> {t("addFolder")}</Button>
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); toast.info("Ctrl+V to paste"); }}><ClipboardPaste className="h-4 w-4" /> {t("paste")}</Button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={folderRef} type="file" accept="image/*" multiple className="hidden" {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {items.length > 0 && (
        <>
          {tips.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <p className="mb-1 flex items-center gap-2 font-medium text-primary"><ScanLine className="h-4 w-4" /> Smart resize assist</p>
              <ul className="list-inside list-disc text-muted">{tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
            </div>
          )}

          <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
            {items.map((it, i) => (
              <button key={it.id} type="button" onClick={() => setActiveIdx(i)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs", i === activeIdx ? "bg-primary text-white" : "text-muted hover:bg-muted/30")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.thumbUrl} alt="" className="h-8 w-8 rounded object-cover" />
                <span className="max-w-[80px] truncate">{it.name}</span>
              </button>
            ))}
            <button type="button" onClick={() => setItems([])} className="ml-auto shrink-0 px-3 py-2 text-xs text-error"><Trash2 className="h-4 w-4" /></button>
          </div>

          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(["studio", "compare", "batch", "history", "api"] as Tab[]).map((key) => (
              <button key={key} type="button" onClick={() => setTab(key)} className={cn("flex flex-1 items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium capitalize", tab === key ? "bg-primary text-white" : "text-muted hover:text-foreground")}>{t(key)}</button>
            ))}
          </div>

          {tab === "studio" && active && (
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-2xl border border-border bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] dark:bg-[repeating-conic-gradient(#374151_0%_25%,transparent_0%_50%)]">
                  <div className="flex min-h-[280px] items-center justify-center p-4" style={{ transform: `scale(${zoom})` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={active.thumbUrl} alt="Preview" className="max-h-[420px] max-w-full object-contain shadow-lg" style={{ transform: `rotate(${transform.rotation}deg) scaleX(${transform.flipH ? -1 : 1}) scaleY(${transform.flipV ? -1 : 1})` }} />
                  </div>
                  <div className="absolute bottom-3 right-3 flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
                  </div>
                </div>
                <p className="text-center text-xs text-muted">
                  {active.naturalW}×{active.naturalH} → {outputSize.outW}×{outputSize.outH} px
                  {dims.unit !== "px" && ` · ${dims.dpi} DPI`}
                </p>
              </div>

              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => patchTransform({ rotation: ((transform.rotation + 90) % 360) as Rotation })}><RotateCw className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => patchTransform({ flipH: !transform.flipH })}><FlipHorizontal2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => patchTransform({ flipV: !transform.flipV })}><FlipVertical2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={undo} disabled={!canUndo}><Undo2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={redo} disabled={!canRedo}><Redo2 className="h-3.5 w-3.5" /></Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("width")}>
                    <input type="number" min={1} value={dims.width} onChange={(e) => {
                      const w = Number(e.target.value);
                      if (dims.lockAspect && active) {
                        const ratio = active.naturalW / active.naturalH;
                        patchDims({ width: w, height: Math.round(w / ratio) });
                      } else patchDims({ width: w });
                    }} className={inputClass()} />
                  </Field>
                  <Field label={t("height")}>
                    <input type="number" min={1} value={dims.height} onChange={(e) => {
                      const h = Number(e.target.value);
                      if (dims.lockAspect && active) {
                        const ratio = active.naturalW / active.naturalH;
                        patchDims({ height: h, width: Math.round(h * ratio) });
                      } else patchDims({ height: h });
                    }} className={inputClass()} />
                  </Field>
                </div>

                <Field label={t("unit")}>
                  <select value={dims.unit} onChange={(e) => patchDims({ unit: e.target.value as SizeUnit })} className={inputClass()}>
                    {UNITS.map((u) => <option key={u} value={u}>{u === "px" ? "Pixels" : u === "%" ? "Percent" : u === "in" ? "Inches" : u === "cm" ? "Centimeters" : "Millimeters"}</option>)}
                  </select>
                </Field>

                {(dims.unit === "in" || dims.unit === "cm" || dims.unit === "mm") && (
                  <Field label={t("dpi")}>
                    <input type="number" min={72} max={600} value={dims.dpi} onChange={(e) => patchDims({ dpi: Number(e.target.value) })} className={inputClass()} />
                  </Field>
                )}

                <label className="flex items-center gap-2 text-sm">
                  <button type="button" onClick={() => patchDims({ lockAspect: !dims.lockAspect })} className="text-primary">
                    {dims.lockAspect ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  </button>
                  {t("lock")}
                </label>

                <Field label={t("fit")}>
                  <div className="grid gap-1">
                    {FIT_OPTIONS.map((f) => (
                      <button key={f.id} type="button" onClick={() => patchDims({ fit: f.id })} className={cn("rounded-lg border px-3 py-2 text-left text-xs", dims.fit === f.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50")}>
                        <span className="font-medium">{f.label}</span>
                        <span className="ml-1 text-muted">— {f.hint}</span>
                      </button>
                    ))}
                  </div>
                </Field>

                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dims.upscale} onChange={(e) => patchDims({ upscale: e.target.checked })} className="accent-[var(--primary)]" /> {t("upscale")}</label>

                <div>
                  <p className="mb-2 text-sm font-medium">{t("presets")}</p>
                  <div className="mb-2 flex flex-wrap gap-1">
                    {(["all", "social", "print", "web", "video"] as const).map((c) => (
                      <button key={c} type="button" onClick={() => setPresetCat(c)} className={cn("rounded px-2 py-0.5 text-[10px] capitalize", presetCat === c ? "bg-primary text-white" : "bg-muted/30 text-muted")}>{c}</button>
                    ))}
                  </div>
                  <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                    {filteredPresets.map((p) => (
                      <button key={p.id} type="button" onClick={() => applyPreset(p)} className="rounded-lg border border-border px-2 py-1 text-[10px] hover:border-primary">{p.label}</button>
                    ))}
                  </div>
                </div>

                <Field label={t("format")}>
                  <select value={exportOpts.format} onChange={(e) => setExportOpts((o) => ({ ...o, format: e.target.value as OutputFormat }))} className={inputClass()}>
                    {Object.entries(FORMAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                {LOSSY_FORMATS.includes(exportOpts.format) && (
                  <Field label={t("quality")}><input type="range" min={10} max={100} value={Math.round(exportOpts.quality * 100)} onChange={(e) => setExportOpts((o) => ({ ...o, quality: Number(e.target.value) / 100 }))} className="w-full accent-[var(--primary)]" /></Field>
                )}
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={exportOpts.sharpen} onChange={(e) => setExportOpts((o) => ({ ...o, sharpen: e.target.checked }))} className="accent-[var(--primary)]" /> {t("sharpen")}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={exportOpts.preserveTransparency} onChange={(e) => setExportOpts((o) => ({ ...o, preserveTransparency: e.target.checked }))} className="accent-[var(--primary)]" /> Preserve transparency</label>

                {recs.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4" /> {t("ai")}</p>
                    {recs.map((r, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 text-xs">
                        <div><p className="font-medium">{r.title}</p><p className="text-muted">{r.detail}</p></div>
                        {r.action && <Button size="sm" variant="outline" onClick={() => applyRec(r)}>{t("apply")}</Button>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button variant="gradient" disabled={busy} onClick={() => void runExport(true)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("resize")}</Button>
                  <Button variant="outline" disabled={busy} onClick={() => void runExport(false)}><Eye className="h-4 w-4" /> {t("preview")}</Button>
                </div>
              </div>
            </div>
          )}

          {tab === "compare" && active && (
            <div className="space-y-4">
              {previewUrl ? (
                <div className="relative overflow-hidden rounded-2xl border border-border">
                  <div className="grid grid-cols-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={active.thumbUrl} alt="Before" className="w-full object-contain bg-muted/10 p-2" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="After" className="w-full object-contain bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-2" />
                  </div>
                  <p className="border-t border-border bg-card px-4 py-2 text-center text-xs text-muted">Before · After ({outputSize.outW}×{outputSize.outH})</p>
                </div>
              ) : (
                <p className="py-16 text-center text-muted">Run Preview or Resize first.</p>
              )}
              <input type="range" min={0} max={100} value={compareSlider} onChange={(e) => setCompareSlider(Number(e.target.value))} className="w-full accent-[var(--primary)]" aria-label="Compare slider" />
            </div>
          )}

          {tab === "batch" && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <p className="text-sm text-muted">{items.length} file(s) — same resize settings applied to all.</p>
              <Button variant="gradient" disabled={busy} onClick={() => void runBatchZip()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} {t("batchZip")}</Button>
              <ul className="divide-y divide-border text-sm">
                {items.map((it) => (
                  <li key={it.id} className="flex justify-between py-2">
                    <span className="truncate">{it.name}</span>
                    <span className={cn("text-xs", it.status === "done" ? "text-success" : it.status === "error" ? "text-error" : "text-muted")}>
                      {it.status === "done" ? `${it.outputW}×${it.outputH}` : it.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "history" && (
            <div className="rounded-xl border border-border bg-card p-4">
              {history.length === 0 ? <p className="py-8 text-center text-muted">{t("emptyHistory")}</p> : (
                <ul className="divide-y divide-border text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex justify-between py-2"><span>{h.name}</span><span className="text-muted">{h.w}×{h.h} · {formatBytes(h.bytes)}</span></li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 font-medium"><Shield className="h-4 w-4 text-primary" /> REST API — POST /api/v1/image/resize</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`POST /api/v1/image/resize
{
  "image": "base64...",
  "width": 1920,
  "height": 1080,
  "unit": "px",
  "fit": "contain",
  "rotate": 90,
  "format": "image/webp",
  "quality": 0.92
}`}</pre>
              <p className="text-xs text-muted">Limit: 25 MB · Studio runs 100% client-side</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
