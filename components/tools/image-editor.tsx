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
  Lock,
  Redo2,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Wand2,
  ZoomIn,
  ZoomOut,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  DEFAULT_ADJUSTMENTS,
  EDITOR_PRESETS,
  aiEditorRecommendations,
  applyAdjustmentsToCanvas,
  autoEnhanceAdjustments,
  editBatchImages,
  editImageFile,
  loadImageBitmap,
  mergePreset,
  smartEditorTips,
  zipEditedImages,
  type EditorAdjustments,
  type EditorExportFormat,
  type EditorRotation,
} from "./image-editor-utils";

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
  format: EditorExportFormat;
  bytes: number;
  ts: number;
}

interface PersistedSettings {
  adj: EditorAdjustments;
  format: EditorExportFormat;
  quality: number;
}

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", preview: "Preview", batch: "Batch", history: "History", api: "API",
    drop: "Drop images, paste, or click to browse", dropHint: "JPG · PNG · WebP · GIF · BMP — 100% in-browser",
    addFiles: "Add files", addFolder: "Add folder", paste: "Paste image", clear: "Clear all",
    edit: "Edit & Download", previewBtn: "Preview", format: "Export format", quality: "Quality",
    private: "100% private · in-browser", favorite: "Favorite", favorited: "Favorited",
    undo: "Undo", redo: "Redo", reset: "Reset filters", batchZip: "Download all as ZIP",
    emptyHistory: "No edited images yet.", before: "Before", after: "After", ai: "Tips",
    brightness: "Brightness", contrast: "Contrast", saturation: "Saturation", exposure: "Exposure",
    hue: "Hue", gamma: "Gamma", blur: "Blur", sharpen: "Sharpen", vignette: "Vignette",
    grayscale: "Grayscale", sepia: "Sepia", invert: "Invert", files: "Files",
    presets: "Presets", selectPreset: "— Choose preset —", autoEnhance: "Auto enhance",
    transform: "Transform", rotate: "Rotate", flipH: "Flip H", flipV: "Flip V",
    light: "Light", color: "Color", detail: "Detail", effects: "Effects",
    temperature: "Temperature", tint: "Tint", clarity: "Clarity", highlights: "Highlights",
    shadows: "Shadows", fade: "Fade", noise: "Noise reduction", apply: "Apply",
  },
  es: {
    studio: "Estudio", preview: "Vista previa", batch: "Lote", history: "Historial", api: "API",
    drop: "Suelta imágenes, pega o haz clic", dropHint: "100% en el navegador",
    addFiles: "Añadir", addFolder: "Carpeta", paste: "Pegar", clear: "Limpiar",
    edit: "Editar y descargar", previewBtn: "Vista previa", format: "Formato", quality: "Calidad",
    private: "100% privado", favorite: "Favorito", favorited: "Favorito",
    undo: "Deshacer", redo: "Rehacer", reset: "Restablecer", batchZip: "ZIP",
    emptyHistory: "Sin historial.", before: "Antes", after: "Después", ai: "Consejos",
    brightness: "Brillo", contrast: "Contraste", saturation: "Saturación", exposure: "Exposición",
    hue: "Tono", gamma: "Gamma", blur: "Desenfoque", sharpen: "Enfoque", vignette: "Viñeta",
    grayscale: "Escala de grises", sepia: "Sepia", invert: "Invertir", files: "Archivos",
  },
  de: {
    studio: "Studio", preview: "Vorschau", batch: "Stapel", history: "Verlauf", api: "API",
    drop: "Bilder ablegen oder klicken", dropHint: "100% im Browser",
    addFiles: "Hinzufügen", addFolder: "Ordner", paste: "Einfügen", clear: "Löschen",
    edit: "Bearbeiten", previewBtn: "Vorschau", format: "Format", quality: "Qualität",
    private: "100% privat", favorite: "Favorit", favorited: "Favorit",
    undo: "Rückgängig", redo: "Wiederholen", reset: "Zurücksetzen", batchZip: "ZIP",
    emptyHistory: "Kein Verlauf.", before: "Vorher", after: "Nachher", ai: "Tipps",
    brightness: "Helligkeit", contrast: "Kontrast", saturation: "Sättigung", exposure: "Belichtung",
    hue: "Farbton", gamma: "Gamma", blur: "Weichzeichner", sharpen: "Schärfen", vignette: "Vignette",
    grayscale: "Graustufen", sepia: "Sepia", invert: "Invertieren", files: "Dateien",
  },
  fr: {
    studio: "Studio", preview: "Aperçu", batch: "Lot", history: "Historique", api: "API",
    drop: "Déposez vos images", dropHint: "100% dans le navigateur",
    addFiles: "Ajouter", addFolder: "Dossier", paste: "Coller", clear: "Effacer",
    edit: "Modifier", previewBtn: "Aperçu", format: "Format", quality: "Qualité",
    private: "100% privé", favorite: "Favori", favorited: "Favori",
    undo: "Annuler", redo: "Rétablir", reset: "Réinitialiser", batchZip: "ZIP",
    emptyHistory: "Aucun historique.", before: "Avant", after: "Après", ai: "Conseils",
    brightness: "Luminosité", contrast: "Contraste", saturation: "Saturation", exposure: "Exposition",
    hue: "Teinte", gamma: "Gamma", blur: "Flou", sharpen: "Netteté", vignette: "Vignette",
    grayscale: "Niveaux de gris", sepia: "Sépia", invert: "Inverser", files: "Fichiers",
  },
  tr: {
    studio: "Stüdyo", preview: "Önizleme", batch: "Toplu", history: "Geçmiş", api: "API",
    drop: "Görüntüleri bırakın", dropHint: "%100 tarayıcıda",
    addFiles: "Ekle", addFolder: "Klasör", paste: "Yapıştır", clear: "Temizle",
    edit: "Düzenle ve indir", previewBtn: "Önizleme", format: "Format", quality: "Kalite",
    private: "%100 özel", favorite: "Favori", favorited: "Favori",
    undo: "Geri", redo: "İleri", reset: "Sıfırla", batchZip: "ZIP",
    emptyHistory: "Geçmiş yok.", before: "Önce", after: "Sonra", ai: "İpuçları",
    brightness: "Parlaklık", contrast: "Kontrast", saturation: "Doygunluk", exposure: "Pozlama",
    hue: "Renk tonu", gamma: "Gama", blur: "Bulanıklık", sharpen: "Keskinleştir", vignette: "Vinyet",
    grayscale: "Gri ton", sepia: "Sepya", invert: "Ters çevir", files: "Dosyalar",
  },
  hi: {
    studio: "स्टूडियो", preview: "पूर्वावलोकन", batch: "बैच", history: "इतिहास", api: "API",
    drop: "छवियाँ छोड़ें", dropHint: "100% ब्राउज़र में",
    addFiles: "जोड़ें", addFolder: "फ़ोल्डर", paste: "पेस्ट", clear: "साफ़",
    edit: "संपादित करें", previewBtn: "पूर्वावलोकन", format: "प्रारूप", quality: "गुणवत्ता",
    private: "100% निजी", favorite: "पसंदीदा", favorited: "पसंदीदा",
    undo: "पूर्ववत", redo: "फिर", reset: "रीसेट", batchZip: "ZIP",
    emptyHistory: "कोई इतिहास नहीं।", before: "पहले", after: "बाद", ai: "सुझाव",
    brightness: "चमक", contrast: "कंट्रास्ट", saturation: "संतृpti", exposure: "एक्सपोज़र",
    hue: "रंग", gamma: "गामा", blur: "धुंधला", sharpen: "तेज", vignette: "विनेट",
    grayscale: "ग्रेस्केल", sepia: "सेपिया", invert: "उलटा", files: "फ़ाइलें",
  },
  pt: {
    studio: "Estúdio", preview: "Prévia", batch: "Lote", history: "Histórico", api: "API",
    drop: "Solte imagens", dropHint: "100% no navegador",
    addFiles: "Adicionar", addFolder: "Pasta", paste: "Colar", clear: "Limpar",
    edit: "Editar e baixar", previewBtn: "Prévia", format: "Formato", quality: "Qualidade",
    private: "100% privado", favorite: "Favorito", favorited: "Favorito",
    undo: "Desfazer", redo: "Refazer", reset: "Repor", batchZip: "ZIP",
    emptyHistory: "Sem histórico.", before: "Antes", after: "Depois", ai: "Dicas",
    brightness: "Brilho", contrast: "Contraste", saturation: "Saturação", exposure: "Exposição",
    hue: "Matiz", gamma: "Gama", blur: "Desfoque", sharpen: "Nitidez", vignette: "Vinheta",
    grayscale: "Escala de cinza", sepia: "Sépia", invert: "Inverter", files: "Arquivos",
  },
  ja: {
    studio: "スタジオ", preview: "プレビュー", batch: "一括", history: "履歴", api: "API",
    drop: "画像をドロップ", dropHint: "100%ブラウザ内処理",
    addFiles: "追加", addFolder: "フォルダ", paste: "ペースト", clear: "消去",
    edit: "編集してダウンロード", previewBtn: "プレビュー", format: "形式", quality: "品質",
    private: "100%プライベート", favorite: "お気に入り", favorited: "お気に入り",
    undo: "元に戻す", redo: "やり直し", reset: "リセット", batchZip: "ZIP",
    emptyHistory: "履歴なし。", before: "前", after: "後", ai: "ヒント",
    brightness: "明るさ", contrast: "コントラスト", saturation: "彩度", exposure: "露出",
    hue: "色相", gamma: "ガンマ", blur: "ぼかし", sharpen: "シャープ", vignette: "ビネット",
    grayscale: "グレースケール", sepia: "セピア", invert: "反転", files: "ファイル",
  },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français",
  tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

