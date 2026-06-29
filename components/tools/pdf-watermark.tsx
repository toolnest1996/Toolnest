"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Download,
  Eye,
  FileArchive,
  FolderUp,
  History,
  ImagePlus,
  Loader2,
  Minus,
  Move,
  Plus,
  QrCode,
  Redo2,
  Shield,
  Sparkles,
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
import { PdfEncryptedError, type PdfDocument } from "./pdf-merge-utils";
import {
  DEFAULT_WATERMARK,
  DEFAULT_WATERMARK_OUTPUT,
  WATERMARK_TEMPLATES,
  WATERMARK_TEMPLATE_CATEGORIES,
  PDF_FONT_OPTIONS,
  aiWatermarkRecommendations,
  anchorForPosition,
  buildWatermarkedPdf,
  detectDigitalSignature,
  executeBatchWatermark,
  nudgeWatermarkSize,
  parsePdf,
  patchWatermarkSize,
  renderThumb,
  resolveWatermarkAnchor,
  smartWatermarkTips,
  watermarkSizeValue,
  zipWatermarkedFiles,
  type PageScope,
  type WatermarkOutputOptions,
  type WatermarkPosition,
  type WatermarkSettings,
  type WatermarkType,
  type PdfFontId,
} from "./pdf-watermark-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";
type Tab = "studio" | "preview" | "batch" | "history" | "api";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: { studio: "Studio", preview: "Preview", batch: "Batch", history: "History", api: "API", drop: "Drop PDFs or browse", private: "100% private · in-browser", watermark: "Apply & Download", previewBtn: "Preview", text: "Text", image: "Image", logo: "Logo", qr: "QR Code", templates: "Templates", selectTemplate: "— Select template —", font: "Font", opacity: "Opacity", rotation: "Rotation", position: "Position", scope: "Pages", favorite: "Favorite", favorited: "Favorited", ai: "AI tips", apply: "Apply", undo: "Undo", redo: "Redo", batchZip: "Batch ZIP", emptyHistory: "No watermarks yet.", signature: "Digital signature detected", size: "Size", smaller: "Smaller", bigger: "Bigger", moveHint: "Drag watermark to move · corner handle to resize", posX: "Horizontal", posY: "Vertical", scale: "Scale", tileLocked: "Tiled mode — switch position to move watermark" },
  es: { studio: "Estudio", preview: "Vista previa", batch: "Lote", history: "Historial", api: "API", drop: "Suelta PDFs", private: "100% privado", watermark: "Aplicar", previewBtn: "Vista previa", text: "Texto", image: "Imagen", logo: "Logo", qr: "QR", templates: "Plantillas", opacity: "Opacidad", rotation: "Rotación", position: "Posición", scope: "Páginas", favorite: "Favorito", favorited: "Favorito", ai: "Consejos IA", apply: "Aplicar", undo: "Deshacer", redo: "Rehacer", batchZip: "ZIP", emptyHistory: "Sin historial.", signature: "Firma digital detectada" },
  de: { studio: "Studio", preview: "Vorschau", batch: "Stapel", history: "Verlauf", api: "API", drop: "PDFs ablegen", private: "100% privat", watermark: "Anwenden", previewBtn: "Vorschau", text: "Text", image: "Bild", logo: "Logo", qr: "QR", templates: "Vorlagen", opacity: "Deckkraft", rotation: "Drehung", position: "Position", scope: "Seiten", favorite: "Favorit", favorited: "Favorit", ai: "KI-Tipps", apply: "Anwenden", undo: "Rückgängig", redo: "Wiederholen", batchZip: "ZIP", emptyHistory: "Kein Verlauf.", signature: "Digitale Signatur erkannt" },
  fr: { studio: "Studio", preview: "Aperçu", batch: "Lot", history: "Historique", api: "API", drop: "Déposez PDF", private: "100% privé", watermark: "Appliquer", previewBtn: "Aperçu", text: "Texte", image: "Image", logo: "Logo", qr: "QR", templates: "Modèles", opacity: "Opacité", rotation: "Rotation", position: "Position", scope: "Pages", favorite: "Favori", favorited: "Favori", ai: "Conseils IA", apply: "Appliquer", undo: "Annuler", redo: "Rétablir", batchZip: "ZIP", emptyHistory: "Aucun.", signature: "Signature détectée" },
  tr: { studio: "Stüdyo", preview: "Önizleme", batch: "Toplu", history: "Geçmiş", api: "API", drop: "PDF bırakın", private: "%100 özel", watermark: "Uygula", previewBtn: "Önizleme", text: "Metin", image: "Görsel", logo: "Logo", qr: "QR", templates: "Şablonlar", opacity: "Opaklık", rotation: "Döndürme", position: "Konum", scope: "Sayfalar", favorite: "Favori", favorited: "Favori", ai: "AI ipuçları", apply: "Uygula", undo: "Geri", redo: "İleri", batchZip: "ZIP", emptyHistory: "Yok.", signature: "Dijital imza algılandı" },
  hi: { studio: "स्टूडियो", preview: "पूर्वावलोकन", batch: "बैच", history: "इतिहास", api: "API", drop: "PDF छोड़ें", private: "100% निजी", watermark: "लागू करें", previewBtn: "पूर्वावलोकन", text: "टेक्स्ट", image: "छवि", logo: "लोगो", qr: "QR", templates: "टेम्पलेट", opacity: "अपारदर्शिता", rotation: "घुमाव", position: "स्थिति", scope: "पृष्ठ", favorite: "पसंदीदा", favorited: "पसंदीदा", ai: "AI सुझाव", apply: "लागू", undo: "पूर्ववत", redo: "फिर", batchZip: "ZIP", emptyHistory: "कोई नहीं।", signature: "डिजिटल हस्ताक्षर" },
  pt: { studio: "Estúdio", preview: "Prévia", batch: "Lote", history: "Histórico", api: "API", drop: "Solte PDFs", private: "100% privado", watermark: "Aplicar", previewBtn: "Prévia", text: "Texto", image: "Imagem", logo: "Logo", qr: "QR", templates: "Modelos", opacity: "Opacidade", rotation: "Rotação", position: "Posição", scope: "Páginas", favorite: "Favorito", favorited: "Favorito", ai: "Dicas IA", apply: "Aplicar", undo: "Desfazer", redo: "Refazer", batchZip: "ZIP", emptyHistory: "Sem histórico.", signature: "Assinatura detectada" },
  ja: { studio: "スタジオ", preview: "プレビュー", batch: "一括", history: "履歴", api: "API", drop: "PDFをドロップ", private: "100%プライベート", watermark: "適用", previewBtn: "プレビュー", text: "テキスト", image: "画像", logo: "ロゴ", qr: "QR", templates: "テンプレート", opacity: "不透明度", rotation: "回転", position: "位置", scope: "ページ", favorite: "お気に入り", favorited: "お気に入り", ai: "AIヒント", apply: "適用", undo: "元に戻す", redo: "やり直し", batchZip: "ZIP", emptyHistory: "履歴なし。", signature: "署名を検出" },
};

