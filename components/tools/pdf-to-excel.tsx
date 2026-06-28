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
  FileSpreadsheet,
  FolderUp,
  History,
  Languages,
  Loader2,
  Lock,
  ScanLine,
  Settings2,
  Sparkles,
  Star,
  Table as TableIcon,
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
  convertPdfToExcel,
  findDuplicateRows,
  probePdfEncryption,
  type ConvertItem,
  type ConvertOptions,
  type OutputFormat,
  type PageContent,
  type ParseProgress,
} from "./pdf-to-excel-utils";

/* ────────────────────────────────────────────────────────────────────────────
 * i18n
 * ──────────────────────────────────────────────────────────────────────────── */

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    drop: "Drop PDFs, paste, or click to browse",
    dropHint: "PDF → Excel · XLSX, XLS, CSV & ODS · AI table detection · OCR · 100% in-browser",
    addFiles: "Add PDFs",
    addFolder: "Add folder",
    paste: "Paste",
    convert: "Convert to Excel",
    preview: "Preview tables",
    settings: "Settings",
    clear: "Clear all",
    batchZip: "Download all as ZIP",
    format: "Output format",
    pageRanges: "Page ranges",
    pageRangesHint: "e.g. 1-3, 5, 8-10 (blank = all)",
    password: "PDF password",
    ocr: "OCR mode",
    ocrLang: "OCR language",
    tableMode: "Table detection",
    oneSheetPerPage: "One sheet per page",
    detectMerged: "Detect merged cells",
    trim: "Trim whitespace",
    cleanData: "AI data cleanup",
    detectHeaders: "Detect header row",
    numberFormat: "Auto number formatting",
    csvDelimiter: "CSV delimiter",
    includeHeaders: "Preserve headers",
    includeFooters: "Preserve footers",
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
    drop: "Suelta PDFs, pega o haz clic",
    dropHint: "PDF → Excel · XLSX, XLS, CSV y ODS · detección IA · OCR — 100% en navegador",
    addFiles: "Añadir PDFs",
    addFolder: "Carpeta",
    paste: "Pegar",
    convert: "Convertir a Excel",
    preview: "Vista previa",
    settings: "Ajustes",
    clear: "Limpiar todo",
    batchZip: "ZIP",
    format: "Formato de salida",
    pageRanges: "Rangos de páginas",
    pageRangesHint: "ej. 1-3, 5, 8-10",
    password: "Contraseña PDF",
    ocr: "Modo OCR",
    ocrLang: "Idioma OCR",
    tableMode: "Detección de tabla",
    oneSheetPerPage: "Una hoja por página",
    detectMerged: "Detectar celdas combinadas",
    trim: "Recortar espacios",
    cleanData: "Limpieza IA",
    detectHeaders: "Detectar encabezado",
    numberFormat: "Formato numérico",
    csvDelimiter: "Delimitador CSV",
    includeHeaders: "Conservar encabezados",
    includeFooters: "Conservar pies",
    smart: "Asistente IA",
    apply: "Aplicar recomendado",
    studio: "Estudio",
    compare: "Vista",
    batch: "Lote",
    history: "Historial",
    api: "API",
    emptyHistory: "Aún no hay conversiones.",
    cloudNote: "PDFs procesados en navegador.",
  },
  de: {
    drop: "PDFs ablegen, einfügen oder klicken",
    dropHint: "PDF → Excel · XLSX, XLS, CSV & ODS · KI-Tabellen · OCR — 100% im Browser",
    addFiles: "PDFs hinzufügen",
    addFolder: "Ordner",
    paste: "Einfügen",
    convert: "Zu Excel konvertieren",
    preview: "Vorschau",
    settings: "Einstellungen",
    clear: "Alles löschen",
    batchZip: "ZIP",
    format: "Ausgabeformat",
    pageRanges: "Seitenbereiche",
    pageRangesHint: "z. B. 1-3, 5, 8-10",
    password: "PDF-Passwort",
    ocr: "OCR-Modus",
    ocrLang: "OCR-Sprache",
    tableMode: "Tabellenerkennung",
    oneSheetPerPage: "Pro Seite ein Blatt",
    detectMerged: "Verbundene Zellen erkennen",
    trim: "Leerzeichen trimmen",
    cleanData: "KI-Datenbereinigung",
    detectHeaders: "Kopfzeile erkennen",
    numberFormat: "Zahlenformat",
    csvDelimiter: "CSV-Trennzeichen",
    includeHeaders: "Kopfzeilen erhalten",
    includeFooters: "Fußzeilen erhalten",
    smart: "KI-Assistent",
    apply: "Empfehlung anwenden",
    studio: "Studio",
    compare: "Vorschau",
    batch: "Stapel",
    history: "Verlauf",
    api: "API",
    emptyHistory: "Noch keine Konvertierungen.",
    cloudNote: "PDFs im Browser verarbeitet.",
  },
  fr: {
    drop: "Déposez vos PDFs, collez ou cliquez",
    dropHint: "PDF → Excel · XLSX, XLS, CSV & ODS · détection IA · OCR — 100% dans le navigateur",
    addFiles: "Ajouter des PDFs",
    addFolder: "Dossier",
    paste: "Coller",
    convert: "Convertir en Excel",
    preview: "Aperçu",
    settings: "Réglages",
    clear: "Tout effacer",
    batchZip: "ZIP",
    format: "Format de sortie",
    pageRanges: "Plages de pages",
    pageRangesHint: "ex. 1-3, 5, 8-10",
    password: "Mot de passe PDF",
    ocr: "Mode OCR",
    ocrLang: "Langue OCR",
    tableMode: "Détection de tableau",
    oneSheetPerPage: "Une feuille par page",
    detectMerged: "Détecter cellules fusionnées",
    trim: "Trim espaces",
    cleanData: "Nettoyage IA",
    detectHeaders: "Détecter en-tête",
    numberFormat: "Format numérique",
    csvDelimiter: "Délimiteur CSV",
    includeHeaders: "Préserver en-têtes",
    includeFooters: "Préserver pieds",
    smart: "Assistant IA",
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
    dropHint: "PDF → Excel · XLSX, XLS, CSV ve ODS · AI tablo · OCR — %100 tarayıcıda",
    addFiles: "PDF ekle",
    addFolder: "Klasör",
    paste: "Yapıştır",
    convert: "Excel'e dönüştür",
    preview: "Önizleme",
    settings: "Ayarlar",
    clear: "Tümünü temizle",
    batchZip: "ZIP",
    format: "Çıktı formatı",
    pageRanges: "Sayfa aralıkları",
    pageRangesHint: "örn. 1-3, 5, 8-10",
    password: "PDF şifresi",
    ocr: "OCR modu",
    ocrLang: "OCR dili",
    tableMode: "Tablo algılama",
    oneSheetPerPage: "Sayfa başına sayfa",
    detectMerged: "Birleşik hücreleri algıla",
    trim: "Boşlukları kırp",
    cleanData: "AI veri temizleme",
    detectHeaders: "Başlık algıla",
    numberFormat: "Sayı formatı",
    csvDelimiter: "CSV ayırıcı",
    includeHeaders: "Başlıkları koru",
    includeFooters: "Altbilgileri koru",
    smart: "AI asistanı",
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
    dropHint: "PDF → Excel · XLSX, XLS, CSV और ODS · AI तालिका · OCR — 100% ब्राउज़र में",
    addFiles: "PDF जोड़ें",
    addFolder: "फ़ोल्डर",
    paste: "पेस्ट",
    convert: "Excel में बदलें",
    preview: "पूर्वावलोकन",
    settings: "सेटिंग्स",
    clear: "सभी साफ़ करें",
    batchZip: "ZIP",
    format: "आउटपुट प्रारूप",
    pageRanges: "पृष्ठ श्रेणियाँ",
    pageRangesHint: "जैसे 1-3, 5, 8-10",
    password: "PDF पासवर्ड",
    ocr: "OCR मोड",
    ocrLang: "OCR भाषा",
    tableMode: "तालिका पहचान",
    oneSheetPerPage: "प्रति पृष्ठ एक शीट",
    detectMerged: "मर्ज कोशिकाएँ पहचानें",
    trim: "व्हाइटस्पेस ट्रिम",
    cleanData: "AI डेटा सफाई",
    detectHeaders: "हेडर पहचानें",
    numberFormat: "ऑटो नंबर फ़ॉर्मैट",
    csvDelimiter: "CSV डिलीमीटर",
    includeHeaders: "हेडर बनाए रखें",
    includeFooters: "फुटर बनाए रखें",
    smart: "स्मार्ट रूपांतरण",
    apply: "अनुशंसित लागू करें",
    studio: "स्टूडियो",
    compare: "पूर्वावलोकन",
    batch: "बैच",
    history: "इतिहास",
    api: "API",
    emptyHistory: "अभी कोई रूपांतरण नहीं।",
    cloudNote: "PDF ब्राउज़र में संसाधित।",
  },
  pt: {
    drop: "Solte PDFs, cole ou clique",
    dropHint: "PDF → Excel · XLSX, XLS, CSV & ODS · detecção IA · OCR — 100% no navegador",
    addFiles: "Adicionar PDFs",
    addFolder: "Pasta",
    paste: "Colar",
    convert: "Converter para Excel",
    preview: "Pré-visualizar",
    settings: "Configurações",
    clear: "Limpar tudo",
    batchZip: "ZIP",
    format: "Formato de saída",
    pageRanges: "Intervalos de páginas",
    pageRangesHint: "ex. 1-3, 5, 8-10",
    password: "Senha PDF",
    ocr: "Modo OCR",
    ocrLang: "Idioma OCR",
    tableMode: "Detecção de tabela",
    oneSheetPerPage: "Uma folha por página",
    detectMerged: "Detectar células mescladas",
    trim: "Aparar espaços",
    cleanData: "Limpeza IA",
    detectHeaders: "Detectar cabeçalho",
    numberFormat: "Formato numérico",
    csvDelimiter: "Delimitador CSV",
    includeHeaders: "Preservar cabeçalhos",
    includeFooters: "Preservar rodapés",
    smart: "Assistente IA",
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
    drop: "PDFをドロップ、ペースト、クリック",
    dropHint: "PDF → Excel · XLSX/XLS/CSV/ODS · AI表検出 · OCR — 100%ブラウザ内",
    addFiles: "PDF追加",
    addFolder: "フォルダ",
    paste: "ペースト",
    convert: "Excelに変換",
    preview: "プレビュー",
    settings: "設定",
    clear: "すべて消去",
    batchZip: "ZIP",
    format: "出力形式",
    pageRanges: "ページ範囲",
    pageRangesHint: "例 1-3, 5, 8-10",
    password: "PDFパスワード",
    ocr: "OCRモード",
    ocrLang: "OCR言語",
    tableMode: "表検出",
    oneSheetPerPage: "ページごとにシート",
    detectMerged: "結合セル検出",
    trim: "空白トリム",
    cleanData: "AIデータクリーンアップ",
    detectHeaders: "ヘッダー検出",
    numberFormat: "数値フォーマット",
    csvDelimiter: "CSV区切り",
    includeHeaders: "ヘッダー保持",
    includeFooters: "フッター保持",
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
  rowCount: number;
  sheetCount: number;
  ocrPages: number;
  ts: number;
}

