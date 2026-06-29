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
  Check,
  ClipboardPaste,
  Download,
  Eye,
  FileArchive,
  FlipHorizontal2,
  FlipVertical2,
  FolderUp,
  History,
  Languages,
  Loader2,
  Maximize2,
  Redo2,
  RotateCcw,
  RotateCw,
  Settings2,
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
  DEFAULT_EXPORT,
  DEFAULT_TRANSFORM,
  defaultPerspective,
  aiRecommendRotate,
  buildOutputName,
  detectHorizonAngle,
  exportRotatedImage,
  isLosslessPath,
  isSupportedInput,
  loadImageMeta,
  rotateBatch,
  totalAngleDeg,
  type RotateExportOptions,
  type RotateItem,
  type RotateTransform,
  type Rotation90,
} from "./image-rotate-utils";
import { FORMAT_LABELS, LOSSY_FORMATS, type OutputFormat } from "./image-compressor-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";
type Tab = "studio" | "compare" | "batch" | "history" | "api";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", compare: "Compare", batch: "Batch", history: "History", api: "API",
    drop: "Drop images, paste, or browse", dropHint: "JPG · PNG · WebP · AVIF · GIF · BMP · HEIC · SVG — 100% in-browser",
    addFiles: "Add files", addFolder: "Folder", paste: "Paste", rotate: "Rotate & Download", preview: "Preview", clear: "Clear",
    exportFmt: "Format", quality: "Quality", private: "100% private · in-browser", favorite: "Favorite", favorited: "Favorited",
    ai: "AI tips", undo: "Undo", redo: "Redo", straighten: "Straighten", customAngle: "Custom angle", batchZip: "ZIP all",
    emptyHistory: "No rotations yet.", flipH: "Flip H", flipV: "Flip V", horizon: "Auto level", exif: "EXIF orient",
    canvasMode: "Canvas", expand: "Expand", crop: "Crop tight", original: "Original size", lossless: "Lossless path",
  },
  es: { studio: "Estudio", compare: "Comparar", batch: "Lote", history: "Historial", api: "API", drop: "Suelta imágenes", dropHint: "100% en navegador", addFiles: "Añadir", addFolder: "Carpeta", paste: "Pegar", rotate: "Girar", preview: "Vista", clear: "Limpiar", exportFmt: "Formato", quality: "Calidad", private: "100% privado", favorite: "Favorito", favorited: "Favorito", ai: "Consejos IA", undo: "Deshacer", redo: "Rehacer", straighten: "Enderezar", customAngle: "Ángulo", batchZip: "ZIP", emptyHistory: "Sin giros.", flipH: "Volteo H", flipV: "Volteo V", horizon: "Nivel auto", exif: "EXIF", canvasMode: "Lienzo", expand: "Expandir", crop: "Recortar", original: "Original", lossless: "Sin pérdida" },
  de: { studio: "Studio", compare: "Vergleich", batch: "Stapel", history: "Verlauf", api: "API", drop: "Bilder ablegen", dropHint: "100% im Browser", addFiles: "Hinzufügen", addFolder: "Ordner", paste: "Einfügen", rotate: "Drehen", preview: "Vorschau", clear: "Löschen", exportFmt: "Format", quality: "Qualität", private: "100% privat", favorite: "Favorit", favorited: "Favorit", ai: "KI-Tipps", undo: "Rückgängig", redo: "Wiederholen", straighten: "Gerade", customAngle: "Winkel", batchZip: "ZIP", emptyHistory: "Keine.", flipH: "Spiegeln H", flipV: "Spiegeln V", horizon: "Auto-Nivel", exif: "EXIF", canvasMode: "Leinwand", expand: "Erweitern", crop: "Zuschneiden", original: "Original", lossless: "Verlustfrei" },
  fr: { studio: "Studio", compare: "Comparer", batch: "Lot", history: "Historique", api: "API", drop: "Déposez images", dropHint: "100% navigateur", addFiles: "Ajouter", addFolder: "Dossier", paste: "Coller", rotate: "Pivoter", preview: "Aperçu", clear: "Effacer", exportFmt: "Format", quality: "Qualité", private: "100% privé", favorite: "Favori", favorited: "Favori", ai: "Conseils IA", undo: "Annuler", redo: "Rétablir", straighten: "Redresser", customAngle: "Angle", batchZip: "ZIP", emptyHistory: "Aucun.", flipH: "Miroir H", flipV: "Miroir V", horizon: "Nivel auto", exif: "EXIF", canvasMode: "Toile", expand: "Étendre", crop: "Rogner", original: "Original", lossless: "Sans perte" },
  tr: { studio: "Stüdyo", compare: "Karşılaştır", batch: "Toplu", history: "Geçmiş", api: "API", drop: "Görsel bırakın", dropHint: "%100 tarayıcı", addFiles: "Ekle", addFolder: "Klasör", paste: "Yapıştır", rotate: "Döndür", preview: "Önizleme", clear: "Temizle", exportFmt: "Format", quality: "Kalite", private: "%100 özel", favorite: "Favori", favorited: "Favori", ai: "AI ipuçları", undo: "Geri", redo: "İleri", straighten: "Düzelt", customAngle: "Açı", batchZip: "ZIP", emptyHistory: "Yok.", flipH: "Çevir H", flipV: "Çevir V", horizon: "Otomatik", exif: "EXIF", canvasMode: "Tuval", expand: "Genişlet", crop: "Kırp", original: "Orijinal", lossless: "Kayıpsız" },
  hi: { studio: "स्टूडियो", compare: "तुलना", batch: "बैच", history: "इतिहास", api: "API", drop: "छवियाँ छोड़ें", dropHint: "100% ब्राउज़र", addFiles: "जोड़ें", addFolder: "फ़ोल्डर", paste: "पेस्ट", rotate: "घुमाएँ", preview: "पूर्वावलोकन", clear: "साफ़", exportFmt: "प्रारूप", quality: "गुणवत्ता", private: "100% निजी", favorite: "पसंदीदा", favorited: "पसंदीदा", ai: "AI सुझाव", undo: "पूर्ववत", redo: "फिर", straighten: "सीधा", customAngle: "कोण", batchZip: "ZIP", emptyHistory: "कोई नहीं।", flipH: "फ्लिप H", flipV: "फ्लिप V", horizon: "ऑटो लेवल", exif: "EXIF", canvasMode: "कैनवास", expand: "विस्तार", crop: "क्रॉप", original: "मूल", lossless: "लॉसलेस" },
  pt: { studio: "Estúdio", compare: "Comparar", batch: "Lote", history: "Histórico", api: "API", drop: "Solte imagens", dropHint: "100% navegador", addFiles: "Adicionar", addFolder: "Pasta", paste: "Colar", rotate: "Girar", preview: "Prévia", clear: "Limpar", exportFmt: "Formato", quality: "Qualidade", private: "100% privado", favorite: "Favorito", favorited: "Favorito", ai: "Dicas IA", undo: "Desfazer", redo: "Refazer", straighten: "Endireitar", customAngle: "Ângulo", batchZip: "ZIP", emptyHistory: "Nenhum.", flipH: "Espelhar H", flipV: "Espelhar V", horizon: "Nivelar", exif: "EXIF", canvasMode: "Tela", expand: "Expandir", crop: "Recortar", original: "Original", lossless: "Sem perda" },
  ja: { studio: "スタジオ", compare: "比較", batch: "一括", history: "履歴", api: "API", drop: "画像をドロップ", dropHint: "100%ブラウザ", addFiles: "追加", addFolder: "フォルダ", paste: "ペースト", rotate: "回転", preview: "プレビュー", clear: "消去", exportFmt: "形式", quality: "品質", private: "100%プライベート", favorite: "お気に入り", favorited: "お気に入り", ai: "AIヒント", undo: "元に戻す", redo: "やり直し", straighten: "傾き補正", customAngle: "角度", batchZip: "ZIP", emptyHistory: "なし。", flipH: "左右反転", flipV: "上下反転", horizon: "水平補正", exif: "EXIF", canvasMode: "キャンバス", expand: "拡張", crop: "切り抜き", original: "元サイズ", lossless: "可逆" },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français", tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

