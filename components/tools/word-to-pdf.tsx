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
  Loader2,
  Lock,
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
  ACCEPT_EXTENSIONS,
  DEFAULT_WORD_TO_PDF_OPTIONS,
  PAGE_SIZES,
  buildPdfOutputName,
  buildPreviewText,
  convertWordBatch,
  convertWordToPdf,
  detectWordFormat,
  smartWordToPdfSuggestions,
  type ConvertItem,
  type WordToPdfOptions,
} from "./word-to-pdf-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    drop: "Drop Word files, paste, or click to browse",
    dropHint: "DOCX, DOC, RTF, ODT & TXT → PDF · layout, tables, images · 100% in-browser",
    addFiles: "Add files",
    addFolder: "Add folder",
    paste: "Paste from clipboard",
    convert: "Convert to PDF",
    preview: "Preview PDF",
    settings: "Settings",
    clear: "Clear all",
    batchZip: "Download all as ZIP",
    pageSize: "Page size",
    margins: "Margins (pt)",
    fontSize: "Base font size",
    password: "PDF open password",
    ownerPassword: "Owner password (optional)",
    watermark: "Watermark text",
    pdfA: "PDF/A metadata intent",
    merge: "Merge batch into one PDF",
    header: "Header text",
    footer: "Footer text",
    signature: "Signature label",
    hyperlinks: "Preserve hyperlinks",
    pageNumbers: "Page numbers",
    compression: "Compression",
    smart: "Smart conversion assist",
    apply: "Apply recommended",
    studio: "Studio",
    compare: "Preview",
    batch: "Batch",
    history: "History",
    api: "API",
    emptyHistory: "No conversions yet — your history will appear here.",
    cloudNote: "Documents are processed in your browser. The REST API sends data only when you call it.",
  },
  es: {
    drop: "Suelta archivos Word, pega o haz clic",
    dropHint: "DOCX, DOC, RTF, ODT y TXT → PDF — 100% en el navegador",
    addFiles: "Añadir archivos",
    addFolder: "Añadir carpeta",
    paste: "Pegar del portapapeles",
    convert: "Convertir a PDF",
    preview: "Vista previa PDF",
    settings: "Ajustes",
    clear: "Limpiar todo",
    batchZip: "Descargar como ZIP",
    pageSize: "Tamaño de página",
    margins: "Márgenes (pt)",
    fontSize: "Tamaño de fuente",
    password: "Contraseña de apertura",
    ownerPassword: "Contraseña de propietario",
    watermark: "Texto de marca de agua",
    pdfA: "Metadatos PDF/A",
    merge: "Combinar lote en un PDF",
    header: "Texto de encabezado",
    footer: "Texto de pie",
    signature: "Etiqueta de firma",
    hyperlinks: "Conservar hipervínculos",
    pageNumbers: "Números de página",
    compression: "Compresión",
    smart: "Asistente de conversión",
    apply: "Aplicar recomendado",
    studio: "Estudio",
    compare: "Vista",
    batch: "Lote",
    history: "Historial",
    api: "API",
    emptyHistory: "Aún no hay conversiones.",
    cloudNote: "Los documentos se procesan en tu navegador.",
  },
  de: {
    drop: "Word-Dateien ablegen, einfügen oder klicken",
    dropHint: "DOCX, DOC, RTF, ODT & TXT → PDF — 100% im Browser",
    addFiles: "Dateien hinzufügen",
    addFolder: "Ordner",
    paste: "Aus Zwischenablage",
    convert: "Zu PDF konvertieren",
    preview: "PDF-Vorschau",
    settings: "Einstellungen",
    clear: "Alles löschen",
    batchZip: "Als ZIP herunterladen",
    pageSize: "Seitengröße",
    margins: "Ränder (pt)",
    fontSize: "Schriftgröße",
    password: "PDF-Passwort",
    ownerPassword: "Besitzer-Passwort",
    watermark: "Wasserzeichen",
    pdfA: "PDF/A-Metadaten",
    merge: "Stapel zu einem PDF zusammenführen",
    header: "Kopfzeile",
    footer: "Fußzeile",
    signature: "Signatur-Label",
    hyperlinks: "Hyperlinks erhalten",
    pageNumbers: "Seitenzahlen",
    compression: "Komprimierung",
    smart: "Konvertierungsassistent",
    apply: "Empfehlung anwenden",
    studio: "Studio",
    compare: "Vorschau",
    batch: "Stapel",
    history: "Verlauf",
    api: "API",
    emptyHistory: "Noch keine Konvertierungen.",
    cloudNote: "Dokumente werden im Browser verarbeitet.",
  },
  fr: {
    drop: "Déposez vos fichiers Word, collez ou cliquez",
    dropHint: "DOCX, DOC, RTF, ODT & TXT → PDF — 100% dans le navigateur",
    addFiles: "Ajouter des fichiers",
    addFolder: "Dossier",
    paste: "Coller",
    convert: "Convertir en PDF",
    preview: "Aperçu PDF",
    settings: "Réglages",
    clear: "Tout effacer",
    batchZip: "Télécharger en ZIP",
    pageSize: "Format de page",
    margins: "Marges (pt)",
    fontSize: "Taille de police",
    password: "Mot de passe PDF",
    ownerPassword: "Mot de passe propriétaire",
    watermark: "Filigrane",
    pdfA: "Métadonnées PDF/A",
    merge: "Fusionner le lot en un PDF",
    header: "En-tête",
    footer: "Pied de page",
    signature: "Libellé signature",
    hyperlinks: "Préserver les liens",
    pageNumbers: "Numéros de page",
    compression: "Compression",
    smart: "Assistant de conversion",
    apply: "Appliquer recommandation",
    studio: "Studio",
    compare: "Aperçu",
    batch: "Lot",
    history: "Historique",
    api: "API",
    emptyHistory: "Aucune conversion.",
    cloudNote: "Documents traités dans le navigateur.",
  },
  tr: {
    drop: "Word dosyalarını sürükleyin, yapıştırın veya tıklayın",
    dropHint: "DOCX, DOC, RTF, ODT ve TXT → PDF — %100 tarayıcıda",
    addFiles: "Dosya ekle",
    addFolder: "Klasör",
    paste: "Panodan yapıştır",
    convert: "PDF'e dönüştür",
    preview: "PDF önizleme",
    settings: "Ayarlar",
    clear: "Tümünü temizle",
    batchZip: "ZIP olarak indir",
    pageSize: "Sayfa boyutu",
    margins: "Kenar boşlukları (pt)",
    fontSize: "Yazı boyutu",
    password: "PDF açma şifresi",
    ownerPassword: "Sahip şifresi",
    watermark: "Filigran metni",
    pdfA: "PDF/A meta verisi",
    merge: "Toplu işlemi tek PDF'te birleştir",
    header: "Üstbilgi",
    footer: "Altbilgi",
    signature: "İmza etiketi",
    hyperlinks: "Köprüleri koru",
    pageNumbers: "Sayfa numaraları",
    compression: "Sıkıştırma",
    smart: "Dönüşüm asistanı",
    apply: "Öneriyi uygula",
    studio: "Stüdyo",
    compare: "Önizleme",
    batch: "Toplu",
    history: "Geçmiş",
    api: "API",
    emptyHistory: "Henüz dönüşüm yok.",
    cloudNote: "Belgeler tarayıcıda işlenir.",
  },
  hi: {
    drop: "Word फ़ाइलें छोड़ें, पेस्ट करें या ब्राउज़ करें",
    dropHint: "DOCX, DOC, RTF, ODT और TXT → PDF — 100% ब्राउज़र में",
    addFiles: "फ़ाइल जोड़ें",
    addFolder: "फ़ोल्डर",
    paste: "क्लिपबोर्ड से पेस्ट",
    convert: "PDF में बदलें",
    preview: "PDF पूर्वावलोकन",
    settings: "सेटिंग्स",
    clear: "सभी साफ़ करें",
    batchZip: "ZIP डाउनलोड",
    pageSize: "पृष्ठ आकार",
    margins: "मार्जिन (pt)",
    fontSize: "फ़ॉन्ट आकार",
    password: "PDF पासवर्ड",
    ownerPassword: "मालिक पासवर्ड",
    watermark: "वॉटरमार्क",
    pdfA: "PDF/A मेटाडेटा",
    merge: "बैच को एक PDF में मर्ज करें",
    header: "हेडर",
    footer: "फुटर",
    signature: "हस्ताक्षर लेबल",
    hyperlinks: "हाइपरलिंक रखें",
    pageNumbers: "पृष्ठ संख्या",
    compression: "संपीड़न",
    smart: "स्मार्ट सहायक",
    apply: "अनुशंसित लागू करें",
    studio: "स्टूडियो",
    compare: "पूर्वावलोकन",
    batch: "बैच",
    history: "इतिहास",
    api: "API",
    emptyHistory: "अभी कोई रूपांतरण नहीं।",
    cloudNote: "दस्तावेज़ ब्राउज़र में संसाधित होते हैं।",
  },
  pt: {
    drop: "Solte arquivos Word, cole ou clique",
    dropHint: "DOCX, DOC, RTF, ODT e TXT → PDF — 100% no navegador",
    addFiles: "Adicionar arquivos",
    addFolder: "Pasta",
    paste: "Colar da área de transferência",
    convert: "Converter para PDF",
    preview: "Pré-visualizar PDF",
    settings: "Configurações",
    clear: "Limpar tudo",
    batchZip: "Baixar como ZIP",
    pageSize: "Tamanho da página",
    margins: "Margens (pt)",
    fontSize: "Tamanho da fonte",
    password: "Senha do PDF",
    ownerPassword: "Senha do proprietário",
    watermark: "Marca d'água",
    pdfA: "Metadados PDF/A",
    merge: "Mesclar lote em um PDF",
    header: "Cabeçalho",
    footer: "Rodapé",
    signature: "Rótulo de assinatura",
    hyperlinks: "Preservar hiperlinks",
    pageNumbers: "Números de página",
    compression: "Compressão",
    smart: "Assistente de conversão",
    apply: "Aplicar recomendado",
    studio: "Estúdio",
    compare: "Pré-visualização",
    batch: "Lote",
    history: "Histórico",
    api: "API",
    emptyHistory: "Ainda nenhuma conversão.",
    cloudNote: "Documentos processados no navegador.",
  },
  ja: {
    drop: "Wordファイルをドロップ、ペースト、またはクリック",
    dropHint: "DOCX/DOC/RTF/ODT/TXT → PDF — 100%ブラウザ内",
    addFiles: "ファイル追加",
    addFolder: "フォルダ",
    paste: "クリップボードから",
    convert: "PDFに変換",
    preview: "PDFプレビュー",
    settings: "設定",
    clear: "すべて消去",
    batchZip: "ZIPで一括",
    pageSize: "ページサイズ",
    margins: "余白 (pt)",
    fontSize: "フォントサイズ",
    password: "PDFパスワード",
    ownerPassword: "所有者パスワード",
    watermark: "透かし",
    pdfA: "PDF/Aメタデータ",
    merge: "バッチを1つのPDFに結合",
    header: "ヘッダー",
    footer: "フッター",
    signature: "署名ラベル",
    hyperlinks: "ハイパーリンク保持",
    pageNumbers: "ページ番号",
    compression: "圧縮",
    smart: "スマート変換",
    apply: "推奨を適用",
    studio: "スタジオ",
    compare: "プレビュー",
    batch: "バッチ",
    history: "履歴",
    api: "API",
    emptyHistory: "まだ変換なし。",
    cloudNote: "ドキュメントはブラウザで処理されます。",
  },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français",
  tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

