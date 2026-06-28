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
  Check,
  ClipboardPaste,
  Download,
  Eye,
  FileArchive,
  FileText,
  FolderUp,
  History,
  Languages,
  Loader2,
  Lock,
  ScanLine,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  DEFAULT_CONVERT_OPTIONS,
  OCR_LANGUAGES,
  buildOutputName,
  convertBatch,
  convertPdfToWord,
  probePdfEncryption,
  type ConvertItem,
  type ConvertOptions,
  type OutputFormat,
  type PageContent,
  type ParseProgress,
} from "./pdf-to-word-utils";

/* ────────────────────────────────────────────────────────────────────────────
 * i18n
 * ──────────────────────────────────────────────────────────────────────────── */

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    drop: "Drop PDFs, paste, or click to browse",
    dropHint: "PDF → editable Word · DOCX, DOC & RTF · OCR for scanned PDFs · 100% in-browser",
    addFiles: "Add PDFs",
    addFolder: "Add folder",
    paste: "Paste image",
    convert: "Convert to Word",
    preview: "Preview pages",
    settings: "Settings",
    clear: "Clear all",
    batchZip: "Download all as ZIP",
    format: "Output format",
    pageRanges: "Page ranges",
    pageRangesHint: "e.g. 1-3, 5, 8-10 (blank = all pages)",
    password: "PDF password (for encrypted files)",
    ocr: "OCR mode",
    ocrLang: "OCR language",
    preserveLayout: "Preserve layout & images",
    extractImages: "Embed scanned-page images",
    imageDpi: "Image DPI",
    includeHeaders: "Preserve headers",
    includeFooters: "Preserve footers",
    includeHyperlinks: "Preserve hyperlinks",
    smart: "Smart conversion assist",
    apply: "Apply recommended",
    studio: "Studio",
    compare: "Preview",
    batch: "Batch",
    history: "History",
    api: "API",
    emptyHistory: "No conversions yet — your history will appear here.",
    cloudNote: "PDFs are processed in your browser. The optional REST API sends data only when you call it.",
  },
  es: {
    drop: "Suelta PDFs, pega o haz clic para explorar",
    dropHint: "PDF → Word editable · DOCX, DOC y RTF · OCR para escaneados — 100% en el navegador",
    addFiles: "Añadir PDFs",
    addFolder: "Añadir carpeta",
    paste: "Pegar imagen",
    convert: "Convertir a Word",
    preview: "Vista previa",
    settings: "Ajustes",
    clear: "Limpiar todo",
    batchZip: "Descargar como ZIP",
    format: "Formato de salida",
    pageRanges: "Rangos de páginas",
    pageRangesHint: "ej. 1-3, 5, 8-10 (vacío = todas)",
    password: "Contraseña del PDF (cifrado)",
    ocr: "Modo OCR",
    ocrLang: "Idioma OCR",
    preserveLayout: "Conservar diseño e imágenes",
    extractImages: "Embeber imágenes de escaneados",
    imageDpi: "DPI de imagen",
    includeHeaders: "Conservar encabezados",
    includeFooters: "Conservar pies",
    includeHyperlinks: "Conservar hipervínculos",
    smart: "Asistente de conversión",
    apply: "Aplicar recomendado",
    studio: "Estudio",
    compare: "Vista",
    batch: "Lote",
    history: "Historial",
    api: "API",
    emptyHistory: "Aún no hay conversiones.",
    cloudNote: "Los PDFs se procesan en tu navegador.",
  },
  de: {
    drop: "PDFs ablegen, einfügen oder klicken",
    dropHint: "PDF → bearbeitbares Word · DOCX, DOC & RTF · OCR — 100% im Browser",
    addFiles: "PDFs hinzufügen",
    addFolder: "Ordner",
    paste: "Bild einfügen",
    convert: "Zu Word konvertieren",
    preview: "Vorschau",
    settings: "Einstellungen",
    clear: "Alles löschen",
    batchZip: "Als ZIP herunterladen",
    format: "Ausgabeformat",
    pageRanges: "Seitenbereiche",
    pageRangesHint: "z. B. 1-3, 5, 8-10 (leer = alle)",
    password: "PDF-Passwort",
    ocr: "OCR-Modus",
    ocrLang: "OCR-Sprache",
    preserveLayout: "Layout & Bilder erhalten",
    extractImages: "Scanned-Seitenbilder einbetten",
    imageDpi: "Bild-DPI",
    includeHeaders: "Kopfzeilen erhalten",
    includeFooters: "Fußzeilen erhalten",
    includeHyperlinks: "Hyperlinks erhalten",
    smart: "Konvertierungsassistent",
    apply: "Empfehlung anwenden",
    studio: "Studio",
    compare: "Vorschau",
    batch: "Stapel",
    history: "Verlauf",
    api: "API",
    emptyHistory: "Noch keine Konvertierungen.",
    cloudNote: "PDFs werden im Browser verarbeitet.",
  },
  fr: {
    drop: "Déposez vos PDFs, collez ou cliquez",
    dropHint: "PDF → Word éditable · DOCX, DOC & RTF · OCR — 100% dans le navigateur",
    addFiles: "Ajouter des PDFs",
    addFolder: "Dossier",
    paste: "Coller l'image",
    convert: "Convertir en Word",
    preview: "Aperçu",
    settings: "Réglages",
    clear: "Tout effacer",
    batchZip: "Télécharger en ZIP",
    format: "Format de sortie",
    pageRanges: "Plages de pages",
    pageRangesHint: "ex. 1-3, 5, 8-10 (vide = toutes)",
    password: "Mot de passe PDF",
    ocr: "Mode OCR",
    ocrLang: "Langue OCR",
    preserveLayout: "Préserver la mise en page",
    extractImages: "Embarquer les images scannées",
    imageDpi: "DPI d'image",
    includeHeaders: "Préserver en-têtes",
    includeFooters: "Préserver pieds",
    includeHyperlinks: "Préserver les liens",
    smart: "Assistant de conversion",
    apply: "Appliquer recommandation",
    studio: "Studio",
    compare: "Aperçu",
    batch: "Lot",
    history: "Historique",
    api: "API",
    emptyHistory: "Aucune conversion.",
    cloudNote: "PDFs traités dans le navigateur.",
  },
  tr: {
    drop: "PDF'leri sürükleyin, yapıştırın veya tıklayın",
    dropHint: "PDF → düzenlenebilir Word · DOCX, DOC & RTF · OCR — %100 tarayıcıda",
    addFiles: "PDF ekle",
    addFolder: "Klasör",
    paste: "Görüntü yapıştır",
    convert: "Word'e dönüştür",
    preview: "Önizleme",
    settings: "Ayarlar",
    clear: "Tümünü temizle",
    batchZip: "ZIP olarak indir",
    format: "Çıktı formatı",
    pageRanges: "Sayfa aralıkları",
    pageRangesHint: "örn. 1-3, 5, 8-10 (boş = tümü)",
    password: "PDF şifresi",
    ocr: "OCR modu",
    ocrLang: "OCR dili",
    preserveLayout: "Düzeni koru",
    extractImages: "Taranan görselleri ekle",
    imageDpi: "Görüntü DPI",
    includeHeaders: "Üstbilgileri koru",
    includeFooters: "Altbilgileri koru",
    includeHyperlinks: "Köprüleri koru",
    smart: "Dönüşüm asistanı",
    apply: "Öneriyi uygula",
    studio: "Stüdyo",
    compare: "Önizleme",
    batch: "Toplu",
    history: "Geçmiş",
    api: "API",
    emptyHistory: "Henüz dönüşüm yok.",
    cloudNote: "PDF'ler tarayıcıda işlenir.",
  },
  hi: {
    drop: "PDF छोड़ें, पेस्ट करें या ब्राउज़ करें",
    dropHint: "PDF → संपादन योग्य Word · DOCX, DOC और RTF · OCR — 100% ब्राउज़र में",
    addFiles: "PDF जोड़ें",
    addFolder: "फ़ोल्डर",
    paste: "छवि पेस्ट करें",
    convert: "Word में बदलें",
    preview: "पूर्वावलोकन",
    settings: "सेटिंग्स",
    clear: "सभी साफ़ करें",
    batchZip: "ZIP डाउनलोड करें",
    format: "आउटपुट प्रारूप",
    pageRanges: "पृष्ठ श्रेणियाँ",
    pageRangesHint: "जैसे 1-3, 5, 8-10 (खाली = सभी)",
    password: "PDF पासवर्ड",
    ocr: "OCR मोड",
    ocrLang: "OCR भाषा",
    preserveLayout: "लेआउट बनाए रखें",
    extractImages: "स्कैन की गई छवियाँ एम्बेड करें",
    imageDpi: "छवि DPI",
    includeHeaders: "हेडर बनाए रखें",
    includeFooters: "फुटर बनाए रखें",
    includeHyperlinks: "हाइपरलिंक बनाए रखें",
    smart: "स्मार्ट रूपांतरण सहायक",
    apply: "अनुशंसित लागू करें",
    studio: "स्टूडियो",
    compare: "पूर्वावलोकन",
    batch: "बैच",
    history: "इतिहास",
    api: "API",
    emptyHistory: "अभी कोई रूपांतरण नहीं।",
    cloudNote: "PDF ब्राउज़र में संसाधित होते हैं।",
  },
  pt: {
    drop: "Solte PDFs, cole ou clique para procurar",
    dropHint: "PDF → Word editável · DOCX, DOC & RTF · OCR — 100% no navegador",
    addFiles: "Adicionar PDFs",
    addFolder: "Pasta",
    paste: "Colar imagem",
    convert: "Converter para Word",
    preview: "Pré-visualizar",
    settings: "Configurações",
    clear: "Limpar tudo",
    batchZip: "Baixar como ZIP",
    format: "Formato de saída",
    pageRanges: "Intervalos de páginas",
    pageRangesHint: "ex. 1-3, 5, 8-10 (vazio = todas)",
    password: "Senha do PDF",
    ocr: "Modo OCR",
    ocrLang: "Idioma OCR",
    preserveLayout: "Preservar layout",
    extractImages: "Embutir imagens escaneadas",
    imageDpi: "DPI de imagem",
    includeHeaders: "Preservar cabeçalhos",
    includeFooters: "Preservar rodapés",
    includeHyperlinks: "Preservar hiperlinks",
    smart: "Assistente de conversão",
    apply: "Aplicar recomendado",
    studio: "Estúdio",
    compare: "Pré-visualização",
    batch: "Lote",
    history: "Histórico",
    api: "API",
    emptyHistory: "Ainda nenhuma conversão.",
    cloudNote: "PDFs processados no navegador.",
  },
  ja: {
    drop: "PDFをドロップ、ペースト、またはクリック",
    dropHint: "PDF → 編集可能なWord · DOCX/DOC/RTF · OCR — 100%ブラウザ内",
    addFiles: "PDF追加",
    addFolder: "フォルダ",
    paste: "画像ペースト",
    convert: "Wordに変換",
    preview: "プレビュー",
    settings: "設定",
    clear: "すべて消去",
    batchZip: "ZIPで一括",
    format: "出力形式",
    pageRanges: "ページ範囲",
    pageRangesHint: "例 1-3, 5, 8-10 (空 = 全ページ)",
    password: "PDFパスワード",
    ocr: "OCRモード",
    ocrLang: "OCR言語",
    preserveLayout: "レイアウト保持",
    extractImages: "スキャン画像埋込",
    imageDpi: "画像DPI",
    includeHeaders: "ヘッダー保持",
    includeFooters: "フッター保持",
    includeHyperlinks: "ハイパーリンク保持",
    smart: "スマート変換",
    apply: "推奨を適用",
    studio: "スタジオ",
    compare: "プレビュー",
    batch: "バッチ",
    history: "履歴",
    api: "API",
    emptyHistory: "まだ変換なし。",
    cloudNote: "PDFはブラウザで処理。",
  },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français",
  tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

