"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Check,
  ClipboardPaste,
  Crop,
  Download,
  Eye,
  FileArchive,
  FlipHorizontal2,
  FlipVertical2,
  FolderUp,
  History,
  Languages,
  Loader2,
  Redo2,
  RotateCcw,
  RotateCw,
  ScanFace,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  UploadCloud,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  ASPECT_PRESETS,
  DEFAULT_EXPORT,
  DEFAULT_TRANSFORM,
  aiRecommendCrop,
  buildOutputName,
  centerCropForAspect,
  cropBatch,
  exportCroppedImage,
  fitAspect,
  isSupportedInput,
  loadImageMeta,
  smartAutoCrop,
  type CropExportOptions,
  type CropItem,
  type CropRect,
  type CropTransform,
  type OutputFormat,
  type Rotation,
  type SmartCropMode,
} from "./image-crop-utils";
import { FORMAT_LABELS, LOSSY_FORMATS } from "./image-compressor-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";
type Tab = "studio" | "compare" | "batch" | "history" | "api";
type Handle = "draw" | "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: { studio: "Studio", compare: "Compare", batch: "Batch", history: "History", api: "API", drop: "Drop images, paste, or browse", dropHint: "JPG · PNG · WebP · AVIF · GIF · BMP · HEIC · SVG — 100% in-browser", addFiles: "Add files", addFolder: "Folder", paste: "Paste", crop: "Crop & Download", preview: "Preview", clear: "Clear", aspect: "Aspect ratio", smart: "Smart crop", face: "Face", trim: "Trim edges", center: "Center", exportFmt: "Format", quality: "Quality", shape: "Shape", rect: "Rectangle", circle: "Circle", outputSize: "Output size", width: "Width", height: "Height", private: "100% private · in-browser", favorite: "Favorite", favorited: "Favorited", ai: "AI tips", apply: "Apply", undo: "Undo", redo: "Redo", straighten: "Straighten", batchZip: "ZIP all", emptyHistory: "No crops yet.", free: "Freeform" },
  es: { studio: "Estudio", compare: "Comparar", batch: "Lote", history: "Historial", api: "API", drop: "Suelta imágenes", dropHint: "100% en navegador", addFiles: "Añadir", addFolder: "Carpeta", paste: "Pegar", crop: "Recortar", preview: "Vista", clear: "Limpiar", aspect: "Proporción", smart: "Recorte IA", face: "Rostro", trim: "Recortar bordes", center: "Centro", exportFmt: "Formato", quality: "Calidad", shape: "Forma", rect: "Rectángulo", circle: "Círculo", outputSize: "Tamaño", width: "Ancho", height: "Alto", private: "100% privado", favorite: "Favorito", favorited: "Favorito", ai: "Consejos IA", apply: "Aplicar", undo: "Deshacer", redo: "Rehacer", straighten: "Enderezar", batchZip: "ZIP", emptyHistory: "Sin recortes.", free: "Libre" },
  de: { studio: "Studio", compare: "Vergleich", batch: "Stapel", history: "Verlauf", api: "API", drop: "Bilder ablegen", dropHint: "100% im Browser", addFiles: "Hinzufügen", addFolder: "Ordner", paste: "Einfügen", crop: "Zuschneiden", preview: "Vorschau", clear: "Löschen", aspect: "Seitenverhältnis", smart: "Smart Crop", face: "Gesicht", trim: "Ränder", center: "Mitte", exportFmt: "Format", quality: "Qualität", shape: "Form", rect: "Rechteck", circle: "Kreis", outputSize: "Größe", width: "Breite", height: "Höhe", private: "100% privat", favorite: "Favorit", favorited: "Favorit", ai: "KI-Tipps", apply: "Anwenden", undo: "Rückgängig", redo: "Wiederholen", straighten: "Gerade", batchZip: "ZIP", emptyHistory: "Keine.", free: "Frei" },
  fr: { studio: "Studio", compare: "Comparer", batch: "Lot", history: "Historique", api: "API", drop: "Déposez images", dropHint: "100% navigateur", addFiles: "Ajouter", addFolder: "Dossier", paste: "Coller", crop: "Recadrer", preview: "Aperçu", clear: "Effacer", aspect: "Ratio", smart: "Recadrage IA", face: "Visage", trim: "Bords", center: "Centre", exportFmt: "Format", quality: "Qualité", shape: "Forme", rect: "Rectangle", circle: "Cercle", outputSize: "Taille", width: "Largeur", height: "Hauteur", private: "100% privé", favorite: "Favori", favorited: "Favori", ai: "Conseils IA", apply: "Appliquer", undo: "Annuler", redo: "Rétablir", straighten: "Redresser", batchZip: "ZIP", emptyHistory: "Aucun.", free: "Libre" },
  tr: { studio: "Stüdyo", compare: "Karşılaştır", batch: "Toplu", history: "Geçmiş", api: "API", drop: "Görsel bırakın", dropHint: "%100 tarayıcı", addFiles: "Ekle", addFolder: "Klasör", paste: "Yapıştır", crop: "Kırp", preview: "Önizleme", clear: "Temizle", aspect: "En-boy", smart: "Akıllı kırp", face: "Yüz", trim: "Kenar", center: "Merkez", exportFmt: "Format", quality: "Kalite", shape: "Şekil", rect: "Dikdörtgen", circle: "Daire", outputSize: "Boyut", width: "Genişlik", height: "Yükseklik", private: "%100 özel", favorite: "Favori", favorited: "Favori", ai: "AI ipuçları", apply: "Uygula", undo: "Geri", redo: "İleri", straighten: "Düzelt", batchZip: "ZIP", emptyHistory: "Yok.", free: "Serbest" },
  hi: { studio: "स्टूडियो", compare: "तुलना", batch: "बैच", history: "इतिहास", api: "API", drop: "छवियाँ छोड़ें", dropHint: "100% ब्राउज़र", addFiles: "जोड़ें", addFolder: "फ़ोल्डर", paste: "पेस्ट", crop: "क्रॉप", preview: "पूर्वावलोकन", clear: "साफ़", aspect: "अनुपात", smart: "स्मार्ट क्रॉप", face: "चेहरा", trim: "किनारे", center: "केंद्र", exportFmt: "प्रारूप", quality: "गुणवत्ता", shape: "आकार", rect: "आयत", circle: "वृत्त", outputSize: "आकार", width: "चौड़ाई", height: "ऊँचाई", private: "100% निजी", favorite: "पसंदीदा", favorited: "पसंदीदा", ai: "AI सुझाव", apply: "लागू", undo: "पूर्ववत", redo: "फिर", straighten: "सीधा", batchZip: "ZIP", emptyHistory: "कोई नहीं।", free: "मुक्त" },
  pt: { studio: "Estúdio", compare: "Comparar", batch: "Lote", history: "Histórico", api: "API", drop: "Solte imagens", dropHint: "100% navegador", addFiles: "Adicionar", addFolder: "Pasta", paste: "Colar", crop: "Recortar", preview: "Prévia", clear: "Limpar", aspect: "Proporção", smart: "Recorte IA", face: "Rosto", trim: "Bordas", center: "Centro", exportFmt: "Formato", quality: "Qualidade", shape: "Forma", rect: "Retângulo", circle: "Círculo", outputSize: "Tamanho", width: "Largura", height: "Altura", private: "100% privado", favorite: "Favorito", favorited: "Favorito", ai: "Dicas IA", apply: "Aplicar", undo: "Desfazer", redo: "Refazer", straighten: "Endireitar", batchZip: "ZIP", emptyHistory: "Nenhum.", free: "Livre" },
  ja: { studio: "スタジオ", compare: "比較", batch: "一括", history: "履歴", api: "API", drop: "画像をドロップ", dropHint: "100%ブラウザ", addFiles: "追加", addFolder: "フォルダ", paste: "ペースト", crop: "切り抜き", preview: "プレビュー", clear: "消去", aspect: "比率", smart: "スマート切り抜き", face: "顔", trim: "端トリム", center: "中央", exportFmt: "形式", quality: "品質", shape: "形状", rect: "矩形", circle: "円", outputSize: "サイズ", width: "幅", height: "高さ", private: "100%プライベート", favorite: "お気に入り", favorited: "お気に入り", ai: "AIヒント", apply: "適用", undo: "元に戻す", redo: "やり直し", straighten: "傾き補正", batchZip: "ZIP", emptyHistory: "なし。", free: "自由" },
};