const LANG_LABELS: Record<Lang, string> = { en: "English", es: "Español", de: "Deutsch", fr: "Français", tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語" };

const SCOPES: { id: PageScope; label: string }[] = [
  { id: "all", label: "All pages" },
  { id: "odd", label: "Odd pages" },
  { id: "even", label: "Even pages" },
  { id: "first", label: "First page only" },
  { id: "last", label: "Last page only" },
  { id: "first-last", label: "First & last" },
  { id: "range", label: "Custom range" },
];

const POSITIONS: { id: WatermarkPosition; label: string }[] = [
  { id: "diagonal", label: "Diagonal" },
  { id: "center", label: "Center" },
  { id: "tile", label: "Tile / repeat" },
  { id: "top-left", label: "Top left" },
  { id: "top-right", label: "Top right" },
  { id: "bottom-left", label: "Bottom left" },
  { id: "bottom-right", label: "Bottom right" },
  { id: "custom", label: "Custom %" },
];

interface HistoryEntry { id: string; name: string; pages: number; bytes: number; ts: number; }

const SETTINGS_KEY = "toolnest-pdf-watermark-settings";
const HISTORY_KEY = "toolnest-pdf-watermark-history";
const LANG_KEY = "toolnest-pdf-watermark-lang";

type WmHandle = "move" | "resize";

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export function PdfWatermark() {
  const favorites = useFavorites();
  const slug = "pdf-watermark";

  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const undoStack = useRef<WatermarkSettings[]>([]);
  const redoStack = useRef<WatermarkSettings[]>([]);
  const interactionRef = useRef<{
    type: WmHandle;
    startX: number;
    startY: number;
    rect: DOMRect;
    orig: { customX: number; customY: number; size: number };
    snapshot: WatermarkSettings;
  } | null>(null);

  const [source, setSource] = useState<PdfDocument | null>(null);
  const [batchSources, setBatchSources] = useState<PdfDocument[]>([]);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("studio");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [pendingUnlock, setPendingUnlock] = useState<{ file: File; password: string } | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lang, setLang] = useState<Lang>("en");
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const [wm, setWm] = useState<WatermarkSettings>({ ...DEFAULT_WATERMARK });
  const [outputName, setOutputName] = useState("watermarked");
  const [compress, setCompress] = useState(true);
  const [preserveMetadata, setPreserveMetadata] = useState(true);
  const [pdfPassword, setPdfPassword] = useState("");
  const [pdfA, setPdfA] = useState(false);

  const t = (k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k;

  const outputOptions: WatermarkOutputOptions = useMemo(
    () => ({
      fileName: outputName,
      title: "",
      author: "ToolNest.io",
      preserveMetadata,
      compress,
      password: pdfPassword,
      pdfA,
    }),
    [outputName, preserveMetadata, compress, pdfPassword, pdfA],
  );

  const tips = useMemo(
    () => (source ? smartWatermarkTips(source.pageCount, hasSignature, wm, source.size) : []),
    [source, hasSignature, wm],
  );

  const recs = useMemo(
    () => (source ? aiWatermarkRecommendations(source.pageCount, wm, hasSignature) : []),
    [source, wm, hasSignature],
  );

  const pushUndo = useCallback((prev: WatermarkSettings) => {
    undoStack.current = [...undoStack.current.slice(-24), { ...prev }];
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const patchWm = (patch: Partial<WatermarkSettings>) => {
    setWm((prev) => {
      pushUndo(prev);
      return { ...prev, ...patch };
    });
  };

  const patchWmLive = (patch: Partial<WatermarkSettings>) => {
    setWm((prev) => ({ ...prev, ...patch }));
  };

  const onPositionChange = (pos: WatermarkPosition) => {
    if (pos === "tile") {
      patchWm({ position: pos });
      return;
    }
    const anchor = pos === "custom" ? { x: wm.customX, y: wm.customY } : anchorForPosition(pos);
    patchWm({ position: pos, customX: anchor.x, customY: anchor.y });
  };

  const previewAnchor = useMemo(() => {
    if (wm.position === "tile") return null;
    return resolveWatermarkAnchor(wm);
  }, [wm.position, wm.customX, wm.customY]);

  const previewSizePx = useMemo(() => {
    if (wm.type === "text") return Math.max(12, Math.min(96, wm.fontSize * wm.scale * 0.45));
    if (wm.type === "qr") return Math.max(24, Math.min(120, wm.qrSize * wm.scale * 0.35));
    return Math.max(32, Math.min(140, wm.imageScale * wm.scale * 280));
  }, [wm.type, wm.fontSize, wm.scale, wm.qrSize, wm.imageScale]);

  const onPreviewPointerDown = (e: ReactPointerEvent<HTMLDivElement>, type: WmHandle) => {
    if (wm.position === "tile" || !previewRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = previewRef.current.getBoundingClientRect();
    const anchor = resolveWatermarkAnchor(wm);
    interactionRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      rect,
      orig: { customX: anchor.x, customY: anchor.y, size: watermarkSizeValue(wm) },
      snapshot: { ...wm },
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPreviewPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const it = interactionRef.current;
    if (!it) return;
    const dx = (e.clientX - it.startX) / it.rect.width;
    const dy = (e.clientY - it.startY) / it.rect.height;
    if (it.type === "move") {
      patchWmLive({
        position: "custom",
        customX: clamp01(it.orig.customX + dx),
        customY: clamp01(it.orig.customY - dy),
      });
    } else {
      const delta = (dx - dy) / 2;
      const next = it.orig.size * (1 + delta * 2.5);
      patchWmLive(patchWatermarkSize(it.snapshot, next));
    }
  };

  const onPreviewPointerUp = () => {
    const it = interactionRef.current;
    if (it) {
      setWm((prev) => {
        pushUndo(it.snapshot);
        return prev;
      });
    }
    interactionRef.current = null;
  };

  const undo = () => {
    const prev = undoStack.current.pop();
    if (prev) {
      redoStack.current.push({ ...wm });
      setWm(prev);
      setCanUndo(undoStack.current.length > 0);
      setCanRedo(true);
    }
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (next) {
      undoStack.current.push({ ...wm });
      setWm(next);
      setCanRedo(redoStack.current.length > 0);
      setCanUndo(true);
    }
  };

  const loadPdf = async (file: File, password?: string) => {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("Please select a PDF");
      return;
    }
    setLoading(true);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    try {
      const doc = await parsePdf(file, password);
      setSource(doc);
      setOutputName(doc.name.replace(/\.pdf$/i, "") || "watermarked");
      const sig = detectDigitalSignature(doc.bytes);
      setHasSignature(sig);
      const thumb = await renderThumb(doc.bytes, 0);
      setThumbUrl(thumb);
      undoStack.current = [];
      redoStack.current = [];
      setCanUndo(false);
      setCanRedo(false);
      if (sig) toast.warning(t("signature"));
      else toast.success(`${doc.pageCount} pages loaded`);
    } catch (e) {
      if (e instanceof PdfEncryptedError) {
        setPendingUnlock({ file, password: "" });
        toast.info(`"${file.name}" requires a password`);
        return;
      }
      toast.error(e instanceof Error ? e.message : "Failed to read PDF");
    } finally {
      setLoading(false);
    }
  };

  const addBatch = async (files: FileList | File[]) => {
    const pdfs = Array.from(files).filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) { toast.error("No PDF files"); return; }
    if (pdfs.length === 1 && !source) { await loadPdf(pdfs[0]!); return; }
    setLoading(true);
    try {
      const loaded: PdfDocument[] = [];
      for (const f of pdfs.slice(source ? 0 : 1)) {
        try { loaded.push(await parsePdf(f)); } catch { /* skip encrypted */ }
      }
      if (loaded.length) {
        setBatchSources((p) => [...p, ...loaded]);
        toast.success(`${loaded.length} PDF(s) queued`);
      }
    } finally {
      setLoading(false);
    }
  };

  const onLogo = async (file: File) => {
    const buf = await file.arrayBuffer();
    patchWm({
      type: "image",
      imageBytes: buf,
      imageMime: file.type.includes("png") ? "png" : "jpg",
    });
    toast.success("Logo loaded");
  };

  const applyTemplate = (id: string) => {
    const tpl = WATERMARK_TEMPLATES.find((x) => x.id === id);
    if (tpl) {
      patchWm({
        ...DEFAULT_WATERMARK,
        ...tpl.settings,
        type: tpl.settings.includeTimestamp && !tpl.settings.text ? wm.type : "text",
        imageBytes: wm.imageBytes,
        imageMime: wm.imageMime,
      });
      setSelectedTemplate(id);
      toast.success(tpl.label);
    }
  };

  const applyRec = (action: string) => {
    if (action === "template-confidential") applyTemplate("confidential");
    else if (action === "opacity") patchWm({ opacity: 0.25 });
    else if (action === "rotation") patchWm({ rotation: -35, position: "diagonal" });
  };

  const runWatermark = async (download: boolean) => {
    if (!source) return;
    setBusy(true);
    setProgress(0);
    try {
      const data = await buildWatermarkedPdf(source.bytes, wm, outputOptions, setProgress);
      const blob = new Blob([data as BlobPart], { type: "application/pdf" });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      if (download) {
        downloadBlob(blob, `${outputName.replace(/[^a-z0-9._-]+/gi, "-") || "watermarked"}.pdf`);
        setHistory((h) => [{ id: crypto.randomUUID(), name: source.name, pages: source.pageCount, bytes: data.byteLength, ts: Date.now() }, ...h].slice(0, 20));
        toast.success(`Done · ${formatBytes(data.byteLength)}`);
      } else {
        setTab("preview");
        toast.success("Preview ready");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Watermark failed");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  const runBatch = async () => {
    const list = batchSources.length ? batchSources : source ? [source] : [];
    if (!list.length) { toast.error("Add PDFs"); return; }
    setBusy(true);
    try {
      const files = await executeBatchWatermark(
        list.map((d) => ({ name: d.name, bytes: d.bytes })),
        wm,
        outputOptions,
        setProgress,
      );
      if (files.length === 1) {
        downloadBlob(new Blob([files[0]!.data as BlobPart], { type: "application/pdf" }), `${files[0]!.name}.pdf`);
      } else {
        const zip = await zipWatermarkedFiles(files, "batch-watermark");
        downloadBlob(zip, "batch-watermark.zip");
      }
      toast.success(`Batch complete · ${files.length} file(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { wm?: Partial<WatermarkSettings>; compress?: boolean };
        if (s.wm) setWm((w) => ({ ...w, ...s.wm, imageBytes: null }));
        if (typeof s.compress === "boolean") setCompress(s.compress);
      }
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h) as HistoryEntry[]);
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ wm: { ...wm, imageBytes: undefined }, compress }));
  }, [wm, compress]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t("private")}</p>
        <div className="flex items-center gap-2">
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={cn(inputClass(), "w-auto py-1.5 text-xs")}>
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
          <button type="button" onClick={() => favorites.toggle(slug)} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs", favorites.isFavorite(slug) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted")}>
            <Star className={cn("h-3.5 w-3.5", favorites.isFavorite(slug) && "fill-current")} />
            {favorites.isFavorite(slug) ? t("favorited") : t("favorite")}
          </button>
        </div>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => !loading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) void loadPdf(f); }}
        className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center", dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50")}
      >
        {loading ? <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" /> : <UploadCloud className="mb-3 h-10 w-10 text-primary" />}
        <p className="font-display text-lg font-semibold">Ultra PDF Watermark Studio</p>
        <p className="mt-1 text-sm text-muted">{source ? `${source.name} · ${source.pageCount} pages` : t("drop")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}><UploadCloud className="h-4 w-4" /> Add PDF</Button>
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); folderRef.current?.click(); }}><FolderUp className="h-4 w-4" /> Folder</Button>
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); batchRef.current?.click(); }}><FileArchive className="h-4 w-4" /> Batch</Button>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadPdf(f); e.target.value = ""; }} />
        <input ref={folderRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} onChange={(e) => { if (e.target.files) void addBatch(e.target.files); e.target.value = ""; }} />
        <input ref={batchRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) void addBatch(e.target.files); e.target.value = ""; }} />
      </div>

      {pendingUnlock && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-wrap gap-2">
          <input type="password" value={pendingUnlock.password} onChange={(e) => setPendingUnlock({ ...pendingUnlock, password: e.target.value })} className={cn(inputClass(), "max-w-xs")} placeholder="PDF password" />
          <Button size="sm" onClick={() => { void loadPdf(pendingUnlock.file, pendingUnlock.password); setPendingUnlock(null); }}>Unlock</Button>
        </div>
      )}

      {source && (
        <>
          {hasSignature && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2 text-sm text-amber-700 dark:text-amber-300"><Shield className="mr-2 inline h-4 w-4" />{t("signature")}</div>
          )}
          {tips.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <ul className="list-inside list-disc text-muted">{tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
            </div>
          )}

          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(["studio", "preview", "batch", "history", "api"] as Tab[]).map((key) => (
              <button key={key} type="button" onClick={() => setTab(key)} className={cn("flex flex-1 items-center justify-center rounded-lg px-3 py-2.5 text-sm font-medium capitalize", tab === key ? "bg-primary text-white" : "text-muted")}>{t(key)}</button>
            ))}
          </div>

          {tab === "studio" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                {thumbUrl && (
                  <div
                    ref={previewRef}
                    className="relative mx-auto max-w-md overflow-hidden rounded-lg border border-border bg-muted/20 select-none"
                    onPointerMove={onPreviewPointerMove}
                    onPointerUp={onPreviewPointerUp}
                    onPointerCancel={onPreviewPointerUp}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={thumbUrl} alt="Page 1" className="w-full object-contain opacity-90" draggable={false} />
                    {wm.position === "tile" ? (
                      <div className="pointer-events-none absolute inset-0 flex flex-wrap content-center justify-center gap-6 p-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <span
                            key={i}
                            className="font-bold opacity-25"
                            style={{ color: wm.color, fontSize: `${Math.max(10, wm.fontSize * wm.scale * 0.2)}px`, transform: `rotate(${wm.rotation}deg)` }}
                          >
                            {wm.type === "text" ? wm.text || "WM" : wm.type === "qr" ? "QR" : "LOGO"}
                          </span>
                        ))}
                      </div>
                    ) : previewAnchor ? (
                      <div
                        className="absolute z-10 touch-none"
                        style={{
                          left: `${previewAnchor.x * 100}%`,
                          top: `${(1 - previewAnchor.y) * 100}%`,
                          transform: `translate(-50%, -50%) rotate(${wm.rotation}deg)`,
                        }}
                      >
                        <div
                          className="relative cursor-move rounded border-2 border-dashed border-primary/70 bg-primary/5 px-2 py-1"
                          style={{ minWidth: previewSizePx, minHeight: wm.type === "qr" ? previewSizePx : undefined }}
                          onPointerDown={(e) => onPreviewPointerDown(e, "move")}
                        >
                          {wm.type === "text" && (
                            <span className="block whitespace-nowrap font-bold" style={{ color: wm.color, fontSize: `${previewSizePx}px`, opacity: wm.opacity + 0.35 }}>
                              {wm.text || "WATERMARK"}
                            </span>
                          )}
                          {wm.type === "qr" && (
                            <div className="flex items-center justify-center rounded bg-white/80" style={{ width: previewSizePx, height: previewSizePx }}>
                              <QrCode className="h-1/2 w-1/2 text-foreground" style={{ width: previewSizePx * 0.6, height: previewSizePx * 0.6 }} />
                            </div>
                          )}
                          {wm.type === "image" && (
                            <div className="flex items-center justify-center rounded bg-white/50 text-xs font-semibold text-muted" style={{ width: previewSizePx, height: previewSizePx * 0.6 }}>
                              LOGO
                            </div>
                          )}
                          <div
                            className="absolute -bottom-1.5 -right-1.5 z-20 h-3.5 w-3.5 cursor-se-resize rounded-full border-2 border-white bg-primary shadow"
                            onPointerDown={(e) => onPreviewPointerDown(e, "resize")}
                          />
                          <Move className="pointer-events-none absolute -left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary opacity-70" />
                        </div>
                      </div>
                    ) : null}
                    <p className="border-t border-border px-2 py-1 text-center text-[10px] text-muted">
                      {wm.position === "tile" ? t("tileLocked") : t("moveHint")}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {(["text", "image", "qr"] as WatermarkType[]).map((ty) => (
                    <Button key={ty} size="sm" variant={wm.type === ty ? "default" : "outline"} onClick={() => patchWm({ type: ty })}>
                      {ty === "text" ? <Type className="h-3.5 w-3.5" /> : ty === "image" ? <ImagePlus className="h-3.5 w-3.5" /> : <QrCode className="h-3.5 w-3.5" />}
                      {ty === "text" ? t("text") : ty === "image" ? t("logo") : t("qr")}
                    </Button>
                  ))}
                  <Button size="sm" variant="outline" onClick={undo} disabled={!canUndo}><Undo2 className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={redo} disabled={!canRedo}><Redo2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <Field label={t("templates")}>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id) applyTemplate(id);
                      else setSelectedTemplate("");
                    }}
                    className={inputClass()}
                  >
                    <option value="">{t("selectTemplate")}</option>
                    {WATERMARK_TEMPLATE_CATEGORIES.map((cat) => (
                      <optgroup key={cat.id} label={cat.label}>
                        {WATERMARK_TEMPLATES.filter((tpl) => tpl.category === cat.id).map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.label} — {tpl.hint}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>

                {wm.type === "text" && (
                  <Field label="Watermark text">
                    <input value={wm.text} onChange={(e) => patchWm({ text: e.target.value })} className={inputClass()} placeholder="CONFIDENTIAL" />
                  </Field>
                )}
                {wm.type === "image" && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}><ImagePlus className="h-4 w-4" /> Upload logo</Button>
                    <input ref={logoRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onLogo(f); e.target.value = ""; }} />
                  </>
                )}
                {wm.type === "qr" && (
                  <Field label="QR content"><input value={wm.qrContent} onChange={(e) => patchWm({ qrContent: e.target.value })} className={inputClass()} placeholder="https://..." /></Field>
                )}

                <Field label={t("font")}>
                  <select value={wm.fontId} onChange={(e) => patchWm({ fontId: e.target.value as PdfFontId })} className={inputClass()}>
                    {(["Helvetica", "Times", "Courier", "Special"] as const).map((group) => (
                      <optgroup key={group} label={group}>
                        {PDF_FONT_OPTIONS.filter((f) => f.group === group).map((f) => (
                          <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Color"><input type="color" value={wm.color} onChange={(e) => patchWm({ color: e.target.value })} className="h-10 w-full cursor-pointer rounded-lg border border-border" /></Field>
                  <Field label={`${t("opacity")}: ${Math.round(wm.opacity * 100)}%`}><input type="range" min={5} max={90} value={Math.round(wm.opacity * 100)} onChange={(e) => patchWm({ opacity: Number(e.target.value) / 100 })} className="w-full accent-[var(--primary)]" /></Field>
                </div>
                <Field label={`${t("rotation")}: ${wm.rotation}°`}><input type="range" min={-90} max={90} value={wm.rotation} onChange={(e) => patchWm({ rotation: Number(e.target.value) })} className="w-full accent-[var(--primary)]" /></Field>

                <Field label={t("size")}>
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" title={t("smaller")} onClick={() => patchWm(nudgeWatermarkSize(wm, 0.85))}><Minus className="h-4 w-4" /></Button>
                    <input
                      type="range"
                      min={wm.type === "text" ? 12 : wm.type === "image" ? 5 : 32}
                      max={wm.type === "text" ? 120 : wm.type === "image" ? 100 : 240}
                      value={wm.type === "text" ? wm.fontSize : wm.type === "image" ? Math.round(wm.imageScale * 100) : wm.qrSize}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (wm.type === "text") patchWm({ fontSize: v });
                        else if (wm.type === "image") patchWm({ imageScale: v / 100 });
                        else patchWm({ qrSize: v });
                      }}
                      className="min-w-0 flex-1 accent-[var(--primary)]"
                    />
                    <Button type="button" size="sm" variant="outline" title={t("bigger")} onClick={() => patchWm(nudgeWatermarkSize(wm, 1.15))}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <p className="mt-1 text-[10px] text-muted">
                    {wm.type === "text" && `${wm.fontSize} pt`}
                    {wm.type === "image" && `${Math.round(wm.imageScale * 100)}% width`}
                    {wm.type === "qr" && `${wm.qrSize}px`}
                    {` · ${t("scale")} ${Math.round(wm.scale * 100)}%`}
                  </p>
                </Field>
                <Field label={`${t("scale")}: ${Math.round(wm.scale * 100)}%`}>
                  <input type="range" min={25} max={200} value={Math.round(wm.scale * 100)} onChange={(e) => patchWm({ scale: Number(e.target.value) / 100 })} className="w-full accent-[var(--primary)]" />
                </Field>

                <Field label={t("position")}>
                  <select value={wm.position} onChange={(e) => onPositionChange(e.target.value as WatermarkPosition)} className={inputClass()}>
                    {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </Field>

                {wm.position !== "tile" && previewAnchor && (
                  <div className="grid grid-cols-2 gap-2">
                    <Field label={`${t("posX")}: ${Math.round(previewAnchor.x * 100)}%`}>
                      <input type="range" min={0} max={100} value={Math.round(previewAnchor.x * 100)} onChange={(e) => patchWm({ position: "custom", customX: Number(e.target.value) / 100 })} className="w-full accent-[var(--primary)]" />
                    </Field>
                    <Field label={`${t("posY")}: ${Math.round(previewAnchor.y * 100)}%`}>
                      <input type="range" min={0} max={100} value={Math.round(previewAnchor.y * 100)} onChange={(e) => patchWm({ position: "custom", customY: Number(e.target.value) / 100 })} className="w-full accent-[var(--primary)]" />
                    </Field>
                  </div>
                )}

                <Field label={t("scope")}>
                  <select value={wm.scope} onChange={(e) => patchWm({ scope: e.target.value as PageScope })} className={inputClass()}>
                    {SCOPES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </Field>
                {wm.scope === "range" && (
                  <Field label="Page range" hint="e.g. 1-3, 5, 8-10"><input value={wm.pageRange} onChange={(e) => patchWm({ pageRange: e.target.value })} className={inputClass()} /></Field>
                )}

                <Field label="Header"><input value={wm.headerText} onChange={(e) => patchWm({ headerText: e.target.value })} className={inputClass()} placeholder="Optional" /></Field>
                <Field label="Footer"><input value={wm.footerText} onChange={(e) => patchWm({ footerText: e.target.value })} className={inputClass()} placeholder="Optional" /></Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wm.includeTimestamp} onChange={(e) => patchWm({ includeTimestamp: e.target.checked })} className="accent-[var(--primary)]" /> Include timestamp</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wm.includePageNumbers} onChange={(e) => patchWm({ includePageNumbers: e.target.checked })} className="accent-[var(--primary)]" /> Page numbers in footer</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wm.layer === "background"} onChange={(e) => patchWm({ layer: e.target.checked ? "background" : "foreground" })} className="accent-[var(--primary)]" /> Background layer (reduced opacity)</label>

                <Field label="Output filename"><input value={outputName} onChange={(e) => setOutputName(e.target.value)} className={inputClass()} /></Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} className="accent-[var(--primary)]" /> Compress output</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={preserveMetadata} onChange={(e) => setPreserveMetadata(e.target.checked)} className="accent-[var(--primary)]" /> Preserve metadata</label>

                {recs.length > 0 && (
                  <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4" /> {t("ai")}</p>
                    {recs.map((r, i) => (
                      <div key={i} className="flex justify-between gap-2 text-xs">
                        <div><p className="font-medium">{r.title}</p><p className="text-muted">{r.detail}</p></div>
                        {r.action && <Button size="sm" variant="outline" onClick={() => applyRec(String(r.action))}>{t("apply")}</Button>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Button variant="gradient" disabled={busy} onClick={() => void runWatermark(true)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("watermark")}</Button>
                  <Button variant="outline" disabled={busy} onClick={() => void runWatermark(false)}><Eye className="h-4 w-4" /> {t("previewBtn")}</Button>
                  {busy && progress > 0 && <div className="h-2 overflow-hidden rounded-full bg-muted/30"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>}
                </div>
              </div>
            </div>
          )}

          {tab === "preview" && (
            <div className="rounded-xl border border-border bg-card p-2">
              {previewUrl ? <iframe src={previewUrl} title="Preview" className="h-[70vh] w-full rounded-lg" /> : <p className="py-16 text-center text-muted">Run Preview first.</p>}
            </div>
          )}

          {tab === "batch" && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-muted">{batchSources.length || 1} PDF(s) — same watermark settings.</p>
              {batchSources.length > 0 && (
                <ul className="divide-y divide-border text-sm">{batchSources.map((d) => <li key={d.id} className="py-2 truncate">{d.name}</li>)}</ul>
              )}
              <Button variant="gradient" disabled={busy} onClick={() => void runBatch()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} {t("batchZip")}</Button>
            </div>
          )}

          {tab === "history" && (
            <div className="rounded-xl border border-border bg-card p-4">
              {history.length === 0 ? <p className="py-8 text-center text-muted">{t("emptyHistory")}</p> : (
                <ul className="divide-y divide-border text-sm">{history.map((h) => <li key={h.id} className="flex justify-between py-2"><span>{h.name}</span><span className="text-muted">{formatBytes(h.bytes)}</span></li>)}</ul>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 font-medium"><Shield className="h-4 w-4 text-primary" /> POST /api/v1/pdf/watermark</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`POST /api/v1/pdf/watermark
{
  "pdf": "JVBERi0x...",
  "watermark": {
    "type": "text",
    "text": "CONFIDENTIAL",
    "opacity": 0.25,
    "rotation": -35,
    "position": "diagonal",
    "scope": "all"
  },
  "options": { "compress": true, "preserveMetadata": true }
}`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
