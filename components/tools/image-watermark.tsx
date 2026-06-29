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
  ImagePlus,
  Languages,
  Loader2,
  Lock,
  Move,
  Redo2,
  Star,
  Trash2,
  Type,
  Undo2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import { loadImageBitmap } from "./image-editor-utils";
import {
  DEFAULT_IMAGE_WATERMARK,
  applyWatermarkToCanvas,
  resolveImgAnchor,
  watermarkBatch,
  watermarkImageFile,
  zipWatermarkedImages,
  type ImageWatermarkSettings,
  type ImgWatermarkPosition,
} from "./image-watermark-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";
type Tab = "studio" | "preview" | "batch" | "history" | "api";
type ExportFormat = "image/png" | "image/jpeg" | "image/webp";

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
  bytes: number;
  ts: number;
}

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", preview: "Preview", batch: "Batch", history: "History", api: "API",
    drop: "Drop images, paste, or click to browse", dropHint: "Text · logo · tile · drag position — 100% in-browser",
    addFiles: "Add files", addFolder: "Add folder", paste: "Paste image", clear: "Clear all",
    watermark: "Apply & Download", previewBtn: "Preview", format: "Export format", quality: "Quality",
    private: "100% private · in-browser", favorite: "Favorite", favorited: "Favorited",
    undo: "Undo", redo: "Redo", batchZip: "Download all as ZIP", emptyHistory: "No watermarks yet.",
    text: "Text", logo: "Logo", opacity: "Opacity", rotation: "Rotation", position: "Position",
    fontSize: "Font size", color: "Color", tile: "Tile spacing", moveHint: "Drag watermark to reposition",
    tileLocked: "Tile mode — spacing controls only", files: "Files", uploadLogo: "Upload logo",
    logoScale: "Logo scale", spacingX: "Tile X", spacingY: "Tile Y",
  },
  es: {
    studio: "Estudio", preview: "Vista previa", batch: "Lote", history: "Historial", api: "API",
    drop: "Suelta imágenes", dropHint: "100% en el navegador",
    addFiles: "Añadir", addFolder: "Carpeta", paste: "Pegar", clear: "Limpiar",
    watermark: "Aplicar", previewBtn: "Vista previa", format: "Formato", quality: "Calidad",
    private: "100% privado", favorite: "Favorito", favorited: "Favorito",
    undo: "Deshacer", redo: "Rehacer", batchZip: "ZIP", emptyHistory: "Sin historial.",
    text: "Texto", logo: "Logo", opacity: "Opacidad", rotation: "Rotación", position: "Posición",
    fontSize: "Tamaño", color: "Color", tile: "Mosaico", moveHint: "Arrastra para mover",
    tileLocked: "Modo mosaico", files: "Archivos", uploadLogo: "Subir logo",
    logoScale: "Escala logo", spacingX: "Mosaico X", spacingY: "Mosaico Y",
  },
  de: {
    studio: "Studio", preview: "Vorschau", batch: "Stapel", history: "Verlauf", api: "API",
    drop: "Bilder ablegen", dropHint: "100% im Browser",
    addFiles: "Hinzufügen", addFolder: "Ordner", paste: "Einfügen", clear: "Löschen",
    watermark: "Anwenden", previewBtn: "Vorschau", format: "Format", quality: "Qualität",
    private: "100% privat", favorite: "Favorit", favorited: "Favorit",
    undo: "Rückgängig", redo: "Wiederholen", batchZip: "ZIP", emptyHistory: "Kein Verlauf.",
    text: "Text", logo: "Logo", opacity: "Deckkraft", rotation: "Drehung", position: "Position",
    fontSize: "Größe", color: "Farbe", tile: "Kachel", moveHint: "Ziehen zum Verschieben",
    tileLocked: "Kachelmodus", files: "Dateien", uploadLogo: "Logo hochladen",
    logoScale: "Logo-Skalierung", spacingX: "Kachel X", spacingY: "Kachel Y",
  },
  fr: {
    studio: "Studio", preview: "Aperçu", batch: "Lot", history: "Historique", api: "API",
    drop: "Déposez vos images", dropHint: "100% dans le navigateur",
    addFiles: "Ajouter", addFolder: "Dossier", paste: "Coller", clear: "Effacer",
    watermark: "Appliquer", previewBtn: "Aperçu", format: "Format", quality: "Qualité",
    private: "100% privé", favorite: "Favori", favorited: "Favori",
    undo: "Annuler", redo: "Rétablir", batchZip: "ZIP", emptyHistory: "Aucun historique.",
    text: "Texte", logo: "Logo", opacity: "Opacité", rotation: "Rotation", position: "Position",
    fontSize: "Taille", color: "Couleur", tile: "Mosaïque", moveHint: "Glisser pour déplacer",
    tileLocked: "Mode mosaïque", files: "Fichiers", uploadLogo: "Importer logo",
    logoScale: "Échelle logo", spacingX: "Mosaïque X", spacingY: "Mosaïque Y",
  },
  tr: {
    studio: "Stüdyo", preview: "Önizleme", batch: "Toplu", history: "Geçmiş", api: "API",
    drop: "Görüntüleri bırakın", dropHint: "%100 tarayıcıda",
    addFiles: "Ekle", addFolder: "Klasör", paste: "Yapıştır", clear: "Temizle",
    watermark: "Uygula", previewBtn: "Önizleme", format: "Format", quality: "Kalite",
    private: "%100 özel", favorite: "Favori", favorited: "Favori",
    undo: "Geri", redo: "İleri", batchZip: "ZIP", emptyHistory: "Geçmiş yok.",
    text: "Metin", logo: "Logo", opacity: "Opaklık", rotation: "Döndürme", position: "Konum",
    fontSize: "Boyut", color: "Renk", tile: "Döşeme", moveHint: "Sürükleyerek taşı",
    tileLocked: "Döşeme modu", files: "Dosyalar", uploadLogo: "Logo yükle",
    logoScale: "Logo ölçeği", spacingX: "Döşeme X", spacingY: "Döşeme Y",
  },
  hi: {
    studio: "स्टूडियो", preview: "पूर्वावलोकन", batch: "बैच", history: "इतिहास", api: "API",
    drop: "छवियाँ छोड़ें", dropHint: "100% ब्राउज़र में",
    addFiles: "जोड़ें", addFolder: "फ़ोल्डर", paste: "पेस्ट", clear: "साफ़",
    watermark: "लागू करें", previewBtn: "पूर्वावलोकन", format: "प्रारूप", quality: "गुणवत्ता",
    private: "100% निजी", favorite: "पसंदीदा", favorited: "पसंदीदा",
    undo: "पूर्ववत", redo: "फिर", batchZip: "ZIP", emptyHistory: "कोई इतिहास नहीं।",
    text: "टेक्स्ट", logo: "लोगो", opacity: "अपारदर्शिता", rotation: "घुमाव", position: "स्थिति",
    fontSize: "आकार", color: "रंग", tile: "टाइल", moveHint: "खींचकर स्थान बदलें",
    tileLocked: "टाइल मोड", files: "फ़ाइलें", uploadLogo: "लोगो अपलोड",
    logoScale: "लोगो पैमाना", spacingX: "टाइल X", spacingY: "टाइल Y",
  },
  pt: {
    studio: "Estúdio", preview: "Prévia", batch: "Lote", history: "Histórico", api: "API",
    drop: "Solte imagens", dropHint: "100% no navegador",
    addFiles: "Adicionar", addFolder: "Pasta", paste: "Colar", clear: "Limpar",
    watermark: "Aplicar", previewBtn: "Prévia", format: "Formato", quality: "Qualidade",
    private: "100% privado", favorite: "Favorito", favorited: "Favorito",
    undo: "Desfazer", redo: "Refazer", batchZip: "ZIP", emptyHistory: "Sem histórico.",
    text: "Texto", logo: "Logo", opacity: "Opacidade", rotation: "Rotação", position: "Posição",
    fontSize: "Tamanho", color: "Cor", tile: "Mosaico", moveHint: "Arraste para mover",
    tileLocked: "Modo mosaico", files: "Arquivos", uploadLogo: "Enviar logo",
    logoScale: "Escala logo", spacingX: "Mosaico X", spacingY: "Mosaico Y",
  },
  ja: {
    studio: "スタジオ", preview: "プレビュー", batch: "一括", history: "履歴", api: "API",
    drop: "画像をドロップ", dropHint: "100%ブラウザ内処理",
    addFiles: "追加", addFolder: "フォルダ", paste: "ペースト", clear: "消去",
    watermark: "適用", previewBtn: "プレビュー", format: "形式", quality: "品質",
    private: "100%プライベート", favorite: "お気に入り", favorited: "お気に入り",
    undo: "元に戻す", redo: "やり直し", batchZip: "ZIP", emptyHistory: "履歴なし。",
    text: "テキスト", logo: "ロゴ", opacity: "不透明度", rotation: "回転", position: "位置",
    fontSize: "サイズ", color: "色", tile: "タイル", moveHint: "ドラッグで移動",
    tileLocked: "タイルモード", files: "ファイル", uploadLogo: "ロゴをアップロード",
    logoScale: "ロゴスケール", spacingX: "タイル X", spacingY: "タイル Y",
  },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français",
  tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

