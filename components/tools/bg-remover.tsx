"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
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
  Pipette,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import { loadImageBitmap } from "./image-editor-utils";
import {
  DEFAULT_BG_REMOVE,
  removeBackgroundBatch,
  removeBackgroundFromCanvas,
  removeBackgroundFromFile,
  smartBgTips,
  zipBgRemoved,
  type BgRemoveMode,
  type BgRemoveSettings,
} from "./bg-remover-utils";

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
  bytes: number;
  ts: number;
}

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", preview: "Preview", batch: "Batch", history: "History", api: "API",
    drop: "Drop images, paste, or click to browse", dropHint: "Auto · color pick · green screen — PNG transparency · 100% in-browser",
    addFiles: "Add files", addFolder: "Add folder", paste: "Paste image", clear: "Clear all",
    remove: "Remove BG & Download PNG", previewBtn: "Preview", private: "100% private · in-browser",
    favorite: "Favorite", favorited: "Favorited", batchZip: "Download all as ZIP",
    emptyHistory: "No background removals yet.", mode: "Mode", threshold: "Threshold",
    feather: "Feather", spill: "Spill suppression", pickColor: "Background color",
    pickHint: "Click image to sample background color", before: "Original", after: "Transparent",
    ai: "Tips", files: "Files", auto: "Auto (corner sample)", color: "Color pick", green: "Green screen",
  },
  es: {
    studio: "Estudio", preview: "Vista previa", batch: "Lote", history: "Historial", api: "API",
    drop: "Suelta imágenes", dropHint: "100% en el navegador",
    addFiles: "Añadir", addFolder: "Carpeta", paste: "Pegar", clear: "Limpiar",
    remove: "Quitar fondo", previewBtn: "Vista previa", private: "100% privado",
    favorite: "Favorito", favorited: "Favorito", batchZip: "ZIP", emptyHistory: "Sin historial.",
    mode: "Modo", threshold: "Umbral", feather: "Suavizado", spill: "Supresión de spill",
    pickColor: "Color de fondo", pickHint: "Clic para muestrear", before: "Original", after: "Transparente",
    ai: "Consejos", files: "Archivos", auto: "Auto", color: "Color", green: "Pantalla verde",
  },
  de: {
    studio: "Studio", preview: "Vorschau", batch: "Stapel", history: "Verlauf", api: "API",
    drop: "Bilder ablegen", dropHint: "100% im Browser",
    addFiles: "Hinzufügen", addFolder: "Ordner", paste: "Einfügen", clear: "Löschen",
    remove: "Hintergrund entfernen", previewBtn: "Vorschau", private: "100% privat",
    favorite: "Favorit", favorited: "Favorit", batchZip: "ZIP", emptyHistory: "Kein Verlauf.",
    mode: "Modus", threshold: "Schwellwert", feather: "Weichzeichnen", spill: "Spill-Unterdrückung",
    pickColor: "Hintergrundfarbe", pickHint: "Klicken zum Auswählen", before: "Original", after: "Transparent",
    ai: "Tipps", files: "Dateien", auto: "Auto", color: "Farbe", green: "Greenscreen",
  },
  fr: {
    studio: "Studio", preview: "Aperçu", batch: "Lot", history: "Historique", api: "API",
    drop: "Déposez vos images", dropHint: "100% dans le navigateur",
    addFiles: "Ajouter", addFolder: "Dossier", paste: "Coller", clear: "Effacer",
    remove: "Supprimer le fond", previewBtn: "Aperçu", private: "100% privé",
    favorite: "Favori", favorited: "Favori", batchZip: "ZIP", emptyHistory: "Aucun historique.",
    mode: "Mode", threshold: "Seuil", feather: "Adoucissement", spill: "Suppression spill",
    pickColor: "Couleur de fond", pickHint: "Cliquez pour échantillonner", before: "Original", after: "Transparent",
    ai: "Conseils", files: "Fichiers", auto: "Auto", color: "Couleur", green: "Fond vert",
  },
  tr: {
    studio: "Stüdyo", preview: "Önizleme", batch: "Toplu", history: "Geçmiş", api: "API",
    drop: "Görüntüleri bırakın", dropHint: "%100 tarayıcıda",
    addFiles: "Ekle", addFolder: "Klasör", paste: "Yapıştır", clear: "Temizle",
    remove: "Arka planı kaldır", previewBtn: "Önizleme", private: "%100 özel",
    favorite: "Favori", favorited: "Favori", batchZip: "ZIP", emptyHistory: "Geçmiş yok.",
    mode: "Mod", threshold: "Eşik", feather: "Yumuşatma", spill: "Spill baskılama",
    pickColor: "Arka plan rengi", pickHint: "Renk örneklemek için tıklayın", before: "Orijinal", after: "Şeffaf",
    ai: "İpuçları", files: "Dosyalar", auto: "Otomatik", color: "Renk", green: "Yeşil perde",
  },
  hi: {
    studio: "स्टूडियो", preview: "पूर्वावलोकन", batch: "बैच", history: "इतिहास", api: "API",
    drop: "छवियाँ छोड़ें", dropHint: "100% ब्राउज़र में",
    addFiles: "जोड़ें", addFolder: "फ़ोल्डर", paste: "पेस्ट", clear: "साफ़",
    remove: "पृष्ठभूमि हटाएँ", previewBtn: "पूर्वावलोकन", private: "100% निजी",
    favorite: "पसंदीदा", favorited: "पसंदीदा", batchZip: "ZIP", emptyHistory: "कोई इतिहास नहीं।",
    mode: "मोड", threshold: "थreshold", feather: "फ़ेदर", spill: "स्पिल दबाव",
    pickColor: "पृष्ठभूमि रंग", pickHint: "रंग चुनने के लिए क्लिक करें", before: "मूल", after: "पारदर्शी",
    ai: "सुझाव", files: "फ़ाइलें", auto: "ऑटो", color: "रंग", green: "ग्रीन स्क्रीन",
  },
  pt: {
    studio: "Estúdio", preview: "Prévia", batch: "Lote", history: "Histórico", api: "API",
    drop: "Solte imagens", dropHint: "100% no navegador",
    addFiles: "Adicionar", addFolder: "Pasta", paste: "Colar", clear: "Limpar",
    remove: "Remover fundo", previewBtn: "Prévia", private: "100% privado",
    favorite: "Favorito", favorited: "Favorito", batchZip: "ZIP", emptyHistory: "Sem histórico.",
    mode: "Modo", threshold: "Limite", feather: "Suavizar", spill: "Supressão spill",
    pickColor: "Cor de fundo", pickHint: "Clique para amostrar", before: "Original", after: "Transparente",
    ai: "Dicas", files: "Arquivos", auto: "Auto", color: "Cor", green: "Tela verde",
  },
  ja: {
    studio: "スタジオ", preview: "プレビュー", batch: "一括", history: "履歴", api: "API",
    drop: "画像をドロップ", dropHint: "100%ブラウザ内処理",
    addFiles: "追加", addFolder: "フォルダ", paste: "ペースト", clear: "消去",
    remove: "背景を削除", previewBtn: "プレビュー", private: "100%プライベート",
    favorite: "お気に入り", favorited: "お気に入り", batchZip: "ZIP", emptyHistory: "履歴なし。",
    mode: "モード", threshold: "しきい値", feather: "フェザー", spill: "スピル抑制",
    pickColor: "背景色", pickHint: "クリックで色を取得", before: "元", after: "透過",
    ai: "ヒント", files: "ファイル", auto: "自動", color: "色", green: "グリーンスクリーン",
  },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français",
  tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