const HISTORY_KEY = "toolnest-pdf-to-excel-history";
const SETTINGS_KEY = "toolnest-pdf-to-excel-settings";
const LANG_KEY = "toolnest-pdf-to-excel-lang";

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
const nextId = () => `pdf2xls-${Date.now()}-${++_idCounter}`;

export function PdfToExcel() {
  const favorites = useFavorites();
  const slug = "pdf-to-excel";

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
    const totalRows = items.reduce((s, i) => s + (i.result?.rowCount ?? 0), 0);
    const totalOcr = items.reduce((s, i) => s + (i.result?.ocrPages ?? 0), 0);
    return { total, done, totalOriginal, totalConverted, totalRows, totalOcr };
  }, [items]);

  const duplicates = useMemo(() => {
    const previewItem = items[previewIndex];
    if (!previewItem?.pages?.length) return [];
    return findDuplicateRows(previewItem.pages);
  }, [items, previewIndex]);

  const applySmart = () => {
    setOptions((o) => ({
      ...o,
      outputFormat: "xlsx",
      tableMode: "auto",
      detectMergedCells: true,
      detectHeaders: true,
      cleanData: true,
      numberFormat: true,
      ocrMode: "scanned-only",
      oneSheetPerPage: false,
      includeHeaders: true,
      includeFooters: true,
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
          id: i.id, name: i.name, format: i.result!.format,
          originalBytes: i.originalBytes, convertedBytes: i.result!.bytes,
          pageCount: i.result!.pageCount, rowCount: i.result!.rowCount,
          sheetCount: i.result!.sheetCount, ocrPages: i.result!.ocrPages, ts: Date.now(),
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
          updated.forEach((i) => { if (i.result) zip.file(buildOutputName(i.name, i.result.format), i.result.blob); });
          const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
          downloadBlob(blob, "toolnest-converted-excel.zip");
        }
        toast.success(`Done — ${newEntries.length} spreadsheet(s)`);
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
      const result = await convertPdfToExcel(item.file, options, setProgress);
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, result, status: "done", pages: result.previewUrl ? p.pages : p.pages } : p)));
      // Re-parse to populate preview pages
      setHistory((h) => {
        const entry: HistoryEntry = {
          id: item.id, name: item.name, format: result.format,
          originalBytes: item.originalBytes, convertedBytes: result.bytes,
          pageCount: result.pageCount, rowCount: result.rowCount,
          sheetCount: result.sheetCount, ocrPages: result.ocrPages, ts: Date.now(),
        };
        const next = [entry, ...h].slice(0, 50);
        saveHistory(next);
        return next;
      });
      downloadBlob(result.blob, buildOutputName(item.name, result.format));
      toast.success(`Converted · ${result.rowCount} rows · ${result.sheetCount} sheet(s)`);
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
    setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, encrypted: false } : p)));
    await convertOne({ ...item, encrypted: false });
  };

  const previewItem = items[previewIndex];
  const previewPages: PageContent[] = previewItem?.pages ?? [];
  const currentPreviewPage = previewPages[pagePreviewIndex];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Lock className="h-3.5 w-3.5" /> 100% private · in-browser
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
            <TableIcon className="h-3.5 w-3.5 text-primary" /> AI table detection
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
          { label: "Rows", value: stats.totalRows.toLocaleString(), color: "text-amber-400" },
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
          <FileSpreadsheet className="mb-4 h-14 w-14 text-primary" />
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

      {showSmart && items.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="flex items-center gap-2 font-medium text-primary">
                  {t("smart")}
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                    XLSX · auto table · OCR scanned
                  </span>
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
                  <li>AI detects tables by clustering text into rows & columns — pick <strong>Grid</strong> for tabular PDFs, <strong>Lines</strong> for paragraph-only pages.</li>
                  <li>Merged-cell detection spans column boundaries for headers and grouped cells.</li>
                  <li>Header rows are bolded and shaded; numeric cells get <code>#,#0.00</code> format; formulas (starting with <code>=</code>) are preserved.</li>
                  <li>For scanned PDFs, enable OCR — Tesseract feeds word bounding boxes into the same table engine.</li>
                  <li>Duplicate-row detector flags repeated rows across pages for data cleanup.</li>
                </ul>
                <div className="mt-3">
                  <Button size="sm" variant="gradient" onClick={applySmart}>
                    <Zap className="h-3.5 w-3.5" /> {t("apply")}
                  </Button>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => setShowSmart(false)} className="text-muted hover:text-foreground" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

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
            downloadBlob(blob, "toolnest-converted-excel.zip");
          }}>
            <FileArchive className="h-4 w-4" /> {t("batchZip")}
          </Button>
          <Button variant="outline" onClick={() => setShowSettings((s) => !s)}>
            <Settings2 className="h-4 w-4" /> {t("settings")}
          </Button>
        </div>
      )}

      {showSettings && items.length > 0 && (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("format")}>
            <select
              value={options.outputFormat}
              onChange={(e) => setOptions((o) => ({ ...o, outputFormat: e.target.value as OutputFormat }))}
              className={inputClass()}
            >
              <option value="xlsx">XLSX — Excel, full fidelity</option>
              <option value="csv">CSV — RFC 4180, UTF-8 BOM</option>
              <option value="xls">XLS — Excel-compatible HTML</option>
              <option value="ods">ODS — OpenDocument Spreadsheet</option>
            </select>
          </Field>
          <Field label={t("tableMode")}>
            <select
              value={options.tableMode}
              onChange={(e) => setOptions((o) => ({ ...o, tableMode: e.target.value as ConvertOptions["tableMode"] }))}
              className={inputClass()}
            >
              <option value="auto">Auto (grid or lines)</option>
              <option value="grid">Grid (multi-column tables)</option>
              <option value="lines">Lines (one column)</option>
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
          {options.outputFormat === "csv" && (
            <Field label={t("csvDelimiter")}>
              <select
                value={options.csvDelimiter}
                onChange={(e) => setOptions((o) => ({ ...o, csvDelimiter: e.target.value as ConvertOptions["csvDelimiter"] }))}
                className={inputClass()}
              >
                <option value=",">Comma ( , )</option>
                <option value=";">Semicolon ( ; )</option>
                <option value={"\t"}>Tab</option>
                <option value="|">Pipe ( | )</option>
              </select>
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.oneSheetPerPage} onChange={(e) => setOptions((o) => ({ ...o, oneSheetPerPage: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("oneSheetPerPage")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.detectMergedCells} onChange={(e) => setOptions((o) => ({ ...o, detectMergedCells: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("detectMerged")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.trimWhitespace} onChange={(e) => setOptions((o) => ({ ...o, trimWhitespace: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("trim")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.cleanData} onChange={(e) => setOptions((o) => ({ ...o, cleanData: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("cleanData")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.detectHeaders} onChange={(e) => setOptions((o) => ({ ...o, detectHeaders: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("detectHeaders")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={options.numberFormat} onChange={(e) => setOptions((o) => ({ ...o, numberFormat: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" />
            {t("numberFormat")}
          </label>
          <p className="text-xs text-muted sm:col-span-2 lg:col-span-3">
            OCR uses Tesseract.js loaded on-demand from CDN. First OCR run downloads the language model (~3-15 MB) and feeds word bounding boxes into the same table-detection engine.
          </p>
        </div>
      )}

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

      {items.length > 0 && (
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {([
            ["studio", t("studio"), FileSpreadsheet],
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
                  <FileSpreadsheet className="h-8 w-8 text-muted" />
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
                      {item.result.rowCount} rows · {item.result.sheetCount} sheet
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
                <button type="button" onClick={() => removeItem(item.id)} className="text-muted hover:text-error" aria-label={`Remove ${item.name}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
                <Stat label="Rows" value={previewItem.result.rowCount.toLocaleString()} />
                <Stat label="Sheets" value={String(previewItem.result.sheetCount)} accent />
                <Stat label="Size" value={formatBytes(previewItem.result.bytes)} />
              </div>
              {duplicates.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                  <p className="flex items-center gap-2 font-medium text-amber-500">
                    <ScanLine className="h-3.5 w-3.5" /> {duplicates.length} duplicate row{duplicates.length > 1 ? "s" : ""} detected — clean up in Excel after download.
                  </p>
                </div>
              )}
              {previewPages.length > 0 ? (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="mb-2 text-sm text-muted">Detected tables preview:</p>
                  <PageTablesPreview pages={previewPages} pageIndex={pagePreviewIndex} onPage={setPagePreviewIndex} />
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm text-muted">
                    Download the spreadsheet to view it in Excel. Run a preview-pass to populate on-page tables here.
                  </p>
                </div>
              )}
              <Button variant="gradient" onClick={() => downloadOne(previewItem)}>
                <Download className="h-4 w-4" /> Download .{previewItem.result.format}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
              <Eye className="mb-3 h-10 w-10 text-muted" />
              <p className="font-medium">Convert a PDF to see the table preview here.</p>
              {previewItem && (
                <Button className="mt-4" variant="gradient" disabled={busy} onClick={() => void convertOne(previewItem)}>
                  <Zap className="h-4 w-4" /> Convert this PDF
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "batch" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Files queued" value={String(items.length)} />
            <Stat label="Original total" value={formatBytes(stats.totalOriginal)} />
            <Stat label="Converted total" value={formatBytes(stats.totalConverted)} accent />
            <Stat label="Total rows" value={stats.totalRows.toLocaleString()} />
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
              downloadBlob(blob, "toolnest-converted-excel.zip");
            }}>
              <FileArchive className="h-4 w-4" /> Re-export ZIP
            </Button>
          </div>
        </div>
      )}

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
                    <p className="text-xs text-muted">{new Date(h.ts).toLocaleString()} · {h.format.toUpperCase()} · {h.pageCount}p · {h.rowCount} rows · {h.sheetCount} sheet</p>
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

      {tab === "api" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-medium"><Lock className="h-4 w-4 text-primary" /> POST /api/v1/pdf/to-excel</p>
          <p className="text-sm text-muted">
            Send a base64-encoded PDF with options. The server extracts tables via pdfjs-dist and
            renders XLSX via exceljs, CSV, ODS or XLS — perfect for CI/CD and backend automation.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/pdf/to-excel \\
  -H "Content-Type: application/json" \\
  -d '{
    "pdf": "data:application/pdf;base64,JVBERi0xLj...",
    "options": {
      "outputFormat": "xlsx",
      "pageRanges": "1-5",
      "password": "",
      "ocrMode": "scanned-only",
      "ocrLanguage": "eng",
      "tableMode": "auto",
      "detectMergedCells": true,
      "detectHeaders": true,
      "cleanData": true,
      "numberFormat": true,
      "oneSheetPerPage": false,
      "csvDelimiter": ","
    }
  }'`}</pre>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">Request body</p>
              <ul className="mt-2 list-inside list-disc text-muted">
                <li><code>pdf</code> — base64 or data URI</li>
                <li><code>options.outputFormat</code> — xlsx · csv · xls · ods</li>
                <li><code>options.tableMode</code> — auto · grid · lines</li>
                <li><code>options.pageRanges</code> — e.g. &quot;1-3, 5&quot;</li>
                <li><code>options.password</code> — for encrypted PDFs</li>
                <li><code>options.ocrMode</code> — scanned-only · auto · always · never</li>
                <li><code>options.csvDelimiter</code> — , ; \t |</li>
                <li><code>options.detectMergedCells</code> — boolean</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">Response</p>
              <pre className="mt-2 overflow-x-auto text-muted">{`{
  "ok": true,
  "output": "data:application/vnd.openxml...",
  "stats": {
    "originalBytes": 1024000,
    "convertedBytes": 215000,
    "pageCount": 12,
    "sheetCount": 1,
    "rowCount": 432,
    "cellCount": 2592,
    "ocrPages": 0,
    "format": "xlsx"
  }
}`}</pre>
            </div>
          </div>
          <p className="flex items-center gap-2 text-xs text-muted">
            <Check className="h-3.5 w-3.5 text-success" /> {t("cloudNote")}
          </p>
        </div>
      )}

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

function PageTablesPreview({
  pages,
  pageIndex,
  onPage,
}: {
  pages: PageContent[];
  pageIndex: number;
  onPage: (i: number) => void;
}) {
  const page = pages[pageIndex];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {pages.map((p, i) => (
          <button
            key={p.pageNumber}
            type="button"
            onClick={() => onPage(i)}
            className={cn(
              "rounded border px-2 py-1 text-xs",
              i === pageIndex ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50",
            )}
          >
            Page {p.pageNumber}
          </button>
        ))}
      </div>
      {page && page.tables.length > 0 ? (
        <div className="space-y-3">
          {page.tables.map((table, ti) => (
            <div key={ti} className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-xs">
                <tbody>
                  {table.rows.slice(0, 50).map((row, ri) => (
                    <tr key={ri} className={row[0]?.isHeader ? "bg-primary/5 font-medium" : ""}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={cn(
                            "border border-border px-2 py-1 align-top",
                            cell.isHeader && "font-bold",
                            cell.isNumber && "text-right tabular-nums",
                          )}
                          colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                          rowSpan={cell.rowSpan > 1 ? cell.rowSpan : undefined}
                        >
                          {cell.text || <span className="text-muted">·</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border bg-card-hover px-2 py-1 text-[10px] text-muted">
                {table.rowCount} rows × {table.colCount} cols · page {table.page}
                {table.ocrConfidence !== null && ` · OCR ${table.ocrConfidence}%`}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">No tables detected on this page.</p>
      )}
    </div>
  );
}
