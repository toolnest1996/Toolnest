"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ClipboardPaste,
  Download,
  Eye,
  FileArchive,
  FolderUp,
  History,
  Loader2,
  Move,
  Redo2,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  UploadCloud,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  DEFAULT_VECTOR,
  TRACE_PRESET_CATALOG,
  VECTOR_MODE_PRESETS,
  aiVectorRecommendations,
  analyzeImageData,
  applyModePreset,
  exportVectorResult,
  fileToImageData,
  isSupportedVectorInput,
  mergeVectorSettings,
  vectorizeBatch,
  vectorizeFile,
  vectorizeInWorker,
  zipVectorExports,
  type ExportVectorFormat,
  type VectorMode,
  type VectorResult,
  type VectorSettings,
} from "./png-to-svg-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";
type Tab = "studio" | "preview" | "batch" | "history" | "api";

interface ImageItem {
  id: string;
  file: File;
  name: string;
  bytes: number;
  thumbUrl: string;
  width: number;
  height: number;
}

interface HistoryEntry {
  id: string;
  name: string;
  format: ExportVectorFormat;
  bytes: number;
  paths: number;
  ts: number;
}

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", preview: "Preview", batch: "Batch", history: "History", api: "API",
    drop: "Drop images, paste, or browse", dropHint: "PNG · JPG · WebP · BMP · GIF · ICO · TIFF — 100% in-browser",
    addFiles: "Add files", addFolder: "Add folder", paste: "Paste image", clear: "Clear all",
    vectorize: "Vectorize & Download", previewBtn: "Preview trace", format: "Export format",
    private: "100% private · Web Worker accelerated", favorite: "Favorite", favorited: "Favorited",
    undo: "Undo", redo: "Redo", batchZip: "Batch export ZIP", emptyHistory: "No exports yet.",
    mode: "Vector mode", preset: "Trace preset", colors: "Colors", aiApply: "Apply AI recommendation",
    before: "Original", after: "Vector", compare: "Compare", zoom: "Zoom", pan: "Drag to pan",
    removeBg: "Remove background", preserveAlpha: "Preserve transparency", layerGroups: "Layer groups",
    worker: "Web Worker", paths: "Paths", layers: "Layers", palette: "Palette",
  },
  es: {
    studio: "Estudio", preview: "Vista previa", batch: "Lote", history: "Historial", api: "API",
    drop: "Suelta imágenes", dropHint: "100% en el navegador",
    addFiles: "Añadir", addFolder: "Carpeta", paste: "Pegar", clear: "Limpiar",
    vectorize: "Vectorizar", previewBtn: "Vista previa", format: "Formato",
    private: "100% privado", favorite: "Favorito", favorited: "Favorito",
    undo: "Deshacer", redo: "Rehacer", batchZip: "ZIP lote", emptyHistory: "Sin historial.",
    mode: "Modo", preset: "Preset", colors: "Colores", aiApply: "Aplicar IA",
    before: "Original", after: "Vector", compare: "Comparar", zoom: "Zoom", pan: "Arrastrar",
    removeBg: "Quitar fondo", preserveAlpha: "Transparencia", layerGroups: "Capas",
    worker: "Web Worker", paths: "Trazos", layers: "Capas", palette: "Paleta",
  },
  de: {
    studio: "Studio", preview: "Vorschau", batch: "Stapel", history: "Verlauf", api: "API",
    drop: "Bilder ablegen", dropHint: "100% im Browser",
    addFiles: "Hinzufügen", addFolder: "Ordner", paste: "Einfügen", clear: "Löschen",
    vectorize: "Vektorisieren", previewBtn: "Vorschau", format: "Format",
    private: "100% privat", favorite: "Favorit", favorited: "Favorit",
    undo: "Rückgängig", redo: "Wiederholen", batchZip: "Stapel-ZIP", emptyHistory: "Kein Verlauf.",
    mode: "Modus", preset: "Preset", colors: "Farben", aiApply: "KI anwenden",
    before: "Original", after: "Vektor", compare: "Vergleich", zoom: "Zoom", pan: "Ziehen",
    removeBg: "Hintergrund entfernen", preserveAlpha: "Transparenz", layerGroups: "Ebenen",
    worker: "Web Worker", paths: "Pfade", layers: "Ebenen", palette: "Palette",
  },
  fr: {
    studio: "Studio", preview: "Aperçu", batch: "Lot", history: "Historique", api: "API",
    drop: "Déposez vos images", dropHint: "100% dans le navigateur",
    addFiles: "Ajouter", addFolder: "Dossier", paste: "Coller", clear: "Effacer",
    vectorize: "Vectoriser", previewBtn: "Aperçu", format: "Format",
    private: "100% privé", favorite: "Favori", favorited: "Favori",
    undo: "Annuler", redo: "Rétablir", batchZip: "ZIP lot", emptyHistory: "Aucun historique.",
    mode: "Mode", preset: "Preset", colors: "Couleurs", aiApply: "Appliquer IA",
    before: "Original", after: "Vecteur", compare: "Comparer", zoom: "Zoom", pan: "Glisser",
    removeBg: "Supprimer fond", preserveAlpha: "Transparence", layerGroups: "Calques",
    worker: "Web Worker", paths: "Tracés", layers: "Calques", palette: "Palette",
  },
  tr: {
    studio: "Stüdyo", preview: "Önizleme", batch: "Toplu", history: "Geçmiş", api: "API",
    drop: "Görüntüleri bırakın", dropHint: "%100 tarayıcıda",
    addFiles: "Ekle", addFolder: "Klasör", paste: "Yapıştır", clear: "Temizle",
    vectorize: "Vektörleştir", previewBtn: "Önizleme", format: "Format",
    private: "%100 özel", favorite: "Favori", favorited: "Favori",
    undo: "Geri", redo: "İleri", batchZip: "Toplu ZIP", emptyHistory: "Geçmiş yok.",
    mode: "Mod", preset: "Preset", colors: "Renkler", aiApply: "AI uygula",
    before: "Orijinal", after: "Vektör", compare: "Karşılaştır", zoom: "Yakınlaştır", pan: "Sürükle",
    removeBg: "Arka plan kaldır", preserveAlpha: "Şeffaflık", layerGroups: "Katmanlar",
    worker: "Web Worker", paths: "Yollar", layers: "Katmanlar", palette: "Palet",
  },
  hi: {
    studio: "स्टूडियो", preview: "पूर्वावलोकन", batch: "बैच", history: "इतिहास", api: "API",
    drop: "छवियाँ छोड़ें", dropHint: "100% ब्राउज़र में",
    addFiles: "जोड़ें", addFolder: "फ़ोल्डर", paste: "पेस्ट", clear: "साफ़",
    vectorize: "वेक्टराइज़", previewBtn: "पूर्वावलोकन", format: "प्रारूप",
    private: "100% निजी", favorite: "पसंदीदा", favorited: "पसंदीदा",
    undo: "पूर्ववत", redo: "फिर", batchZip: "ZIP", emptyHistory: "कोई इतिहास नहीं।",
    mode: "मोड", preset: "प्रीसेट", colors: "रंग", aiApply: "AI लागू",
    before: "मूल", after: "वेक्टर", compare: "तुलना", zoom: "ज़ूम", pan: "खींचें",
    removeBg: "पृष्ठभूमि हटाएँ", preserveAlpha: "पारदर्शिता", layerGroups: "लेयर",
    worker: "Web Worker", paths: "पथ", layers: "लेयर", palette: "पैलेट",
  },
  pt: {
    studio: "Estúdio", preview: "Prévia", batch: "Lote", history: "Histórico", api: "API",
    drop: "Solte imagens", dropHint: "100% no navegador",
    addFiles: "Adicionar", addFolder: "Pasta", paste: "Colar", clear: "Limpar",
    vectorize: "Vetorizar", previewBtn: "Prévia", format: "Formato",
    private: "100% privado", favorite: "Favorito", favorited: "Favorito",
    undo: "Desfazer", redo: "Refazer", batchZip: "ZIP lote", emptyHistory: "Sem histórico.",
    mode: "Modo", preset: "Preset", colors: "Cores", aiApply: "Aplicar IA",
    before: "Original", after: "Vetor", compare: "Comparar", zoom: "Zoom", pan: "Arrastar",
    removeBg: "Remover fundo", preserveAlpha: "Transparência", layerGroups: "Camadas",
    worker: "Web Worker", paths: "Caminhos", layers: "Camadas", palette: "Paleta",
  },
  ja: {
    studio: "スタジオ", preview: "プレビュー", batch: "一括", history: "履歴", api: "API",
    drop: "画像をドロップ", dropHint: "100%ブラウザ内処理",
    addFiles: "追加", addFolder: "フォルダ", paste: "ペースト", clear: "消去",
    vectorize: "ベクター化", previewBtn: "プレビュー", format: "形式",
    private: "100%プライベート", favorite: "お気に入り", favorited: "お気に入り",
    undo: "元に戻す", redo: "やり直し", batchZip: "一括ZIP", emptyHistory: "履歴なし。",
    mode: "モード", preset: "プリセット", colors: "色数", aiApply: "AI適用",
    before: "原画", after: "ベクター", compare: "比較", zoom: "ズーム", pan: "ドラッグ",
    removeBg: "背景除去", preserveAlpha: "透明度", layerGroups: "レイヤー",
    worker: "Web Worker", paths: "パス", layers: "レイヤー", palette: "パレット",
  },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français",
  tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

