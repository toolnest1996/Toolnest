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
  ClipboardPaste,
  Download,
  Eye,
  FileArchive,
  FolderUp,
  History,
  Languages,
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
import { FORMAT_LABELS, LOSSY_FORMATS, type OutputFormat } from "./image-compressor-utils";
import {
  DEFAULT_ENHANCE,
  ENHANCE_MODES,
  QUALITY_PRESETS,
  UPSCALE_OPTIONS,
  SUPPORTED_ENHANCE_INPUT,
  aiEnhanceRecommendations,
  aiEnhanceTips,
  analyzePhotoBitmap,
  applyQualityPreset,
  buildOutputName,
  enhanceBatch,
  enhancePhotoFile,
  mergeEnhanceSettings,
  zipEnhanced,
  type EnhanceMode,
  type EnhanceSettings,
  type QualityPreset,
  type UpscaleFactor,
} from "./photo-enhancer-utils";
import { loadImageBitmap } from "./image-editor-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";
type Tab = "studio" | "compare" | "batch" | "history" | "api";

interface PhotoItem {
  id: string;
  file: File;
  name: string;
  bytes: number;
  width: number;
  height: number;
  thumbUrl: string;
}

interface HistoryEntry {
  id: string;
  name: string;
  w: number;
  h: number;
  bytes: number;
  ms: number;
  ts: number;
  dataUrl: string;
}

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", compare: "Compare", batch: "Batch", history: "History", api: "API",
    drop: "Drop photos, paste, or browse", dropHint: "JPG · PNG · WebP · AVIF · HEIC · TIFF · BMP · GIF — 100% in-browser",
    addFiles: "Add photos", addFolder: "Folder", paste: "Paste", clear: "Clear all",
    enhance: "Enhance & Download", preview: "Preview", private: "100% private · AI in-browser",
    favorite: "Favorite", favorited: "Favorited", aiApply: "Apply AI recommendation",
    undo: "Undo", redo: "Redo", batchZip: "Download all as ZIP", emptyHistory: "No enhancements yet.",
    mode: "AI mode", upscale: "Super-resolution", preset: "Quality preset", format: "Export format",
    autoTone: "Auto tone", autoWB: "Auto white balance", faceEnhance: "Face enhancement",
    skinSmooth: "Skin smooth", redEye: "Red-eye fix", denoise: "Denoise", sharpen: "Sharpen",
    hdr: "HDR boost", sky: "Sky enhance", colorize: "Colorize strength", worker: "Web Worker upscale",
    before: "Before", after: "After", compareHint: "Drag slider to compare",
  },
  es: {
    studio: "Estudio", compare: "Comparar", batch: "Lote", history: "Historial", api: "API",
    drop: "Suelta fotos", dropHint: "100% navegador", addFiles: "Añadir", addFolder: "Carpeta",
    paste: "Pegar", clear: "Limpiar", enhance: "Mejorar", preview: "Vista previa", private: "100% privado",
    favorite: "Favorito", favorited: "Favorito", aiApply: "Aplicar IA", undo: "Deshacer", redo: "Rehacer",
    batchZip: "ZIP", emptyHistory: "Sin historial.", mode: "Modo IA", upscale: "Super-resolución",
    preset: "Calidad", format: "Formato", autoTone: "Tono auto", autoWB: "Balance blancos",
    faceEnhance: "Rostro", skinSmooth: "Piel suave", redEye: "Ojos rojos", denoise: "Ruido",
    sharpen: "Nitidez", hdr: "HDR", sky: "Cielo", colorize: "Colorizar", worker: "Web Worker",
    before: "Antes", after: "Después", compareHint: "Arrastra el slider",
  },
  de: {
    studio: "Studio", compare: "Vergleich", batch: "Stapel", history: "Verlauf", api: "API",
    drop: "Fotos ablegen", dropHint: "100% Browser", addFiles: "Hinzufügen", addFolder: "Ordner",
    paste: "Einfügen", clear: "Löschen", enhance: "Verbessern", preview: "Vorschau", private: "100% privat",
    favorite: "Favorit", favorited: "Favorit", aiApply: "KI anwenden", undo: "Rückgängig", redo: "Wiederholen",
    batchZip: "ZIP", emptyHistory: "Kein Verlauf.", mode: "KI-Modus", upscale: "Super-Auflösung",
    preset: "Qualität", format: "Format", autoTone: "Auto-Ton", autoWB: "Auto-WB",
    faceEnhance: "Gesicht", skinSmooth: "Haut", redEye: "Rote Augen", denoise: "Entrauschen",
    sharpen: "Schärfen", hdr: "HDR", sky: "Himmel", colorize: "Kolorieren", worker: "Web Worker",
    before: "Vorher", after: "Nachher", compareHint: "Slider ziehen",
  },
  fr: {
    studio: "Studio", compare: "Comparer", batch: "Lot", history: "Historique", api: "API",
    drop: "Déposez vos photos", dropHint: "100% navigateur", addFiles: "Ajouter", addFolder: "Dossier",
    paste: "Coller", clear: "Effacer", enhance: "Améliorer", preview: "Aperçu", private: "100% privé",
    favorite: "Favori", favorited: "Favori", aiApply: "Appliquer IA", undo: "Annuler", redo: "Rétablir",
    batchZip: "ZIP", emptyHistory: "Aucun historique.", mode: "Mode IA", upscale: "Super-résolution",
    preset: "Qualité", format: "Format", autoTone: "Ton auto", autoWB: "Balance blancs",
    faceEnhance: "Visage", skinSmooth: "Peau", redEye: "Yeux rouges", denoise: "Bruit",
    sharpen: "Netteté", hdr: "HDR", sky: "Ciel", colorize: "Coloriser", worker: "Web Worker",
    before: "Avant", after: "Après", compareHint: "Glisser le curseur",
  },
  tr: {
    studio: "Stüdyo", compare: "Karşılaştır", batch: "Toplu", history: "Geçmiş", api: "API",
    drop: "Fotoğrafları bırakın", dropHint: "%100 tarayıcı", addFiles: "Ekle", addFolder: "Klasör",
    paste: "Yapıştır", clear: "Temizle", enhance: "İyileştir", preview: "Önizleme", private: "%100 özel",
    favorite: "Favori", favorited: "Favori", aiApply: "AI uygula", undo: "Geri", redo: "İleri",
    batchZip: "ZIP", emptyHistory: "Geçmiş yok.", mode: "AI mod", upscale: "Süper çözünürlük",
    preset: "Kalite", format: "Format", autoTone: "Otomatik ton", autoWB: "Otomatik WB",
    faceEnhance: "Yüz", skinSmooth: "Cilt", redEye: "Kırmızı göz", denoise: "Gürültü",
    sharpen: "Keskinlik", hdr: "HDR", sky: "Gökyüzü", colorize: "Renklendir", worker: "Web Worker",
    before: "Önce", after: "Sonra", compareHint: "Kaydırıcıyı sürükleyin",
  },
  hi: {
    studio: "स्टूडियो", compare: "तुलना", batch: "बैच", history: "इतिहास", api: "API",
    drop: "फ़ोटो छोड़ें", dropHint: "100% ब्राउज़र", addFiles: "जोड़ें", addFolder: "फ़ोल्डर",
    paste: "पेस्ट", clear: "साफ़", enhance: "बढ़ाएँ", preview: "पूर्वावलोकन", private: "100% निजी",
    favorite: "पसंदीदा", favorited: "पसंदीदा", aiApply: "AI लागू", undo: "पूर्ववत", redo: "फिर",
    batchZip: "ZIP", emptyHistory: "कोई इतिहास नहीं।", mode: "AI मोड", upscale: "सुपर-रेज़",
    preset: "गुणवत्ता", format: "प्रारूप", autoTone: "ऑटो टोन", autoWB: "ऑटो WB",
    faceEnhance: "चेहरा", skinSmooth: "त्वचा", redEye: "लाल आँख", denoise: "शोर",
    sharpen: "तीक्ष्ण", hdr: "HDR", sky: "आकाश", colorize: "रंग", worker: "Web Worker",
    before: "पहले", after: "बाद", compareHint: "स्लाइडर खींचें",
  },
  pt: {
    studio: "Estúdio", compare: "Comparar", batch: "Lote", history: "Histórico", api: "API",
    drop: "Solte fotos", dropHint: "100% navegador", addFiles: "Adicionar", addFolder: "Pasta",
    paste: "Colar", clear: "Limpar", enhance: "Melhorar", preview: "Prévia", private: "100% privado",
    favorite: "Favorito", favorited: "Favorito", aiApply: "Aplicar IA", undo: "Desfazer", redo: "Refazer",
    batchZip: "ZIP", emptyHistory: "Sem histórico.", mode: "Modo IA", upscale: "Super-resolução",
    preset: "Qualidade", format: "Formato", autoTone: "Tom auto", autoWB: "WB auto",
    faceEnhance: "Rosto", skinSmooth: "Pele", redEye: "Olhos vermelhos", denoise: "Ruído",
    sharpen: "Nitidez", hdr: "HDR", sky: "Céu", colorize: "Colorir", worker: "Web Worker",
    before: "Antes", after: "Depois", compareHint: "Arraste o slider",
  },
  ja: {
    studio: "スタジオ", compare: "比較", batch: "一括", history: "履歴", api: "API",
    drop: "写真をドロップ", dropHint: "100%ブラウザ", addFiles: "追加", addFolder: "フォルダ",
    paste: "ペースト", clear: "消去", enhance: "強化", preview: "プレビュー", private: "100%プライベート",
    favorite: "お気に入り", favorited: "お気に入り", aiApply: "AI適用", undo: "元に戻す", redo: "やり直し",
    batchZip: "ZIP", emptyHistory: "履歴なし。", mode: "AIモード", upscale: "超解像",
    preset: "品質", format: "形式", autoTone: "自動トーン", autoWB: "自動WB",
    faceEnhance: "顔", skinSmooth: "肌", redEye: "赤目", denoise: "ノイズ",
    sharpen: "シャープ", hdr: "HDR", sky: "空", colorize: "カラー化", worker: "Web Worker",
    before: "前", after: "後", compareHint: "スライダーをドラッグ",
  },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français",
  tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