const LANG_LABELS: Record<Lang, string> = { en: "English", es: "Español", de: "Deutsch", fr: "Français", tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語" };

interface HistoryEntry { id: string; name: string; w: number; h: number; bytes: number; ts: number; dataUrl: string; }
const HISTORY_KEY = "toolnest-crop-history";
const SETTINGS_KEY = "toolnest-crop-settings";
const LANG_KEY = "toolnest-crop-lang";

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }

let _id = 0;
const nextId = () => `crop-${Date.now()}-${++_id}`;

export function ImageCrop() {
  const favorites = useFavorites();
  const slug = "image-crop";

  const [items, setItems] = useState<CropItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [transform, setTransform] = useState<CropTransform>(DEFAULT_TRANSFORM);
  const [exportOpts, setExportOpts] = useState<CropExportOptions>(DEFAULT_EXPORT);
  const [aspectId, setAspectId] = useState("free");
  const [tab, setTab] = useState<Tab>("studio");
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [compareSlider, setCompareSlider] = useState(50);

  const undoStack = useRef<CropRect[]>([]);
  const redoStack = useRef<CropRect[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<{ type: Handle; startX: number; startY: number; rect: DOMRect; orig: CropRect } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const t = useCallback((k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k, [lang]);
  const active = items[activeIdx];

  const aspectRatio = useMemo(() => ASPECT_PRESETS.find((p) => p.id === aspectId)?.ratio ?? null, [aspectId]);

  const pushCrop = useCallback((next: CropRect | null) => {
    setCrop((prev) => {
      if (prev) undoStack.current.push(prev);
      redoStack.current = [];
      return next;
    });
  }, []);

  const undo = () => {
    if (!undoStack.current.length) return;
    const prev = undoStack.current.pop()!;
    setCrop((cur) => { if (cur) redoStack.current.push(cur); return prev; });
  };
  const redo = () => {
    if (!redoStack.current.length) return;
    const next = redoStack.current.pop()!;
    setCrop((cur) => { if (cur) undoStack.current.push(cur); return next; });
  };

  useEffect(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) { const p = JSON.parse(s); if (p.exportOpts) setExportOpts((o) => ({ ...o, ...p.exportOpts })); if (p.aspectId) setAspectId(p.aspectId); }
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
      setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ exportOpts, aspectId })); } catch { /* ignore */ } }, [exportOpts, aspectId]);
  useEffect(() => { try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ } }, [lang]);

  useEffect(() => () => { items.forEach((i) => { if (i.resultUrl) URL.revokeObjectURL(i.resultUrl); if (i.thumbUrl.startsWith("blob:")) URL.revokeObjectURL(i.thumbUrl); }); previewUrl && URL.revokeObjectURL(previewUrl); }, []);

  const addFiles = useCallback(async (files: File[]) => {
    const accepted: CropItem[] = [];
    for (const file of files) {
      if (!isSupportedInput(file)) { toast.error(`Unsupported: ${file.name}`); continue; }
      const meta = await loadImageMeta(file);
      accepted.push({
        id: nextId(), file, name: file.name, originalBytes: meta.bytes,
        naturalW: meta.w, naturalH: meta.h, thumbUrl: meta.thumbUrl,
        crop: null, transform: { ...DEFAULT_TRANSFORM }, perspective: null,
        status: "queued", resultUrl: "", resultBytes: 0,
      });
    }
    if (accepted.length) {
      setItems((prev) => [...prev, ...accepted]);
      if (!items.length) {
        setActiveIdx(0);
        const ar = ASPECT_PRESETS.find((p) => p.id === aspectId)?.ratio ?? null;
        setCrop(centerCropForAspect(accepted[0].naturalW, accepted[0].naturalH, ar));
      }
      toast.success(`${accepted.length} image(s) added`);
    }
  }, [items.length, aspectId]);

  useEffect(() => {
    if (!active) return;
    const ar = aspectRatio;
    setCrop((c) => {
      if (!c) return centerCropForAspect(active.naturalW, active.naturalH, ar);
      return ar ? fitAspect(c, ar) : c;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectId, active?.id]);

  const onSmartCrop = async (mode: SmartCropMode) => {
    if (!active) return;
    setBusy(true);
    try {
      const rect = await smartAutoCrop(active.file, mode, aspectRatio);
      pushCrop(rect);
      toast.success(`Smart ${mode} crop applied`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Smart crop failed");
    } finally {
      setBusy(false);
    }
  };

  const runExport = useCallback(async (download = true) => {
    if (!active) return;
    setBusy(true);
    try {
      const result = await exportCroppedImage(active.file, crop, transform, exportOpts);
      setPreviewUrl(result.previewUrl);
      setItems((prev) => prev.map((it, i) => i === activeIdx ? { ...it, resultUrl: result.previewUrl, resultBytes: result.bytes, status: "done" as const } : it));
      if (download) downloadBlob(result.blob, buildOutputName(active.name, result.format));
      const entry: HistoryEntry = { id: nextId(), name: active.name, w: result.width, h: result.height, bytes: result.bytes, ts: Date.now(), dataUrl: result.previewUrl };
      setHistory((h) => { const n = [entry, ...h].slice(0, 50); localStorage.setItem(HISTORY_KEY, JSON.stringify(n)); return n; });
      toast.success(`Cropped ${result.width}×${result.height} · ${formatBytes(result.bytes)}`);
      if (!download) setTab("compare");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }, [active, crop, transform, exportOpts, activeIdx]);

  const runBatchZip = async () => {
    if (!items.length) return;
    setBusy(true);
    try {
      const updated = await cropBatch([...items], crop, transform, exportOpts);
      setItems(updated);
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const i of updated) {
        if (i.status === "done" && i.resultUrl) {
          const res = await fetch(i.resultUrl);
          zip.file(buildOutputName(i.name, exportOpts.format), await res.blob());
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "toolnest-cropped.zip");
      toast.success("Batch ZIP ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  };

  const recs = useMemo(() => active ? aiRecommendCrop(crop, active.naturalW, active.naturalH, aspectId, exportOpts) : [], [active, crop, aspectId, exportOpts]);

  /* ── Crop pointer handlers ─ */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>, handle: Handle) => {
    if (!containerRef.current) return;
    e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    interactionRef.current = { type: handle, startX: e.clientX - rect.left, startY: e.clientY - rect.top, rect, orig: crop ?? { x: 0.1, y: 0.1, w: 0.8, h: 0.8 } };
    if (handle === "draw") setCrop({ x: interactionRef.current.startX / rect.width, y: interactionRef.current.startY / rect.height, w: 0, h: 0 });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactionRef.current || !containerRef.current) return;
    const { type, startX, startY, rect, orig } = interactionRef.current;
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    if (type === "draw") {
      let left = clamp(Math.min(startX, curX) / rect.width, 0, 1);
      let top = clamp(Math.min(startY, curY) / rect.height, 0, 1);
      let w = clamp(Math.abs(curX - startX) / rect.width, 0.01, 1);
      let h = clamp(Math.abs(curY - startY) / rect.height, 0.01, 1);
      if (aspectRatio) { h = w / aspectRatio; if (top + h > 1) { h = 1 - top; w = h * aspectRatio; } }
      setCrop({ x: left, y: top, w, h });
      return;
    }
    if (type === "move") {
      const dx = (curX - startX) / rect.width;
      const dy = (curY - startY) / rect.height;
      setCrop({ ...orig, x: clamp(orig.x + dx, 0, 1 - orig.w), y: clamp(orig.y + dy, 0, 1 - orig.h) });
      return;
    }
    let x = orig.x, y = orig.y, w = orig.w, h = orig.h;
    const dx = (curX - startX) / rect.width;
    const dy = (curY - startY) / rect.height;
    if (type.includes("e")) w = clamp(orig.w + dx, 0.01, 1 - orig.x);
    if (type.includes("s")) h = clamp(orig.h + dy, 0.01, 1 - orig.y);
    if (type.includes("w")) { const nx = clamp(orig.x + dx, 0, orig.x + orig.w - 0.01); w = orig.w + (orig.x - nx); x = nx; }
    if (type.includes("n")) { const ny = clamp(orig.y + dy, 0, orig.y + orig.h - 0.01); h = orig.h + (orig.y - ny); y = ny; }
    if (aspectRatio) {
      if (type === "e" || type === "w") h = w / aspectRatio;
      else if (type === "n" || type === "s") w = h * aspectRatio;
      else { if (w / aspectRatio <= h) h = w / aspectRatio; else w = h * aspectRatio; }
    }
    setCrop({ x, y, w, h });
  };

  const onPointerUp = () => {
    if (interactionRef.current && crop) pushCrop(crop);
    interactionRef.current = null;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undo(); }
    if ((e.key === "y" && (e.ctrlKey || e.metaKey)) || (e.key === "z" && e.shiftKey && (e.ctrlKey || e.metaKey))) { e.preventDefault(); redo(); }
    if (e.key === "r" && !e.ctrlKey) setTransform((tr) => ({ ...tr, rotation: ((tr.rotation + 90) % 360) as Rotation }));
  };

  const rotate = (dir: "cw" | "ccw") => setTransform((tr) => ({ ...tr, rotation: (((dir === "cw" ? tr.rotation + 90 : tr.rotation - 90) % 360) + 360) % 360 as Rotation }));

  return (
    <div className="space-y-6" onKeyDown={onKeyDown} tabIndex={0}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success"><Crop className="h-3.5 w-3.5" /> {t("private")}</span>
          <button type="button" onClick={() => favorites.toggle(slug)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs", favorites.isFavorite(slug) ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-card")}><Star className="h-3.5 w-3.5" /> {favorites.isFavorite(slug) ? t("favorited") : t("favorite")}</button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted"><Languages className="h-3.5 w-3.5" /><select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-md border border-border bg-card px-2 py-1 text-xs">{(Object.keys(LANG_LABELS) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}</select></label>
      </div>

      {items.length === 0 ? (
        <div role="button" tabIndex={0} onClick={() => fileInputRef.current?.click()} onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()} className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card p-14 text-center hover:border-primary/50">
          <Crop className="mb-4 h-14 w-14 text-primary" />
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
          <Button variant="outline" size="sm" className="ml-auto text-error" onClick={() => { items.forEach((i) => { i.resultUrl && URL.revokeObjectURL(i.resultUrl); }); setItems([]); setCrop(null); }}><Trash2 className="h-4 w-4" /> {t("clear")}</Button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {([["studio", t("studio"), Crop], ["compare", t("compare"), Eye], ["batch", t("batch"), FileArchive], ["history", t("history"), History], ["api", t("api"), Settings2]] as const).map(([k, lbl, Icon]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium", tab === k ? "bg-primary text-white" : "text-muted hover:text-foreground")}><Icon className="h-4 w-4" /><span className="hidden sm:inline">{lbl}</span></button>
            ))}
          </div>

          {tab === "studio" && active && (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                {items.length > 1 && (
                  <select value={activeIdx} onChange={(e) => setActiveIdx(Number(e.target.value))} className={cn(inputClass(), "w-auto")}>
                    {items.map((it, i) => <option key={it.id} value={i}>{it.name}</option>)}
                  </select>
                )}
                <div ref={containerRef} className="relative mx-auto max-h-[520px] max-w-full select-none overflow-hidden rounded-2xl border border-border bg-black/5 touch-none" style={{ aspectRatio: `${active.naturalW}/${active.naturalH}` }} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={active.thumbUrl} alt="" className="h-full w-full object-contain" draggable={false} style={{ transform: `scale(${transform.zoom}) translate(${transform.panX}px, ${transform.panY}px)` }} />
                  <div className="absolute inset-0 cursor-crosshair" onPointerDown={(e) => onPointerDown(e, crop ? "draw" : "draw")} />
                  {crop && crop.w > 0 && (
                    <>
                      <div className="pointer-events-none absolute border-2 border-primary bg-primary/10" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}>
                        {showGrid && <div className="absolute inset-0 grid grid-cols-3 grid-rows-3"><div className="border-r border-b border-white/40" /><div className="border-r border-b border-white/40" /><div className="border-b border-white/40" /><div className="border-r border-b border-white/40" /><div className="border-r border-b border-white/40" /><div className="border-b border-white/40" /><div className="border-r border-white/40" /><div className="border-r border-white/40" /><div /></div>}
                      </div>
                      <div className="absolute cursor-move border-2 border-primary" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }} onPointerDown={(e) => onPointerDown(e, "move")} />
                      {(["nw", "ne", "sw", "se", "n", "s", "e", "w"] as Handle[]).map((h) => (
                        <div key={h} className="absolute z-10 h-3 w-3 rounded-full border-2 border-white bg-primary shadow" style={{
                          left: h.includes("w") ? `${crop.x * 100}%` : h.includes("e") ? `${(crop.x + crop.w) * 100}%` : `${(crop.x + crop.w / 2) * 100}%`,
                          top: h.includes("n") ? `${crop.y * 100}%` : h.includes("s") ? `${(crop.y + crop.h) * 100}%` : `${(crop.y + crop.h / 2) * 100}%`,
                          transform: "translate(-50%, -50%)", cursor: `${h}-resize`,
                        }} onPointerDown={(e) => onPointerDown(e, h)} />
                      ))}
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => rotate("cw")}><RotateCw className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => rotate("ccw")}><RotateCcw className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setTransform((tr) => ({ ...tr, flipH: !tr.flipH }))}><FlipHorizontal2 className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setTransform((tr) => ({ ...tr, flipV: !tr.flipV }))}><FlipVertical2 className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={undo}><Undo2 className="h-4 w-4" /> {t("undo")}</Button>
                  <Button size="sm" variant="outline" onClick={redo}><Redo2 className="h-4 w-4" /> {t("redo")}</Button>
                  <Button size="sm" variant="outline" onClick={() => setTransform((tr) => ({ ...tr, zoom: clamp(tr.zoom + 0.1, 0.5, 3) }))}><ZoomIn className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setTransform((tr) => ({ ...tr, zoom: clamp(tr.zoom - 0.1, 0.5, 3) }))}><ZoomOut className="h-4 w-4" /></Button>
                </div>
                <Field label={t("straighten")}>
                  <input type="range" min={-45} max={45} value={transform.straighten} onChange={(e) => setTransform((tr) => ({ ...tr, straighten: Number(e.target.value) }))} className="w-full accent-[var(--primary)]" />
                  <span className="text-xs text-muted">{transform.straighten}°</span>
                </Field>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium">{t("aspect")}</p>
                  <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                    {ASPECT_PRESETS.map((p) => (
                      <button key={p.id} type="button" onClick={() => setAspectId(p.id)} className={cn("rounded-lg border px-2.5 py-1 text-xs", aspectId === p.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50")}>{p.label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void onSmartCrop("trim")}><Wand2 className="h-3.5 w-3.5" /> {t("trim")}</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void onSmartCrop("face")}><ScanFace className="h-3.5 w-3.5" /> {t("face")}</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void onSmartCrop("center")}><Crop className="h-3.5 w-3.5" /> {t("center")}</Button>
                </div>
                <Field label={t("exportFmt")}>
                  <select value={exportOpts.format} onChange={(e) => setExportOpts((o) => ({ ...o, format: e.target.value as OutputFormat }))} className={inputClass()}>
                    {Object.entries(FORMAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                {LOSSY_FORMATS.includes(exportOpts.format) && (
                  <Field label={t("quality")}><input type="range" min={10} max={100} value={Math.round(exportOpts.quality * 100)} onChange={(e) => setExportOpts((o) => ({ ...o, quality: Number(e.target.value) / 100 }))} className="w-full accent-[var(--primary)]" /></Field>
                )}
                <Field label={t("shape")}>
                  <select value={exportOpts.shape} onChange={(e) => setExportOpts((o) => ({ ...o, shape: e.target.value as "rect" | "circle" }))} className={inputClass()}>
                    <option value="rect">{t("rect")}</option><option value="circle">{t("circle")}</option>
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t("width")} hint="0 = auto"><input type="number" min={0} value={exportOpts.outputWidth || ""} onChange={(e) => setExportOpts((o) => ({ ...o, outputWidth: Number(e.target.value) || 0 }))} className={inputClass()} placeholder="auto" /></Field>
                  <Field label={t("height")} hint="0 = auto"><input type="number" min={0} value={exportOpts.outputHeight || ""} onChange={(e) => setExportOpts((o) => ({ ...o, outputHeight: Number(e.target.value) || 0 }))} className={inputClass()} placeholder="auto" /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={exportOpts.preserveTransparency} onChange={(e) => setExportOpts((o) => ({ ...o, preserveTransparency: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> Preserve transparency</label>

                {recs.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4" /> {t("ai")}</p>
                    {recs.map((r, i) => (
                      <div key={i} className="text-xs"><p className="font-medium">{r.title}</p><p className="text-muted">{r.detail}</p></div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button variant="gradient" disabled={busy} onClick={() => void runExport(true)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("crop")}</Button>
                  <Button variant="outline" disabled={busy} onClick={() => void runExport(false)}><Eye className="h-4 w-4" /> {t("preview")}</Button>
                </div>
                {crop && (
                  <p className="text-xs text-muted">
                    Crop: {Math.round(crop.w * active.naturalW)}×{Math.round(crop.h * active.naturalH)} px
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === "compare" && active && (
            <div className="space-y-4">
              {previewUrl ? (
                <div className="relative overflow-hidden rounded-2xl border border-border">
                  <div className="grid grid-cols-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={active.thumbUrl} alt="Before" className="w-full object-contain" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="After" className="w-full object-contain bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]" />
                  </div>
                  <p className="border-t border-border bg-card px-4 py-2 text-center text-xs text-muted">Before · After</p>
                </div>
              ) : (
                <p className="py-16 text-center text-muted">Run Preview or Crop first.</p>
              )}
              <input type="range" min={0} max={100} value={compareSlider} onChange={(e) => setCompareSlider(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
            </div>
          )}

          {tab === "batch" && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              <p className="text-sm text-muted">{items.length} file(s) — same crop settings applied to all.</p>
              <Button variant="gradient" disabled={busy} onClick={() => void runBatchZip()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} {t("batchZip")}</Button>
              <ul className="divide-y divide-border text-sm">{items.map((it) => (
                <li key={it.id} className="flex justify-between py-2"><span className="truncate">{it.name}</span><span className={cn("text-xs", it.status === "done" ? "text-success" : it.status === "error" ? "text-error" : "text-muted")}>{it.status}</span></li>
              ))}</ul>
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
              <p className="font-medium">POST /api/v1/image/crop</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/image/crop \\
  -H "Content-Type: application/json" \\
  -d '{
    "image": "data:image/png;base64,...",
    "crop": { "x": 0.1, "y": 0.1, "w": 0.8, "h": 0.8 },
    "rotate": 90,
    "format": "image/png",
    "outputWidth": 1080,
    "outputHeight": 1080,
    "shape": "circle"
  }'`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