const SETTINGS_KEY = "toolnest-png-to-svg-settings";
const HISTORY_KEY = "toolnest-png-to-svg-history";
const LANG_KEY = "toolnest-png-to-svg-lang";

let _id = 0;
const nextId = () => `vec-${Date.now()}-${++_id}`;

export function PngToSvg() {
  const favorites = useFavorites();
  const slug = "png-to-svg";

  const [tab, setTab] = useState<Tab>("studio");
  const [lang, setLang] = useState<Lang>("en");
  const [items, setItems] = useState<ImageItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettings] = useState<VectorSettings>({ ...DEFAULT_VECTOR });
  const [settingsStack, setSettingsStack] = useState<VectorSettings[]>([]);
  const [redoStack, setRedoStack] = useState<VectorSettings[]>([]);
  const [result, setResult] = useState<VectorResult | null>(null);
  const [aiTips, setAiTips] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [useWorker, setUseWorker] = useState(true);
  const [comparePos, setComparePos] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const panning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const t = STRINGS[lang];
  const active = items.find((i) => i.id === activeId) ?? items[0] ?? null;

  const s = useCallback((patch: Partial<VectorSettings>) => {
    setSettings((prev) => {
      setSettingsStack((st) => [...st.slice(-30), prev]);
      setRedoStack([]);
      return { ...prev, ...patch };
    });
  }, []);

  const undo = () => {
    setSettingsStack((st) => {
      if (!st.length) return st;
      const prev = st[st.length - 1]!;
      setSettings((cur) => {
        setRedoStack((r) => [...r, cur]);
        return prev;
      });
      return st.slice(0, -1);
    });
  };

  const redo = () => {
    setRedoStack((r) => {
      if (!r.length) return r;
      const next = r[r.length - 1]!;
      setSettings((cur) => {
        setSettingsStack((st) => [...st, cur]);
        return next;
      });
      return r.slice(0, -1);
    });
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) setSettings({ ...DEFAULT_VECTOR, ...JSON.parse(saved) });
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h) as HistoryEntry[]);
      const l = localStorage.getItem(LANG_KEY) as Lang;
      if (l && STRINGS[l]) setLang(l);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const pushHistory = (entry: HistoryEntry) => {
    setHistory((h) => {
      const next = [entry, ...h].slice(0, 50);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const addFiles = async (files: FileList | File[]) => {
    const accepted: ImageItem[] = [];
    for (const file of Array.from(files)) {
      if (!isSupportedVectorInput(file)) continue;
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
        accepted.push({
          id: nextId(),
          file,
          name: file.name,
          bytes: file.size,
          thumbUrl: URL.createObjectURL(file),
          width: bmp.width,
          height: bmp.height,
        });
        bmp.close();
      } catch {
        toast.error(`${file.name}: decode failed`);
      }
    }
    if (!accepted.length) return toast.error("No supported images");
    setItems((p) => [...p, ...accepted]);
    if (!activeId) setActiveId(accepted[0]!.id);
    toast.success(`${accepted.length} image(s) added`);
    void runAiAnalysis(accepted[0]!.file);
  };

  const runAiAnalysis = async (file: File) => {
    try {
      const data = await fileToImageData(file, settings);
      const analysis = analyzeImageData(data);
      const rec = aiVectorRecommendations(analysis);
      setAiTips(rec.tips);
      if (settings.mode === "auto") {
        s(mergeVectorSettings(settings, rec.settings));
      }
    } catch { /* optional */ }
  };

  const applyAi = async () => {
    if (!active) return;
    const data = await fileToImageData(active.file, settings);
    const rec = aiVectorRecommendations(analyzeImageData(data));
    s(mergeVectorSettings(settings, rec.settings));
    toast.success(rec.label);
  };

  const runPreview = async () => {
    if (!active) return toast.error("Add an image");
    setBusy(true);
    setResult(null);
    try {
      const applied = settings.mode !== "auto" ? applyModePreset(settings, settings.mode) : settings;
      let res: VectorResult | null = null;
      if (useWorker) res = await vectorizeInWorker(active.file, applied);
      if (!res) res = await vectorizeFile(active.file, applied);
      setResult(res);
      toast.success(`Trace ready · ${res.pathCount} paths`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Trace failed");
    } finally {
      setBusy(false);
    }
  };

  const exportOne = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const applied = settings.mode !== "auto" ? applyModePreset(settings, settings.mode) : settings;
      let res = result;
      if (!res || active.id !== activeId) {
        if (useWorker) res = (await vectorizeInWorker(active.file, applied)) ?? (await vectorizeFile(active.file, applied));
        else res = await vectorizeFile(active.file, applied);
      }
      const base = active.name.replace(/\.[^.]+$/i, "");
      const { blob, filename } = await exportVectorResult(res, settings.exportFormat, base);
      downloadBlob(blob, filename);
      pushHistory({
        id: nextId(),
        name: filename,
        format: settings.exportFormat,
        bytes: blob.size,
        paths: res.pathCount,
        ts: Date.now(),
      });
      toast.success("Download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const exportBatch = async () => {
    if (!items.length) return;
    setBusy(true);
    setProgress(0);
    try {
      const applied = settings.mode !== "auto" ? applyModePreset(settings, settings.mode) : settings;
      const batch = await vectorizeBatch(
        items.map((i) => i.file),
        applied,
        (d, tot) => setProgress(Math.round((d / tot) * 100)),
        useWorker,
      );
      const exports: { name: string; blob: Blob }[] = [];
      for (const row of batch) {
        const base = row.name.replace(/\.svg$/i, "");
        const { blob, filename } = await exportVectorResult(row.result, settings.exportFormat, base);
        exports.push({ name: filename, blob });
      }
      if (exports.length === 1) {
        downloadBlob(exports[0]!.blob, exports[0]!.name);
      } else {
        downloadBlob(await zipVectorExports(exports), `vector-export-${settings.exportFormat}.zip`);
      }
      toast.success(`Exported ${exports.length} file(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  };

  const onPaste = useCallback((e: ClipboardEvent) => {
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
  }, []);

  useEffect(() => {
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onPaste]);

  const svgPreviewUrl = useMemo(() => {
    if (!result?.svg) return "";
    return URL.createObjectURL(new Blob([result.svg], { type: "image/svg+xml" }));
  }, [result?.svg]);

  useEffect(() => () => { if (svgPreviewUrl) URL.revokeObjectURL(svgPreviewUrl); }, [svgPreviewUrl]);

  const onPanStart = (e: ReactPointerEvent) => {
    if (zoom <= 1) return;
    panning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPanMove = (e: ReactPointerEvent) => {
    if (!panning.current) return;
    setPan({
      x: panStart.current.px + (e.clientX - panStart.current.x),
      y: panStart.current.py + (e.clientY - panStart.current.y),
    });
  };

  const onPanEnd = () => { panning.current = false; };

  const tabs: { id: Tab; icon: typeof Eye }[] = [
    { id: "studio", icon: Wand2 },
    { id: "preview", icon: Eye },
    { id: "batch", icon: FileArchive },
    { id: "history", icon: History },
    { id: "api", icon: Sparkles },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">
            <Sparkles className="mr-1 inline h-4 w-4 text-primary" />
            Ultra PNG to SVG Vector Studio · {t.private}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={lang}
            onChange={(e) => {
              const v = e.target.value as Lang;
              setLang(v);
              localStorage.setItem(LANG_KEY, v);
            }}
            className={cn(inputClass(), "w-auto py-1.5 text-xs")}
            aria-label="Language"
          >
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
              <option key={l} value={l}>{LANG_LABELS[l]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => favorites.toggle(slug)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs",
              favorites.isFavorite(slug) ? "border-primary text-primary" : "border-border",
            )}
          >
            <Star className="inline h-3.5 w-3.5" /> {favorites.isFavorite(slug) ? t.favorited : t.favorite}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {tabs.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors",
              tab === id ? "bg-primary text-white" : "text-muted hover:bg-card-hover hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {t[id] ?? id}
          </button>
        ))}
      </div>

      {/* Studio tab */}
      {tab === "studio" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border bg-card",
              )}
            >
              <UploadCloud className="mx-auto mb-3 h-10 w-10 text-muted" />
              <p className="font-medium">{t.drop}</p>
              <p className="mt-1 text-sm text-muted">{t.dropHint}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => inputRef.current?.click()}><UploadCloud className="h-4 w-4" /> {t.addFiles}</Button>
                <Button variant="outline" onClick={() => folderRef.current?.click()}><FolderUp className="h-4 w-4" /> {t.addFolder}</Button>
                <Button variant="outline" onClick={() => toast.info("Ctrl+V to paste")}><ClipboardPaste className="h-4 w-4" /> {t.paste}</Button>
              </div>
              <input ref={inputRef} type="file" accept="image/*,.ico,.tiff,.tif" multiple className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
              <input ref={folderRef} type="file" accept="image/*" multiple className="hidden" {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
            </div>

            {items.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium">{items.length} file(s)</span>
                  <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => { items.forEach((i) => URL.revokeObjectURL(i.thumbUrl)); setItems([]); setActiveId(null); setResult(null); }}>
                    <Trash2 className="inline h-3.5 w-3.5" /> {t.clear}
                  </button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setActiveId(item.id); void runAiAnalysis(item.file); }}
                      className={cn(
                        "shrink-0 rounded-lg border p-1 transition-colors",
                        active?.id === item.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.thumbUrl} alt="" className="h-16 w-16 rounded object-cover" />
                      <p className="mt-1 max-w-[72px] truncate text-[10px]">{item.name}</p>
                    </button>
                  ))}
                </div>
                {active && (
                  <p className="mt-2 text-xs text-muted">
                    {active.width}×{active.height} · {formatBytes(active.bytes)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Settings panel */}
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={undo} disabled={!settingsStack.length}><Undo2 className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="outline" onClick={redo} disabled={!redoStack.length}><Redo2 className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="outline" onClick={() => void applyAi()} disabled={!active}><Sparkles className="h-3.5 w-3.5" /> {t.aiApply}</Button>
            </div>

            {aiTips.length > 0 && (
              <ul className="space-y-1 rounded-lg bg-muted/10 p-3 text-xs text-muted">
                {aiTips.map((tip) => <li key={tip}>• {tip}</li>)}
              </ul>
            )}

            <Field label={t.mode}>
              <select
                value={settings.mode}
                onChange={(e) => {
                  const mode = e.target.value as VectorMode;
                  s({ ...applyModePreset(settings, mode), mode });
                }}
                className={inputClass()}
              >
                {VECTOR_MODE_PRESETS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label} — {m.desc}</option>
                ))}
              </select>
            </Field>

            <Field label={t.preset}>
              <select value={settings.preset} onChange={(e) => s({ preset: e.target.value as VectorSettings["preset"] })} className={inputClass()}>
                {TRACE_PRESET_CATALOG.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </Field>

            <Field label={t.colors}>
              <input type="range" min={2} max={64} value={settings.numberofcolors} onChange={(e) => s({ numberofcolors: Number(e.target.value) })} className="w-full" />
              <span className="text-xs text-muted">{settings.numberofcolors}</span>
            </Field>

            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-muted hover:text-foreground">Advanced trace settings</summary>
              <div className="mt-3 space-y-3">
                <Field label="Line threshold (ltres)">
                  <input type="range" min={0.01} max={2} step={0.01} value={settings.ltres} onChange={(e) => s({ ltres: Number(e.target.value) })} className="w-full" />
                </Field>
                <Field label="Curve threshold (qtres)">
                  <input type="range" min={0.01} max={2} step={0.01} value={settings.qtres} onChange={(e) => s({ qtres: Number(e.target.value) })} className="w-full" />
                </Field>
                <Field label="Path omit">
                  <input type="range" min={0} max={20} value={settings.pathomit} onChange={(e) => s({ pathomit: Number(e.target.value) })} className="w-full" />
                </Field>
                <Field label="Noise reduction">
                  <input type="range" min={0} max={100} value={settings.noiseReduction} onChange={(e) => s({ noiseReduction: Number(e.target.value) })} className="w-full" />
                </Field>
                <Field label="Blur radius">
                  <input type="range" min={0} max={5} value={settings.blurradius} onChange={(e) => s({ blurradius: Number(e.target.value) })} className="w-full" />
                </Field>
                <Field label="Max dimension">
                  <select value={settings.maxDimension} onChange={(e) => s({ maxDimension: Number(e.target.value) })} className={inputClass()}>
                    <option value={1024}>1024px</option>
                    <option value={2048}>2048px</option>
                    <option value={4096}>4096px</option>
                    <option value={8192}>8192px</option>
                  </select>
                </Field>
              </div>
            </details>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.removeBackground} onChange={(e) => s({ removeBackground: e.target.checked })} />
              {t.removeBg}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.preserveTransparency} onChange={(e) => s({ preserveTransparency: e.target.checked })} />
              {t.preserveAlpha}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.edgeEnhance} onChange={(e) => s({ edgeEnhance: e.target.checked })} />
              Edge enhance (line art)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.layerGroups} onChange={(e) => s({ layerGroups: e.target.checked })} />
              {t.layerGroups}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={settings.simplifyPaths} onChange={(e) => s({ simplifyPaths: e.target.checked })} />
              Path simplification
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useWorker} onChange={(e) => setUseWorker(e.target.checked)} />
              {t.worker}
            </label>

            <Field label={t.format}>
              <select value={settings.exportFormat} onChange={(e) => s({ exportFormat: e.target.value as ExportVectorFormat })} className={inputClass()}>
                <option value="svg">SVG</option>
                <option value="svg-ai">SVG (Illustrator / Inkscape)</option>
                <option value="eps">EPS</option>
                <option value="pdf">PDF</option>
              </select>
            </Field>

            <div className="flex flex-col gap-2 pt-2">
              <Button variant="outline" disabled={busy || !active} onClick={() => void runPreview()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} {t.previewBtn}
              </Button>
              <Button variant="gradient" disabled={busy || !active} onClick={() => void exportOne()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t.vectorize}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview tab */}
      {tab === "preview" && (
        <div className="space-y-4">
          {!active ? (
            <p className="py-12 text-center text-muted">Upload an image in Studio first.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
                <span className="text-xs text-muted">{Math.round(zoom * 100)}%</span>
                <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Move className="h-4 w-4" /> Reset</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void runPreview()}>{t.previewBtn}</Button>
                {result && (
                  <span className="ml-auto text-xs text-muted">
                    {result.pathCount} {t.paths} · {result.layerCount} {t.layers} · {formatBytes(result.bytes)}
                  </span>
                )}
              </div>

              <div
                ref={previewRef}
                className="relative overflow-hidden rounded-xl border border-border bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
                style={{ minHeight: 400 }}
                onPointerDown={onPanStart}
                onPointerMove={onPanMove}
                onPointerUp={onPanEnd}
                onPointerLeave={onPanEnd}
              >
                <div
                  className="relative mx-auto flex max-w-full"
                  style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "center center" }}
                >
                  {/* Before/after slider */}
                  <div className="relative flex w-full max-w-3xl">
                    <div className="relative aspect-square w-full max-h-[520px] overflow-hidden rounded-lg border border-border bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={active.thumbUrl} alt={t.before} className="absolute inset-0 h-full w-full object-contain" />
                      {svgPreviewUrl && (
                        <div
                          className="absolute inset-0 overflow-hidden border-l-2 border-primary bg-white"
                          style={{ clipPath: `inset(0 0 0 ${comparePos}%)` }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={svgPreviewUrl} alt={t.after} className="h-full w-full object-contain" />
                        </div>
                      )}
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={comparePos}
                        onChange={(e) => setComparePos(Number(e.target.value))}
                        className="absolute inset-x-4 bottom-4 z-10"
                        aria-label={t.compare}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-center text-xs text-muted">{t.compare} — drag slider · {t.pan} when zoomed</p>
            </>
          )}
        </div>
      )}

      {/* Batch tab */}
      {tab === "batch" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6">
          <p className="text-sm">{items.length} file(s) queued for batch export as {settings.exportFormat.toUpperCase()}</p>
          {items.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted"><th className="py-2">File</th><th>Size</th><th>Dimensions</th></tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-b border-border/50">
                      <td className="py-2 pr-4">{i.name}</td>
                      <td>{formatBytes(i.bytes)}</td>
                      <td>{i.width}×{i.height}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Button variant="gradient" disabled={busy || !items.length} onClick={() => void exportBatch()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} {t.batchZip}
          </Button>
          {busy && (
            <div className="h-2 rounded-full bg-muted/30">
              <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="rounded-xl border border-border bg-card p-4">
          {history.length === 0 ? (
            <p className="py-8 text-center text-muted">{t.emptyHistory}</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{h.name}</p>
                    <p className="text-xs text-muted">{new Date(h.ts).toLocaleString()} · {h.paths} paths · {formatBytes(h.bytes)}</p>
                  </div>
                  <span className="rounded bg-muted/20 px-2 py-0.5 text-xs uppercase">{h.format}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* API tab */}
      {tab === "api" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-6 font-mono text-sm">
          <p className="font-sans text-muted">POST /api/v1/image/vectorize — server-side vectorization for automation pipelines.</p>
          <pre className="overflow-x-auto rounded-lg bg-muted/10 p-4 text-xs">{`curl -X POST https://your-domain/api/v1/image/vectorize \\
  -H "Content-Type: application/json" \\
  -d '{
    "image": "<base64 or data URI>",
    "settings": {
      "mode": "logo",
      "preset": "curvy",
      "numberofcolors": 8,
      "removeBackground": true,
      "exportFormat": "svg"
    }
  }'`}</pre>
          <p className="font-sans text-xs text-muted">Response: {`{ ok, svg, width, height, pathCount, layerCount, bytes }`}</p>
        </div>
      )}
    </div>
  );
}