const SETTINGS_KEY = "toolnest-photo-enhancer-settings";
const HISTORY_KEY = "toolnest-photo-enhancer-history";
const LANG_KEY = "toolnest-photo-enhancer-lang";

let _id = 0;
const nextId = () => `pe-${Date.now()}-${++_id}`;

export function PhotoEnhancer() {
  const favorites = useFavorites();
  const slug = "photo-enhancer";

  const [items, setItems] = useState<PhotoItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [settings, setSettings] = useState<EnhanceSettings>({ ...DEFAULT_ENHANCE });
  const [tab, setTab] = useState<Tab>("studio");
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [afterUrl, setAfterUrl] = useState("");
  const [comparePos, setComparePos] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [aiTips, setAiTips] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [useWorker, setUseWorker] = useState(true);
  const [lastMs, setLastMs] = useState(0);

  const settingsUndo = useRef<EnhanceSettings[]>([]);
  const settingsRedo = useRef<EnhanceSettings[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const t = useCallback((k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k, [lang]);
  const active = items[activeIdx];

  const patch = useCallback((p: Partial<EnhanceSettings>) => {
    setSettings((prev) => {
      settingsUndo.current.push(prev);
      if (settingsUndo.current.length > 40) settingsUndo.current.shift();
      settingsRedo.current = [];
      return { ...prev, ...p };
    });
  }, []);

  const undo = () => {
    if (!settingsUndo.current.length) return;
    const prev = settingsUndo.current.pop()!;
    setSettings((cur) => { settingsRedo.current.push(cur); return prev; });
  };
  const redo = () => {
    if (!settingsRedo.current.length) return;
    const next = settingsRedo.current.pop()!;
    setSettings((cur) => { settingsUndo.current.push(cur); return next; });
  };

  useEffect(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) setSettings((o) => ({ ...o, ...JSON.parse(s) }));
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"));
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);
  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  const runAiOnFile = async (file: File) => {
    try {
      const bmp = await loadImageBitmap(file);
      const analysis = analyzePhotoBitmap(bmp);
      bmp.close();
      const rec = aiEnhanceRecommendations(analysis);
      setAiTips(rec.tips);
      if (settings.mode === "auto") patch(mergeEnhanceSettings(settings, rec.settings));
    } catch { /* optional */ }
  };

  const addFiles = async (files: File[]) => {
    const accepted: PhotoItem[] = [];
    for (const file of files) {
      if (!SUPPORTED_ENHANCE_INPUT(file)) continue;
      try {
        const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
        accepted.push({
          id: nextId(),
          file,
          name: file.name,
          bytes: file.size,
          width: bmp.width,
          height: bmp.height,
          thumbUrl: URL.createObjectURL(file),
        });
        bmp.close();
      } catch {
        toast.error(`${file.name}: decode failed`);
      }
    }
    if (!accepted.length) return toast.error("No supported images");
    setItems((p) => [...p, ...accepted]);
    if (!items.length) setActiveIdx(0);
    toast.success(`${accepted.length} photo(s) added`);
    void runAiOnFile(accepted[0]!.file);
  };

  const applyAi = async () => {
    if (!active) return;
    const bmp = await loadImageBitmap(active.file);
    const rec = aiEnhanceRecommendations(analyzePhotoBitmap(bmp));
    bmp.close();
    patch(mergeEnhanceSettings(settings, rec.settings));
    toast.success(rec.label);
  };

  const runPreview = async () => {
    if (!active) return;
    setBusy(true);
    try {
      if (afterUrl) URL.revokeObjectURL(afterUrl);
      const result = await enhancePhotoFile(active.file, settings);
      setAfterUrl(result.previewUrl);
      setLastMs(result.durationMs);
      toast.success(`${result.width}×${result.height} · ${Math.round(result.durationMs)}ms`);
      setTab("compare");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enhance failed");
    } finally {
      setBusy(false);
    }
  };

  const exportOne = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const result = await enhancePhotoFile(active.file, settings);
      downloadBlob(result.blob, buildOutputName(active.name, settings.format));
      const entry: HistoryEntry = {
        id: nextId(),
        name: active.name,
        w: result.width,
        h: result.height,
        bytes: result.bytes,
        ms: result.durationMs,
        ts: Date.now(),
        dataUrl: result.previewUrl,
      };
      setHistory((h) => {
        const n = [entry, ...h].slice(0, 50);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(n));
        return n;
      });
      setAfterUrl(result.previewUrl);
      setLastMs(result.durationMs);
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
      const out = await enhanceBatch(
        items.map((i) => i.file),
        settings,
        (d, tot) => setProgress(Math.round((d / tot) * 100)),
        useWorker,
      );
      if (out.length === 1) {
        downloadBlob(out[0]!.blob, out[0]!.name);
      } else {
        downloadBlob(await zipEnhanced(out), "enhanced-photos.zip");
      }
      toast.success(`Enhanced ${out.length} photo(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const clip = e.clipboardData?.items;
      if (!clip) return;
      const files: File[] = [];
      for (const it of clip) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [items.length]);

  const modeTips = useMemo(() => aiEnhanceTips(settings.mode), [settings.mode]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) void addFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <Sparkles className="mr-1 inline h-4 w-4 text-primary" />
          Ultra AI Photo Enhancer · {t("private")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={cn(inputClass(), "w-auto py-1.5 text-xs")}>
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
          <button type="button" onClick={() => favorites.toggle(slug)} className={cn("rounded-lg border px-3 py-1.5 text-xs", favorites.isFavorite(slug) ? "border-primary text-primary" : "border-border")}>
            <Star className="inline h-3.5 w-3.5" /> {favorites.isFavorite(slug) ? t("favorited") : t("favorite")}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {(["studio", "compare", "batch", "history", "api"] as Tab[]).map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium", tab === k ? "bg-primary text-white" : "text-muted hover:text-foreground")}>
            {k === "studio" && <Wand2 className="h-4 w-4" />}
            {k === "compare" && <Eye className="h-4 w-4" />}
            {k === "batch" && <FileArchive className="h-4 w-4" />}
            {k === "history" && <History className="h-4 w-4" />}
            {k === "api" && <Sparkles className="h-4 w-4" />}
            <span className="hidden sm:inline">{t(k)}</span>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn("flex flex-col items-center rounded-2xl border-2 border-dashed p-12 text-center", dragOver ? "border-primary bg-primary/5" : "border-border bg-card")}
        >
          <UploadCloud className="mb-4 h-12 w-12 text-primary" />
          <p className="font-medium">{t("drop")}</p>
          <p className="mt-2 text-sm text-muted">{t("dropHint")}</p>
          <div className="mt-4 flex gap-2">
            <Button variant="gradient" onClick={() => fileInputRef.current?.click()}><UploadCloud className="h-4 w-4" /> {t("addFiles")}</Button>
            <Button variant="outline" onClick={() => folderInputRef.current?.click()}><FolderUp className="h-4 w-4" /> {t("addFolder")}</Button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif,.tiff,.tif" multiple className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) void addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
          <input ref={folderInputRef} type="file" accept="image/*" multiple className="hidden" {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) void addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><UploadCloud className="h-4 w-4" /> {t("addFiles")}</Button>
            <Button variant="outline" size="sm" onClick={() => folderInputRef.current?.click()}><FolderUp className="h-4 w-4" /> {t("addFolder")}</Button>
            <Button variant="outline" size="sm" onClick={() => toast.info("Ctrl+V to paste")}><ClipboardPaste className="h-4 w-4" /> {t("paste")}</Button>
            <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif,.tiff,.tif" multiple className="hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) void addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
            <input ref={folderInputRef} type="file" accept="image/*" multiple className="hidden" {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} onChange={(e: ChangeEvent<HTMLInputElement>) => { if (e.target.files) void addFiles(Array.from(e.target.files)); e.target.value = ""; }} />
            <Button variant="outline" size="sm" className="ml-auto text-error" onClick={() => { items.forEach((i) => URL.revokeObjectURL(i.thumbUrl)); if (afterUrl) URL.revokeObjectURL(afterUrl); setItems([]); setAfterUrl(""); }}><Trash2 className="h-4 w-4" /> {t("clear")}</Button>
          </div>

          {tab === "studio" && active && (
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="space-y-3">
                {items.length > 1 && (
                  <select value={activeIdx} onChange={(e) => { setActiveIdx(Number(e.target.value)); void runAiOnFile(items[Number(e.target.value)]!.file); }} className={cn(inputClass(), "max-w-full")}>
                    {items.map((it, i) => <option key={it.id} value={i}>{it.name}</option>)}
                  </select>
                )}
                <div className="flex min-h-[280px] items-center justify-center overflow-auto rounded-xl border border-border bg-card p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={active.thumbUrl} alt="" className="max-h-[480px] object-contain transition-transform" style={{ transform: `scale(${zoom})` }} draggable={false} />
                </div>
                <p className="text-center text-xs text-muted tabular-nums">
                  {active.width}×{active.height} · {formatBytes(active.bytes)}
                  {lastMs > 0 && ` · last ${Math.round(lastMs)}ms`}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={undo}><Undo2 className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={redo}><Redo2 className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(4, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <Button size="sm" variant="outline" className="w-full" onClick={() => void applyAi()}><Sparkles className="h-4 w-4" /> {t("aiApply")}</Button>
                {(aiTips.length > 0 || modeTips.length > 0) && (
                  <ul className="space-y-1 rounded-lg bg-muted/10 p-3 text-xs text-muted">
                    {[...new Set([...aiTips, ...modeTips])].slice(0, 5).map((tip) => <li key={tip}>• {tip}</li>)}
                  </ul>
                )}

                <Field label={t("mode")}>
                  <select value={settings.mode} onChange={(e) => patch({ mode: e.target.value as EnhanceMode })} className={inputClass()}>
                    {ENHANCE_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                </Field>

                <Field label={t("upscale")}>
                  <select value={settings.upscale} onChange={(e) => patch({ upscale: Number(e.target.value) as UpscaleFactor })} className={inputClass()}>
                    {UPSCALE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>

                <Field label={t("preset")}>
                  <select value={settings.preset} onChange={(e) => patch(applyQualityPreset(settings, e.target.value as QualityPreset))} className={inputClass()}>
                    {(Object.keys(QUALITY_PRESETS) as QualityPreset[]).map((k) => <option key={k} value={k}>{QUALITY_PRESETS[k].label}</option>)}
                  </select>
                </Field>

                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-muted">Tone & color</summary>
                  <div className="mt-2 space-y-2">
                    <Field label={t("hdr")}><input type="range" min={0} max={100} value={settings.hdr} onChange={(e) => patch({ hdr: Number(e.target.value) })} className="w-full" /></Field>
                    <Field label="Exposure"><input type="range" min={-50} max={50} value={settings.exposure} onChange={(e) => patch({ exposure: Number(e.target.value) })} className="w-full" /></Field>
                    <Field label="Vibrance"><input type="range" min={-50} max={50} value={settings.vibrance} onChange={(e) => patch({ vibrance: Number(e.target.value) })} className="w-full" /></Field>
                    <Field label={t("sky")}><input type="range" min={0} max={100} value={settings.skyEnhance} onChange={(e) => patch({ skyEnhance: Number(e.target.value) })} className="w-full" /></Field>
                  </div>
                </details>

                <details className="text-sm">
                  <summary className="cursor-pointer font-medium text-muted">Detail & restoration</summary>
                  <div className="mt-2 space-y-2">
                    <Field label={t("denoise")}><input type="range" min={0} max={100} value={settings.denoise} onChange={(e) => patch({ denoise: Number(e.target.value) })} className="w-full" /></Field>
                    <Field label={t("sharpen")}><input type="range" min={0} max={100} value={settings.sharpen} onChange={(e) => patch({ sharpen: Number(e.target.value) })} className="w-full" /></Field>
                    <Field label="Deblur"><input type="range" min={0} max={100} value={settings.deblur} onChange={(e) => patch({ deblur: Number(e.target.value) })} className="w-full" /></Field>
                    <Field label="Clarity"><input type="range" min={0} max={100} value={settings.clarity} onChange={(e) => patch({ clarity: Number(e.target.value) })} className="w-full" /></Field>
                    <Field label="Scratch removal"><input type="range" min={0} max={100} value={settings.scratchRemoval} onChange={(e) => patch({ scratchRemoval: Number(e.target.value) })} className="w-full" /></Field>
                    <Field label={t("colorize")}><input type="range" min={0} max={100} value={settings.colorizeStrength} onChange={(e) => patch({ colorizeStrength: Number(e.target.value) })} className="w-full" /></Field>
                    <Field label="Text readability"><input type="range" min={0} max={100} value={settings.textReadability} onChange={(e) => patch({ textReadability: Number(e.target.value) })} className="w-full" /></Field>
                  </div>
                </details>

                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.autoTone} onChange={(e) => patch({ autoTone: e.target.checked })} /> {t("autoTone")}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.autoWhiteBalance} onChange={(e) => patch({ autoWhiteBalance: e.target.checked })} /> {t("autoWB")}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.faceEnhance} onChange={(e) => patch({ faceEnhance: e.target.checked })} /> {t("faceEnhance")}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.redEyeFix} onChange={(e) => patch({ redEyeFix: e.target.checked })} /> {t("redEye")}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={useWorker} onChange={(e) => setUseWorker(e.target.checked)} /> {t("worker")}</label>

                {settings.faceEnhance && (
                  <Field label={t("skinSmooth")}><input type="range" min={0} max={100} value={settings.skinSmooth} onChange={(e) => patch({ skinSmooth: Number(e.target.value) })} className="w-full" /></Field>
                )}

                <Field label={t("format")}>
                  <select value={settings.format} onChange={(e) => patch({ format: e.target.value as OutputFormat })} className={inputClass()}>
                    {Object.entries(FORMAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                {LOSSY_FORMATS.includes(settings.format) && (
                  <Field label="Quality"><input type="range" min={50} max={100} value={Math.round(settings.quality * 100)} onChange={(e) => patch({ quality: Number(e.target.value) / 100 })} className="w-full" /></Field>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <Button variant="outline" disabled={busy} onClick={() => void runPreview()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} {t("preview")}</Button>
                  <Button variant="gradient" disabled={busy} onClick={() => void exportOne()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("enhance")}</Button>
                </div>
              </div>
            </div>
          )}

          {tab === "compare" && active && (
            <div className="space-y-3">
              {afterUrl ? (
                <>
                  <div className="relative overflow-hidden rounded-xl border border-border">
                    <div className="relative flex min-h-[320px] items-center justify-center bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={afterUrl} alt={t("after")} className="max-h-[520px] max-w-full object-contain" style={{ transform: `scale(${zoom})` }} />
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ clipPath: `inset(0 ${100 - comparePos}% 0 0)` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={active.thumbUrl} alt={t("before")} className="max-h-[520px] max-w-full object-contain" style={{ transform: `scale(${zoom})` }} />
                      </div>
                      <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-primary" style={{ left: `${comparePos}%` }} />
                    </div>
                    <input type="range" min={0} max={100} value={comparePos} onChange={(e) => setComparePos(Number(e.target.value))} className="w-full accent-[var(--primary)]" aria-label="Compare" />
                  </div>
                  <p className="text-center text-xs text-muted">{t("compareHint")}</p>
                </>
              ) : (
                <p className="py-16 text-center text-muted">Run Preview in Studio first.</p>
              )}
            </div>
          )}

          {tab === "batch" && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-6">
              <p className="text-sm">{items.length} photo(s) · upscale {settings.upscale}× · {settings.format.split("/")[1]?.toUpperCase()}</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted"><th className="py-2">File</th><th>Size</th><th>Dimensions</th></tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 truncate max-w-[200px]">{i.name}</td>
                      <td>{formatBytes(i.bytes)}</td>
                      <td>{i.width}×{i.height}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button variant="gradient" disabled={busy} onClick={() => void exportBatch()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} {t("batchZip")}
              </Button>
              {busy && <div className="h-2 rounded-full bg-muted/30"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>}
            </div>
          )}

          {tab === "history" && (
            <div className="rounded-xl border border-border bg-card p-4">
              {history.length === 0 ? <p className="py-12 text-center text-muted">{t("emptyHistory")}</p> : (
                <ul className="grid gap-3 sm:grid-cols-3">
                  {history.map((h) => (
                    <li key={h.id} className="rounded-lg border border-border p-2 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={h.dataUrl} alt="" className="mx-auto h-24 w-24 object-cover rounded" />
                      <p className="truncate text-xs font-medium">{h.name}</p>
                      <p className="text-[10px] text-muted">{h.w}×{h.h} · {formatBytes(h.bytes)} · {Math.round(h.ms)}ms</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="rounded-xl border border-border bg-card p-6 font-mono text-sm space-y-3">
              <p className="font-sans text-muted">POST /api/v1/image/enhance — Lanczos upscale, denoise, sharpen, tone via sharp.</p>
              <pre className="overflow-x-auto rounded-lg bg-muted/10 p-4 text-xs">{`curl -X POST https://your-domain/api/v1/image/enhance \\
  -H "Content-Type: application/json" \\
  -d '{
    "image": "<base64>",
    "upscale": 4,
    "settings": {
      "mode": "portrait",
      "denoise": 35,
      "sharpen": 30,
      "autoTone": true,
      "format": "image/jpeg",
      "quality": 0.92
    }
  }'`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