/* ────────────────────────────────────────────────────────────────────────────
 * History
 * ──────────────────────────────────────────────────────────────────────────── */

interface HistoryEntry {
  id: string;
  name: string;
  format: OutputFormat;
  originalBytes: number;
  convertedBytes: number;
  pageCount: number;
  wordCount: number;
  ocrPages: number;
  ts: number;
}

const HISTORY_KEY = "toolnest-pdf-to-word-history";
const SETTINGS_KEY = "toolnest-pdf-to-word-settings";
const LANG_KEY = "toolnest-pdf-to-word-lang";

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
 * Component
 * ──────────────────────────────────────────────────────────────────────────── */

type Tab = "studio" | "compare" | "batch" | "history" | "api";

let _idCounter = 0;
const nextId = () => `pdf2word-${Date.now()}-${++_idCounter}`;

export function PdfToWord() {
  const favorites = useFavorites();
  const slug = "pdf-to-word";

  const [items, setItems] = useState<ConvertItem[]>([]);
  const [tab, setTab] = useState<Tab>("studio");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ParseProgress | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSmart, setShowSmart] = useState(true);
  const [lang, setLang] = useState<Lang>("en");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [pagePreviewIndex, setPagePreviewIndex] = useState(0);
  const [pendingUnlock, setPendingUnlock] = useState<ConvertItem | null>(null);
  const [unlockPassword, setUnlockPassword] = useState("");

  const [options, setOptions] = useState<ConvertOptions>(DEFAULT_CONVERT_OPTIONS);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const t = useCallback((key: string) => STRINGS[lang][key] ?? STRINGS.en[key] ?? key, [lang]);

  useEffect(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) setOptions((prev) => ({ ...prev, ...JSON.parse(s) }));
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

  useEffect(() => () => {
    items.forEach((i) => {
      i.result?.previewUrl && URL.revokeObjectURL(i.result.previewUrl);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── file ingestion ─ */
  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const accepted: ConvertItem[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        toast.error(`Not a PDF: ${file.name}`);
        continue;
      }
      const item: ConvertItem = {
        id: nextId(),
        file,
        name: file.name,
        originalBytes: file.size,
        pageCount: 0,
        encrypted: false,
        status: "queued",
        result: null,
        pages: [],
        thumbUrl: "",
      };
      accepted.push(item);
      // Probe encryption status asynchronously.
      try {
        item.encrypted = await probePdfEncryption(file);
      } catch { /* ignore */ }
    }
    if (accepted.length) {
      setItems((prev) => [...prev, ...accepted]);
      const encrypted = accepted.filter((a) => a.encrypted);
      if (encrypted.length) {
        toast.info(`${encrypted.length} encrypted PDF(s) — password required`);
        setPendingUnlock(encrypted[0]);
      } else {
        toast.success(`${accepted.length} PDF(s) added`);
      }
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
      const clipItems = await navigator.clipboard.read();
      const files: File[] = [];
      for (const it of clipItems) {
        for (const type of it.types) {
          if (type === "application/pdf") {
            const blob = await it.getType(type);
            files.push(new File([blob], `pasted-${Date.now()}.pdf`, { type }));
          }
        }
      }
      if (files.length) void addFiles(files);
      else toast.error("No PDF on clipboard");
    } catch {
      toast.error("Clipboard read denied by browser");
    }
  }, [addFiles]);

  const stats = useMemo(() => {
    const total = items.length;
    const done = items.filter((i) => i.status === "done" && i.result).length;
    const totalOriginal = items.reduce((s, i) => s + i.originalBytes, 0);
    const totalConverted = items.reduce((s, i) => s + (i.result?.bytes ?? 0), 0);
    const totalWords = items.reduce((s, i) => s + (i.result?.wordCount ?? 0), 0);
    const totalOcr = items.reduce((s, i) => s + (i.result?.ocrPages ?? 0), 0);
    return { total, done, totalOriginal, totalConverted, totalWords, totalOcr };
  }, [items]);

  const applySmart = () => {
    setOptions((o) => ({
      ...o,
      outputFormat: "docx",
      preserveLayout: true,
      extractImages: true,
      ocrMode: "scanned-only",
      includeHeaders: true,
      includeFooters: true,
      includeHyperlinks: true,
    }));
    toast.success("Smart settings applied");
  };

  const runConvertAll = useCallback(async (autoDownload: boolean) => {
    if (!items.length) { toast.error("Add PDFs first"); return; }
    const pending = items.filter((i) => !i.encrypted || options.password);
    if (!pending.length) {
      toast.error("All PDFs are encrypted — enter a password in Settings");
      return;
    }
    setBusy(true);
    setProgress({ phase: "loading" });
    try {
      const updated = await convertBatch(items, options, (_item, p) => setProgress(p));
      setItems([...updated]);

      const newEntries: HistoryEntry[] = updated
        .filter((i) => i.status === "done" && i.result)
        .map((i) => ({
          id: i.id,
          name: i.name,
          format: i.result!.format,
          originalBytes: i.originalBytes,
          convertedBytes: i.result!.bytes,
          pageCount: i.result!.pageCount,
          wordCount: i.result!.wordCount,
          ocrPages: i.result!.ocrPages,
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
          const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
          downloadBlob(blob, "toolnest-converted-word.zip");
        }
        toast.success(`Done — ${newEntries.length} document(s)`);
      } else {
        setTab("compare");
        toast.success("Conversion ready — view the Preview tab");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [items, options]);

  const convertOne = useCallback(async (item: ConvertItem) => {
    if (item.encrypted && !options.password) {
      setPendingUnlock(item);
      return;
    }
    setBusy(true);
    setProgress({ phase: "loading" });
    try {
      const result = await convertPdfToWord(item.file, options, setProgress);
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, result, status: "done" } : p)));
      setHistory((h) => {
        const entry: HistoryEntry = {
          id: item.id, name: item.name, format: result.format,
          originalBytes: item.originalBytes, convertedBytes: result.bytes,
          pageCount: result.pageCount, wordCount: result.wordCount, ocrPages: result.ocrPages, ts: Date.now(),
        };
        const next = [entry, ...h].slice(0, 50);
        saveHistory(next);
        return next;
      });
      downloadBlob(result.blob, buildOutputName(item.name, result.format));
      toast.success(`Converted · ${result.wordCount} words · ${result.ocrPages} OCR pages`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Conversion failed";
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "error", error: msg } : p)));
      toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [options]);

  const downloadOne = (item: ConvertItem) => {
    if (!item.result) return;
    downloadBlob(item.result.blob, buildOutputName(item.name, item.result.format));
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((p) => p.id === id);
      target?.result?.previewUrl && URL.revokeObjectURL(target.result.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearAll = () => {
    items.forEach((i) => i.result?.previewUrl && URL.revokeObjectURL(i.result.previewUrl));
    setItems([]);
    setPreviewIndex(0);
    setPagePreviewIndex(0);
  };

  const unlockPending = async () => {
    if (!pendingUnlock) return;
    if (!unlockPassword.trim()) { toast.error("Enter password"); return; }
    setOptions((o) => ({ ...o, password: unlockPassword }));
    const item = pendingUnlock;
    setPendingUnlock(null);
    setUnlockPassword("");
    // Mark item as not-encrypted-so-far and try convert
    setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, encrypted: false } : p)));
    const updated = { ...item, encrypted: false };
    // Use the new password directly
    await convertOne({ ...updated, file: item.file });
  };

  const previewItem = items[previewIndex];
  const previewPages: PageContent[] = previewItem?.pages ?? [];
  const currentPreviewPage = previewPages[pagePreviewIndex];

  /* ──────────────────────────────────────────────────────────────────────────
   * Render
   * ────────────────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Lock className="h-3.5 w-3.5" /> 100% private · in-browser
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
            <ScanLine className="h-3.5 w-3.5 text-primary" /> OCR + multilingual
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Files", value: String(stats.total), color: "text-foreground" },
          { label: "Original", value: stats.totalOriginal ? formatBytes(stats.totalOriginal) : "—", color: "text-violet-400" },
          { label: "Words", value: stats.totalWords.toLocaleString(), color: "text-amber-400" },
          { label: "OCR pages", value: String(stats.totalOcr), color: "text-emerald-500" },
          { label: "Format", value: options.outputFormat.toUpperCase(), color: "text-primary" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className={cn("font-display text-lg font-bold", s.color)}>{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
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
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all sm:p-14",
            dragging ? "scale-[1.01] border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
          )}
          aria-label={t("drop")}
        >
          <FileText className="mb-4 h-14 w-14 text-primary" />
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
          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={onInputChange} />
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
          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={onInputChange} />
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

      {/* Smart assist */}
      {showSmart && items.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="flex items-center gap-2 font-medium text-primary">
                  {t("smart")}
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                    DOCX · preserve layout · OCR scanned-only
                  </span>
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
                  <li>DOCX keeps headings, lists, alignment & images editable in Word.</li>
                  <li>For scanned PDFs, enable OCR — pick the document&apos;s language for best accuracy.</li>
                  <li>Use page ranges to convert only the pages you need — much faster for big files.</li>
                  <li>Encrypted PDFs need a password — enter it in Settings before converting.</li>
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
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Action bar */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button variant="gradient" disabled={busy || !items.length} onClick={() => void runConvertAll(true)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("convert")}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void runConvertAll(false)}>
            <Eye className="h-4 w-4" /> {t("preview")}
          </Button>
          <Button variant="outline" disabled={busy || stats.done === 0} onClick={async () => {
            const JSZip = (await import("jszip")).default;
            const zip = new JSZip();
            items.forEach((i) => { if (i.result) zip.file(buildOutputName(i.name, i.result.format), i.result.blob); });
            if (!Object.keys(zip.files).length) { toast.error("Nothing to export"); return; }
            const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
            downloadBlob(blob, "toolnest-converted-word.zip");
          }}>
            <FileArchive className="h-4 w-4" /> {t("batchZip")}
          </Button>
          <Button variant="outline" onClick={() => setShowSettings((s) => !s)}>
            <Settings2 className="h-4 w-4" /> {t("settings")}
          </Button>
        </div>
      )}

      {/* Settings */}
      {showSettings && items.length > 0 && (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("format")}>
            <select
              value={options.outputFormat}
              onChange={(e) => setOptions((o) => ({ ...o, outputFormat: e.target.value as OutputFormat }))}
              className={inputClass()}
            >
              <option value="docx">DOCX — editable, full fidelity</option>
              <option value="doc">DOC — Word-compatible HTML</option>
              <option value="rtf">RTF — universal, text-only</option>
            </select>
          </Field>
          <Field label={t("pageRanges")} hint={t("pageRangesHint")}>
            <input
              value={options.pageRanges}
              onChange={(e) => setOptions((o) => ({ ...o, pageRanges: e.target.value }))}
              placeholder="1-3, 5, 8-10"
              className={inputClass()}
            />
          </Field>
          <Field label={t("password")}>
            <input
              type="password"
              value={options.password}
              onChange={(e) => setOptions((o) => ({ ...o, password: e.target.value }))}
              placeholder="••••••••"
              className={inputClass()}
            />
          </Field>
          <Field label={t("ocr")}>
            <select
              value={options.ocrMode}
              onChange={(e) => setOptions((o) => ({ ...o, ocrMode: e.target.value as ConvertOptions["ocrMode"] }))}
              className={inputClass()}
            >
              <option value="scanned-only">Scanned-only (auto-detect)</option>
              <option value="auto">Auto (when no text)</option>
              <option value="always">Always OCR</option>
              <option value="never">Never (text only)</option>
            </select>
          </Field>
          <Field label={t("ocrLang")}>
            <select
              value={options.ocrLanguage}
              onChange={(e) => setOptions((o) => ({ ...o, ocrLanguage: e.target.value }))}
              className={inputClass()}
            >
              {OCR_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </Field>
          <Field label={`${t("imageDpi")}: ${options.imageDpi}`}>
            <input
              type="range"
              min={72}
              max={300}
              step={6}
              value={options.imageDpi}
              onChange={(e) => setOptions((o) => ({ ...o, imageDpi: Number(e.target.value) }))}
              className="w-full accent-[var(--primary)]"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.preserveLayout} onChange={(e) => setOptions((o) => ({ ...o, preserveLayout: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("preserveLayout")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.extractImages} onChange={(e) => setOptions((o) => ({ ...o, extractImages: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("extractImages")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.includeHeaders} onChange={(e) => setOptions((o) => ({ ...o, includeHeaders: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("includeHeaders")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.includeFooters} onChange={(e) => setOptions((o) => ({ ...o, includeFooters: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("includeFooters")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.includeHyperlinks} onChange={(e) => setOptions((o) => ({ ...o, includeHyperlinks: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("includeHyperlinks")}
          </label>
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-3">
            OCR uses Tesseract.js loaded on-demand from CDN. First OCR run downloads the language model (~3-15 MB).
          </p>
        </div>
      )}

      {/* Progress */}
      {busy && progress && (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="capitalize">{progress.phase}</span>
              {progress.page && progress.totalPages ? `· page ${progress.page}/${progress.totalPages}` : ""}
            </span>
            {progress.totalPages ? <span>{Math.round((progress.page ?? 0) / progress.totalPages * 100)}%</span> : null}
          </div>
          {progress.totalPages ? (
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round((progress.page ?? 0) / progress.totalPages * 100)}%` }} />
            </div>
          ) : null}
        </div>
      )}

      {/* Tabs */}
      {items.length > 0 && (
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {([
            ["studio", t("studio"), FileText],
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
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-card-hover sm:h-20 sm:w-20">
                {item.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
                ) : (
                  <FileText className="h-8 w-8 text-muted" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="text-xs text-muted">
                  {formatBytes(item.originalBytes)}
                  {item.encrypted && <span className="ml-2 inline-flex items-center gap-1 text-amber-500"><Lock className="h-3 w-3" /> encrypted</span>}
                </p>
                {item.status === "done" && item.result && (
                  <p className="mt-1 text-xs">
                    <span className="text-emerald-500">→ {formatBytes(item.result.bytes)}</span>
                    <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-500">
                      {item.result.wordCount} words
                    </span>
                    {item.result.ocrPages > 0 && (
                      <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">
                        {item.result.ocrPages} OCR
                      </span>
                    )}
                    <span className="ml-2 text-muted">.{item.result.format}</span>
                  </p>
                )}
                {item.status === "error" && (
                  <p className="mt-1 text-xs text-error">{item.error}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {item.status === "done" && item.result ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setPreviewIndex(items.findIndex((p) => p.id === item.id)); setTab("compare"); }}>
                      <Eye className="h-3.5 w-3.5" /> <span className="hidden sm:inline">View</span>
                    </Button>
                    <Button size="sm" variant="gradient" onClick={() => downloadOne(item)}>
                      <Download className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Save</span>
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void convertOne(item)}>
                    <Zap className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Convert</span>
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

      {/* Compare / Preview */}
      {tab === "compare" && (
        <div className="space-y-4">
          {items.length > 1 && (
            <select
              value={previewIndex}
              onChange={(e) => { setPreviewIndex(Number(e.target.value)); setPagePreviewIndex(0); }}
              className={inputClass()}
              style={{ width: "auto" }}
            >
              {items.map((it, i) => (
                <option key={it.id} value={i}>{it.name}</option>
              ))}
            </select>
          )}
          {previewItem && previewItem.result ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-4">
                <Stat label="Pages" value={String(previewItem.result.pageCount)} />
                <Stat label="Words" value={previewItem.result.wordCount.toLocaleString()} />
                <Stat label="OCR pages" value={String(previewItem.result.ocrPages)} accent />
                <Stat label="Size" value={formatBytes(previewItem.result.bytes)} />
              </div>
              {previewItem.result.format === "docx" ? (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="mb-2 text-sm text-muted">
                    DOCX preview isn&apos;t renderable in-browser — download to open in Word.
                    Page thumbnails from the source PDF:
                  </p>
                  {previewPages.length > 0 && (
                    <PageThumbGrid pages={previewPages} index={pagePreviewIndex} onIndex={setPagePreviewIndex} />
                  )}
                </div>
              ) : (
                <iframe
                  src={previewItem.result.previewUrl}
                  title="Word preview"
                  className="h-[min(70vh,640px)] w-full rounded-xl border border-border bg-white"
                />
              )}
              <Button variant="gradient" onClick={() => downloadOne(previewItem)}>
                <Download className="h-4 w-4" /> Download .{previewItem.result.format}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
              <Eye className="mb-3 h-10 w-10 text-muted" />
              <p className="font-medium">Convert a PDF to see the Word preview here.</p>
              {previewItem && (
                <Button className="mt-4" variant="gradient" disabled={busy} onClick={() => void convertOne(previewItem)}>
                  <Zap className="h-4 w-4" /> Convert this PDF
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Batch */}
      {tab === "batch" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Files queued" value={String(items.length)} />
            <Stat label="Original total" value={formatBytes(stats.totalOriginal)} />
            <Stat label="Converted total" value={formatBytes(stats.totalConverted)} accent />
            <Stat label="Total words" value={stats.totalWords.toLocaleString()} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="gradient" disabled={busy || !items.length} onClick={() => void runConvertAll(true)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Convert & ZIP
            </Button>
            <Button variant="outline" disabled={busy || stats.done === 0} onClick={async () => {
              const JSZip = (await import("jszip")).default;
              const zip = new JSZip();
              items.forEach((i) => { if (i.result) zip.file(buildOutputName(i.name, i.result.format), i.result.blob); });
              if (!Object.keys(zip.files).length) return;
              const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
              downloadBlob(blob, "toolnest-converted-word.zip");
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
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted">{t("emptyHistory")}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {history.map((h) => (
                <li key={`${h.id}-${h.ts}`} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{h.name}</p>
                    <p className="text-xs text-muted">{new Date(h.ts).toLocaleString()} · {h.format.toUpperCase()} · {h.pageCount}p · {h.wordCount} words</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted">{formatBytes(h.originalBytes)}</span>
                    <span className="text-foreground">→ {formatBytes(h.convertedBytes)}</span>
                    {h.ocrPages > 0 && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">{h.ocrPages} OCR</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* API */}
      {tab === "api" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-primary" /> POST /api/v1/pdf/to-word</p>
          <p className="text-sm text-muted">
            Send a base64-encoded PDF with options. The server extracts text & images via pdfjs and
            renders a DOCX via the `docx` library. Use for CI/CD and backend automation.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/pdf/to-word \\
  -H "Content-Type: application/json" \\
  -d '{
    "pdf": "data:application/pdf;base64,JVBERi0xLj...",
    "options": {
      "outputFormat": "docx",
      "pageRanges": "1-5",
      "password": "",
      "ocrMode": "scanned-only",
      "ocrLanguage": "eng",
      "preserveLayout": true,
      "extractImages": true,
      "imageDpi": 150
    }
  }'`}</pre>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">Request body</p>
              <ul className="mt-2 list-inside list-disc text-muted">
                <li><code>pdf</code> — base64 or data URI</li>
                <li><code>options.outputFormat</code> — docx · doc · rtf</li>
                <li><code>options.pageRanges</code> — e.g. &quot;1-3, 5&quot;</li>
                <li><code>options.password</code> — for encrypted PDFs</li>
                <li><code>options.ocrMode</code> — scanned-only · auto · always · never</li>
                <li><code>options.ocrLanguage</code> — Tesseract lang code</li>
                <li><code>options.imageDpi</code> — 72–300</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">Response</p>
              <pre className="mt-2 overflow-x-auto text-muted">{`{
  "ok": true,
  "output": "data:application/vnd.openxmlformats-...",
  "stats": {
    "originalBytes": 1024000,
    "convertedBytes": 215000,
    "pageCount": 12,
    "wordCount": 4321,
    "imageCount": 7,
    "ocrPages": 0,
    "format": "docx"
  }
}`}</pre>
            </div>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted">
            <Check className="h-3.5 w-3.5 text-success" /> {t("cloudNote")}
          </p>
        </div>
      )}

      {/* Pending unlock modal */}
      {pendingUnlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <h3 className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4 text-primary" /> Unlock PDF</h3>
            <p className="mt-2 text-sm text-muted">{pendingUnlock.name} is password-protected.</p>
            <div className="mt-4">
              <Field label="Password">
                <input
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  className={inputClass()}
                  onKeyDown={(e) => e.key === "Enter" && void unlockPending()}
                  autoFocus
                />
              </Field>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="gradient" onClick={() => void unlockPending()}>Unlock & convert</Button>
              <Button variant="outline" onClick={() => { setPendingUnlock(null); setUnlockPassword(""); }}>Cancel</Button>
            </div>
          </div>
        </div>
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

function PageThumbGrid({
  pages,
  index,
  onIndex,
}: {
  pages: PageContent[];
  index: number;
  onIndex: (i: number) => void;
}) {
  const page = pages[index];
  return (
    <div className="space-y-3">
      {page && (
        <div className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-card-hover p-2" style={{ maxHeight: 480 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={page.thumbDataUrl} alt={`Page ${page.pageNumber}`} className="max-h-[460px] max-w-full object-contain" />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {pages.map((p, i) => (
          <button
            key={p.pageNumber}
            type="button"
            onClick={() => onIndex(i)}
            className={cn(
              "overflow-hidden rounded border transition-colors",
              i === index ? "border-primary" : "border-border hover:border-primary/50",
            )}
            style={{ width: 64, height: 84 }}
            aria-label={`Page ${p.pageNumber}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumbDataUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