interface HistoryEntry { id: string; name: string; w: number; h: number; bytes: number; ts: number; dataUrl: string; }
const HISTORY_KEY = "toolnest-rotate-history";
const SETTINGS_KEY = "toolnest-rotate-settings";
const LANG_KEY = "toolnest-rotate-lang";

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
let _id = 0;
const nextId = () => `rot-${Date.now()}-${++_id}`;

export function ImageRotate() {
  const favorites = useFavorites();
  const slug = "image-rotate";

  const [items, setItems] = useState<RotateItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [transform, setTransform] = useState<RotateTransform>(DEFAULT_TRANSFORM);
  const [exportOpts, setExportOpts] = useState<RotateExportOptions>(DEFAULT_EXPORT);
  const [tab, setTab] = useState<Tab>("studio");
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [compareSlider, setCompareSlider] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [perspective, setPerspective] = useState(defaultPerspective());

  const undoStack = useRef<RotateTransform[]>([]);
  const redoStack = useRef<RotateTransform[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const t = useCallback((k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k, [lang]);
  const active = items[activeIdx];

  const pushTransform = useCallback((next: RotateTransform) => {
    setTransform((prev) => {
      undoStack.current.push(prev);
      if (undoStack.current.length > 60) undoStack.current.shift();
      redoStack.current = [];
      return next;
    });
  }, []);

  const patchTransform = useCallback((patch: Partial<RotateTransform>) => {
    setTransform((prev) => {
      undoStack.current.push(prev);
      redoStack.current = [];
      return { ...prev, ...patch };
    });
  }, []);

  const undo = () => {
    if (!undoStack.current.length) return;
    const prev = undoStack.current.pop()!;
    setTransform((cur) => { redoStack.current.push(cur); return prev; });
  };
  const redo = () => {
    if (!redoStack.current.length) return;
    const next = redoStack.current.pop()!;
    setTransform((cur) => { undoStack.current.push(cur); return next; });
  };

  useEffect(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (p.exportOpts) setExportOpts((o) => ({ ...o, ...p.exportOpts }));
      }
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ exportOpts })); } catch { /* ignore */ } }, [exportOpts]);
  useEffect(() => { try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ } }, [lang]);

  useEffect(() => () => { items.forEach((i) => { if (i.resultUrl) URL.revokeObjectURL(i.resultUrl); }); if (previewUrl) URL.revokeObjectURL(previewUrl); }, []);

  const addFiles = useCallback(async (files: File[]) => {
    const accepted: RotateItem[] = [];
    for (const file of files) {
      if (!isSupportedInput(file)) { toast.error(`Unsupported: ${file.name}`); continue; }
      const meta = await loadImageMeta(file, exportOpts.applyExif);
      accepted.push({
        id: nextId(), file, name: file.name, originalBytes: meta.bytes,
        naturalW: meta.w, naturalH: meta.h, thumbUrl: meta.thumbUrl,
        transform: { ...DEFAULT_TRANSFORM }, perspective: null,
        status: "queued", resultUrl: "", resultBytes: 0,
      });
    }
    if (accepted.length) {
      setItems((prev) => [...prev, ...accepted]);
      if (!items.length) setActiveIdx(0);
      toast.success(`${accepted.length} image(s) added`);
    }
  }, [items.length, exportOpts.applyExif]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const clipItems = e.clipboardData?.items;
      if (!clipItems) return;
      const files: File[] = [];
      for (const it of clipItems) {
        if (it.type.startsWith("image/")) {
          const blob = it.getAsFile();
          if (blob) files.push(new File([blob], `paste-${Date.now()}.png`, { type: blob.type }));
        }
      }
      if (files.length) void addFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFiles]);

  const rotate90 = (dir: "cw" | "ccw") => {
    setTransform((tr) => {
      undoStack.current.push(tr);
      redoStack.current = [];
      const next = (((dir === "cw" ? tr.rotation + 90 : tr.rotation - 90) % 360) + 360) % 360 as Rotation90;
      return { ...tr, rotation: next };
    });
  };

  const onHorizon = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const angle = await detectHorizonAngle(active.file);
      patchTransform({ straighten: clamp(Math.round(angle * 10) / 10, -45, 45) });
      toast.success(`Horizon detected · ${angle.toFixed(1)}°`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Horizon detection failed");
    } finally {
      setBusy(false);
    }
  };

  const runExport = useCallback(async (download = true) => {
    if (!active) return;
    setBusy(true);
    try {
      const result = await exportRotatedImage(active.file, transform, { ...exportOpts, perspective });
      setPreviewUrl(result.previewUrl);
      setItems((prev) => prev.map((it, i) => i === activeIdx ? { ...it, resultUrl: result.previewUrl, resultBytes: result.bytes, status: "done" as const } : it));
      if (download) downloadBlob(result.blob, buildOutputName(active.name, result.format));
      const entry: HistoryEntry = { id: nextId(), name: active.name, w: result.width, h: result.height, bytes: result.bytes, ts: Date.now(), dataUrl: result.previewUrl };
      setHistory((h) => { const n = [entry, ...h].slice(0, 50); localStorage.setItem(HISTORY_KEY, JSON.stringify(n)); return n; });
      toast.success(`${result.width}×${result.height} · ${formatBytes(result.bytes)}${result.lossless ? " · lossless" : ""}`);
      if (!download) setTab("compare");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }, [active, transform, exportOpts, perspective, activeIdx]);

  const runBatchZip = async () => {
    if (!items.length) return;
    setBusy(true);
    try {
      const updated = await rotateBatch([...items], transform, { ...exportOpts, perspective });
      setItems(updated);
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const i of updated) {
        if (i.status === "done" && i.resultUrl) {
          const res = await fetch(i.resultUrl);
          zip.file(buildOutputName(i.name, exportOpts.format), await res.blob());
        }
      }
      downloadBlob(await zip.generateAsync({ type: "blob" }), "toolnest-rotated.zip");
      toast.success("Batch ZIP ready");
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

  const recs = useMemo(
    () => (active ? aiRecommendRotate(transform, active.naturalW, active.naturalH, exportOpts) : []),
    [active, transform, exportOpts],
  );

  const previewCss = useMemo(() => {
    const angle = totalAngleDeg(transform);
    const parts = [
      `rotate(${angle}deg)`,
      `scaleX(${transform.flipH ? -1 : 1})`,
      `scaleY(${transform.flipV ? -1 : 1})`,
      `scale(${zoom})`,
    ];
    return parts.join(" ");
  }, [transform, zoom]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.key === "y" && (e.ctrlKey || e.metaKey)) || (e.key === "z" && e.shiftKey && (e.ctrlKey || e.metaKey))) { e.preventDefault(); redo(); }
    if (e.key === "r" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); rotate90(e.shiftKey ? "ccw" : "cw"); }
    if (e.key === "f" && !e.ctrlKey) { e.preventDefault(); patchTransform({ flipH: !transform.flipH }); }
    if (e.key === "v" && e.shiftKey && !e.ctrlKey) { e.preventDefault(); patchTransform({ flipV: !transform.flipV }); }
    if (e.key === "+" || e.key === "=") { e.preventDefault(); setZoom((z) => clamp(z + 0.1, 0.25, 4)); }
    if (e.key === "-") { e.preventDefault(); setZoom((z) => clamp(z - 0.1, 0.25, 4)); }
  };

  const applyRec = (action?: string) => {
    if (action === "expand") setExportOpts((o) => ({ ...o, canvasMode: "expand" }));
    if (action === "png") setExportOpts((o) => ({ ...o, format: "image/png", preserveTransparency: true }));
    if (action === "exif") setExportOpts((o) => ({ ...o, applyExif: true }));
    if (action === "horizon") void onHorizon();
  };

  return (
    <div className="space-y-6" onKeyDown={onKeyDown} tabIndex={0}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <RotateCw className="h-3.5 w-3.5" /> {t("private")}
          </span>
          {isLosslessPath(transform, exportOpts.format) && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600">
              <Check className="h-3.5 w-3.5" /> {t("lossless")}
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
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) void addFiles(Array.from(e.dataTransfer.files)); }}
          className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-14 text-center", dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50")}
        >
          <RotateCw className="mb-4 h-14 w-14 text-primary" />
          <p className="font-display text-xl font-semibold">{t("drop")}</p>
          <p className="mt-2 text-sm text-muted">{t("dropHint")}</p>
          <div className="mt-5 flex gap-2">
            <Button variant="gradient" type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}><UploadCloud className="h-4 w-4" /> {t("addFiles")}</Button>
            <Button variant="outline" type="button" onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}><FolderUp className="h-4 w-4" /> {t("addFolder")}</Button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} />
          <input ref={folderInputRef} type="file" multiple className="hidden" // @ts-expect-error webkitdirectory
            webkitdirectory="" directory="" onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><UploadCloud className="h-4 w-4" /> {t("addFiles")}</Button>
          <Button variant="outline" size="sm" onClick={() => folderInputRef.current?.click()}><FolderUp className="h-4 w-4" /> {t("addFolder")}</Button>
          <Button variant="outline" size="sm" onClick={async () => { try { const clip = await navigator.clipboard.read(); for (const it of clip) for (const type of it.types) if (type.startsWith("image/")) void addFiles([new File([await it.getType(type)], `paste-${Date.now()}.png`, { type })]); } catch { toast.error("Clipboard denied"); } }}><ClipboardPaste className="h-4 w-4" /> {t("paste")}</Button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} />
          <input ref={folderInputRef} type="file" multiple className="hidden" // @ts-expect-error webkitdirectory
            webkitdirectory="" directory="" onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} />
          <Button variant="outline" size="sm" className="ml-auto text-error" onClick={() => { items.forEach((i) => i.resultUrl && URL.revokeObjectURL(i.resultUrl)); setItems([]); pushTransform(DEFAULT_TRANSFORM); }}><Trash2 className="h-4 w-4" /> {t("clear")}</Button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {([["studio", t("studio"), RotateCw], ["compare", t("compare"), Eye], ["batch", t("batch"), FileArchive], ["history", t("history"), History], ["api", t("api"), Settings2]] as const).map(([k, lbl, Icon]) => (
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
                <div className="relative flex min-h-[320px] max-h-[560px] items-center justify-center overflow-hidden rounded-2xl border border-border bg-[repeating-conic-gradient(var(--card)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={active.thumbUrl} alt="" className="max-h-[520px] max-w-full object-contain transition-transform duration-150" style={{ transform: previewCss }} draggable={false} />
                </div>
                <p className="text-center text-xs text-muted tabular-nums">
                  {active.naturalW}×{active.naturalH} · {formatBytes(active.originalBytes)} · {Math.round(totalAngleDeg(transform))}° total
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => rotate90("cw")} title="R"><RotateCw className="h-4 w-4" /> 90°</Button>
                  <Button size="sm" variant="outline" onClick={() => rotate90("ccw")} title="Shift+R"><RotateCcw className="h-4 w-4" /> 90°</Button>
                  <Button size="sm" variant="outline" onClick={() => patchTransform({ rotation: 180 })}>180°</Button>
                  <Button size="sm" variant="outline" onClick={() => patchTransform({ flipH: !transform.flipH })} title="F"><FlipHorizontal2 className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => patchTransform({ flipV: !transform.flipV })} title="Shift+V"><FlipVertical2 className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => pushTransform(DEFAULT_TRANSFORM)}><Maximize2 className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={undo}><Undo2 className="h-4 w-4" /> {t("undo")}</Button>
                  <Button size="sm" variant="outline" onClick={redo}><Redo2 className="h-4 w-4" /> {t("redo")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setZoom((z) => clamp(z + 0.1, 0.25, 4))}><ZoomIn className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setZoom((z) => clamp(z - 0.1, 0.25, 4))}><ZoomOut className="h-4 w-4" /></Button>
                </div>
                <Field label={t("straighten")}>
                  <input type="range" min={-45} max={45} step={0.5} value={transform.straighten} onChange={(e) => patchTransform({ straighten: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                  <span className="text-xs text-muted tabular-nums">{transform.straighten > 0 ? "+" : ""}{transform.straighten}°</span>
                </Field>
                <Field label={t("customAngle")}>
                  <input type="range" min={-180} max={180} step={1} value={transform.customAngle} onChange={(e) => patchTransform({ customAngle: Number(e.target.value) })} className="w-full accent-[var(--primary)]" />
                  <span className="text-xs text-muted tabular-nums">{transform.customAngle}°</span>
                </Field>
              </div>

              <div className="space-y-4">
                <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => void onHorizon()}><Wand2 className="h-4 w-4" /> {t("horizon")}</Button>

                <Field label={t("canvasMode")}>
                  <select value={exportOpts.canvasMode} onChange={(e) => setExportOpts((o) => ({ ...o, canvasMode: e.target.value as RotateExportOptions["canvasMode"] }))} className={inputClass()}>
                    <option value="expand">{t("expand")}</option>
                    <option value="crop">{t("crop")}</option>
                    <option value="original">{t("original")}</option>
                  </select>
                </Field>

                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={exportOpts.applyExif} onChange={(e) => setExportOpts((o) => ({ ...o, applyExif: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
                  {t("exif")}
                </label>

                <Field label={t("exportFmt")}>
                  <select value={exportOpts.format} onChange={(e) => setExportOpts((o) => ({ ...o, format: e.target.value as OutputFormat }))} className={inputClass()}>
                    {Object.entries(FORMAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                {LOSSY_FORMATS.includes(exportOpts.format) && (
                  <Field label={t("quality")}>
                    <input type="range" min={10} max={100} value={Math.round(exportOpts.quality * 100)} onChange={(e) => setExportOpts((o) => ({ ...o, quality: Number(e.target.value) / 100 }))} className="w-full accent-[var(--primary)]" />
                  </Field>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={exportOpts.preserveTransparency} onChange={(e) => setExportOpts((o) => ({ ...o, preserveTransparency: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
                  Preserve transparency
                </label>
                <details className="rounded-lg border border-border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">Perspective correction</summary>
                  <div className="mt-3 space-y-2">
                    {(["tl", "tr", "br", "bl"] as const).map((corner) => (
                      <div key={corner} className="grid grid-cols-3 gap-2 items-center">
                        <span className="text-xs uppercase text-muted">{corner}</span>
                        <input type="range" min={0} max={100} value={Math.round(perspective[corner].x * 100)} onChange={(e) => setPerspective((p) => ({ ...p, [corner]: { ...p[corner], x: Number(e.target.value) / 100 } }))} className="accent-[var(--primary)]" aria-label={`${corner} x`} />
                        <input type="range" min={0} max={100} value={Math.round(perspective[corner].y * 100)} onChange={(e) => setPerspective((p) => ({ ...p, [corner]: { ...p[corner], y: Number(e.target.value) / 100 } }))} className="accent-[var(--primary)]" aria-label={`${corner} y`} />
                      </div>
                    ))}
                    <Button size="sm" variant="outline" className="w-full" onClick={() => setPerspective(defaultPerspective())}>Reset perspective</Button>
                  </div>
                </details>
                <Field label="Background (flatten)">
                  <input type="color" value={exportOpts.flattenBackground} onChange={(e) => setExportOpts((o) => ({ ...o, flattenBackground: e.target.value }))} className="h-9 w-full cursor-pointer rounded border border-border bg-card p-1" />
                </Field>

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
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("rotate")}
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
                  <div className="relative flex min-h-[280px] items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="After" className="max-h-[400px] max-w-full object-contain" />
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ clipPath: `inset(0 ${100 - compareSlider}% 0 0)` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={active.thumbUrl} alt="Before" className="max-h-[400px] max-w-full object-contain" />
                    </div>
                    <div className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-primary" style={{ left: `${compareSlider}%` }} />
                  </div>
                  <input type="range" min={0} max={100} value={compareSlider} onChange={(e) => setCompareSlider(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
                </div>
              ) : (
                <p className="py-16 text-center text-muted">Run Preview or Rotate first.</p>
              )}
            </div>
          )}

          {tab === "batch" && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <p className="text-sm text-muted">{items.length} file(s) — same rotation settings applied to all.</p>
              <Button variant="gradient" disabled={busy} onClick={() => void runBatchZip()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} {t("batchZip")}</Button>
              <ul className="divide-y divide-border text-sm">
                {items.map((it) => (
                  <li key={it.id} className="flex justify-between py-2">
                    <span className="truncate">{it.name}</span>
                    <span className={cn("text-xs", it.status === "done" ? "text-success" : it.status === "error" ? "text-error" : "text-muted")}>{it.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "history" && (
            <div className="rounded-xl border border-border bg-card p-4">
              {history.length === 0 ? <p className="py-12 text-center text-sm text-muted">{t("emptyHistory")}</p> : (
                <ul className="grid gap-3 sm:grid-cols-3">{history.map((h) => (
                  <li key={h.id} className="rounded-lg border border-border p-2 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={h.dataUrl} alt="" className="mx-auto h-20 w-20 object-contain" />
                    <p className="truncate text-xs font-medium">{h.name}</p>
                    <p className="text-[10px] text-muted">{h.w}×{h.h} · {formatBytes(h.bytes)}</p>
                  </li>
                ))}</ul>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <p className="font-medium">POST /api/v1/image/rotate</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/image/rotate \\
  -H "Content-Type: application/json" \\
  -d '{
    "image": "data:image/png;base64,...",
    "rotation": 90,
    "customAngle": 15,
    "flipH": false,
    "flipV": false,
    "straighten": -2.5,
    "format": "image/png",
    "canvasMode": "expand",
    "applyExif": true
  }'`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
