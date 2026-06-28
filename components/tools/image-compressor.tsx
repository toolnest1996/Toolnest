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
  Gauge,
  History,
  Image as ImageIcon,
  Info,
  Languages,
  Loader2,
  Lock,
  Maximize2,
  ScanLine,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  X,
  ZoomIn,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  COMPRESS_PRESETS,
  DEFAULT_COMPRESS_OPTIONS,
  FORMAT_EXTENSIONS,
  FORMAT_LABELS,
  LOSSY_FORMATS,
  buildOutputName,
  compressBatch,
  compressImage,
  detectEncodingSupport,
  detectMime,
  estimateCompressedSize,
  isBrowserEncodable,
  isSupportedInput,
  smartRecommend,
  analyzeImage,
  bytesFromSizeInput,
  formatSizeUnit,
  type CompressMode,
  type CompressOptions,
  type ImageItem,
  type OutputFormat,
  type ResizeOptions,
  type SmartTip,
} from "./image-compressor-utils";

/* ────────────────────────────────────────────────────────────────────────────
 * i18n — minimal in-house dictionary (no server, no deps)
 * ──────────────────────────────────────────────────────────────────────────── */

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    drop: "Drop images, paste, or click to browse",
    dropHint: "JPG · PNG · WebP · AVIF · GIF · BMP · SVG · HEIC · TIFF · ICO — 100% in-browser",
    addFiles: "Add files",
    addFolder: "Add folder",
    paste: "Paste image",
    compress: "Compress & Download",
    preview: "Preview first",
    settings: "Settings",
    clear: "Clear all",
    batchZip: "Download all as ZIP",
    original: "Original",
    estimated: "Estimated",
    saved: "Saved",
    mode: "Mode",
    quality: "Quality",
    target: "Target size",
    format: "Output format",
    resize: "Resize before compress",
    width: "Width",
    height: "Height",
    keepRatio: "Keep aspect ratio",
    transparency: "Preserve transparency",
    stripMeta: "Strip EXIF / metadata",
    ocrSafe: "OCR-safe (preserve text)",
    flatten: "Background when flattening",
    smart: "Smart AI assist",
    apply: "Apply suggestion",
    studio: "Studio",
    compare: "Compare",
    batch: "Batch",
    history: "History",
    api: "API",
    emptyHistory: "No compressed images yet — your history will appear here.",
    workerOn: "WebWorker acceleration",
    cloudNote: "Files never leave your browser. The optional API sends data only when you call it.",
  },
  es: {
    drop: "Suelta imágenes, pega o haz clic para explorar",
    dropHint: "JPG · PNG · WebP · AVIF · GIF · BMP · SVG — 100% en el navegador",
    addFiles: "Añadir archivos",
    addFolder: "Añadir carpeta",
    paste: "Pegar imagen",
    compress: "Comprimir y descargar",
    preview: "Vista previa",
    settings: "Ajustes",
    clear: "Limpiar todo",
    batchZip: "Descargar todo como ZIP",
    original: "Original",
    estimated: "Estimado",
    saved: "Ahorrado",
    mode: "Modo",
    quality: "Calidad",
    target: "Tamaño objetivo",
    format: "Formato de salida",
    resize: "Redimensionar antes de comprimir",
    width: "Ancho",
    height: "Alto",
    keepRatio: "Mantener proporción",
    transparency: "Conservar transparencia",
    stripMeta: "Eliminar EXIF / metadatos",
    ocrSafe: "Modo OCR (conserva texto)",
    flatten: "Fondo al aplanar",
    smart: "Asistente IA",
    apply: "Aplicar sugerencia",
    studio: "Estudio",
    compare: "Comparar",
    batch: "Lote",
    history: "Historial",
    api: "API",
    emptyHistory: "Aún no has comprimido imágenes.",
    workerOn: "Aceleración WebWorker",
    cloudNote: "Los archivos nunca salen de tu navegador.",
  },
  de: {
    drop: "Bilder ablegen, einfügen oder klicken zum Durchsuchen",
    dropHint: "JPG · PNG · WebP · AVIF · GIF · BMP · SVG — 100% im Browser",
    addFiles: "Dateien hinzufügen",
    addFolder: "Ordner hinzufügen",
    paste: "Bild einfügen",
    compress: "Komprimieren & herunterladen",
    preview: "Vorschau",
    settings: "Einstellungen",
    clear: "Alles löschen",
    batchZip: "Als ZIP herunterladen",
    original: "Original",
    estimated: "Geschätzt",
    saved: "Gespart",
    mode: "Modus",
    quality: "Qualität",
    target: "Zielgröße",
    format: "Ausgabeformat",
    resize: "Vor Komprimierung skalieren",
    width: "Breite",
    height: "Höhe",
    keepRatio: "Seitenverhältnis beibehalten",
    transparency: "Transparenz erhalten",
    stripMeta: "EXIF / Metadaten entfernen",
    ocrSafe: "OCR-sicher (Text erhalten)",
    flatten: "Hintergrund beim Flachlegen",
    smart: "KI-Assistent",
    apply: "Vorschlag anwenden",
    studio: "Studio",
    compare: "Vergleich",
    batch: "Stapel",
    history: "Verlauf",
    api: "API",
    emptyHistory: "Noch keine Bilder komprimiert.",
    workerOn: "WebWorker-Beschleunigung",
    cloudNote: "Dateien verlassen niemals deinen Browser.",
  },
  fr: {
    drop: "Déposez vos images, collez ou cliquez pour parcourir",
    dropHint: "JPG · PNG · WebP · AVIF · GIF · BMP · SVG — 100% dans le navigateur",
    addFiles: "Ajouter des fichiers",
    addFolder: "Ajouter un dossier",
    paste: "Coller l'image",
    compress: "Compresser et télécharger",
    preview: "Aperçu",
    settings: "Réglages",
    clear: "Tout effacer",
    batchZip: "Télécharger en ZIP",
    original: "Original",
    estimated: "Estimé",
    saved: "Économisé",
    mode: "Mode",
    quality: "Qualité",
    target: "Taille cible",
    format: "Format de sortie",
    resize: "Redimensionner avant compression",
    width: "Largeur",
    height: "Hauteur",
    keepRatio: "Conserver le ratio",
    transparency: "Préserver la transparence",
    stripMeta: "Supprimer EXIF / métadonnées",
    ocrSafe: "Mode OCR (préserve le texte)",
    flatten: "Fond lors de l'aplatissement",
    smart: "Assistant IA",
    apply: "Appliquer la suggestion",
    studio: "Studio",
    compare: "Comparer",
    batch: "Lot",
    history: "Historique",
    api: "API",
    emptyHistory: "Aucune image compressée pour l'instant.",
    workerOn: "Accélération WebWorker",
    cloudNote: "Vos fichiers ne quittent jamais votre navigateur.",
  },
  tr: {
    drop: "Görüntüleri sürükleyin, yapıştırın veya tıklayın",
    dropHint: "JPG · PNG · WebP · AVIF · GIF · BMP · SVG — %100 tarayıcıda",
    addFiles: "Dosya ekle",
    addFolder: "Klasör ekle",
    paste: "Görüntü yapıştır",
    compress: "Sıkıştır ve indir",
    preview: "Önizleme",
    settings: "Ayarlar",
    clear: "Tümünü temizle",
    batchZip: "ZIP olarak indir",
    original: "Orijinal",
    estimated: "Tahmini",
    saved: "Tasarruf",
    mode: "Mod",
    quality: "Kalite",
    target: "Hedef boyut",
    format: "Çıktı formatı",
    resize: "Sıkıştırmadan önce yeniden boyutlandır",
    width: "Genişlik",
    height: "Yükseklik",
    keepRatio: "En-boy oranını koru",
    transparency: "Şeffaflığı koru",
    stripMeta: "EXIF / meta verileri sil",
    ocrSafe: "OCR güvenli (metni koru)",
    flatten: "Düzleştirirken arka plan",
    smart: "Akıllı AI asistanı",
    apply: "Öneriyi uygula",
    studio: "Stüdyo",
    compare: "Karşılaştır",
    batch: "Toplu",
    history: "Geçmiş",
    api: "API",
    emptyHistory: "Henüz sıkıştırılmış görüntü yok.",
    workerOn: "WebWorker hızlandırma",
    cloudNote: "Dosyalarınız tarayıcıdan çıkmaz.",
  },
  hi: {
    drop: "छवियाँ छोड़ें, पेस्ट करें या ब्राउज़ करें",
    dropHint: "JPG · PNG · WebP · AVIF · GIF · BMP · SVG — 100% ब्राउज़र में",
    addFiles: "फ़ाइलें जोड़ें",
    addFolder: "फ़ोल्डर जोड़ें",
    paste: "छवि पेस्ट करें",
    compress: "संपीड़ित करें और डाउनलोड करें",
    preview: "पूर्वावलोकन",
    settings: "सेटिंग्स",
    clear: "सभी साफ़ करें",
    batchZip: "ZIP के रूप में डाउनलोड करें",
    original: "मूल",
    estimated: "अनुमानित",
    saved: "बचत",
    mode: "मोड",
    quality: "गुणवत्ता",
    target: "लक्ष्य आकार",
    format: "आउटपुट प्रारूप",
    resize: "संपीड़न से पहले आकार बदलें",
    width: "चौड़ाई",
    height: "ऊँचाई",
    keepRatio: "पहलू अनुपात बनाए रखें",
    transparency: "पारदर्शिता बनाए रखें",
    stripMeta: "EXIF / मेटाडेटा हटाएँ",
    ocrSafe: "OCR-सुरक्षित (पाठ सुरक्षित रखें)",
    flatten: "समतल करते समय पृष्ठभूमि",
    smart: "स्मार्ट AI सहायक",
    apply: "सुझाव लागू करें",
    studio: "स्टूडियो",
    compare: "तुलना",
    batch: "बैच",
    history: "इतिहास",
    api: "API",
    emptyHistory: "अभी तक कोई संपीड़ित छवि नहीं।",
    workerOn: "WebWorker त्वरण",
    cloudNote: "फ़ाइलें कभी ब्राउज़र से बाहर नहीं जातीं।",
  },
  pt: {
    drop: "Solte imagens, cole ou clique para procurar",
    dropHint: "JPG · PNG · WebP · AVIF · GIF · BMP · SVG — 100% no navegador",
    addFiles: "Adicionar arquivos",
    addFolder: "Adicionar pasta",
    paste: "Colar imagem",
    compress: "Comprimir e baixar",
    preview: "Pré-visualizar",
    settings: "Configurações",
    clear: "Limpar tudo",
    batchZip: "Baixar como ZIP",
    original: "Original",
    estimated: "Estimado",
    saved: "Poupado",
    mode: "Modo",
    quality: "Qualidade",
    target: "Tamanho alvo",
    format: "Formato de saída",
    resize: "Redimensionar antes de comprimir",
    width: "Largura",
    height: "Altura",
    keepRatio: "Manter proporção",
    transparency: "Preservar transparência",
    stripMeta: "Remover EXIF / metadados",
    ocrSafe: "Modo OCR (preserva texto)",
    flatten: "Fundo ao achatar",
    smart: "Assistente IA",
    apply: "Aplicar sugestão",
    studio: "Estúdio",
    compare: "Comparar",
    batch: "Lote",
    history: "Histórico",
    api: "API",
    emptyHistory: "Ainda não comprimiu imagens.",
    workerOn: "Aceleração WebWorker",
    cloudNote: "Os ficheiros nunca saem do navegador.",
  },
  ja: {
    drop: "画像をドロップ、ペースト、またはクリックして選択",
    dropHint: "JPG · PNG · WebP · AVIF · GIF · BMP · SVG — 100%ブラウザ内処理",
    addFiles: "ファイル追加",
    addFolder: "フォルダ追加",
    paste: "画像をペースト",
    compress: "圧縮してダウンロード",
    preview: "プレビュー",
    settings: "設定",
    clear: "すべて消去",
    batchZip: "ZIPで一括ダウンロード",
    original: "元のサイズ",
    estimated: "推定",
    saved: "削減",
    mode: "モード",
    quality: "品質",
    target: "目標サイズ",
    format: "出力形式",
    resize: "圧縮前にリサイズ",
    width: "幅",
    height: "高さ",
    keepRatio: "縦横比を維持",
    transparency: "透過を保持",
    stripMeta: "EXIF / メタデータを削除",
    ocrSafe: "OCRセーフ（文字保持）",
    flatten: "フラット化時の背景",
    smart: "スマートAIアシスト",
    apply: "提案を適用",
    studio: "スタジオ",
    compare: "比較",
    batch: "バッチ",
    history: "履歴",
    api: "API",
    emptyHistory: "まだ圧縮した画像はありません。",
    workerOn: "WebWorker加速",
    cloudNote: "ファイルはブラウザから外出ししません。",
  },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français",
  tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