const SETTINGS_KEY = "toolnest-bg-remover-settings";
const HISTORY_KEY = "toolnest-bg-remover-history";
const LANG_KEY = "toolnest-bg-remover-lang";

const MODES: { id: BgRemoveMode; labelKey: string }[] = [
  { id: "auto", labelKey: "auto" },
  { id: "color", labelKey: "color" },
  { id: "green", labelKey: "green" },
];

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

let _id = 0;
const nextId = () => `bg-${Date.now()}-${++_id}`;

export function BgRemover() {
  const favorites = useFavorites();
  const slug = "bg-remover";

  const [items, setItems] = useState<ImageItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [settings, setSettings] = useState<BgRemoveSettings>({ ...DEFAULT_BG_REMOVE });
  const [tab, setTab] = useState<Tab>("studio");
  const [lang, setLang] = useState<Lang>("en");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [compareSlider, setCompareSlider] = useState(50);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const t = useCallback((k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k, [lang]);
  const active = items[activeIdx];
  const tips = useMemo(() => smartBgTips(settings.mode), [settings.mode]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) setSettings((s) => ({ ...s, ...JSON.parse(raw) }));
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h) as HistoryEntry[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch { /* ignore */ }
  }, [settings]);

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
    sourceCanvasRef.current = null;
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
      const src = document.createElement("canvas");
      src.width = bmp.width;
      src.height = bmp.height;
      src.getContext("2d")!.drawImage(bmp, 0, 0);
      bmp.close();
      sourceCanvasRef.current = src;

      const out = removeBackgroundFromCanvas(src, settings);
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
  }, [active, settings]);

  useEffect(() => {
    if (!active || tab !== "preview") return;
    let cancelled = false;
    void (async () => {
      const bmp = await loadImageBitmap(active.file);
      if (cancelled) {
        bmp.close();
        return;
      }
      const src = document.createElement("canvas");
      src.width = bmp.width;
      src.height = bmp.height;
      src.getContext("2d")!.drawImage(bmp, 0, 0);
      bmp.close();
      const out = removeBackgroundFromCanvas(src, settings);
      const el = previewCanvasRef.current;
      if (el) {
        el.width = out.width;
        el.height = out.height;
        el.getContext("2d")!.drawImage(out, 0, 0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, settings, tab]);

  const onCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (settings.mode !== "color" || !sourceCanvasRef.current || !canvasRef.current) return;
    const canvas = sourceCanvasRef.current;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    const ctx = canvas.getContext("2d")!;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const hex = rgbToHex(pixel[0]!, pixel[1]!, pixel[2]!);
    setSettings((s) => ({ ...s, pickColor: hex, mode: "color" }));
    toast.success(`Color picked: ${hex}`);
  };

  const pushHistory = (name: string, blob: Blob) => {
    setHistory((prev) => [{ id: nextId(), name, bytes: blob.size, ts: Date.now() }, ...prev].slice(0, 50));
  };

  const runRemove = async () => {
    if (!active) {
      toast.error("Add an image first");
      return;
    }
    setBusy(true);
    try {
      const blob = await removeBackgroundFromFile(active.file, settings);
      downloadBlob(blob, active.name.replace(/\.[^.]+$/, "") + "-nobg.png");
      pushHistory(active.name, blob);
      toast.success("Background removed · PNG with transparency");
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
      const results = await removeBackgroundBatch(items.map((i) => i.file), settings, setProgress);
      if (results.length === 1) {
        downloadBlob(results[0]!.blob, results[0]!.name);
      } else {
        const zip = await zipBgRemoved(results);
        downloadBlob(zip, "nobg-images.zip");
      }
      results.forEach((r) => pushHistory(r.name, r.blob));
      toast.success(`Batch complete · ${results.length} PNG(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
      setProgress(0);
    }
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
          <p className="font-display text-xl font-semibold">Ultra Background Remover</p>
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
                {key === "history" && <History className="h-3.5 w-3.5" />}
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
                      className={cn("relative h-14 w-14 cursor-pointer overflow-hidden rounded-lg border-2", idx === activeIdx ? "border-primary" : "border-border")}
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
                <div
                  className={cn(
                    "overflow-auto rounded-lg border border-border p-2",
                    "bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]",
                  )}
                >
                  <canvas
                    ref={canvasRef}
                    onClick={onCanvasClick}
                    className={cn(
                      "mx-auto max-h-[480px] max-w-full object-contain",
                      settings.mode === "color" && "cursor-crosshair",
                    )}
                    title={settings.mode === "color" ? t("pickHint") : undefined}
                  />
                </div>
                {settings.mode === "color" && (
                  <p className="flex items-center gap-2 text-xs text-muted">
                    <Pipette className="h-3.5 w-3.5 text-primary" /> {t("pickHint")}
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                <Field label={t("mode")}>
                  <select
                    value={settings.mode}
                    onChange={(e) => setSettings({ ...settings, mode: e.target.value as BgRemoveMode })}
                    className={inputClass()}
                  >
                    {MODES.map((m) => (
                      <option key={m.id} value={m.id}>{t(m.labelKey)}</option>
                    ))}
                  </select>
                </Field>

                {settings.mode === "color" && (
                  <Field label={t("pickColor")}>
                    <input
                      type="color"
                      value={settings.pickColor}
                      onChange={(e) => setSettings({ ...settings, pickColor: e.target.value })}
                      className="h-10 w-full cursor-pointer rounded-lg border border-border"
                    />
                  </Field>
                )}

                <Field label={`${t("threshold")}: ${settings.threshold}`}>
                  <input type="range" min={10} max={120} value={settings.threshold} onChange={(e) => setSettings({ ...settings, threshold: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                </Field>
                <Field label={`${t("feather")}: ${settings.feather}`}>
                  <input type="range" min={0} max={30} value={settings.feather} onChange={(e) => setSettings({ ...settings, feather: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                </Field>
                <Field label={`${t("spill")}: ${settings.spill}%`}>
                  <input type="range" min={0} max={100} value={settings.spill} onChange={(e) => setSettings({ ...settings, spill: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                </Field>

                <div className="flex flex-col gap-2 pt-2">
                  <Button variant="gradient" disabled={busy} onClick={() => void runRemove()}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("remove")}
                  </Button>
                  <Button variant="outline" onClick={() => setTab("preview")}>
                    <Eye className="h-4 w-4" /> {t("previewBtn")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab === "preview" && active && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div
                className="relative mx-auto max-w-3xl overflow-hidden rounded-lg border border-border"
                style={{ aspectRatio: active.width && active.height ? `${active.width}/${active.height}` : "16/9" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={active.thumbUrl} alt={t("before")} className="absolute inset-0 h-full w-full object-contain" />
                <div
                  className="absolute inset-0 overflow-hidden bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
                  style={{ clipPath: `inset(0 ${100 - compareSlider}% 0 0)` }}
                >
                  <canvas ref={previewCanvasRef} className="h-full w-full object-contain" />
                </div>
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
              <p className="text-sm text-muted">{items.length} image(s) — PNG with transparency.</p>
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
                      <span className="text-muted">{formatBytes(h.bytes)} · {new Date(h.ts).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-primary" /> POST /api/v1/image/bg-remove</p>
              <p className="text-sm text-muted">Send a base64 image with removal settings. Returns PNG with alpha channel.</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/image/bg-remove \\
  -H "Content-Type: application/json" \\
  -d '{
    "image": "data:image/png;base64,iVBORw0KGgo...",
    "settings": {
      "mode": "auto",
      "pickColor": "#ffffff",
      "threshold": 42,
      "feather": 8,
      "spill": 0
    }
  }'`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
