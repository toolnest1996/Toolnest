"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Eye,
  FileArchive,
  FlipHorizontal2,
  FolderUp,
  GripVertical,
  History,
  Loader2,
  Maximize2,
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ScanLine,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Star,
  Trash2,
  Undo2,
  UploadCloud,
  Wand2,
  X,
  Zap,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import { PdfEncryptedError, type PdfDocument } from "./pdf-merge-utils";
import {
  aiRotateRecommendations,
  analyzePageOrientations,
  applyAutoOrient,
  applyRotationToRange,
  buildRotatedPdf,
  canRotateInPlace,
  detectDigitalSignature,
  executeBatchRotate,
  initRotatePages,
  normalizeAllRotations,
  normalizeRotation,
  parsePdf,
  readPageDimensions,
  reorder,
  renderThumb,
  rotateClockwise,
  rotateCounterClockwise,
  rotateLandscapePages,
  smartRotateSuggestions,
  zipRotatedFiles,
  type PageOrientationInfo,
  type RotateOutputOptions,
  type RotatePage,
  type RotateRecommendation,
} from "./pdf-rotate-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";
type Tab = "studio" | "preview" | "compare" | "batch" | "history" | "api";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", preview: "Preview", compare: "Compare", batch: "Batch", history: "History", api: "API",
    drop: "Drop PDFs, paste, or browse", dropHint: "Rotate pages in-browser — private & secure",
    addFiles: "Add files", addFolder: "Folder", paste: "Paste", rotate: "Rotate & Download",
    previewBtn: "Preview", clear: "Clear", cw: "90° CW", ccw: "90° CCW", all: "Rotate all",
    undo: "Undo", redo: "Redo", range: "Page range", apply: "Apply", custom: "Custom °",
    autoOrient: "Auto-orient", normalize: "Normalize", delete: "Delete page", private: "100% private · in-browser",
    favorite: "Favorite", favorited: "Favorited", ai: "AI recommendations", emptyHistory: "No rotations yet.",
    batchZip: "Batch ZIP", signature: "Digital signature detected", inPlace: "Lossless in-place rotation",
  },
  es: {
    studio: "Estudio", preview: "Vista previa", compare: "Comparar", batch: "Lote", history: "Historial", api: "API",
    drop: "Suelta PDFs", dropHint: "100% en navegador", addFiles: "Añadir", addFolder: "Carpeta", paste: "Pegar",
    rotate: "Rotar y descargar", previewBtn: "Vista previa", clear: "Limpiar", cw: "90° horario", ccw: "90° antihorario",
    all: "Rotar todo", undo: "Deshacer", redo: "Rehacer", range: "Rango", apply: "Aplicar", custom: "Grados",
    autoOrient: "Auto-orientar", normalize: "Normalizar", delete: "Eliminar", private: "100% privado",
    favorite: "Favorito", favorited: "Favorito", ai: "Recomendaciones IA", emptyHistory: "Sin historial.", batchZip: "ZIP lote",
    signature: "Firma digital detectada", inPlace: "Rotación sin pérdida",
  },
  de: {
    studio: "Studio", preview: "Vorschau", compare: "Vergleich", batch: "Stapel", history: "Verlauf", api: "API",
    drop: "PDFs ablegen", dropHint: "100% im Browser", addFiles: "Hinzufügen", addFolder: "Ordner", paste: "Einfügen",
    rotate: "Drehen & laden", previewBtn: "Vorschau", clear: "Löschen", cw: "90° rechts", ccw: "90° links",
    all: "Alle drehen", undo: "Rückgängig", redo: "Wiederholen", range: "Seitenbereich", apply: "Anwenden", custom: "Grad",
    autoOrient: "Auto-Ausrichtung", normalize: "Normalisieren", delete: "Seite löschen", private: "100% privat",
    favorite: "Favorit", favorited: "Favorit", ai: "KI-Empfehlungen", emptyHistory: "Kein Verlauf.", batchZip: "Stapel-ZIP",
    signature: "Digitale Signatur erkannt", inPlace: "Verlustfreie Rotation",
  },
  fr: {
    studio: "Studio", preview: "Aperçu", compare: "Comparer", batch: "Lot", history: "Historique", api: "API",
    drop: "Déposez des PDF", dropHint: "100% navigateur", addFiles: "Ajouter", addFolder: "Dossier", paste: "Coller",
    rotate: "Pivoter et télécharger", previewBtn: "Aperçu", clear: "Effacer", cw: "90° horaire", ccw: "90° antihoraire",
    all: "Tout pivoter", undo: "Annuler", redo: "Rétablir", range: "Plage", apply: "Appliquer", custom: "Degrés",
    autoOrient: "Auto-orientation", normalize: "Normaliser", delete: "Supprimer page", private: "100% privé",
    favorite: "Favori", favorited: "Favori", ai: "Recommandations IA", emptyHistory: "Aucun historique.", batchZip: "ZIP lot",
    signature: "Signature numérique détectée", inPlace: "Rotation sans perte",
  },
  tr: {
    studio: "Stüdyo", preview: "Önizleme", compare: "Karşılaştır", batch: "Toplu", history: "Geçmiş", api: "API",
    drop: "PDF bırakın", dropHint: "%100 tarayıcı", addFiles: "Ekle", addFolder: "Klasör", paste: "Yapıştır",
    rotate: "Döndür ve indir", previewBtn: "Önizleme", clear: "Temizle", cw: "90° saat yönü", ccw: "90° ters",
    all: "Tümünü döndür", undo: "Geri", redo: "İleri", range: "Sayfa aralığı", apply: "Uygula", custom: "Özel °",
    autoOrient: "Otomatik yönlendir", normalize: "Normalize et", delete: "Sayfayı sil", private: "%100 özel",
    favorite: "Favori", favorited: "Favori", ai: "AI önerileri", emptyHistory: "Geçmiş yok.", batchZip: "Toplu ZIP",
    signature: "Dijital imza algılandı", inPlace: "Kayıpsız döndürme",
  },
  hi: {
    studio: "स्टूडियो", preview: "पूर्वावलोकन", compare: "तुलना", batch: "बैच", history: "इतिहास", api: "API",
    drop: "PDF छोड़ें", dropHint: "100% ब्राउज़र", addFiles: "जोड़ें", addFolder: "फ़ोल्डर", paste: "पेस्ट",
    rotate: "घुमाएँ और डाउनलोड", previewBtn: "पूर्वावलोकन", clear: "साफ़", cw: "90° CW", ccw: "90° CCW",
    all: "सभी घुमाएँ", undo: "पूर्ववत", redo: "फिर", range: "पृष्ठ सीमा", apply: "लागू", custom: "कस्टम °",
    autoOrient: "ऑटो-ओरिएंट", normalize: "सामान्य", delete: "पृष्ठ हटाएँ", private: "100% निजी",
    favorite: "पसंदीदा", favorited: "पसंदीदा", ai: "AI सुझाव", emptyHistory: "कोई इतिहास नहीं।", batchZip: "बैच ZIP",
    signature: "डिजिटल हस्ताक्षर", inPlace: "नुकसान रहित घुमाव",
  },
  pt: {
    studio: "Estúdio", preview: "Prévia", compare: "Comparar", batch: "Lote", history: "Histórico", api: "API",
    drop: "Solte PDFs", dropHint: "100% navegador", addFiles: "Adicionar", addFolder: "Pasta", paste: "Colar",
    rotate: "Girar e baixar", previewBtn: "Prévia", clear: "Limpar", cw: "90° horário", ccw: "90° anti-horário",
    all: "Girar tudo", undo: "Desfazer", redo: "Refazer", range: "Intervalo", apply: "Aplicar", custom: "Graus",
    autoOrient: "Auto-orientar", normalize: "Normalizar", delete: "Excluir página", private: "100% privado",
    favorite: "Favorito", favorited: "Favorito", ai: "Recomendações IA", emptyHistory: "Sem histórico.", batchZip: "ZIP lote",
    signature: "Assinatura digital detectada", inPlace: "Rotação sem perda",
  },
  ja: {
    studio: "スタジオ", preview: "プレビュー", compare: "比較", batch: "一括", history: "履歴", api: "API",
    drop: "PDFをドロップ", dropHint: "100%ブラウザ", addFiles: "追加", addFolder: "フォルダ", paste: "ペースト",
    rotate: "回転してダウンロード", previewBtn: "プレビュー", clear: "消去", cw: "90°時計回り", ccw: "90°反時計回り",
    all: "すべて回転", undo: "元に戻す", redo: "やり直し", range: "ページ範囲", apply: "適用", custom: "角度",
    autoOrient: "自動向き", normalize: "正規化", delete: "ページ削除", private: "100%プライベート",
    favorite: "お気に入り", favorited: "お気に入り", ai: "AI推奨", emptyHistory: "履歴なし。", batchZip: "一括ZIP",
    signature: "デジタル署名を検出", inPlace: "ロスレス回転",
  },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français", tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