const POSITIONS: { id: ImgWatermarkPosition; label: string }[] = [
  { id: "diagonal", label: "Diagonal" },
  { id: "center", label: "Center" },
  { id: "tile", label: "Tile / repeat" },
  { id: "top-left", label: "Top left" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-right", label: "Bottom right" },
  { id: "custom", label: "Custom (drag)" },
];

const SETTINGS_KEY = "toolnest-image-watermark-settings";
const HISTORY_KEY = "toolnest-image-watermark-history";
const LANG_KEY = "toolnest-image-watermark-lang";

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

let _id = 0;
const nextId = () => `wm-${Date.now()}-${++_id}`;

export function ImageWatermark() {
  const favorites = useFavorites();
  const slug = "image-watermark";

  const [items, setItems] = useState<ImageItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [wm, setWm] = useState<ImageWatermarkSettings>({ ...DEFAULT_IMAGE_WATERMARK });
  const [format, setFormat] = useState<ExportFormat>("image/png");
  const [quality, setQuality] = useState(0.92);
  const [tab, setTab] = useState<Tab>("studio");
  const [lang, setLang] = useState<Lang>("en");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<ImageWatermarkSettings[]>([]);
  const redoStack = useRef<ImageWatermarkSettings[]>([]);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; rect: DOMRect } | null>(null);

  const t = useCallback((k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k, [lang]);
  const active = items[activeIdx];
  const anchor = useMemo(() => resolveImgAnchor(wm), [wm]);

  const pushUndo = useCallback((prev: ImageWatermarkSettings) => {
    undoStack.current = [...undoStack.current.slice(-49), { ...prev, logoBlob: prev.logoBlob }];
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const patchWm = useCallback(
    (patch: Partial<ImageWatermarkSettings>) => {
      setWm((prev) => {
        pushUndo(prev);
        return { ...prev, ...patch };
      });
    },
    [pushUndo],
  );

  const patchWmLive = (patch: Partial<ImageWatermarkSettings>) => {
    setWm((prev) => ({ ...prev, ...patch }));
  };

  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setWm((cur) => {
      redoStack.current.push({ ...cur, logoBlob: cur.logoBlob });
      setCanRedo(true);
      setCanUndo(undoStack.current.length > 0);
      return { ...prev, logoBlob: prev.logoBlob ?? cur.logoBlob };
    });
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    setWm((cur) => {
      undoStack.current.push({ ...cur, logoBlob: cur.logoBlob });
      setCanUndo(true);
      setCanRedo(redoStack.current.length > 0);
      return { ...next, logoBlob: next.logoBlob ?? cur.logoBlob };
    });
  };

  const onPositionChange = (pos: ImgWatermarkPosition) => {
    if (pos === "tile") {
      patchWm({ position: pos });
      return;
    }
    const a = pos === "custom" ? { x: wm.customX, y: wm.customY } : resolveImgAnchor({ ...wm, position: pos });
    patchWm({ position: pos, customX: a.x, customY: a.y });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { wm?: Partial<ImageWatermarkSettings>; format?: ExportFormat; quality?: number };
        if (s.wm) setWm((w) => ({ ...w, ...s.wm, logoBlob: w.logoBlob }));
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
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ wm: { ...wm, logoBlob: undefined }, format, quality }));
    } catch { /* ignore */ }
  }, [wm, format, quality]);

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
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const addFiles = useCallback(async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name));
    if (!imgs.length) {
      toast.error("No supported images");
      return;
    }
    const added: ImageItem[] = [];
    for (const file of imgs) {
      try {
        const bmp = await loadImageBitmap(file);
        added.push({
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
            files.push(new File([blob], `pasted-${Date.now()}.png`, { type }));
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
      const removed = prev.find((i) => i.id === id);
      if (removed) URL.revokeObjectURL(removed.thumbUrl);
      const next = prev.filter((i) => i.id !== id);
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
      const out = await applyWatermarkToCanvas(bmp, wm);
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
  }, [active, wm]);

  const onPreviewPointerDown = (e: ReactPointerEvent) => {
    if (wm.position === "tile") return;
    e.preventDefault();
    const rect = previewRef.current!.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: wm.customX,
      origY: wm.customY,
      rect,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPreviewPointerMove = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / d.rect.width;
    const dy = (e.clientY - d.startY) / d.rect.height;
    patchWmLive({
      position: "custom",
      customX: clamp01(d.origX + dx),
      customY: clamp01(d.origY + dy),
    });
  };

  const onPreviewPointerUp = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    pushUndo({ ...wm, position: "custom" });
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch { /* ignore */ }
  };

  const pushHistory = (name: string, blob: Blob) => {
    setHistory((prev) => [{ id: nextId(), name, bytes: blob.size, ts: Date.now() }, ...prev].slice(0, 50));
  };

  const runWatermark = async (download = true) => {
    if (!active) {
      toast.error("Add an image first");
      return;
    }
    setBusy(true);
    try {
      const blob = await watermarkImageFile(active.file, wm, format, quality);
      if (download) {
        const ext = format === "image/png" ? "png" : format === "image/webp" ? "webp" : "jpg";
        downloadBlob(blob, active.name.replace(/\.[^.]+$/, "") + `-watermarked.${ext}`);
        toast.success("Watermarked image saved");
      } else {
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setTab("preview");
      }
      pushHistory(active.name, blob);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
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
      const results = await watermarkBatch(items.map((i) => i.file), wm, format, setProgress);
      if (results.length === 1) {
        downloadBlob(results[0]!.blob, results[0]!.name);
      } else {
        const zip = await zipWatermarkedImages(results);
        downloadBlob(zip, "watermarked-images.zip");
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

  const onLogoUpload = (file: File) => {
    patchWm({ type: "image", logoBlob: file });
    toast.success("Logo loaded");
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
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center",
            dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
          )}
        >
          <UploadCloud className="mb-4 h-14 w-14 text-primary" />
          <p className="font-display text-xl font-semibold">Ultra Image Watermark Studio</p>
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
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><UploadCloud className="h-4 w-4" /> {t("addFiles")}</Button>
              <Button variant="outline" size="sm" onClick={() => folderInputRef.current?.click()}><FolderUp className="h-4 w-4" /> {t("addFolder")}</Button>
              <Button variant="outline" size="sm" onClick={clearAll}><Trash2 className="h-4 w-4" /> {t("clear")}</Button>
            </div>
            <p className="text-xs text-muted">{items.length} {t("files")}</p>
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
                {t(key)}
              </button>
            ))}
          </div>

          {tab === "studio" && active && (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap gap-2">
                  {items.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveIdx(idx)}
                      className={cn("relative h-14 w-14 overflow-hidden rounded-lg border-2", idx === activeIdx ? "border-primary" : "border-border")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
                <div
                  ref={previewRef}
                  className="relative overflow-hidden rounded-lg border border-border bg-muted/10 select-none"
                  onPointerMove={onPreviewPointerMove}
                  onPointerUp={onPreviewPointerUp}
                  onPointerCancel={onPreviewPointerUp}
                >
                  <canvas ref={canvasRef} className="mx-auto max-h-[420px] max-w-full" />
                  {wm.position !== "tile" && (
                    <div
                      className="absolute z-10 cursor-move touch-none rounded border-2 border-dashed border-primary/70 bg-primary/5 px-2 py-1"
                      style={{
                        left: `${anchor.x * 100}%`,
                        top: `${anchor.y * 100}%`,
                        transform: `translate(-50%, -50%) rotate(${wm.rotation}deg)`,
                      }}
                      onPointerDown={onPreviewPointerDown}
                    >
                      {wm.type === "text" ? (
                        <span className="whitespace-nowrap font-bold" style={{ color: wm.color, fontSize: wm.fontSize * 0.35, opacity: wm.opacity + 0.2 }}>
                          {wm.text || "WATERMARK"}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-muted">LOGO</span>
                      )}
                      <Move className="pointer-events-none absolute -left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-primary" />
                    </div>
                  )}
                  <p className="border-t border-border px-2 py-1 text-center text-[10px] text-muted">
                    {wm.position === "tile" ? t("tileLocked") : t("moveHint")}
                  </p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={wm.type === "text" ? "default" : "outline"} onClick={() => patchWm({ type: "text" })}>
                    <Type className="h-3.5 w-3.5" /> {t("text")}
                  </Button>
                  <Button size="sm" variant={wm.type === "image" ? "default" : "outline"} onClick={() => patchWm({ type: "image" })}>
                    <ImagePlus className="h-3.5 w-3.5" /> {t("logo")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={undo} disabled={!canUndo}><Undo2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={redo} disabled={!canRedo}><Redo2 className="h-3.5 w-3.5" /></Button>
                </div>

                {wm.type === "text" && (
                  <Field label={t("text")}>
                    <input value={wm.text} onChange={(e) => patchWm({ text: e.target.value })} className={inputClass()} placeholder="CONFIDENTIAL" />
                  </Field>
                )}
                {wm.type === "image" && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
                      <ImagePlus className="h-4 w-4" /> {t("uploadLogo")}
                    </Button>
                    <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoUpload(f); e.target.value = ""; }} />
                    <Field label={`${t("logoScale")}: ${Math.round(wm.logoScale * 100)}%`}>
                      <input type="range" min={5} max={80} value={Math.round(wm.logoScale * 100)} onChange={(e) => patchWm({ logoScale: Number(e.target.value) / 100 })} className="w-full accent-[var(--primary)]" />
                    </Field>
                  </>
                )}

                {wm.type === "text" && (
                  <Field label={`${t("fontSize")}: ${wm.fontSize}`}>
                    <input type="range" min={12} max={120} value={wm.fontSize} onChange={(e) => patchWm({ fontSize: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("color")}>
                    <input type="color" value={wm.color} onChange={(e) => patchWm({ color: e.target.value })} className="h-10 w-full cursor-pointer rounded-lg border border-border" />
                  </Field>
                  <Field label={`${t("opacity")}: ${Math.round(wm.opacity * 100)}%`}>
                    <input type="range" min={5} max={90} value={Math.round(wm.opacity * 100)} onChange={(e) => patchWm({ opacity: Number(e.target.value) / 100 })} className="w-full accent-[var(--primary)]" />
                  </Field>
                </div>

                <Field label={`${t("rotation")}: ${wm.rotation}°`}>
                  <input type="range" min={-90} max={90} value={wm.rotation} onChange={(e) => patchWm({ rotation: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                </Field>

                <Field label={t("position")}>
                  <select value={wm.position} onChange={(e) => onPositionChange(e.target.value as ImgWatermarkPosition)} className={inputClass()}>
                    {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </Field>

                {wm.position === "tile" && (
                  <>
                    <Field label={`${t("spacingX")}: ${wm.tileSpacingX}px`}>
                      <input type="range" min={80} max={400} value={wm.tileSpacingX} onChange={(e) => patchWm({ tileSpacingX: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                    </Field>
                    <Field label={`${t("spacingY")}: ${wm.tileSpacingY}px`}>
                      <input type="range" min={60} max={320} value={wm.tileSpacingY} onChange={(e) => patchWm({ tileSpacingY: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                    </Field>
                  </>
                )}

                {wm.position !== "tile" && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={`X: ${Math.round(anchor.x * 100)}%`}>
                      <input type="range" min={0} max={100} value={Math.round(anchor.x * 100)} onChange={(e) => patchWm({ position: "custom", customX: Number(e.target.value) / 100 })} className="w-full accent-[var(--primary)]" />
                    </Field>
                    <Field label={`Y: ${Math.round(anchor.y * 100)}%`}>
                      <input type="range" min={0} max={100} value={Math.round(anchor.y * 100)} onChange={(e) => patchWm({ position: "custom", customY: Number(e.target.value) / 100 })} className="w-full accent-[var(--primary)]" />
                    </Field>
                  </div>
                )}

                <Field label={t("format")}>
                  <select value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} className={inputClass()}>
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
                  <Button variant="gradient" disabled={busy} onClick={() => void runWatermark(true)}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("watermark")}
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => void runWatermark(false)}>
                    <Eye className="h-4 w-4" /> {t("previewBtn")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab === "preview" && (
            <div className="rounded-xl border border-border bg-card p-4">
              {previewUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={previewUrl} alt="Preview" className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain" />
              ) : (
                <p className="py-16 text-center text-muted">Run Preview from Studio first.</p>
              )}
            </div>
          )}

          {tab === "batch" && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted">{items.length} image(s) — same watermark settings.</p>
              <ul className="max-h-64 divide-y divide-border overflow-auto text-sm">
                {items.map((i) => (
                  <li key={i.id} className="flex justify-between py-2">
                    <span className="truncate">{i.name}</span>
                    <span className="text-muted">{formatBytes(i.bytes)}</span>
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
                      <span className="text-muted">{formatBytes(h.bytes)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-primary" /> POST /api/v1/image/watermark</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/image/watermark \\
  -H "Content-Type: application/json" \\
  -d '{
    "image": "data:image/png;base64,iVBORw0KGgo...",
    "watermark": {
      "type": "text",
      "text": "CONFIDENTIAL",
      "fontSize": 48,
      "color": "#c0392b",
      "opacity": 0.35,
      "rotation": -35,
      "position": "diagonal",
      "customX": 0.5,
      "customY": 0.5,
      "tileSpacingX": 200,
      "tileSpacingY": 160,
      "logoScale": 0.25
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