const SETTINGS_KEY = "toolnest-image-editor-settings";
const HISTORY_KEY = "toolnest-image-editor-history";
const LANG_KEY = "toolnest-image-editor-lang";

const SLIDER_GROUPS = {
  light: ["brightness", "exposure", "contrast", "highlights", "shadows", "gamma", "fade"] as const,
  color: ["saturation", "hue", "temperature", "tint"] as const,
  detail: ["clarity", "sharpen", "blur", "noiseReduction"] as const,
  effects: ["vignette"] as const,
};

type SliderKey = typeof SLIDER_GROUPS.light[number] | typeof SLIDER_GROUPS.color[number] | typeof SLIDER_GROUPS.detail[number] | typeof SLIDER_GROUPS.effects[number];

const SLIDER_KEYS = [
  ...SLIDER_GROUPS.light,
  ...SLIDER_GROUPS.color,
  ...SLIDER_GROUPS.detail,
  ...SLIDER_GROUPS.effects,
] as SliderKey[];

let _id = 0;
const nextId = () => `edit-${Date.now()}-${++_id}`;

function extForFormat(format: EditorExportFormat) {
  return format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg";
}

export function ImageEditor() {
  const favorites = useFavorites();
  const slug = "image-editor";

  const [items, setItems] = useState<ImageItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [adj, setAdj] = useState<EditorAdjustments>({ ...DEFAULT_ADJUSTMENTS });
  const [format, setFormat] = useState<EditorExportFormat>("image/png");
  const [quality, setQuality] = useState(0.92);
  const [tab, setTab] = useState<Tab>("studio");
  const [lang, setLang] = useState<Lang>("en");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [compareSlider, setCompareSlider] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [selectedPreset, setSelectedPreset] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [previewAfterUrl, setPreviewAfterUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<EditorAdjustments[]>([]);
  const redoStack = useRef<EditorAdjustments[]>([]);

  const t = useCallback((k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k, [lang]);
  const active = items[activeIdx];

  const tips = useMemo(
    () => (active ? smartEditorTips(active.width, active.height) : []),
    [active],
  );

  const recs = useMemo(
    () => (active ? aiEditorRecommendations(active.width, active.height, adj) : []),
    [active, adj],
  );

  const pushUndo = useCallback((prev: EditorAdjustments) => {
    undoStack.current = [...undoStack.current.slice(-49), { ...prev }];
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const patchAdj = useCallback(
    (patch: Partial<EditorAdjustments>) => {
      setAdj((prev) => {
        pushUndo(prev);
        return { ...prev, ...patch };
      });
    },
    [pushUndo],
  );

  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setAdj((cur) => {
      redoStack.current.push({ ...cur });
      setCanRedo(true);
      setCanUndo(undoStack.current.length > 0);
      return prev;
    });
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    setAdj((cur) => {
      undoStack.current.push({ ...cur });
      setCanUndo(true);
      setCanRedo(redoStack.current.length > 0);
      return next;
    });
  };

  const resetAdj = () => {
    pushUndo(adj);
    setAdj({ ...DEFAULT_ADJUSTMENTS });
    setSelectedPreset("");
  };

  const applyPreset = async (id: string) => {
    const preset = EDITOR_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    if (id === "auto" && active) {
      const bmp = await loadImageBitmap(active.file);
      const patch = autoEnhanceAdjustments(bmp);
      bmp.close();
      patchAdj(patch);
    } else {
      patchAdj(mergePreset(preset));
    }
    setSelectedPreset(id);
    toast.success(preset.label);
  };

  const applyRec = async (rec: { presetId?: string; patch?: Partial<EditorAdjustments> }) => {
    if (rec.presetId) await applyPreset(rec.presetId);
    else if (rec.patch) patchAdj(rec.patch);
  };

  const rotateCW = () => {
    const next = ((adj.rotation + 90) % 360) as EditorRotation;
    patchAdj({ rotation: next });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as PersistedSettings;
        if (s.adj) setAdj({ ...DEFAULT_ADJUSTMENTS, ...s.adj });
        if (s.format) setFormat(s.format);
        if (typeof s.quality === "number") setQuality(s.quality);
      }
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h) as HistoryEntry[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ adj, format, quality }));
    } catch { /* ignore */ }
  }, [adj, format, quality]);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch { /* ignore */ }
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
    } catch { /* ignore */ }
  }, [history]);

  useEffect(
    () => () => {
      items.forEach((i) => URL.revokeObjectURL(i.thumbUrl));
      if (previewAfterUrl) URL.revokeObjectURL(previewAfterUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const addFiles = useCallback(async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|avif|svg)$/i.test(f.name));
    if (!imgs.length) {
      toast.error("No supported images");
      return;
    }
    const added: ImageItem[] = [];
    for (const file of imgs) {
      try {
        const bmp = await loadImageBitmap(file);
        const item: ImageItem = {
          id: nextId(),
          file,
          name: file.name,
          bytes: file.size,
          thumbUrl: URL.createObjectURL(file),
          width: bmp.width,
          height: bmp.height,
        };
        bmp.close();
        added.push(item);
      } catch {
        toast.error(`Could not load: ${file.name}`);
      }
    }
    if (added.length) {
      setItems((prev) => [...prev, ...added]);
      toast.success(`${added.length} image(s) added`);
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

  const onPaste = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.read();
      const files: File[] = [];
      for (const it of clip) {
        for (const type of it.types) {
          if (type.startsWith("image/")) {
            const blob = await it.getType(type);
            files.push(new File([blob], `pasted-${Date.now()}.${type.split("/")[1] || "png"}`, { type }));
          }
        }
      }
      if (files.length) void addFiles(files);
      else toast.error("No image on clipboard");
    } catch {
      toast.error("Clipboard read denied");
    }
  }, [addFiles]);

  const removeItem = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      const removed = prev.find((i) => i.id === id);
      if (removed) URL.revokeObjectURL(removed.thumbUrl);
      setActiveIdx((idx) => Math.min(idx, Math.max(0, next.length - 1)));
      return next;
    });
  };

  const clearAll = () => {
    items.forEach((i) => URL.revokeObjectURL(i.thumbUrl));
    setItems([]);
    setActiveIdx(0);
  };

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      const bmp = await loadImageBitmap(active.file);
      if (cancelled) {
        bmp.close();
        return;
      }
      const out = applyAdjustmentsToCanvas(bmp, adj);
      bmp.close();
      const el = canvasRef.current;
      if (el) {
        el.width = out.width;
        el.height = out.height;
        el.getContext("2d")!.drawImage(out, 0, 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, adj]);

  useEffect(() => {
    if (!active || tab !== "preview") return;
    let cancelled = false;
    void (async () => {
      const bmp = await loadImageBitmap(active.file);
      const out = applyAdjustmentsToCanvas(bmp, adj);
      bmp.close();
      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", 0.85));
      if (cancelled || !blob) return;
      setPreviewAfterUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [active, adj, tab]);

  const pushHistory = (name: string, blob: Blob) => {
    setHistory((prev) => [
      { id: nextId(), name, format, bytes: blob.size, ts: Date.now() },
      ...prev,
    ].slice(0, 50));
  };

  const runEdit = async (download = true) => {
    if (!active) {
      toast.error("Add an image first");
      return;
    }
    setBusy(true);
    try {
      const blob = await editImageFile(active.file, adj, format, quality);
      if (download) {
        const ext = extForFormat(format);
        downloadBlob(blob, active.name.replace(/\.[^.]+$/, "") + `-edited.${ext}`);
        toast.success("Image saved");
      }
      pushHistory(active.name, blob);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Edit failed");
    } finally {
      setBusy(false);
    }
  };

  const runBatch = async () => {
    if (!items.length) {
      toast.error("Add images first");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      const results = await editBatchImages(
        items.map((i) => i.file),
        adj,
        format,
        quality,
        setProgress,
      );
      if (results.length === 1) {
        downloadBlob(results[0]!.blob, results[0]!.name);
      } else {
        const zip = await zipEditedImages(results);
        downloadBlob(zip, "edited-images.zip");
      }
      results.forEach((r) => pushHistory(r.name, r.blob));
      toast.success(`Batch complete · ${results.length} file(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const sliderRange = (key: SliderKey) => {
    if (key === "blur") return { min: 0, max: 20, step: 1 };
    if (key === "vignette" || key === "sharpen" || key === "clarity" || key === "noiseReduction" || key === "fade") {
      return { min: 0, max: 100, step: 1 };
    }
    if (key === "gamma") return { min: 20, max: 300, step: 5, scale: 0.01 };
    if (key === "highlights") return { min: -100, max: 100, step: 1 };
    if (key === "shadows") return { min: 0, max: 100, step: 1 };
    if (key === "temperature" || key === "tint") return { min: -100, max: 100, step: 1 };
    return { min: -100, max: 100, step: 1 };
  };

  const sliderValue = (key: SliderKey) => {
    const r = sliderRange(key);
    if (r.scale) return Math.round(adj[key] / r.scale);
    return adj[key];
  };

  const onSlider = (key: SliderKey, raw: number) => {
    const r = sliderRange(key);
    const val = r.scale ? raw * r.scale : raw;
    patchAdj({ [key]: val });
    setSelectedPreset("");
  };

  const renderSlider = (key: SliderKey) => {
    const r = sliderRange(key);
    const label = key === "noiseReduction" ? t("noise") : t(key);
    const display = key === "gamma" ? adj.gamma.toFixed(2) : adj[key];
    return (
      <Field key={key} label={`${label}: ${display}`}>
        <input
          type="range"
          min={r.min}
          max={r.max}
          step={r.step}
          value={sliderValue(key)}
          onChange={(e) => onSlider(key, Number(e.target.value))}
          className="w-full accent-[var(--primary)]"
        />
      </Field>
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Lock className="h-3.5 w-3.5" /> {t("private")}
          </span>
          <button
            type="button"
            onClick={() => favorites.toggle(slug)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
              favorites.isFavorite(slug) ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-card-hover",
            )}
          >
            <Star className={cn("h-3.5 w-3.5", favorites.isFavorite(slug) && "fill-current")} />
            {favorites.isFavorite(slug) ? t("favorited") : t("favorite")}
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <Languages className="h-3.5 w-3.5" />
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={cn(inputClass(), "w-auto py-1.5 text-xs")}>
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
              <option key={l} value={l}>{LANG_LABELS[l]}</option>
            ))}
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
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all",
            dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
          )}
        >
          <UploadCloud className="mb-4 h-14 w-14 text-primary" />
          <p className="font-display text-xl font-semibold">Ultra Image Editor Studio</p>
          <p className="mt-2 text-sm text-muted">{t("drop")}</p>
          <p className="mt-1 text-xs text-muted">{t("dropHint")}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="gradient" type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              <UploadCloud className="h-4 w-4" /> {t("addFiles")}
            </Button>
            <Button variant="outline" type="button" onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}>
              <FolderUp className="h-4 w-4" /> {t("addFolder")}
            </Button>
            <Button variant="outline" type="button" onClick={(e) => { e.stopPropagation(); void onPaste(); }}>
              <ClipboardPaste className="h-4 w-4" /> {t("paste")}
            </Button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onInputChange} />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
            onChange={onInputChange}
          />
        </div>
      ) : (
        <>
          {tips.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <p className="mb-1 flex items-center gap-2 font-medium text-primary"><Sparkles className="h-4 w-4" /> {t("ai")}</p>
              <ul className="list-inside list-disc text-muted">{tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><UploadCloud className="h-4 w-4" /> {t("addFiles")}</Button>
              <Button variant="outline" size="sm" onClick={() => folderInputRef.current?.click()}><FolderUp className="h-4 w-4" /> {t("addFolder")}</Button>
              <Button variant="outline" size="sm" onClick={() => void onPaste()}><ClipboardPaste className="h-4 w-4" /> {t("paste")}</Button>
              <Button variant="outline" size="sm" onClick={clearAll}><Trash2 className="h-4 w-4" /> {t("clear")}</Button>
            </div>
            <p className="text-xs text-muted">{items.length} {t("files")} · {active ? `${active.width}×${active.height}` : ""}</p>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onInputChange} />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
              onChange={onInputChange}
            />
          </div>

          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(["studio", "preview", "batch", "history", "api"] as Tab[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium capitalize",
                  tab === key ? "bg-primary text-white" : "text-muted hover:text-foreground",
                )}
              >
                {key === "history" && <History className="h-3.5 w-3.5" />}
                {key === "batch" && <FileArchive className="h-3.5 w-3.5" />}
                {t(key)}
              </button>
            ))}
          </div>

          {tab === "studio" && active && (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap gap-2">
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setActiveIdx(idx)}
                      onKeyDown={(e) => e.key === "Enter" && setActiveIdx(idx)}
                      className={cn(
                        "relative h-16 w-16 cursor-pointer overflow-hidden rounded-lg border-2",
                        idx === activeIdx ? "border-primary" : "border-border",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
                        className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="overflow-auto rounded-lg border border-border bg-muted/10">
                  <div className="flex min-h-[280px] items-center justify-center p-2" style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}>
                    <canvas ref={canvasRef} className="max-h-[480px] max-w-full object-contain shadow-md" />
                  </div>
                  <div className="flex justify-end gap-1 border-t border-border p-2">
                    <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}><ZoomOut className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}><ZoomIn className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>

              <div className="max-h-[85vh] space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={undo} disabled={!canUndo}><Undo2 className="h-3.5 w-3.5" /> {t("undo")}</Button>
                  <Button size="sm" variant="outline" onClick={redo} disabled={!canRedo}><Redo2 className="h-3.5 w-3.5" /> {t("redo")}</Button>
                  <Button size="sm" variant="outline" onClick={resetAdj}>{t("reset")}</Button>
                  <Button size="sm" variant="outline" onClick={() => void applyPreset("auto")}><Wand2 className="h-3.5 w-3.5" /> {t("autoEnhance")}</Button>
                </div>

                <Field label={t("presets")}>
                  <select
                    value={selectedPreset}
                    onChange={(e) => { const id = e.target.value; if (id) void applyPreset(id); else setSelectedPreset(""); }}
                    className={inputClass()}
                  >
                    <option value="">{t("selectPreset")}</option>
                    {(["fix", "portrait", "cinematic", "creative"] as const).map((cat) => (
                      <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                        {EDITOR_PRESETS.filter((p) => p.category === cat).map((p) => (
                          <option key={p.id} value={p.id}>{p.label} — {p.hint}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted">{t("transform")}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={rotateCW}><RotateCw className="h-3.5 w-3.5" /> {t("rotate")}</Button>
                    <Button size="sm" variant="outline" onClick={() => patchAdj({ flipH: !adj.flipH })}><FlipHorizontal className="h-3.5 w-3.5" /> {t("flipH")}</Button>
                    <Button size="sm" variant="outline" onClick={() => patchAdj({ flipV: !adj.flipV })}><FlipVertical className="h-3.5 w-3.5" /> {t("flipV")}</Button>
                  </div>
                </div>

                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("light")}</p>
                {SLIDER_GROUPS.light.map(renderSlider)}
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("color")}</p>
                {SLIDER_GROUPS.color.map(renderSlider)}
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("detail")}</p>
                {SLIDER_GROUPS.detail.map(renderSlider)}
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("effects")}</p>
                {SLIDER_GROUPS.effects.map(renderSlider)}

                <div className="flex flex-wrap gap-3 text-sm">
                  {(["grayscale", "sepia", "invert"] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2">
                      <input type="checkbox" checked={adj[k]} onChange={(e) => patchAdj({ [k]: e.target.checked })} className="accent-[var(--primary)]" />
                      {t(k)}
                    </label>
                  ))}
                </div>

                {recs.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4" /> {t("ai")}</p>
                    {recs.map((r, i) => (
                      <div key={i} className="flex justify-between gap-2 text-xs">
                        <div><p className="font-medium">{r.title}</p><p className="text-muted">{r.detail}</p></div>
                        <Button size="sm" variant="outline" onClick={() => void applyRec(r)}>{t("apply")}</Button>
                      </div>
                    ))}
                  </div>
                )}

                <Field label={t("format")}>
                  <select value={format} onChange={(e) => setFormat(e.target.value as EditorExportFormat)} className={inputClass()}>
                    <option value="image/png">PNG</option>
                    <option value="image/jpeg">JPG</option>
                    <option value="image/webp">WebP</option>
                  </select>
                </Field>
                {format !== "image/png" && (
                  <Field label={`${t("quality")}: ${Math.round(quality * 100)}%`}>
                    <input type="range" min={50} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-full accent-[var(--primary)]" />
                  </Field>
                )}

                <div className="flex flex-col gap-2 pt-2">
                  <Button variant="gradient" disabled={busy} onClick={() => void runEdit(true)}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("edit")}
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => { setTab("preview"); }}>
                    <Eye className="h-4 w-4" /> {t("previewBtn")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab === "preview" && active && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="relative mx-auto max-w-3xl overflow-hidden rounded-lg border border-border" style={{ aspectRatio: `${active.width}/${active.height}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={active.thumbUrl} alt={t("before")} className="absolute inset-0 h-full w-full object-contain" />
                {previewAfterUrl && (
                  <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - compareSlider}% 0 0)` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewAfterUrl} alt={t("after")} className="h-full w-full object-contain" />
                  </div>
                )}
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={compareSlider}
                  onChange={(e) => setCompareSlider(Number(e.target.value))}
                  className="absolute bottom-2 left-1/2 z-10 w-2/3 -translate-x-1/2 accent-[var(--primary)]"
                />
              </div>
              <div className="flex justify-between text-xs text-muted">
                <span>{t("before")}</span>
                <span>{t("after")}</span>
              </div>
            </div>
          )}

          {tab === "batch" && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted">{items.length} image(s) — same adjustment settings.</p>
              <ul className="max-h-64 divide-y divide-border overflow-auto text-sm">
                {items.map((i) => (
                  <li key={i.id} className="flex justify-between py-2">
                    <span className="truncate">{i.name}</span>
                    <span className="shrink-0 text-muted">{formatBytes(i.bytes)}</span>
                  </li>
                ))}
              </ul>
              <Button variant="gradient" disabled={busy} onClick={() => void runBatch()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} {t("batchZip")}
              </Button>
              {busy && progress > 0 && (
                <div className="h-2 overflow-hidden rounded-full bg-muted/30">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="rounded-xl border border-border bg-card p-4">
              {history.length === 0 ? (
                <p className="py-8 text-center text-muted">{t("emptyHistory")}</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="flex justify-between py-2">
                      <span>{h.name}</span>
                      <span className="text-muted">{formatBytes(h.bytes)} · {new Date(h.ts).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-primary" /> POST /api/v1/image/edit</p>
              <p className="text-sm text-muted">Send a base64 image with adjustment options. Returns edited image as base64.</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/image/edit \\
  -H "Content-Type: application/json" \\
  -d '{
    "image": "data:image/png;base64,iVBORw0KGgo...",
    "adjustments": {
      "brightness": 10,
      "contrast": 5,
      "saturation": -10,
      "exposure": 0,
      "hue": 0,
      "gamma": 1,
      "blur": 0,
      "sharpen": 15,
      "grayscale": false,
      "sepia": false,
      "invert": false,
      "vignette": 20
    },
    "format": "image/png",
    "quality": 0.92
  }'`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