const SELECTION_PRESETS = [
  { id: "all", label: "All" },
  { id: "none", label: "None" },
  { id: "odd", label: "Odd" },
  { id: "even", label: "Even" },
  { id: "landscape", label: "Landscape" },
  { id: "portrait", label: "Portrait" },
  { id: "invert", label: "Invert" },
] as const;

const SETTINGS_KEY = "toolnest-pdf-rotate-settings";
const HISTORY_KEY = "toolnest-pdf-rotate-history";
const LANG_KEY = "toolnest-pdf-rotate-lang";

interface HistoryEntry {
  id: string;
  name: string;
  pages: number;
  bytes: number;
  ts: number;
}

function baseName(filename: string): string {
  return filename.replace(/\.pdf$/i, "") || "document";
}

export function PdfRotate() {
  const favorites = useFavorites();
  const slug = "pdf-rotate";

  const inputRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<RotatePage[][]>([]);
  const redoStack = useRef<RotatePage[][]>([]);

  const [source, setSource] = useState<PdfDocument | null>(null);
  const [pages, setPages] = useState<RotatePage[]>([]);
  const [orientations, setOrientations] = useState<PageOrientationInfo[]>([]);
  const [batchSources, setBatchSources] = useState<PdfDocument[]>([]);
  const [tab, setTab] = useState<Tab>("studio");
  const [dragging, setDragging] = useState(false);
  const [dragPage, setDragPage] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [pageSearch, setPageSearch] = useState("");
  const [zoomPage, setZoomPage] = useState<RotatePage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [compareSlider, setCompareSlider] = useState(50);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [pendingUnlock, setPendingUnlock] = useState<{ file: File; password: string } | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchRotation, setBatchRotation] = useState(90);
  const [pageRange, setPageRange] = useState("");
  const [customAngle, setCustomAngle] = useState(90);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lang, setLang] = useState<Lang>("en");

  const [outputName, setOutputName] = useState("rotated");
  const [compress, setCompress] = useState(true);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfAuthor, setPdfAuthor] = useState("ToolNest.io");
  const [pdfSubject, setPdfSubject] = useState("");
  const [pdfKeywords, setPdfKeywords] = useState("");
  const [pdfPassword, setPdfPassword] = useState("");
  const [preserveMetadata, setPreserveMetadata] = useState(true);
  const [preserveBookmarks, setPreserveBookmarks] = useState(true);
  const [pdfA, setPdfA] = useState(false);
  const [pageNumbers, setPageNumbers] = useState(false);
  const [watermark, setWatermark] = useState("");
  const [fitToA4, setFitToA4] = useState(false);

  const t = (k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k;

  const included = useMemo(() => pages.filter((p) => p.included), [pages]);

  const outputOptions: RotateOutputOptions = useMemo(
    () => ({
      fileName: outputName,
      title: pdfTitle,
      author: pdfAuthor,
      subject: pdfSubject,
      keywords: pdfKeywords.split(",").map((k) => k.trim()).filter(Boolean),
      compress,
      password: pdfPassword,
      preserveMetadata,
      preserveBookmarks,
      pdfA,
      pageNumbers,
      watermark,
      fitToA4,
    }),
    [outputName, pdfTitle, pdfAuthor, pdfSubject, pdfKeywords, compress, pdfPassword, preserveMetadata, preserveBookmarks, pdfA, pageNumbers, watermark, fitToA4],
  );

  const inPlace = useMemo(
    () => (source ? canRotateInPlace(pages, source.pageCount) : false),
    [source, pages],
  );

  const mixedOrientation = useMemo(
    () =>
      orientations.some((o) => o.orientation === "landscape") &&
      orientations.some((o) => o.orientation === "portrait"),
    [orientations],
  );

  const smartTips = useMemo(
    () =>
      source
        ? smartRotateSuggestions(pages, source.pageCount, source.size, hasSignature, mixedOrientation)
        : [],
    [source, pages, hasSignature, mixedOrientation],
  );

  const recommendations = useMemo(
    () => (pages.length ? aiRotateRecommendations(pages, orientations) : []),
    [pages, orientations],
  );

  const stats = useMemo(
    () => ({
      total: source?.pageCount ?? 0,
      selected: included.length,
      rotated: included.filter((p) => p.rotation !== 0).length,
      size: source?.size ?? 0,
    }),
    [source, included],
  );

  const filteredPages = useMemo(() => {
    const q = pageSearch.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter((p) => `page ${p.sourcePageIndex + 1}`.includes(q));
  }, [pages, pageSearch]);

  const pushUndo = useCallback((snapshot: RotatePage[]) => {
    undoStack.current = [...undoStack.current.slice(-24), snapshot.map((p) => ({ ...p }))];
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const updatePages = useCallback(
    (updater: (prev: RotatePage[]) => RotatePage[], trackUndo = true) => {
      setPages((prev) => {
        if (trackUndo) pushUndo(prev);
        return updater(prev);
      });
    },
    [pushUndo],
  );

  const undo = () => {
    const prev = undoStack.current.pop();
    if (prev) {
      redoStack.current.push(pages.map((p) => ({ ...p })));
      setPages(prev);
      setCanUndo(undoStack.current.length > 0);
      setCanRedo(true);
      toast.success(t("undo"));
    }
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (next) {
      undoStack.current.push(pages.map((p) => ({ ...p })));
      setPages(next);
      setCanRedo(redoStack.current.length > 0);
      setCanUndo(true);
      toast.success(t("redo"));
    }
  };

  const loadThumbs = useCallback(async (items: RotatePage[], bytes: ArrayBuffer) => {
    for (const item of items) {
      if (item.thumb) continue;
      try {
        const thumb = await renderThumb(bytes, item.sourcePageIndex);
        setPages((prev) => prev.map((p) => (p.id === item.id ? { ...p, thumb } : p)));
      } catch {
        /* skip */
      }
    }
  }, []);

  const loadPdf = async (file: File, password?: string) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please select a PDF file");
      return;
    }
    setLoadingFile(true);
    setError("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    try {
      const doc = await parsePdf(file, password);
      const dims = await readPageDimensions(doc.bytes);
      const initial = initRotatePages(
        doc.pageCount,
        dims.map((d) => d.rotation),
      );
      const ori = await analyzePageOrientations(doc.bytes);
      const sig = detectDigitalSignature(doc.bytes);

      setSource(doc);
      setPages(initial);
      setOrientations(ori);
      setHasSignature(sig);
      setOutputName(baseName(doc.name));
      setPageRange(`1-${doc.pageCount}`);
      undoStack.current = [];
      redoStack.current = [];
      setCanUndo(false);
      setCanRedo(false);
      void loadThumbs(initial, doc.bytes);
      if (sig) toast.warning(t("signature"));
      else toast.success(`${doc.pageCount} pages loaded`);
    } catch (e) {
      if (e instanceof PdfEncryptedError) {
        setPendingUnlock({ file, password: "" });
        toast.info(`"${file.name}" requires a password`);
        return;
      }
      const msg = e instanceof Error ? e.message : "Failed to read PDF";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingFile(false);
    }
  };

  const addFiles = async (fileList: FileList | File[]) => {
    const pdfs = Array.from(fileList).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    if (!pdfs.length) {
      toast.error("No PDF files found");
      return;
    }
    if (pdfs.length === 1 && !source) {
      await loadPdf(pdfs[0]!);
      return;
    }
    if (!source && pdfs.length > 1) {
      await loadPdf(pdfs[0]!);
    }
    setLoadingFile(true);
    try {
      const loaded: PdfDocument[] = [];
      for (const file of pdfs.slice(source ? 0 : 1)) {
        try {
          loaded.push(await parsePdf(file));
        } catch (e) {
          if (e instanceof PdfEncryptedError) {
            toast.error(`"${file.name}" is encrypted — unlock in Studio first`);
            continue;
          }
        }
      }
      if (loaded.length) {
        setBatchSources((prev) => [...prev, ...loaded]);
        toast.success(`${loaded.length} PDF(s) added to batch`);
      }
    } finally {
      setLoadingFile(false);
    }
  };

  const unlockPending = async () => {
    if (!pendingUnlock?.password.trim()) {
      toast.error("Enter the PDF password");
      return;
    }
    const { file, password } = pendingUnlock;
    setPendingUnlock(null);
    await loadPdf(file, password);
  };

  const applyRecommendation = (rec: RotateRecommendation) => {
    if (rec.action === "auto-orient") {
      updatePages((prev) => applyAutoOrient(prev, orientations));
    } else if (rec.action === "normalize") {
      updatePages((prev) => normalizeAllRotations(prev));
    } else if (rec.action === "rotate-all-90") {
      updatePages((prev) => prev.map((p) => ({ ...p, rotation: rotateClockwise(p.rotation, 90) })));
    } else if (rec.action === "rotate-landscape") {
      updatePages((prev) => rotateLandscapePages(prev, orientations));
    }
    toast.success(t("apply"));
  };

  const applySelectionPreset = (id: (typeof SELECTION_PRESETS)[number]["id"]) => {
    if (!source) return;
    updatePages((prev) =>
      prev.map((p) => {
        const ori = orientations.find((o) => o.pageIndex === p.sourcePageIndex);
        let included = p.included;
        if (id === "all") included = true;
        else if (id === "none") included = false;
        else if (id === "odd") included = p.sourcePageIndex % 2 === 0;
        else if (id === "even") included = p.sourcePageIndex % 2 === 1;
        else if (id === "landscape") included = ori?.orientation === "landscape";
        else if (id === "portrait") included = ori?.orientation === "portrait";
        else if (id === "invert") included = !p.included;
        return { ...p, included };
      }),
    );
  };

  const deletePage = (id: string) => {
    updatePages((prev) => prev.map((p) => (p.id === id ? { ...p, included: false } : p)));
    toast.success(t("delete"));
  };

  const runRotate = async (download: boolean): Promise<Uint8Array | null> => {
    if (!source || included.length === 0) {
      toast.error("Select at least one page");
      return null;
    }
    const setter = download ? setProcessing : setPreviewing;
    setter(true);
    setProgress(0);
    setError("");
    try {
      const data = await buildRotatedPdf(source.bytes, pages, outputOptions, setProgress);
      if (download) {
        const name = `${sanitizeOutputName(outputName)}.pdf`;
        downloadBlob(new Blob([data as BlobPart], { type: "application/pdf" }), name);
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          name,
          pages: included.length,
          bytes: data.byteLength,
          ts: Date.now(),
        };
        setHistory((h) => [entry, ...h].slice(0, 20));
        toast.success(`Done · ${formatBytes(data.byteLength)}`);
      }
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : download ? "Rotate failed" : "Preview failed";
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setter(false);
      setProgress(0);
    }
  };

  function sanitizeOutputName(n: string) {
    return n.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-|-$/g, "") || "rotated";
  }

  const generatePreview = async () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const data = await runRotate(false);
    if (data) {
      setPreviewUrl(URL.createObjectURL(new Blob([data as BlobPart], { type: "application/pdf" })));
      setTab("preview");
      toast.success("Preview ready");
    }
  };

  const runBatchRotate = async () => {
    if (!batchSources.length) {
      toast.error("Add PDFs to batch queue");
      return;
    }
    setBatchRunning(true);
    setProgress(0);
    try {
      const files = await executeBatchRotate(
        batchSources.map((d) => ({ name: d.name, bytes: d.bytes, pageCount: d.pageCount })),
        batchRotation,
        outputOptions,
        setProgress,
      );
      if (files.length === 1) {
        downloadBlob(new Blob([files[0]!.data as BlobPart], { type: "application/pdf" }), `${files[0]!.name}.pdf`);
      } else {
        const zip = await zipRotatedFiles(files, "batch-rotate");
        downloadBlob(zip, "batch-rotate.zip");
      }
      toast.success(`Batch complete · ${files.length} file(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBatchRunning(false);
      setProgress(0);
    }
  };

  const clearAll = () => {
    setSource(null);
    setPages([]);
    setOrientations([]);
    setBatchSources([]);
    setError("");
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (!source) return;
    if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
      updatePages((prev) => prev.map((p) => (p.included ? { ...p, rotation: rotateClockwise(p.rotation) } : p)));
    }
    if (e.key === "R" && e.shiftKey) {
      updatePages((prev) => prev.map((p) => (p.included ? { ...p, rotation: rotateCounterClockwise(p.rotation) } : p)));
    }
    if (e.key === "z" && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    if ((e.key === "z" && (e.metaKey || e.ctrlKey) && e.shiftKey) || (e.key === "y" && (e.metaKey || e.ctrlKey))) {
      e.preventDefault();
      redo();
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Record<string, unknown>;
        if (typeof s.compress === "boolean") setCompress(s.compress);
        if (typeof s.preserveMetadata === "boolean") setPreserveMetadata(s.preserveMetadata);
        if (typeof s.pdfA === "boolean") setPdfA(s.pdfA);
      }
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h) as HistoryEntry[]);
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ compress, preserveMetadata, pdfA }));
  }, [compress, preserveMetadata, pdfA]);

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
      for (const item of items) {
        if (item.type === "application/pdf") {
          const f = item.getAsFile();
          if (f) void loadPdf(f);
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const sourcePreviewUrl = useMemo(
    () => (source ? URL.createObjectURL(new Blob([source.bytes], { type: "application/pdf" })) : null),
    [source],
  );

  useEffect(() => {
    return () => {
      if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
    };
  }, [sourcePreviewUrl]);

  return (
    <div className="mx-auto max-w-6xl space-y-6" onKeyDown={onKeyDown} tabIndex={0}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{t("private")}</p>
        <div className="flex items-center gap-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
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
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              favorites.isFavorite(slug) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted hover:text-foreground",
            )}
          >
            <Star className={cn("h-3.5 w-3.5", favorites.isFavorite(slug) && "fill-current")} />
            {favorites.isFavorite(slug) ? t("favorited") : t("favorite")}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Pages", value: stats.total, color: "text-foreground" },
          { label: "Selected", value: stats.selected, color: "text-emerald-500" },
          { label: "Rotated", value: stats.rotated, color: "text-violet-400" },
          { label: "Size", value: source ? formatBytes(stats.size) : "—", color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className={cn("font-display text-xl font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => !loadingFile && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files); }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all sm:p-10",
          dragging ? "scale-[1.01] border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
          loadingFile && "pointer-events-none opacity-70",
        )}
      >
        {loadingFile ? <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" /> : <UploadCloud className="mb-3 h-10 w-10 text-primary" />}
        <p className="font-display text-lg font-semibold">{loadingFile ? "Reading PDF..." : source ? t("drop") : "Ultra PDF Rotate Studio"}</p>
        <p className="mt-1 text-sm text-muted">{source ? `${source.name} · ${source.pageCount} pages` : t("dropHint")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}><UploadCloud className="h-4 w-4" /> {t("addFiles")}</Button>
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); folderRef.current?.click(); }}><FolderUp className="h-4 w-4" /> {t("addFolder")}</Button>
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); toast.info("Press Ctrl+V to paste a PDF"); }}><ClipboardPaste className="h-4 w-4" /> {t("paste")}</Button>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={folderRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {pendingUnlock && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <p className="mb-2 text-sm font-medium">Password-protected PDF</p>
          <div className="flex flex-wrap gap-2">
            <input type="password" value={pendingUnlock.password} onChange={(e) => setPendingUnlock({ ...pendingUnlock, password: e.target.value })} className={cn(inputClass(), "max-w-xs")} placeholder="PDF password" />
            <Button size="sm" onClick={() => void unlockPending()}>Unlock</Button>
            <Button size="sm" variant="outline" onClick={() => setPendingUnlock(null)}><X className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {source && (
        <>
          {hasSignature && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
              <Shield className="mr-2 inline h-4 w-4" />
              {t("signature")}
            </div>
          )}

          {inPlace && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="mr-2 inline h-4 w-4" />
              {t("inPlace")} — bookmarks & hyperlinks preserved
            </div>
          )}

          {smartTips.length > 0 && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <p className="mb-1 flex items-center gap-2 font-medium text-primary"><ScanLine className="h-4 w-4" /> Smart rotate assist</p>
              <ul className="list-inside list-disc text-muted">{smartTips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
            </div>
          )}

          {recommendations.length > 0 && (
            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4" /> {t("ai")}</p>
              {recommendations.map((rec, i) => (
                <div key={i} className="flex flex-wrap items-start justify-between gap-2 text-xs">
                  <div><p className="font-medium">{rec.title}</p><p className="text-muted">{rec.detail}</p></div>
                  {rec.action && <Button size="sm" variant="outline" onClick={() => applyRecommendation(rec)}>{t("apply")}</Button>}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}><RefreshCw className="h-4 w-4" /> Replace</Button>
            <Button variant="outline" size="sm" onClick={() => updatePages((prev) => prev.map((p) => p.included ? { ...p, rotation: rotateClockwise(p.rotation) } : p))}><RotateCw className="h-4 w-4" /> {t("all")}</Button>
            <Button variant="outline" size="sm" onClick={() => updatePages((prev) => applyAutoOrient(prev, orientations))}><Wand2 className="h-4 w-4" /> {t("autoOrient")}</Button>
            <Button variant="outline" size="sm" onClick={() => updatePages((prev) => normalizeAllRotations(prev))}><FlipHorizontal2 className="h-4 w-4" /> {t("normalize")}</Button>
            <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo}><Undo2 className="h-4 w-4" /> {t("undo")}</Button>
            <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo}><Redo2 className="h-4 w-4" /> {t("redo")}</Button>
            <Button variant="outline" size="sm" onClick={clearAll} className="text-error hover:text-error"><Trash2 className="h-4 w-4" /> {t("clear")}</Button>
            <button type="button" onClick={() => setShowSettings((s) => !s)} className={cn("ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm", showSettings ? "border-primary bg-primary/10 text-primary" : "border-border text-muted")}>
              <Settings2 className="h-4 w-4" /> Output
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex flex-wrap items-end gap-3">
              <div className="min-w-[140px] flex-1">
                <Field label={t("range")}>
                  <input value={pageRange} onChange={(e) => setPageRange(e.target.value)} placeholder="1-3, 5, 8-10" className={inputClass()} />
                </Field>
              </div>
              <Button size="sm" variant="outline" onClick={() => updatePages((prev) => applyRotationToRange(prev, pageRange, source.pageCount, 90, "add"))}><RotateCw className="h-3.5 w-3.5" /> {t("cw")}</Button>
              <Button size="sm" variant="outline" onClick={() => updatePages((prev) => applyRotationToRange(prev, pageRange, source.pageCount, -90, "add"))}><RotateCcw className="h-3.5 w-3.5" /> {t("ccw")}</Button>
              <Field label={t("custom")}>
                <input type="number" min={0} max={359} value={customAngle} onChange={(e) => setCustomAngle(Number(e.target.value))} className={inputClass()} />
              </Field>
              <Button size="sm" variant="outline" onClick={() => updatePages((prev) => applyRotationToRange(prev, pageRange, source.pageCount, 0, "set", customAngle))}>{t("apply")}</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {SELECTION_PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => applySelectionPreset(p.id)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-primary">{p.label}</button>
              ))}
            </div>
          </div>

          {showSettings && (
            <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Output filename"><input value={outputName} onChange={(e) => setOutputName(e.target.value)} className={inputClass()} /></Field>
              <Field label="PDF title"><input value={pdfTitle} onChange={(e) => setPdfTitle(e.target.value)} className={inputClass()} placeholder="Optional" /></Field>
              <Field label="Author"><input value={pdfAuthor} onChange={(e) => setPdfAuthor(e.target.value)} className={inputClass()} /></Field>
              <Field label="Password (output)"><input type="password" value={pdfPassword} onChange={(e) => setPdfPassword(e.target.value)} className={inputClass()} /></Field>
              <Field label="Watermark"><input value={watermark} onChange={(e) => setWatermark(e.target.value)} className={inputClass()} /></Field>
              <div className="flex flex-col justify-end gap-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} className="accent-[var(--primary)]" /> Compress output</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={preserveMetadata} onChange={(e) => setPreserveMetadata(e.target.checked)} className="accent-[var(--primary)]" /> Preserve metadata</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={pdfA} onChange={(e) => setPdfA(e.target.checked)} className="accent-[var(--primary)]" /> PDF/A metadata mode</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={pageNumbers} onChange={(e) => setPageNumbers(e.target.checked)} className="accent-[var(--primary)]" /> Page numbers</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={fitToA4} onChange={(e) => setFitToA4(e.target.checked)} className="accent-[var(--primary)]" /> Fit to A4</label>
              </div>
            </div>
          )}

          <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
            {(
              [
                ["studio", t("studio"), Zap],
                ["preview", t("preview"), Eye],
                ["compare", t("compare"), Copy],
                ["batch", t("batch"), Layers],
                ["history", t("history"), History],
                ["api", t("api"), Shield],
              ] as const
            ).map(([key, label, Icon]) => (
              <button key={key} type="button" onClick={() => setTab(key)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium sm:px-3", tab === key ? "bg-primary text-white" : "text-muted hover:text-foreground")}>
                <Icon className="h-4 w-4" /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          {tab === "studio" && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input value={pageSearch} onChange={(e) => setPageSearch(e.target.value)} placeholder="Filter pages..." className={cn(inputClass(), "pl-10")} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filteredPages.map((page) => {
                  const idx = pages.findIndex((p) => p.id === page.id);
                  const ori = orientations.find((o) => o.pageIndex === page.sourcePageIndex);
                  return (
                    <div
                      key={page.id}
                      draggable
                      onDragStart={() => setDragPage(page.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (!dragPage || dragPage === page.id) return;
                        updatePages((prev) => {
                          const from = prev.findIndex((p) => p.id === dragPage);
                          const to = prev.findIndex((p) => p.id === page.id);
                          if (from < 0 || to < 0) return prev;
                          return reorder(prev, from, to);
                        });
                        setDragPage(null);
                      }}
                      className={cn("group relative overflow-hidden rounded-xl border bg-card transition-all", page.included ? "border-border" : "border-border/50 opacity-45")}
                    >
                      <GripVertical className="absolute right-2 top-2 z-10 h-4 w-4 cursor-grab text-muted opacity-0 group-hover:opacity-100" />
                      <span className="absolute left-2 top-2 z-10 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{page.sourcePageIndex + 1}</span>
                      {page.rotation !== 0 && (
                        <span className="absolute left-2 top-8 z-10 rounded bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold text-white">{page.rotation}°</span>
                      )}
                      <button type="button" onClick={() => setZoomPage(page)} className="absolute right-2 top-8 z-10 rounded bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100"><Maximize2 className="h-3.5 w-3.5" /></button>
                      <div className="aspect-[3/4] bg-muted/20">
                        {page.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={page.thumb} alt="" className="h-full w-full object-contain transition-transform" style={{ transform: `rotate(${page.rotation}deg)` }} />
                        ) : (
                          <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
                        )}
                      </div>
                      <div className="border-t border-border p-2">
                        <div className="flex items-center justify-between gap-1">
                          <button type="button" onClick={() => updatePages((prev) => prev.map((p) => (p.id === page.id ? { ...p, included: !p.included } : p)), false)} className={cn("rounded px-2 py-0.5 text-[10px] font-medium", page.included ? "bg-emerald-500/15 text-emerald-500" : "bg-muted/30 text-muted")}>{page.included ? "In" : "Out"}</button>
                          <div className="flex gap-0.5">
                            <button type="button" title={t("ccw")} onClick={() => updatePages((prev) => prev.map((p) => (p.id === page.id ? { ...p, rotation: rotateCounterClockwise(p.rotation) } : p)))} className="rounded p-1 text-muted hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" /></button>
                            <button type="button" title={t("cw")} onClick={() => updatePages((prev) => prev.map((p) => (p.id === page.id ? { ...p, rotation: rotateClockwise(p.rotation) } : p)))} className="rounded p-1 text-muted hover:text-foreground"><RotateCw className="h-3.5 w-3.5" /></button>
                            <button type="button" title={t("delete")} onClick={() => deletePage(page.id)} className="rounded p-1 text-muted hover:text-error"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                        <p className="mt-1 truncate text-[10px] text-muted">#{idx + 1}{ori ? ` · ${ori.orientation}` : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "preview" && (
            <div className="space-y-4">
              {previewUrl ? (
                <iframe src={previewUrl} title="PDF preview" className="h-[70vh] w-full rounded-xl border border-border bg-white" />
              ) : (
                <p className="py-16 text-center text-muted">Click Preview to render rotated PDF.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void generatePreview()} disabled={previewing}>{previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} {t("previewBtn")}</Button>
                <Button variant="gradient" disabled={processing} onClick={() => void runRotate(true)}>{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("rotate")}</Button>
              </div>
              {(processing || previewing) && progress > 0 && (
                <div className="h-2 overflow-hidden rounded-full bg-muted/30"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
              )}
            </div>
          )}

          {tab === "compare" && (
            <div className="space-y-4">
              {previewUrl && source ? (
                <div className="relative overflow-hidden rounded-2xl border border-border">
                  <div className="grid grid-cols-2">
                    <iframe src={sourcePreviewUrl ?? undefined} title="Before" className="h-[50vh] w-full border-r border-border" />
                    <iframe src={previewUrl} title="After" className="h-[50vh] w-full" />
                  </div>
                  <p className="border-t border-border bg-card px-4 py-2 text-center text-xs text-muted">Original · Rotated</p>
                </div>
              ) : (
                <p className="py-16 text-center text-muted">Generate a preview first to compare before/after.</p>
              )}
              <input type="range" min={0} max={100} value={compareSlider} onChange={(e) => setCompareSlider(Number(e.target.value))} className="w-full accent-[var(--primary)]" aria-label="Compare slider" />
            </div>
          )}

          {tab === "batch" && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
              <p className="text-sm text-muted">Rotate multiple PDFs with the same global angle. Encrypted files must be unlocked in Studio first.</p>
              <Field label={`Global rotation: ${batchRotation}°`}>
                <input type="range" min={0} max={270} step={90} value={batchRotation} onChange={(e) => setBatchRotation(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
              </Field>
              <Button variant="outline" size="sm" onClick={() => batchRef.current?.click()}><UploadCloud className="h-4 w-4" /> Add PDFs</Button>
              <input ref={batchRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
              {batchSources.length > 0 && (
                <ul className="divide-y divide-border text-sm">
                  {batchSources.map((d) => (
                    <li key={d.id} className="flex justify-between py-2"><span className="truncate">{d.name}</span><span className="text-muted">{d.pageCount} pg</span></li>
                  ))}
                </ul>
              )}
              <Button variant="gradient" disabled={!batchSources.length || batchRunning} onClick={() => void runBatchRotate()}>
                {batchRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                {t("batchZip")} ({batchSources.length})
              </Button>
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
                      <span className="text-muted">{h.pages} pg · {formatBytes(h.bytes)} · {new Date(h.ts).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 font-medium"><Shield className="h-4 w-4 text-primary" /> REST API — POST /api/v1/pdf/rotate</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`POST /api/v1/pdf/rotate
{
  "pdf": "JVBERi0x...",
  "globalRotation": 90,
  "pages": [
    { "pageIndex": 0, "rotation": 180, "included": true }
  ],
  "options": { "compress": true, "preserveMetadata": true }
}`}</pre>
              <p className="text-xs text-muted">Limit: 50 MB · Studio runs 100% client-side</p>
            </div>
          )}

          {tab === "studio" && (
            <div className="sticky bottom-4 flex flex-wrap gap-2 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
              <Button variant="gradient" disabled={processing} onClick={() => void runRotate(true)}>{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t("rotate")}</Button>
              <Button variant="outline" disabled={previewing} onClick={() => void generatePreview()}>{previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} {t("previewBtn")}</Button>
              {(processing || previewing) && progress > 0 && <span className="self-center text-sm text-muted">{progress}%</span>}
            </div>
          )}

          {error && <p className="text-sm text-error">{error}</p>}
        </>
      )}

      {zoomPage && source && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setZoomPage(null)}>
          <div className="max-h-[90vh] max-w-lg overflow-auto rounded-2xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
            {zoomPage.thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={zoomPage.thumb} alt="" className="mx-auto max-h-[70vh] object-contain transition-transform" style={{ transform: `rotate(${zoomPage.rotation}deg)` }} />
            ) : (
              <Loader2 className="mx-auto h-10 w-10 animate-spin" />
            )}
            <p className="mt-2 text-center text-sm">Page {zoomPage.sourcePageIndex + 1} · {zoomPage.rotation}°</p>
            <div className="mt-3 flex justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => { updatePages((prev) => prev.map((p) => (p.id === zoomPage.id ? { ...p, rotation: rotateCounterClockwise(p.rotation) } : p))); setZoomPage((z) => z ? { ...z, rotation: rotateCounterClockwise(z.rotation) } : z); }}><RotateCcw className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={() => { updatePages((prev) => prev.map((p) => (p.id === zoomPage.id ? { ...p, rotation: rotateClockwise(p.rotation) } : p))); setZoomPage((z) => z ? { ...z, rotation: rotateClockwise(z.rotation) } : z); }}><RotateCw className="h-4 w-4" /></Button>
              <Button size="sm" onClick={() => setZoomPage(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