/* ────────────────────────────────────────────────────────────────────────────
 * History (localStorage)
 * ──────────────────────────────────────────────────────────────────────────── */

interface HistoryEntry {
  id: string;
  name: string;
  format: OutputFormat;
  originalBytes: number;
  compressedBytes: number;
  savingsPercent: number;
  ts: number;
}

const HISTORY_KEY = "toolnest-image-compressor-history";
const SETTINGS_KEY = "toolnest-image-compressor-settings";
const LANG_KEY = "toolnest-image-compressor-lang";

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 50))); } catch { /* quota */ }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Main component
 * ──────────────────────────────────────────────────────────────────────────── */

type Tab = "studio" | "compare" | "batch" | "history" | "api";

let _idCounter = 0;
const nextId = () => `img-${Date.now()}-${++_idCounter}`;

export function ImageCompressor() {
  const favorites = useFavorites();
  const slug = "image-compress";

  const [items, setItems] = useState<ImageItem[]>([]);
  const [tab, setTab] = useState<Tab>("studio");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [showSmart, setShowSmart] = useState(true);
  const [useWorker, setUseWorker] = useState(true);
  const [lang, setLang] = useState<Lang>("en");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [zoom, setZoom] = useState(1);
  const [compareIndex, setCompareIndex] = useState(0);
  const [sliderPos, setSliderPos] = useState(50);

  const [options, setOptions] = useState<CompressOptions>(DEFAULT_COMPRESS_OPTIONS);
  const [targetValue, setTargetValue] = useState(200);
  const [targetUnit, setTargetUnit] = useState<"B" | "KB" | "MB">("KB");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const t = useCallback((key: string) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key, [lang]);
  const cap = useMemo(() => detectEncodingSupport(), []);

  /* ── hydrate persisted settings ─ */
  useEffect(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        setOptions((prev) => ({ ...prev, ...parsed, resize: { ...prev.resize, ...(parsed.resize ?? {}) } }));
      }
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
      setHistory(loadHistory());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(options)); } catch { /* ignore */ }
  }, [options]);

  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  /* ── keep target bytes in sync ─ */
  useEffect(() => {
    setOptions((o) => ({ ...o, targetBytes: bytesFromSizeInput(targetValue, targetUnit) }));
  }, [targetValue, targetUnit]);

  /* ── revoke object URLs on unmount ─ */
  useEffect(() => () => {
    items.forEach((i) => {
      URL.revokeObjectURL(i.thumbUrl);
      i.result?.previewUrl && URL.revokeObjectURL(i.result.previewUrl);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── file ingestion ─ */
  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const accepted: ImageItem[] = [];
    for (const file of files) {
      if (!isSupportedInput(file)) {
        toast.error(`Unsupported: ${file.name}`);
        continue;
      }
      const thumbUrl = URL.createObjectURL(file);
      const item: ImageItem = {
        id: nextId(),
        file,
        name: file.name,
        originalBytes: file.size,
        originalMime: detectMime(file),
        outputName: file.name,
        meta: null,
        status: "queued",
        result: null,
        thumbUrl,
      };
      accepted.push(item);
      // Lazy metadata analysis so the UI shows dimensions immediately.
      try {
        const { meta } = await analyzeImage(file);
        item.meta = meta;
        setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, meta } : p)));
      } catch {
        item.status = "error";
        item.error = "Could not decode this image in your browser";
      }
    }
    if (accepted.length) {
      setItems((prev) => [...prev, ...accepted]);
      toast.success(`${accepted.length} image(s) added`);
    }
  }, []);

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void addFiles(Array.from(e.target.files));
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    void addFiles(files);
  };

  const onPaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const it of items) {
        for (const type of it.types) {
          if (type.startsWith("image/")) {
            const blob = await it.getType(type);
            const ext = type.split("/")[1] || "png";
            files.push(new File([blob], `pasted-${Date.now()}.${ext}`, { type }));
          }
        }
      }
      if (files.length) void addFiles(files);
      else toast.error("No image on clipboard");
    } catch {
      toast.error("Clipboard read denied by browser");
    }
  }, [addFiles]);

  /* ── stats ─ */
  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.status === "done" && i.result).length;
    const totalOriginal = items.reduce((s, i) => s + i.originalBytes, 0);
    const totalCompressed = items.reduce((s, i) => s + (i.result?.bytes ?? 0), 0);
    const saved = totalOriginal - totalCompressed;
    const savedPct = totalOriginal > 0 ? Math.round((saved / totalOriginal) * 100) : 0;
    return { total, done, totalOriginal, totalCompressed, saved, savedPct };
  }, [items]);

  /* ── smart AI recommendation for the first item ─ */
  const smart = useMemo(() => {
    const first = items.find((i) => i.meta);
    if (!first?.meta) return null;
    return smartRecommend(first.meta, options);
  }, [items, options]);

  const applySmart = () => {
    if (!smart) return;
    setOptions((o) => ({ ...o, mode: smart.recommendedMode, format: smart.recommendedFormat }));
    if (
      smart.recommendedMode !== "custom" &&
      smart.recommendedMode !== "target" &&
      smart.recommendedMode !== "lossless" &&
      smart.recommendedMode in COMPRESS_PRESETS
    ) {
      setOptions((o) => ({
        ...o,
        quality: COMPRESS_PRESETS[smart.recommendedMode as keyof typeof COMPRESS_PRESETS].quality,
      }));
    }
    toast.success("Smart AI settings applied");
  };

  /* ── compression actions ─ */
  const runCompressAll = useCallback(async (autoDownload: boolean) => {
    if (!items.length) { toast.error("Add images first"); return; }
    setBusy(true);
    setProgress({ done: 0, total: items.length });
    try {
      const updated = await compressBatch(
        items,
        options,
        (done, total) => setProgress({ done, total }),
        useWorker,
      );
      setItems([...updated]);
      // history
      const newEntries: HistoryEntry[] = updated
        .filter((i) => i.status === "done" && i.result)
        .map((i) => ({
          id: i.id,
          name: i.name,
          format: i.result!.format,
          originalBytes: i.originalBytes,
          compressedBytes: i.result!.bytes,
          savingsPercent: i.result!.savingsPercent,
          ts: Date.now(),
        }));
      if (newEntries.length) {
        setHistory((h) => {
          const next = [...newEntries, ...h].slice(0, 50);
          saveHistory(next);
          return next;
        });
      }
      if (autoDownload) {
        if (updated.length === 1 && updated[0].result) {
          downloadBlob(updated[0].result.blob, buildOutputName(updated[0].name, updated[0].result!.format));
        } else {
          const JSZip = (await import("jszip")).default;
          const zip = new JSZip();
          updated.forEach((i) => {
            if (i.result) zip.file(buildOutputName(i.name, i.result.format), i.result.blob);
          });
          const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip", compression: "DEFLATE", compressionOptions: { level: 6 } });
          downloadBlob(blob, "toolnest-compressed-images.zip");
        }
        toast.success(`Done — ${newEntries.length} images, ${stats.savedPct > 0 ? stats.savedPct : 0}% saved`);
      } else {
        setTab("compare");
        toast.success("Compression ready — view the Compare tab");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Compression failed");
    } finally {
      setBusy(false);
      setProgress({ done: 0, total: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, options, useWorker]);

  const downloadOne = (item: ImageItem) => {
    if (!item.result) return;
    downloadBlob(item.result.blob, buildOutputName(item.name, item.result.format));
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.thumbUrl);
        target.result?.previewUrl && URL.revokeObjectURL(target.result.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearAll = () => {
    items.forEach((i) => {
      URL.revokeObjectURL(i.thumbUrl);
      i.result?.previewUrl && URL.revokeObjectURL(i.result.previewUrl);
    });
    setItems([]);
    setCompareIndex(0);
  };

  const compressPreviewSingle = useCallback(async (item: ImageItem) => {
    if (!item.meta) return;
    setBusy(true);
    try {
      const { bitmap } = await analyzeImage(item.file);
      const result = await compressImage(bitmap, item.meta, options);
      bitmap.close();
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, result, status: "done" } : p)));
      setTab("compare");
      setCompareIndex(items.findIndex((p) => p.id === item.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Preview failed");
    } finally { setBusy(false); }
  }, [options, items]);

  const previewItem = items[compareIndex];

  /* ──────────────────────────────────────────────────────────────────────────
   * Render
   * ────────────────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* Header row: language picker + favorite + privacy badge */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Lock className="h-3.5 w-3.5" /> 100% private · in-browser
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
            <Zap className="h-3.5 w-3.5 text-primary" /> {cap.avif ? "AVIF" : cap.webp ? "WebP" : "JPG"} encoder active
          </span>
          <button
            type="button"
            onClick={() => favorites.toggle(slug)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
              favorites.isFavorite(slug)
                ? "border-accent/40 bg-accent/10 text-accent"
                : "border-border bg-card hover:bg-card-hover",
            )}
            aria-pressed={favorites.isFavorite(slug)}
          >
            <Star className="h-3.5 w-3.5" /> {favorites.isFavorite(slug) ? "Favorited" : "Add favorite"}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <Languages className="h-3.5 w-3.5" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary"
              aria-label="Language"
            >
              {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
                <option key={l} value={l}>{LANG_LABELS[l]}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input
              type="checkbox"
              checked={useWorker}
              onChange={(e) => setUseWorker(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--primary)]"
            />
            {t("workerOn")}
          </label>
        </div>
      </div>

      {/* Stats dashboard */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: t("original"), value: stats.totalOriginal ? formatBytes(stats.totalOriginal) : "—", color: "text-violet-400" },
          { label: t("estimated"), value: stats.total ? formatBytes(items.reduce((s, i) => s + (i.meta ? estimateCompressedSize(i.meta.bytes, i.meta.width, i.meta.height, options) : 0), 0)) : "—", color: "text-amber-400" },
          { label: t("saved"), value: stats.totalCompressed ? `${stats.savedPct}%` : "—", color: "text-emerald-500" },
          { label: "Files", value: stats.total, color: "text-foreground" },
          { label: t("mode"), value: options.mode, color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className={cn("font-display text-lg font-bold capitalize", s.color)}>{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Drop zone — hidden once files are loaded (replaced by file list) */}
      {items.length === 0 ? (
        <div
          ref={dropZoneRef}
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all sm:p-14",
            dragging ? "scale-[1.01] border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
          )}
          aria-label={t("drop")}
        >
          <UploadCloud className="mb-4 h-14 w-14 text-primary" />
          <p className="font-display text-xl font-semibold">{t("drop")}</p>
          <p className="mt-2 max-w-lg text-sm text-muted">{t("dropHint")}</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
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
            // @ts-expect-error -- non-standard but widely supported directory attrs
            webkitdirectory=""
            directory=""
            onChange={onInputChange}
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud className="h-4 w-4" /> {t("addFiles")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => folderInputRef.current?.click()}>
            <FolderUp className="h-4 w-4" /> {t("addFolder")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void onPaste()}>
            <ClipboardPaste className="h-4 w-4" /> {t("paste")}
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onInputChange} />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            // @ts-expect-error -- non-standard but widely supported directory attrs
            webkitdirectory=""
            directory=""
            onChange={onInputChange}
          />
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={clearAll} className="text-error">
              <Trash2 className="h-4 w-4" /> {t("clear")}
            </Button>
          </div>
        </div>
      )}

      {/* Compression presets */}
      {items.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-muted">
            <Gauge className="h-3.5 w-3.5" /> {t("mode")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            {(["lossless", "low", "medium", "high", "extreme", "target"] as CompressMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setOptions((o) => ({
                  ...o,
                  mode: m,
                  quality: m !== "lossless" && m !== "target" && m !== "custom" ? COMPRESS_PRESETS[m].quality : o.quality,
                }))}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  options.mode === m ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                )}
              >
                <p className="font-medium capitalize">
                  {m === "target" ? "Target size" : COMPRESS_PRESETS[m as Exclude<CompressMode, "custom" | "target">]?.label ?? m}
                </p>
                <p className="mt-0.5 text-[10px] text-muted">
                  {m === "target" ? "Hit exact size" : COMPRESS_PRESETS[m as Exclude<CompressMode, "custom" | "target">]?.estReduction}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Smart AI assist */}
      {smart && showSmart && items.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="flex items-center gap-2 font-medium text-primary">
                  {t("smart")}
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                    {smart.recommendedMode} · {FORMAT_LABELS[smart.recommendedFormat]}
                  </span>
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
                  {smart.tips.map((tip: SmartTip, i) => (
                    <li
                      key={i}
                      className={cn(
                        tip.level === "warn" && "text-amber-500",
                        tip.level === "success" && "text-emerald-500",
                      )}
                    >
                      {tip.text}
                    </li>
                  ))}
                </ul>
                <div className="mt-3">
                  <Button size="sm" variant="gradient" onClick={applySmart}>
                    <Zap className="h-3.5 w-3.5" /> {t("apply")}
                  </Button>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSmart(false)}
              className="text-muted hover:text-foreground"
              aria-label="Dismiss smart assist"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Action bar */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button variant="gradient" disabled={busy || !items.length} onClick={() => void runCompressAll(true)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("compress")}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void runCompressAll(false)}>
            <Eye className="h-4 w-4" /> {t("preview")}
          </Button>
          <Button variant="outline" disabled={busy || stats.done === 0} onClick={async () => {
            const JSZip = (await import("jszip")).default;
            const zip = new JSZip();
            items.forEach((i) => { if (i.result) zip.file(buildOutputName(i.name, i.result.format), i.result.blob); });
            if (!Object.keys(zip.files).length) { toast.error("Nothing to export"); return; }
            const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
            downloadBlob(blob, "toolnest-compressed-images.zip");
          }}>
            <FileArchive className="h-4 w-4" /> {t("batchZip")}
          </Button>
          <Button variant="outline" onClick={() => setShowSettings((s) => !s)}>
            <Settings2 className="h-4 w-4" /> {t("settings")}
          </Button>
        </div>
      )}

      {/* Settings drawer */}
      {showSettings && items.length > 0 && (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("format")}>
            <select
              value={options.format}
              onChange={(e) => setOptions((o) => ({ ...o, format: e.target.value as OutputFormat }))}
              className={inputClass()}
            >
              <option value="image/jpeg">JPG — universal, no alpha</option>
              <option value="image/png">PNG — lossless, alpha</option>
              <option value="image/webp">WebP — modern, alpha</option>
              {cap.avif && <option value="image/avif">AVIF — best ratio</option>}
              {cap.gif && <option value="image/gif">GIF — 256-color, alpha</option>}
              <option value="image/bmp">BMP — lossless, large files</option>
              <option value="image/x-icon">ICO — Windows icon (≤256px)</option>
              <option value="image/tiff">TIFF — server-side only (REST API)</option>
            </select>
            {!isBrowserEncodable(options.format) && (
              <span className="mt-1 block text-xs text-amber-500">
                This format is encodable only via the REST API. In-browser output will fall back to PNG.
              </span>
            )}
          </Field>

          {options.mode === "target" && (
            <Field label={t("target")}>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={targetValue}
                  onChange={(e) => setTargetValue(Math.max(1, Number(e.target.value)))}
                  className={inputClass()}
                />
                <select
                  value={targetUnit}
                  onChange={(e) => setTargetUnit(e.target.value as "B" | "KB" | "MB")}
                  className={cn(inputClass(), "w-24")}
                >
                  <option value="B">B</option>
                  <option value="KB">KB</option>
                  <option value="MB">MB</option>
                </select>
              </div>
            </Field>
          )}

          {(options.mode === "custom" || options.mode === "low" || options.mode === "medium" || options.mode === "high" || options.mode === "extreme") && LOSSY_FORMATS.includes(options.format) && (
            <Field label={`${t("quality")}: ${Math.round(options.quality * 100)}%`}>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.01}
                value={options.quality}
                onChange={(e) => setOptions((o) => ({ ...o, quality: Number(e.target.value), mode: "custom" }))}
                className="w-full accent-[var(--primary)]"
              />
            </Field>
          )}

          <Field label={`${t("width")} (px / %)`}>
            <input
              type="number"
              min={1}
              value={options.resize.width}
              onChange={(e) => setOptions((o) => ({ ...o, resize: { ...o.resize, width: Number(e.target.value) } }))}
              className={inputClass()}
            />
          </Field>
          <Field label={`${t("height")} (px / %)`}>
            <input
              type="number"
              min={1}
              value={options.resize.height}
              onChange={(e) => setOptions((o) => ({ ...o, resize: { ...o.resize, height: Number(e.target.value) } }))}
              className={inputClass()}
            />
          </Field>
          <Field label="Resize unit / fit">
            <div className="flex gap-2">
              <select
                value={options.resize.unit}
                onChange={(e) => setOptions((o) => ({ ...o, resize: { ...o.resize, unit: e.target.value as "px" | "%" } }))}
                className={inputClass()}
              >
                <option value="px">Pixels</option>
                <option value="%">Percent</option>
              </select>
              <select
                value={options.resize.fit}
                onChange={(e) => setOptions((o) => ({ ...o, resize: { ...o.resize, fit: e.target.value as ResizeOptions["fit"] } }))}
                className={inputClass()}
              >
                <option value="none">Free</option>
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
              </select>
            </div>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.resize.enabled} onChange={(e) => setOptions((o) => ({ ...o, resize: { ...o.resize, enabled: e.target.checked } }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("resize")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.resize.keepRatio} onChange={(e) => setOptions((o) => ({ ...o, resize: { ...o.resize, keepRatio: e.target.checked } }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("keepRatio")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.preserveTransparency} onChange={(e) => setOptions((o) => ({ ...o, preserveTransparency: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("transparency")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.stripMetadata} onChange={(e) => setOptions((o) => ({ ...o, stripMetadata: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("stripMeta")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.ocrSafe} onChange={(e) => setOptions((o) => ({ ...o, ocrSafe: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("ocrSafe")}
          </label>
          <Field label={t("flatten")}>
            <input
              type="color"
              value={options.flattenBackground}
              onChange={(e) => setOptions((o) => ({ ...o, flattenBackground: e.target.value }))}
              className="h-10 w-full rounded-lg border border-border bg-card p-1"
            />
          </Field>
        </div>
      )}

      {/* Progress bar */}
      {busy && progress.total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted">
            <span>Compressing… {progress.done}/{progress.total}</span>
            <span>{progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Tabs */}
      {items.length > 0 && (
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {([
            ["studio", t("studio"), ImageIcon],
            ["compare", t("compare"), Eye],
            ["batch", t("batch"), FileArchive],
            ["history", t("history"), History],
            ["api", t("api"), Lock],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
                tab === key ? "bg-primary text-white" : "text-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Studio — file list */}
      {tab === "studio" && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-[64px_1fr_auto] items-center gap-4 rounded-xl border border-border bg-card p-3 sm:grid-cols-[80px_1fr_auto]"
            >
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(var(--card)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] sm:h-20 sm:w-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.thumbUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-xs text-muted">
                  {item.meta ? `${item.meta.width}×${item.meta.height} · ` : ""}
                  {formatBytes(item.originalBytes)}
                  {item.meta?.hasAlpha && " · alpha"}
                  {item.meta?.mime && ` · ${item.meta.mime.replace("image/", "")}`}
                </p>
                {item.status === "done" && item.result && (
                  <p className="mt-1 text-xs">
                    <span className="text-emerald-500">→ {formatBytes(item.result.bytes)}</span>
                    <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-500">
                      −{item.result.savingsPercent}%
                    </span>
                    <span className="ml-2 text-muted">{FORMAT_LABELS[item.result.format]} · {Math.round(item.result.quality * 100)}%</span>
                  </p>
                )}
                {item.status === "error" && (
                  <p className="mt-1 text-xs text-error">{item.error}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {item.status === "done" && item.result ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setCompareIndex(items.findIndex((p) => p.id === item.id)); setTab("compare"); }}>
                      <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">View</span>
                    </Button>
                    <Button size="sm" variant="gradient" onClick={() => downloadOne(item)}>
                      <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Save</span>
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy || !item.meta} onClick={() => void compressPreviewSingle(item)}>
                    <Zap className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Try</span>
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-muted hover:text-error"
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Compare — side-by-side + slider zoom */}
      {tab === "compare" && (
        <div className="space-y-4">
          {items.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={compareIndex}
                onChange={(e) => setCompareIndex(Number(e.target.value))}
                className={inputClass()}
                style={{ width: "auto" }}
              >
                {items.map((it, i) => (
                  <option key={it.id} value={i}>{it.name}</option>
                ))}
              </select>
              <div className="ml-auto flex items-center gap-2">
                <ZoomIn className="h-4 w-4 text-muted" />
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-40 accent-[var(--primary)]"
                  aria-label="Zoom"
                />
                <span className="w-12 text-xs text-muted">{Math.round(zoom * 100)}%</span>
              </div>
            </div>
          )}
          {previewItem && previewItem.result ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{t("original")} · {formatBytes(previewItem.originalBytes)}</span>
                  <span className="text-muted">{previewItem.meta?.width}×{previewItem.meta?.height}</span>
                </div>
                <div
                  className="flex items-center justify-center overflow-auto rounded-lg bg-[repeating-conic-gradient(var(--card)_0%_25%,transparent_0%_50%)] bg-[length:24px_24px] p-4"
                  style={{ maxHeight: 520 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewItem.thumbUrl}
                    alt="Original"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                    className="max-w-full object-contain transition-transform"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-emerald-500">
                    After · {formatBytes(previewItem.result.bytes)} (−{previewItem.result.savingsPercent}%)
                  </span>
                  <span className="text-muted">{FORMAT_LABELS[previewItem.result.format]} · {Math.round(previewItem.result.quality * 100)}%</span>
                </div>
                <div
                  className="flex items-center justify-center overflow-auto rounded-lg bg-[repeating-conic-gradient(var(--card)_0%_25%,transparent_0%_50%)] bg-[length:24px_24px] p-4"
                  style={{ maxHeight: 520 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewItem.result.previewUrl}
                    alt="Compressed"
                    style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
                    className="max-w-full object-contain transition-transform"
                  />
                </div>
              </div>

              {/* Slider overlay comparison */}
              <div className="lg:col-span-2">
                <div className="mb-2 flex items-center justify-between text-xs text-muted">
                  <span>Slider compare</span>
                  <span className="flex items-center gap-1"><Maximize2 className="h-3 w-3" /> drag the handle</span>
                </div>
                <div
                  className="relative select-none overflow-hidden rounded-xl border border-border bg-card"
                  style={{ height: 420 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewItem.thumbUrl} alt="Original" className="absolute inset-0 h-full w-full object-contain" />
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${sliderPos}%` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewItem.result.previewUrl}
                      alt="Compressed"
                      style={{ width: `${100 / (sliderPos / 100)}%`, maxWidth: "none" }}
                      className="absolute inset-0 h-full object-contain"
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={sliderPos}
                    onChange={(e) => setSliderPos(Number(e.target.value))}
                    className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
                    aria-label="Comparison slider"
                  />
                  <div
                    className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary"
                    style={{ left: `${sliderPos}%` }}
                  >
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary p-1 text-white">
                      <ScanLine className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
              <Eye className="mb-3 h-10 w-10 text-muted" />
              <p className="font-medium">Run a preview or compress to see the before/after comparison.</p>
              {previewItem && (
                <Button className="mt-4" variant="gradient" onClick={() => void compressPreviewSingle(previewItem)}>
                  <Zap className="h-4 w-4" /> Compress this image
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Batch summary */}
      {tab === "batch" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Files queued" value={String(items.length)} />
            <Stat label="Original total" value={formatBytes(stats.totalOriginal)} />
            <Stat label="Compressed total" value={formatBytes(stats.totalCompressed)} />
            <Stat label="Total saved" value={`${stats.savedPct}%`} accent />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="gradient" disabled={busy || !items.length} onClick={() => void runCompressAll(true)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Compress & ZIP
            </Button>
            <Button variant="outline" disabled={busy || stats.done === 0} onClick={async () => {
              const JSZip = (await import("jszip")).default;
              const zip = new JSZip();
              items.forEach((i) => { if (i.result) zip.file(buildOutputName(i.name, i.result.format), i.result.blob); });
              if (!Object.keys(zip.files).length) return;
              const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
              downloadBlob(blob, "toolnest-compressed-images.zip");
            }}>
              <FileArchive className="h-4 w-4" /> Re-export ZIP
            </Button>
          </div>
        </div>
      )}

      {/* History */}
      {tab === "history" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 font-medium"><History className="h-4 w-4" /> {t("history")}</p>
            {history.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => { setHistory([]); saveHistory([]); }}>
                <Trash2 className="h-3.5 w-3.5" /> Clear history
              </Button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">{t("emptyHistory")}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {history.map((h) => {
                const size = formatSizeUnit(h.compressedBytes);
                return (
                  <li key={`${h.id}-${h.ts}`} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{h.name}</p>
                      <p className="text-xs text-muted">
                        {new Date(h.ts).toLocaleString()} · {FORMAT_LABELS[h.format]}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted">{formatBytes(h.originalBytes)}</span>
                      <span className="text-foreground">→ {size.value} {size.unit}</span>
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-500">−{h.savingsPercent}%</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* API */}
      {tab === "api" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-primary" /> POST /api/v1/image/compress</p>
          <p className="text-sm text-muted">
            Send a base64-encoded image with options. The server re-encodes using the same engine and returns base64 + stats.
            Use this for CI/CD pipelines, build scripts, and backend automation.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/image/compress \\
  -H "Content-Type: application/json" \\
  -d '{
    "image": "data:image/png;base64,iVBORw0KGgo...",
    "options": {
      "mode": "medium",
      "format": "image/webp",
      "quality": 0.78,
      "resize": { "enabled": true, "width": 1920, "height": 1080, "unit": "px", "fit": "contain", "keepRatio": true },
      "stripMetadata": true,
      "preserveTransparency": true
    }
  }'`}</pre>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">Request body</p>
              <ul className="mt-2 list-inside list-disc text-muted">
                <li><code>image</code> — base64 or data URI</li>
                <li><code>options.mode</code> — lossless · low · medium · high · extreme · target · custom</li>
                <li><code>options.format</code> — image/jpeg · image/png · image/webp · image/avif</li>
                <li><code>options.quality</code> — 0.1 – 1.0</li>
                <li><code>options.targetBytes</code> — target file size</li>
                <li><code>options.resize</code> — width, height, unit, fit, keepRatio</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">Response</p>
              <pre className="mt-2 overflow-x-auto text-muted">{`{
  "ok": true,
  "output": "data:image/webp;base64,...",
  "stats": {
    "originalBytes": 1024000,
    "compressedBytes": 215000,
    "savingsPercent": 79,
    "format": "image/webp",
    "quality": 0.78
  }
}`}</pre>
            </div>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted">
            <Info className="h-3.5 w-3.5" /> {t("cloudNote")}
          </p>
        </div>
      )}

      {/* Live smart tip when there are files but no smart panel */}
      {items.length > 0 && !showSmart && smart && smart.tips.length > 0 && (
        <button
          type="button"
          onClick={() => setShowSmart(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 py-2 text-sm text-primary hover:bg-primary/10"
        >
          <Sparkles className="h-4 w-4" /> {smart.tips.length} smart tip{smart.tips.length > 1 ? "s" : ""} available — click to view
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-center">
      <p className={cn("font-display text-lg font-bold", accent ? "text-emerald-500" : "text-foreground")}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