interface HistoryEntry {
  id: string;
  name: string;
  format: string;
  originalBytes: number;
  convertedBytes: number;
  pageCount: number;
  wordCount: number;
  ts: number;
}

const HISTORY_KEY = "toolnest-word-to-pdf-history";
const SETTINGS_KEY = "toolnest-word-to-pdf-settings";
const LANG_KEY = "toolnest-word-to-pdf-lang";

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

type Tab = "studio" | "compare" | "batch" | "history" | "api";

let _idCounter = 0;
const nextId = () => `w2pdf-${Date.now()}-${++_idCounter}`;

const EXT_OK = /\.(docx?|rtf|odt|txt|md)$/i;

export function WordToPdf() {
  const favorites = useFavorites();
  const slug = "word-to-pdf";

  const [items, setItems] = useState<ConvertItem[]>([]);
  const [tab, setTab] = useState<Tab>("studio");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showSmart, setShowSmart] = useState(true);
  const [lang, setLang] = useState<Lang>("en");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [mergedResult, setMergedResult] = useState<{ blob: Blob; previewUrl: string } | null>(null);

  const [options, setOptions] = useState<WordToPdfOptions>(DEFAULT_WORD_TO_PDF_OPTIONS);

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
    items.forEach((i) => i.result?.previewUrl && URL.revokeObjectURL(i.result.previewUrl));
    if (mergedResult?.previewUrl) URL.revokeObjectURL(mergedResult.previewUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const accepted: ConvertItem[] = [];
    for (const file of files) {
      if (!EXT_OK.test(file.name) && !file.type.includes("word") && !file.type.includes("opendocument") && !file.type.includes("rtf") && file.type !== "text/plain") {
        toast.error(`Unsupported: ${file.name}`);
        continue;
      }
      const format = detectWordFormat(file);
      const previewText = await buildPreviewText(file);
      accepted.push({
        id: nextId(),
        file,
        name: file.name,
        originalBytes: file.size,
        format,
        status: "queued",
        result: null,
        previewText,
      });
    }
    if (accepted.length) {
      setItems((prev) => [...prev, ...accepted]);
      toast.success(`${accepted.length} document(s) added`);
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
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { toast.error("Clipboard is empty"); return; }
      const blob = new Blob([text], { type: "text/plain" });
      const file = new File([blob], `pasted-${Date.now()}.txt`, { type: "text/plain" });
      void addFiles([file]);
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
    const totalPages = items.reduce((s, i) => s + (i.result?.pageCount ?? 0), 0);
    return { total, done, totalOriginal, totalConverted, totalWords, totalPages };
  }, [items]);

  const suggestions = useMemo(() => smartWordToPdfSuggestions(items, options), [items, options]);

  const applySmart = () => {
    setOptions((o) => ({
      ...o,
      pageSize: "a4",
      marginTop: 56,
      marginRight: 56,
      marginBottom: 56,
      marginLeft: 56,
      preserveHyperlinks: true,
      includePageNumbers: true,
      includeBookmarks: true,
      compression: "medium",
    }));
    toast.success("Smart settings applied");
  };

  const runConvertAll = useCallback(async (autoDownload: boolean) => {
    if (!items.length) { toast.error("Add documents first"); return; }
    setBusy(true);
    setProgress(0);
    setMergedResult(null);
    try {
      const files = items.map((i) => i.file);
      setItems((prev) => prev.map((p) => ({ ...p, status: "converting" as const })));

      const { items: results, merged } = await convertWordBatch(files, options, (idx, total) => {
        setProgress(Math.round((idx / total) * 100));
      });

      const updated = items.map((item, i) => ({
        ...item,
        status: "done" as const,
        result: results[i] ?? null,
        error: results[i] ? undefined : "Conversion failed",
      }));
      setItems(updated);

      if (merged) {
        setMergedResult({ blob: merged.blob, previewUrl: merged.previewUrl });
      }

      const newEntries: HistoryEntry[] = updated
        .filter((i) => i.result)
        .map((i) => ({
          id: i.id,
          name: i.name,
          format: i.format,
          originalBytes: i.originalBytes,
          convertedBytes: i.result!.bytes,
          pageCount: i.result!.pageCount,
          wordCount: i.result!.wordCount,
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
        if (merged && options.mergeBatch) {
          downloadBlob(merged.blob, buildPdfOutputName("merged-document"));
        } else if (updated.length === 1 && updated[0].result) {
          downloadBlob(updated[0].result.blob, buildPdfOutputName(updated[0].name));
        } else {
          const JSZip = (await import("jszip")).default;
          const zip = new JSZip();
          updated.forEach((i) => {
            if (i.result) zip.file(buildPdfOutputName(i.name), i.result.blob);
          });
          const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
          downloadBlob(blob, "toolnest-word-to-pdf.zip");
        }
        toast.success(`Done — ${newEntries.length} PDF(s)`);
      } else {
        setTab("compare");
        toast.success("Conversion ready — view Preview tab");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Conversion failed");
      setItems((prev) => prev.map((p) => ({ ...p, status: "error" as const, error: e instanceof Error ? e.message : "Failed" })));
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, [items, options]);

  const convertOne = useCallback(async (item: ConvertItem) => {
    setBusy(true);
    setProgress(0);
    try {
      const result = await convertWordToPdf(item.file, options, setProgress);
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, result, status: "done" } : p)));
      setHistory((h) => {
        const entry: HistoryEntry = {
          id: item.id, name: item.name, format: item.format,
          originalBytes: item.originalBytes, convertedBytes: result.bytes,
          pageCount: result.pageCount, wordCount: result.wordCount, ts: Date.now(),
        };
        const next = [entry, ...h].slice(0, 50);
        saveHistory(next);
        return next;
      });
      downloadBlob(result.blob, buildPdfOutputName(item.name));
      toast.success(`Converted · ${result.pageCount} pages · ${result.wordCount} words`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Conversion failed";
      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: "error", error: msg } : p)));
      toast.error(msg);
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, [options]);

  const removeItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.result?.previewUrl) URL.revokeObjectURL(item.result.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearAll = () => {
    items.forEach((i) => i.result?.previewUrl && URL.revokeObjectURL(i.result.previewUrl));
    if (mergedResult?.previewUrl) URL.revokeObjectURL(mergedResult.previewUrl);
    setItems([]);
    setMergedResult(null);
  };

  const previewItem = items[previewIndex];
  const previewUrl = mergedResult?.previewUrl ?? previewItem?.result?.previewUrl;

  const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "studio", label: t("studio"), icon: FileText },
    { id: "compare", label: t("compare"), icon: Eye },
    { id: "batch", label: t("batch"), icon: FileArchive },
    { id: "history", label: t("history"), icon: History },
    { id: "api", label: t("api"), icon: Sparkles },
  ];

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                tab === id ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => favorites.toggle(slug)}
            className="rounded-lg border border-border p-2 hover:bg-muted/50"
            aria-label="Favorite"
          >
            <Star className={cn("h-4 w-4", favorites.isFavorite(slug) ? "fill-amber-400 text-amber-400" : "text-muted")} />
          </button>
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
            onClick={() => setShowSettings((s) => !s)}
            className={cn("rounded-lg border border-border p-2 hover:bg-muted/50", showSettings && "bg-muted")}
            aria-label={t("settings")}
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Smart assist */}
      {showSmart && suggestions.length > 0 && tab === "studio" && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("smart")}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={applySmart}>{t("apply")}</Button>
              <button type="button" onClick={() => setShowSmart(false)} aria-label="Dismiss"><X className="h-4 w-4 text-muted" /></button>
            </div>
          </div>
          <ul className="space-y-1 text-sm text-muted">
            {suggestions.map((s, i) => <li key={i}>• {s}</li>)}
          </ul>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("pageSize")}>
            <select value={options.pageSize} onChange={(e) => setOptions((o) => ({ ...o, pageSize: e.target.value as WordToPdfOptions["pageSize"] }))} className={inputClass()}>
              <option value="a4">A4 ({PAGE_SIZES.a4[0].toFixed(0)}×{PAGE_SIZES.a4[1].toFixed(0)} pt)</option>
              <option value="letter">Letter</option>
              <option value="legal">Legal</option>
            </select>
          </Field>
          <Field label={t("fontSize")}>
            <input type="number" min={8} max={24} value={options.fontSize} onChange={(e) => setOptions((o) => ({ ...o, fontSize: +e.target.value }))} className={inputClass()} />
          </Field>
          <Field label={t("compression")}>
            <select value={options.compression} onChange={(e) => setOptions((o) => ({ ...o, compression: e.target.value as WordToPdfOptions["compression"] }))} className={inputClass()}>
              <option value="none">None</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label={`${t("margins")} — top`}>
            <input type="number" min={0} max={144} value={options.marginTop} onChange={(e) => setOptions((o) => ({ ...o, marginTop: +e.target.value }))} className={inputClass()} />
          </Field>
          <Field label={`${t("margins")} — right`}>
            <input type="number" min={0} max={144} value={options.marginRight} onChange={(e) => setOptions((o) => ({ ...o, marginRight: +e.target.value }))} className={inputClass()} />
          </Field>
          <Field label={`${t("margins")} — bottom`}>
            <input type="number" min={0} max={144} value={options.marginBottom} onChange={(e) => setOptions((o) => ({ ...o, marginBottom: +e.target.value }))} className={inputClass()} />
          </Field>
          <Field label={`${t("margins")} — left`}>
            <input type="number" min={0} max={144} value={options.marginLeft} onChange={(e) => setOptions((o) => ({ ...o, marginLeft: +e.target.value }))} className={inputClass()} />
          </Field>
          <Field label={t("header")}>
            <input value={options.headerText} onChange={(e) => setOptions((o) => ({ ...o, headerText: e.target.value }))} className={inputClass()} placeholder="Optional header" />
          </Field>
          <Field label={t("footer")}>
            <input value={options.footerText} onChange={(e) => setOptions((o) => ({ ...o, footerText: e.target.value }))} className={inputClass()} placeholder="Optional footer" />
          </Field>
          <Field label={t("watermark")}>
            <input value={options.watermark} onChange={(e) => setOptions((o) => ({ ...o, watermark: e.target.value }))} className={inputClass()} placeholder="CONFIDENTIAL" />
          </Field>
          <Field label={t("password")}>
            <input type="password" value={options.userPassword} onChange={(e) => setOptions((o) => ({ ...o, userPassword: e.target.value }))} className={inputClass()} autoComplete="new-password" />
          </Field>
          <Field label={t("ownerPassword")}>
            <input type="password" value={options.ownerPassword} onChange={(e) => setOptions((o) => ({ ...o, ownerPassword: e.target.value }))} className={inputClass()} autoComplete="new-password" />
          </Field>
          <Field label={t("signature")}>
            <input value={options.signatureLabel} onChange={(e) => setOptions((o) => ({ ...o, signatureLabel: e.target.value }))} className={inputClass()} placeholder="Signed by …" />
          </Field>
          <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={options.preserveHyperlinks} onChange={(e) => setOptions((o) => ({ ...o, preserveHyperlinks: e.target.checked }))} />
              {t("hyperlinks")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={options.includePageNumbers} onChange={(e) => setOptions((o) => ({ ...o, includePageNumbers: e.target.checked }))} />
              {t("pageNumbers")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={options.pdfA} onChange={(e) => setOptions((o) => ({ ...o, pdfA: e.target.checked }))} />
              {t("pdfA")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={options.mergeBatch} onChange={(e) => setOptions((o) => ({ ...o, mergeBatch: e.target.checked }))} />
              {t("merge")}
            </label>
          </div>
        </div>
      )}

      {/* Studio tab */}
      {tab === "studio" && (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "relative rounded-2xl border-2 border-dashed p-8 text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border bg-card/50",
            )}
          >
            <UploadCloud className="mx-auto mb-3 h-10 w-10 text-muted" />
            <p className="font-medium">{t("drop")}</p>
            <p className="mt-1 text-sm text-muted">{t("dropHint")}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={() => fileInputRef.current?.click()}>{t("addFiles")}</Button>
              <Button type="button" variant="outline" onClick={() => folderInputRef.current?.click()}>
                <FolderUp className="mr-1.5 h-4 w-4" />{t("addFolder")}
              </Button>
              <Button type="button" variant="outline" onClick={() => void onPaste()}>
                <ClipboardPaste className="mr-1.5 h-4 w-4" />{t("paste")}
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept={ACCEPT_EXTENSIONS} multiple className="hidden" onChange={onInputChange} />
            <input ref={folderInputRef} type="file" accept={ACCEPT_EXTENSIONS} multiple {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} className="hidden" onChange={onInputChange} />
          </div>

          {items.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: "Files", value: stats.total },
                  { label: "Done", value: stats.done },
                  { label: "Words", value: stats.totalWords.toLocaleString() },
                  { label: "Pages", value: stats.totalPages },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-border bg-card px-3 py-2 text-center">
                    <p className="text-lg font-semibold tabular-nums">{value}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
                  </div>
                ))}
              </div>

              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <FileText className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-xs text-muted">
                        {item.format.toUpperCase()} · {formatBytes(item.originalBytes)}
                        {item.result && ` → ${formatBytes(item.result.bytes)} · ${item.result.pageCount} pg`}
                        {item.error && <span className="text-destructive"> · {item.error}</span>}
                      </p>
                      {item.previewText && !item.result && (
                        <p className="mt-1 truncate text-xs text-muted/80">{item.previewText.slice(0, 120)}…</p>
                      )}
                    </div>
                    {item.status === "converting" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {item.status === "done" && item.result && (
                      <Button size="sm" variant="outline" onClick={() => downloadBlob(item.result!.blob, buildPdfOutputName(item.name))}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <button type="button" onClick={() => convertOne(item)} disabled={busy} className="text-xs text-primary hover:underline">1×</button>
                    <button type="button" onClick={() => removeItem(item.id)} aria-label="Remove"><Trash2 className="h-4 w-4 text-muted hover:text-destructive" /></button>
                  </li>
                ))}
              </ul>

              {busy && (
                <div className="space-y-1">
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-center text-xs text-muted">{progress}%</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void runConvertAll(true)} disabled={busy}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                  {t("convert")}
                </Button>
                <Button variant="outline" onClick={() => void runConvertAll(false)} disabled={busy}>{t("preview")}</Button>
                <Button variant="ghost" onClick={clearAll} disabled={busy}>{t("clear")}</Button>
              </div>
            </>
          )}

          <p className="flex items-center gap-2 text-xs text-muted">
            <Lock className="h-3 w-3" />
            {t("cloudNote")}
          </p>
        </>
      )}

      {/* Preview tab */}
      {tab === "compare" && (
        <div className="space-y-4">
          {items.length > 1 && !mergedResult && (
            <select value={previewIndex} onChange={(e) => setPreviewIndex(+e.target.value)} className={inputClass()}>
              {items.map((item, i) => (
                <option key={item.id} value={i}>{item.name}</option>
              ))}
            </select>
          )}
          {previewUrl ? (
            <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
              <iframe src={previewUrl} title="PDF preview" className="h-[70vh] w-full" />
            </div>
          ) : (
            <p className="py-12 text-center text-muted">Convert documents first to preview PDF output.</p>
          )}
          {previewUrl && (
            <Button onClick={() => {
              const blob = mergedResult?.blob ?? previewItem?.result?.blob;
              if (blob) downloadBlob(blob, buildPdfOutputName(previewItem?.name ?? "document"));
            }}>
              <Download className="mr-2 h-4 w-4" />Download PDF
            </Button>
          )}
        </div>
      )}

      {/* Batch tab */}
      {tab === "batch" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Batch-convert multiple Word documents. Enable &quot;Merge batch&quot; in Settings to combine into one PDF, or download individual PDFs as ZIP.</p>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="font-medium">{items.length} file(s) queued · {formatBytes(stats.totalOriginal)} total</p>
            <div className="mt-3 flex gap-2">
              <Button onClick={() => void runConvertAll(true)} disabled={!items.length || busy}>{t("convert")}</Button>
              <Button variant="outline" disabled={!stats.done} onClick={async () => {
                const JSZip = (await import("jszip")).default;
                const zip = new JSZip();
                items.forEach((i) => { if (i.result) zip.file(buildPdfOutputName(i.name), i.result.blob); });
                downloadBlob(await zip.generateAsync({ type: "blob" }), "toolnest-word-to-pdf.zip");
              }}>
                <FileArchive className="mr-2 h-4 w-4" />{t("batchZip")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="py-8 text-center text-muted">{t("emptyHistory")}</p>
          ) : (
            history.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                <div>
                  <p className="font-medium">{h.name}</p>
                  <p className="text-xs text-muted">
                    {h.format.toUpperCase()} · {formatBytes(h.originalBytes)} → {formatBytes(h.convertedBytes)} · {h.pageCount} pg · {h.wordCount} words
                  </p>
                </div>
                <span className="text-xs text-muted">{new Date(h.ts).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* API tab */}
      {tab === "api" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4 font-mono text-sm">
          <p className="font-sans text-muted">Convert Word documents programmatically via REST API.</p>
          <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs">{`POST /api/v1/pdf/word-to-pdf
Content-Type: application/json

{
  "document": "<base64 or data URI>",
  "filename": "report.docx",
  "options": {
    "pageSize": "a4",
    "userPassword": "",
    "watermark": "DRAFT",
    "mergeBatch": false
  }
}`}</pre>
          <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs">{`// Response
{
  "ok": true,
  "output": "data:application/pdf;base64,...",
  "stats": { "pageCount": 12, "wordCount": 3400, "convertedBytes": 89000 }
}`}</pre>
          <p className="font-sans text-xs text-muted">Max 25 MB per document. Legacy .doc binary format not supported server-side.</p>
        </div>
      )}
    </div>
  );
}
