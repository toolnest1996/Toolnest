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
  AlertTriangle,
  Check,
  ClipboardCopy,
  Download,
  FileArchive,
  History,
  ImagePlus,
  Info,
  Languages,
  Loader2,
  Palette,
  QrCode,
  ScanLine,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  CONTENT_CATEGORIES,
  CONTENT_TYPE_LABELS,
  DEFAULT_DESIGN,
  DEFAULT_FIELDS,
  DESIGN_PRESETS,
  aiRecommend,
  analyzeQr,
  buildEncodedPayload,
  bulkRenderZip,
  exportCanvas,
  exportSvgString,
  parseBulkCsv,
  renderQr,
  testScanFromCanvas,
  type ExportFormat,
  type QrContentFields,
  type QrContentType,
  type QrDesign,
  type QrPayload,
  type ScanTestResult,
} from "./qr-generator-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";
type Tab = "studio" | "design" | "bulk" | "history" | "api";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", design: "Design", bulk: "Bulk", history: "History", api: "API",
    contentType: "Content type", generate: "Generate", download: "Download",
    copyPayload: "Copy payload", copied: "Copied!", scanTest: "Scan test",
    scanOk: "Scan verified", scanFail: "Scan mismatch", scanUnsupported: "Use phone camera to test",
    export: "Export", preset: "Template", ai: "AI design tips", apply: "Apply",
    favorite: "Favorite", favorited: "Favorited", private: "100% private · generated in-browser",
    emptyHistory: "No QR codes saved yet.", bulkImport: "Import CSV", bulkZip: "Download ZIP",
    logo: "Logo overlay", logoHint: "PNG/JPG · max 25% area recommended",
    foreground: "Foreground", background: "Background", transparent: "Transparent background",
    gradient: "Gradient", ec: "Error correction", margin: "Margin", size: "Export size",
    moduleStyle: "Module style", eyeStyle: "Eye style", frame: "Frame",
    clear: "Clear",
  },
  es: { studio: "Estudio", design: "Diseño", bulk: "Lote", history: "Historial", api: "API", contentType: "Tipo", generate: "Generar", download: "Descargar", copyPayload: "Copiar payload", copied: "¡Copiado!", scanTest: "Probar escaneo", scanOk: "Escaneo verificado", scanFail: "No coincide", scanUnsupported: "Usa la cámara del móvil", export: "Exportar", preset: "Plantilla", ai: "Consejos IA", apply: "Aplicar", favorite: "Favorito", favorited: "Favorito", private: "100% privado · en navegador", emptyHistory: "Sin códigos QR.", bulkImport: "Importar CSV", bulkZip: "Descargar ZIP", logo: "Logo", logoHint: "PNG/JPG", foreground: "Primer plano", background: "Fondo", transparent: "Fondo transparente", gradient: "Degradado", ec: "Corrección", margin: "Margen", size: "Tamaño", moduleStyle: "Módulos", eyeStyle: "Ojos", frame: "Marco", clear: "Limpiar" },
  de: { studio: "Studio", design: "Design", bulk: "Stapel", history: "Verlauf", api: "API", contentType: "Inhaltstyp", generate: "Generieren", download: "Download", copyPayload: "Payload kopieren", copied: "Kopiert!", scanTest: "Scan-Test", scanOk: "Scan OK", scanFail: "Abweichung", scanUnsupported: "Mit Handy testen", export: "Export", preset: "Vorlage", ai: "KI-Tipps", apply: "Anwenden", favorite: "Favorit", favorited: "Favorit", private: "100% privat · im Browser", emptyHistory: "Keine QR-Codes.", bulkImport: "CSV import", bulkZip: "ZIP laden", logo: "Logo", logoHint: "PNG/JPG", foreground: "Vordergrund", background: "Hintergrund", transparent: "Transparent", gradient: "Verlauf", ec: "Fehlerkorrektur", margin: "Rand", size: "Größe", moduleStyle: "Module", eyeStyle: "Augen", frame: "Rahmen", clear: "Löschen" },
  fr: { studio: "Studio", design: "Design", bulk: "Lot", history: "Historique", api: "API", contentType: "Type", generate: "Générer", download: "Télécharger", copyPayload: "Copier payload", copied: "Copié !", scanTest: "Test scan", scanOk: "Scan OK", scanFail: "Écart", scanUnsupported: "Tester avec le téléphone", export: "Exporter", preset: "Modèle", ai: "Conseils IA", apply: "Appliquer", favorite: "Favori", favorited: "Favori", private: "100% privé · navigateur", emptyHistory: "Aucun QR.", bulkImport: "Importer CSV", bulkZip: "ZIP", logo: "Logo", logoHint: "PNG/JPG", foreground: "Premier plan", background: "Fond", transparent: "Transparent", gradient: "Dégradé", ec: "Correction", margin: "Marge", size: "Taille", moduleStyle: "Modules", eyeStyle: "Yeux", frame: "Cadre", clear: "Effacer" },
  tr: { studio: "Stüdyo", design: "Tasarım", bulk: "Toplu", history: "Geçmiş", api: "API", contentType: "İçerik türü", generate: "Oluştur", download: "İndir", copyPayload: "Payload kopyala", copied: "Kopyalandı!", scanTest: "Tarama testi", scanOk: "Tarama doğrulandı", scanFail: "Uyuşmuyor", scanUnsupported: "Telefon kamerası kullanın", export: "Dışa aktar", preset: "Şablon", ai: "AI ipuçları", apply: "Uygula", favorite: "Favori", favorited: "Favori", private: "%100 özel · tarayıcıda", emptyHistory: "QR yok.", bulkImport: "CSV içe aktar", bulkZip: "ZIP indir", logo: "Logo", logoHint: "PNG/JPG", foreground: "Ön plan", background: "Arka plan", transparent: "Şeffaf arka plan", gradient: "Gradyan", ec: "Hata düzeltme", margin: "Kenar", size: "Boyut", moduleStyle: "Modül", eyeStyle: "Göz", frame: "Çerçeve", clear: "Temizle" },
  hi: { studio: "स्टूडियो", design: "डिज़ाइन", bulk: "बल्क", history: "इतिहास", api: "API", contentType: "सामग्री प्रकार", generate: "बनाएँ", download: "डाउनलोड", copyPayload: "पेलोड कॉपी", copied: "कॉपी!", scanTest: "स्कैन परीक्षण", scanOk: "स्कैन सत्यापित", scanFail: "मेल नहीं", scanUnsupported: "फ़ोन कैमरा उपयोग करें", export: "निर्यात", preset: "टेम्पलेट", ai: "AI सुझाव", apply: "लागू", favorite: "पसंदीदा", favorited: "पसंदीदा", private: "100% निजी · ब्राउज़र", emptyHistory: "कोई QR नहीं।", bulkImport: "CSV आयात", bulkZip: "ZIP", logo: "लोगो", logoHint: "PNG/JPG", foreground: "अग्रभूमि", background: "पृष्ठभूमि", transparent: "पारदर्शी", gradient: "ग्रेडिएंट", ec: "त्रुटि सुधार", margin: "मार्जिन", size: "आकार", moduleStyle: "मॉड्यूल", eyeStyle: "आँख", frame: "फ़्रेम", clear: "साफ़" },
  pt: { studio: "Estúdio", design: "Design", bulk: "Lote", history: "Histórico", api: "API", contentType: "Tipo", generate: "Gerar", download: "Baixar", copyPayload: "Copiar payload", copied: "Copiado!", scanTest: "Teste scan", scanOk: "Scan OK", scanFail: "Divergência", scanUnsupported: "Use câmera do celular", export: "Exportar", preset: "Modelo", ai: "Dicas IA", apply: "Aplicar", favorite: "Favorito", favorited: "Favorito", private: "100% privado · navegador", emptyHistory: "Sem QR codes.", bulkImport: "Importar CSV", bulkZip: "Baixar ZIP", logo: "Logo", logoHint: "PNG/JPG", foreground: "Primeiro plano", background: "Fundo", transparent: "Transparente", gradient: "Gradiente", ec: "Correção", margin: "Margem", size: "Tamanho", moduleStyle: "Módulos", eyeStyle: "Olhos", frame: "Moldura", clear: "Limpar" },
  ja: { studio: "スタジオ", design: "デザイン", bulk: "一括", history: "履歴", api: "API", contentType: "コンテンツ", generate: "生成", download: "ダウンロード", copyPayload: "ペイロードコピー", copied: "コピーしました", scanTest: "スキャンテスト", scanOk: "スキャン確認", scanFail: "不一致", scanUnsupported: "スマホカメラでテスト", export: "エクスポート", preset: "テンプレート", ai: "AIヒント", apply: "適用", favorite: "お気に入り", favorited: "お気に入り", private: "100%プライベート", emptyHistory: "QRコードなし。", bulkImport: "CSVインポート", bulkZip: "ZIP", logo: "ロゴ", logoHint: "PNG/JPG", foreground: "前景", background: "背景", transparent: "透明背景", gradient: "グラデーション", ec: "誤り訂正", margin: "余白", size: "サイズ", moduleStyle: "モジュール", eyeStyle: "目", frame: "フレーム", clear: "消去" },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français",
  tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

interface HistoryEntry {
  id: string;
  label: string;
  type: QrContentType;
  encoded: string;
  dataUrl: string;
  ts: number;
}

const HISTORY_KEY = "toolnest-qr-history";
const SETTINGS_KEY = "toolnest-qr-settings";
const LANG_KEY = "toolnest-qr-lang";

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

let _id = 0;
const nextId = () => `qr-${Date.now()}-${++_id}`;

export function QrGenerator() {
  const favorites = useFavorites();
  const slug = "qr-generator";

  const [contentType, setContentType] = useState<QrContentType>("url");
  const [fields, setFields] = useState<QrContentFields>(DEFAULT_FIELDS);
  const [design, setDesign] = useState<QrDesign>(DEFAULT_DESIGN);
  const [label, setLabel] = useState("My QR");
  const [tab, setTab] = useState<Tab>("studio");
  const [lang, setLang] = useState<Lang>("en");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dataUrl, setDataUrl] = useState("");
  const [encoded, setEncoded] = useState("");
  const [rendering, setRendering] = useState(false);
  const [scan, setScan] = useState<ScanTestResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [bulkCsv, setBulkCsv] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [exportFmt, setExportFmt] = useState<ExportFormat>("png");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const t = useCallback((k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k, [lang]);

  const payload: QrPayload = useMemo(() => ({ type: contentType, fields, design, label }), [contentType, fields, design, label]);
  const info = useMemo(() => analyzeQr(buildEncodedPayload(contentType, fields), design.errorCorrection), [contentType, fields, design.errorCorrection]);
  const recs = useMemo(() => aiRecommend(payload, info), [payload, info]);

  useEffect(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed.design) setDesign((d) => ({ ...d, ...parsed.design }));
        if (parsed.contentType) setContentType(parsed.contentType);
      }
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
      setHistory(loadHistory());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ design, contentType })); } catch { /* ignore */ }
  }, [design, contentType]);

  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  const doRender = useCallback(async () => {
    setRendering(true);
    setScan(null);
    try {
      const result = await renderQr(payload);
      canvasRef.current = result.canvas;
      setDataUrl(result.dataUrl);
      setEncoded(result.encoded);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Render failed");
      setDataUrl("");
      setEncoded("");
    } finally {
      setRendering(false);
    }
  }, [payload]);

  useEffect(() => {
    const timer = setTimeout(() => { void doRender(); }, 120);
    return () => clearTimeout(timer);
  }, [doRender]);

  const onExport = useCallback(async (fmt: ExportFormat = exportFmt) => {
    if (!canvasRef.current && !encoded) { toast.error("Nothing to export"); return; }
    try {
      let blob: Blob;
      let ext = fmt;
      if (fmt === "svg" && encoded) {
        blob = exportSvgString(encoded, design);
      } else if (canvasRef.current) {
        blob = await exportCanvas(canvasRef.current, fmt);
      } else return;
      const safe = label.replace(/[^a-z0-9_-]/gi, "_") || "qr-code";
      downloadBlob(blob, `${safe}.${ext}`);
      toast.success(`Exported ${ext.toUpperCase()}`);
      if (dataUrl && encoded) {
        setHistory((h) => {
          const entry: HistoryEntry = { id: nextId(), label, type: contentType, encoded, dataUrl, ts: Date.now() };
          const next = [entry, ...h].slice(0, 50);
          saveHistory(next);
          return next;
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    }
  }, [encoded, design, label, contentType, dataUrl, exportFmt]);

  const onCopyPayload = useCallback(async () => {
    if (!encoded) return;
    try {
      await navigator.clipboard.writeText(encoded);
      toast.success(t("copied"));
    } catch { toast.error("Clipboard blocked"); }
  }, [encoded, t]);

  const onScanTest = useCallback(async () => {
    if (!canvasRef.current || !encoded) return;
    setScanning(true);
    try {
      const r = await testScanFromCanvas(canvasRef.current, encoded);
      setScan(r);
      if (r.match) toast.success(t("scanOk"));
      else if (!r.supported) toast.info(t("scanUnsupported"));
      else toast.warning(t("scanFail"));
    } finally {
      setScanning(false);
    }
  }, [encoded, t]);

  const onLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDesign((d) => ({ ...d, logoDataUrl: reader.result as string, errorCorrection: "H" }));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onBulkCsvFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBulkCsv(reader.result as string);
    reader.readAsText(file);
    e.target.value = "";
  };

  const onBulkZip = async () => {
    const rows = parseBulkCsv(bulkCsv);
    if (!rows.length) { toast.error("No rows in CSV"); return; }
    setBulkBusy(true);
    try {
      const zip = await bulkRenderZip(rows, design);
      downloadBlob(zip, "toolnest-qr-bulk.zip");
      toast.success(`${rows.length} QR codes in ZIP`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const patchFields = (patch: Partial<QrContentFields>) => setFields((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <QrCode className="h-3.5 w-3.5" /> {t("private")}
          </span>
          <button
            type="button"
            onClick={() => favorites.toggle(slug)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
              favorites.isFavorite(slug) ? "border-accent/40 bg-accent/10 text-accent" : "border-border bg-card hover:bg-card-hover",
            )}
          >
            <Star className="h-3.5 w-3.5" /> {favorites.isFavorite(slug) ? t("favorited") : t("favorite")}
          </button>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <Languages className="h-3.5 w-3.5" />
          <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="rounded-md border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary">
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Version", value: String(info.version), color: "text-foreground" },
          { label: "Data", value: `${info.dataLength}/${info.capacity} B`, color: "text-violet-400" },
          { label: "Modules", value: `${info.moduleCount}×${info.moduleCount}`, color: "text-amber-400" },
          { label: "EC level", value: design.errorCorrection, color: "text-primary" },
          { label: "Scan", value: info.estimatedScannability, color: "text-emerald-500" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3 text-center">
            <p className={cn("font-display text-lg font-bold capitalize", s.color)}>{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {([
          ["studio", t("studio"), QrCode],
          ["design", t("design"), Palette],
          ["bulk", t("bulk"), FileArchive],
          ["history", t("history"), History],
          ["api", t("api"), Zap],
        ] as const).map(([key, lbl, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key)} className={cn("flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium", tab === key ? "bg-primary text-white" : "text-muted hover:text-foreground")}>
            <Icon className="h-4 w-4" /><span className="hidden sm:inline">{lbl}</span>
          </button>
        ))}
      </div>

      {(tab === "studio" || tab === "design") && (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-5">
            {tab === "studio" && (
              <>
                <Field label={t("contentType")}>
                  <select value={contentType} onChange={(e) => setContentType(e.target.value as QrContentType)} className={inputClass()}>
                    {CONTENT_CATEGORIES.map((cat) => (
                      <optgroup key={cat.label} label={cat.label}>
                        {cat.types.map((tp) => <option key={tp} value={tp}>{CONTENT_TYPE_LABELS[tp]}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </Field>
                <Field label="Label (for export/history)">
                  <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass()} />
                </Field>
                <ContentForm type={contentType} fields={fields} onChange={patchFields} />
              </>
            )}

            {tab === "design" && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium">{t("preset")}</p>
                  <div className="flex flex-wrap gap-2">
                    {DESIGN_PRESETS.map((p) => (
                      <Button key={p.name} size="sm" variant="outline" onClick={() => setDesign((d) => ({ ...d, ...p.design }))}>{p.name}</Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t("foreground")}>
                    <input type="color" value={design.foreground} onChange={(e) => setDesign((d) => ({ ...d, foreground: e.target.value }))} className="h-10 w-full cursor-pointer rounded-lg border border-border bg-card" />
                  </Field>
                  <Field label={t("background")}>
                    <input type="color" value={design.background} onChange={(e) => setDesign((d) => ({ ...d, background: e.target.value }))} className="h-10 w-full cursor-pointer rounded-lg border border-border bg-card" disabled={design.transparentBg} />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={design.transparentBg} onChange={(e) => setDesign((d) => ({ ...d, transparentBg: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("transparent")}</label>
                <Field label={t("gradient")}>
                  <select value={design.gradientMode} onChange={(e) => setDesign((d) => ({ ...d, gradientMode: e.target.value as QrDesign["gradientMode"] }))} className={inputClass()}>
                    <option value="none">None</option>
                    <option value="linear">Linear gradient</option>
                  </select>
                </Field>
                {design.gradientMode === "linear" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Gradient color 2"><input type="color" value={design.gradientColor2} onChange={(e) => setDesign((d) => ({ ...d, gradientColor2: e.target.value }))} className="h-10 w-full cursor-pointer rounded-lg border border-border bg-card" /></Field>
                    <Field label="Angle"><input type="range" min={0} max={360} value={design.gradientAngle} onChange={(e) => setDesign((d) => ({ ...d, gradientAngle: Number(e.target.value) }))} className="w-full accent-[var(--primary)]" /></Field>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t("moduleStyle")}>
                    <select value={design.moduleStyle} onChange={(e) => setDesign((d) => ({ ...d, moduleStyle: e.target.value as QrDesign["moduleStyle"] }))} className={inputClass()}>
                      <option value="square">Square</option><option value="rounded">Rounded</option><option value="dots">Dots</option>
                    </select>
                  </Field>
                  <Field label={t("eyeStyle")}>
                    <select value={design.eyeStyle} onChange={(e) => setDesign((d) => ({ ...d, eyeStyle: e.target.value as QrDesign["eyeStyle"] }))} className={inputClass()}>
                      <option value="square">Square</option><option value="rounded">Rounded</option><option value="circle">Circle</option>
                    </select>
                  </Field>
                </div>
                <Field label={t("frame")}>
                  <select value={design.frame} onChange={(e) => setDesign((d) => ({ ...d, frame: e.target.value as QrDesign["frame"] }))} className={inputClass()}>
                    <option value="none">None</option><option value="border">Border</option><option value="card">Card</option><option value="banner">Banner + text</option>
                  </select>
                </Field>
                {design.frame !== "none" && (
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Frame color"><input type="color" value={design.frameColor} onChange={(e) => setDesign((d) => ({ ...d, frameColor: e.target.value }))} className="h-10 w-full cursor-pointer rounded-lg border border-border bg-card" /></Field>
                    {design.frame === "banner" && <Field label="Banner text"><input value={design.frameText} onChange={(e) => setDesign((d) => ({ ...d, frameText: e.target.value }))} className={inputClass()} /></Field>}
                  </div>
                )}
                <Field label={t("ec")}>
                  <select value={design.errorCorrection} onChange={(e) => setDesign((d) => ({ ...d, errorCorrection: e.target.value as QrDesign["errorCorrection"] }))} className={inputClass()}>
                    <option value="L">L — 7% (max data)</option><option value="M">M — 15%</option><option value="Q">Q — 25%</option><option value="H">H — 30% (best for logos)</option>
                  </select>
                </Field>
                <Field label={`${t("size")}: ${design.size}px`}>
                  <input type="range" min={128} max={2048} step={32} value={design.size} onChange={(e) => setDesign((d) => ({ ...d, size: Number(e.target.value) }))} className="w-full accent-[var(--primary)]" />
                </Field>
                <Field label={`${t("margin")}: ${design.margin}`}>
                  <input type="range" min={0} max={8} value={design.margin} onChange={(e) => setDesign((d) => ({ ...d, margin: Number(e.target.value) }))} className="w-full accent-[var(--primary)]" />
                </Field>
                <Field label={t("logo")} hint={t("logoHint")}>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}><ImagePlus className="h-4 w-4" /> Upload logo</Button>
                    {design.logoDataUrl && <Button variant="ghost" size="sm" onClick={() => setDesign((d) => ({ ...d, logoDataUrl: "" }))}><Trash2 className="h-4 w-4" /></Button>}
                    <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
                  </div>
                  {design.logoDataUrl && (
                    <Field label={`Logo size: ${design.logoSize}%`}>
                      <input type="range" min={8} max={35} value={design.logoSize} onChange={(e) => setDesign((d) => ({ ...d, logoSize: Number(e.target.value) }))} className="w-full accent-[var(--primary)]" />
                    </Field>
                  )}
                </Field>
              </div>
            )}

            {recs.length > 0 && tab === "studio" && (
              <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-primary"><Sparkles className="h-4 w-4" /> {t("ai")}</p>
                {recs.map((r, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                    <div className="flex gap-2">
                      {r.level === "warning" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" /> : <Info className="mt-0.5 h-4 w-4 text-primary" />}
                      <div><p className="font-medium">{r.title}</p><p className="text-xs text-muted">{r.detail}</p></div>
                    </div>
                    {r.action && <Button size="sm" variant="outline" onClick={() => setDesign((d) => ({ ...d, ...r.action }))}>{t("apply")}</Button>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className={cn("flex min-h-[320px] items-center justify-center rounded-2xl border border-border p-6", design.transparentBg ? "bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]" : "bg-card")}>
              {rendering ? <Loader2 className="h-10 w-10 animate-spin text-muted" /> : dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dataUrl} alt="QR preview" className="max-h-[420px] max-w-full rounded-lg" />
              ) : (
                <p className="text-sm text-muted">Enter content to generate QR</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="gradient" disabled={!dataUrl} onClick={() => void onExport("png")}><Download className="h-4 w-4" /> PNG</Button>
              <select value={exportFmt} onChange={(e) => setExportFmt(e.target.value as ExportFormat)} className={cn(inputClass(), "w-auto")}>
                {(["png", "svg", "webp", "jpg", "pdf", "eps"] as ExportFormat[]).map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
              <Button variant="outline" disabled={!dataUrl} onClick={() => void onExport()}><Download className="h-4 w-4" /> {t("export")}</Button>
              <Button variant="outline" disabled={!encoded} onClick={() => void onCopyPayload()}><ClipboardCopy className="h-4 w-4" /> {t("copyPayload")}</Button>
              <Button variant="outline" disabled={!dataUrl || scanning} onClick={() => void onScanTest()}>
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} {t("scanTest")}
              </Button>
            </div>
            {scan && (
              <p className={cn("text-xs", scan.match ? "text-success" : scan.supported ? "text-amber-500" : "text-muted")}>
                {scan.match ? t("scanOk") : scan.error ?? t("scanFail")}
              </p>
            )}
            {encoded && (
              <details className="rounded-lg border border-border bg-card p-3 text-xs">
                <summary className="cursor-pointer font-medium">Encoded payload</summary>
                <code className="mt-2 block break-all text-muted">{encoded}</code>
              </details>
            )}
          </div>
        </div>
      )}

      {tab === "bulk" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted">CSV format: <code>label,content</code> — one URL/text per row. Generates PNGs in a ZIP with current design settings.</p>
          <textarea value={bulkCsv} onChange={(e) => setBulkCsv(e.target.value)} placeholder={"label,content\nHomepage,https://toolnest.io\nDocs,https://toolnest.io/docs"} className="min-h-[160px] w-full rounded-lg border border-border bg-card p-3 font-mono text-sm outline-none focus:border-primary" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => csvInputRef.current?.click()}><UploadCloud className="h-4 w-4" /> {t("bulkImport")}</Button>
            <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={onBulkCsvFile} />
            <Button variant="gradient" disabled={bulkBusy || !bulkCsv.trim()} onClick={() => void onBulkZip()}>
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} {t("bulkZip")}
            </Button>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 font-medium"><History className="h-4 w-4" /> {t("history")}</p>
            {history.length > 0 && <Button size="sm" variant="outline" onClick={() => { setHistory([]); saveHistory([]); }}><Trash2 className="h-3.5 w-3.5" /> {t("clear")}</Button>}
          </div>
          {history.length === 0 ? <p className="py-12 text-center text-sm text-muted">{t("emptyHistory")}</p> : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((h) => (
                <li key={h.id} className="rounded-lg border border-border p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={h.dataUrl} alt={h.label} className="mx-auto mb-2 h-24 w-24 object-contain" />
                  <p className="truncate text-sm font-medium">{h.label}</p>
                  <p className="text-xs text-muted">{CONTENT_TYPE_LABELS[h.type]} · {new Date(h.ts).toLocaleString()}</p>
                  <Button size="sm" variant="ghost" className="mt-1" onClick={async () => {
                    const res = await fetch(h.dataUrl);
                    const blob = await res.blob();
                    downloadBlob(blob, `${h.label.replace(/[^a-z0-9_-]/gi, "_")}.png`);
                  }}>Download</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="font-medium">POST /api/v1/qr/generate</p>
          <p className="text-sm text-muted">Server-side QR generation with full styling — PNG/SVG/PDF output for CI/CD and automation.</p>
          <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/qr/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "url",
    "content": "https://toolnest.io",
    "label": "Homepage",
    "design": {
      "foreground": "#4f46e5",
      "background": "#ffffff",
      "errorCorrection": "H",
      "size": 512,
      "moduleStyle": "rounded",
      "eyeStyle": "rounded"
    },
    "format": "png"
  }'`}</pre>
        </div>
      )}
    </div>
  );
}

function ContentForm({ type, fields, onChange }: { type: QrContentType; fields: QrContentFields; onChange: (p: Partial<QrContentFields>) => void }) {
  const ic = inputClass();
  switch (type) {
    case "url":
      return <Field label="URL"><input value={fields.url} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://example.com" className={ic} /></Field>;
    case "text":
      return <Field label="Text"><textarea value={fields.text} onChange={(e) => onChange({ text: e.target.value })} className="min-h-[100px] w-full rounded-lg border border-border bg-card p-3 text-sm outline-none focus:border-primary" /></Field>;
    case "custom":
      return <Field label="Custom data"><textarea value={fields.custom} onChange={(e) => onChange({ custom: e.target.value })} className="min-h-[100px] w-full rounded-lg border border-border bg-card p-3 text-sm outline-none focus:border-primary" /></Field>;
    case "wifi":
      return (
        <div className="space-y-3">
          <Field label="SSID"><input value={fields.wifi.ssid} onChange={(e) => onChange({ wifi: { ...fields.wifi, ssid: e.target.value } })} className={ic} /></Field>
          <Field label="Password"><input type="password" value={fields.wifi.password} onChange={(e) => onChange({ wifi: { ...fields.wifi, password: e.target.value } })} className={ic} /></Field>
          <Field label="Encryption">
            <select value={fields.wifi.encryption} onChange={(e) => onChange({ wifi: { ...fields.wifi, encryption: e.target.value as typeof fields.wifi.encryption } })} className={ic}>
              <option value="WPA">WPA/WPA2/WPA3</option><option value="WEP">WEP</option><option value="nopass">Open</option>
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fields.wifi.hidden} onChange={(e) => onChange({ wifi: { ...fields.wifi, hidden: e.target.checked } })} className="h-4 w-4 accent-[var(--primary)]" /> Hidden network</label>
        </div>
      );
    case "vcard":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name"><input value={fields.vcard.firstName} onChange={(e) => onChange({ vcard: { ...fields.vcard, firstName: e.target.value } })} className={ic} /></Field>
          <Field label="Last name"><input value={fields.vcard.lastName} onChange={(e) => onChange({ vcard: { ...fields.vcard, lastName: e.target.value } })} className={ic} /></Field>
          <Field label="Organization"><input value={fields.vcard.org} onChange={(e) => onChange({ vcard: { ...fields.vcard, org: e.target.value } })} className={ic} /></Field>
          <Field label="Title"><input value={fields.vcard.title} onChange={(e) => onChange({ vcard: { ...fields.vcard, title: e.target.value } })} className={ic} /></Field>
          <Field label="Phone"><input value={fields.vcard.phone} onChange={(e) => onChange({ vcard: { ...fields.vcard, phone: e.target.value } })} className={ic} /></Field>
          <Field label="Email"><input value={fields.vcard.email} onChange={(e) => onChange({ vcard: { ...fields.vcard, email: e.target.value } })} className={ic} /></Field>
          <Field label="Website"><input value={fields.vcard.url} onChange={(e) => onChange({ vcard: { ...fields.vcard, url: e.target.value } })} className={ic} /></Field>
          <Field label="Address"><input value={fields.vcard.address} onChange={(e) => onChange({ vcard: { ...fields.vcard, address: e.target.value } })} className={ic} /></Field>
        </div>
      );
    case "email":
      return (
        <div className="space-y-3">
          <Field label="To"><input value={fields.email.to} onChange={(e) => onChange({ email: { ...fields.email, to: e.target.value } })} className={ic} /></Field>
          <Field label="Subject"><input value={fields.email.subject} onChange={(e) => onChange({ email: { ...fields.email, subject: e.target.value } })} className={ic} /></Field>
          <Field label="Body"><textarea value={fields.email.body} onChange={(e) => onChange({ email: { ...fields.email, body: e.target.value } })} className="min-h-[80px] w-full rounded-lg border border-border bg-card p-3 text-sm outline-none focus:border-primary" /></Field>
        </div>
      );
    case "sms":
      return (
        <div className="space-y-3">
          <Field label="Phone"><input value={fields.sms.phone} onChange={(e) => onChange({ sms: { ...fields.sms, phone: e.target.value } })} className={ic} /></Field>
          <Field label="Message"><textarea value={fields.sms.body} onChange={(e) => onChange({ sms: { ...fields.sms, body: e.target.value } })} className="min-h-[80px] w-full rounded-lg border border-border bg-card p-3 text-sm outline-none focus:border-primary" /></Field>
        </div>
      );
    case "phone":
      return <Field label="Phone number"><input value={fields.phone} onChange={(e) => onChange({ phone: e.target.value })} placeholder="+1234567890" className={ic} /></Field>;
    case "whatsapp":
      return (
        <div className="space-y-3">
          <Field label="Phone (country code, no +)"><input value={fields.whatsapp.phone} onChange={(e) => onChange({ whatsapp: { ...fields.whatsapp, phone: e.target.value } })} className={ic} /></Field>
          <Field label="Pre-filled message"><textarea value={fields.whatsapp.message} onChange={(e) => onChange({ whatsapp: { ...fields.whatsapp, message: e.target.value } })} className="min-h-[80px] w-full rounded-lg border border-border bg-card p-3 text-sm outline-none focus:border-primary" /></Field>
        </div>
      );
    case "telegram":
      return <Field label="Username or link"><input value={fields.telegram} onChange={(e) => onChange({ telegram: e.target.value })} placeholder="@username" className={ic} /></Field>;
    case "zoom":
      return <Field label="Meeting ID or link"><input value={fields.zoom} onChange={(e) => onChange({ zoom: e.target.value })} className={ic} /></Field>;
    case "meet":
      return <Field label="Meeting code or link"><input value={fields.meet} onChange={(e) => onChange({ meet: e.target.value })} placeholder="abc-defg-hij" className={ic} /></Field>;
    case "maps":
      return (
        <div className="space-y-3">
          <Field label="Place name / address"><input value={fields.maps.query} onChange={(e) => onChange({ maps: { ...fields.maps, query: e.target.value } })} className={ic} /></Field>
          <p className="text-xs text-muted">Or coordinates:</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude"><input value={fields.maps.lat} onChange={(e) => onChange({ maps: { ...fields.maps, lat: e.target.value } })} className={ic} /></Field>
            <Field label="Longitude"><input value={fields.maps.lng} onChange={(e) => onChange({ maps: { ...fields.maps, lng: e.target.value } })} className={ic} /></Field>
          </div>
        </div>
      );
    case "geo":
      return (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude"><input value={fields.geo.lat} onChange={(e) => onChange({ geo: { ...fields.geo, lat: e.target.value } })} className={ic} /></Field>
          <Field label="Longitude"><input value={fields.geo.lng} onChange={(e) => onChange({ geo: { ...fields.geo, lng: e.target.value } })} className={ic} /></Field>
        </div>
      );
    case "instagram":
    case "facebook":
    case "twitter":
    case "linkedin":
    case "tiktok":
    case "youtube":
      return <Field label="Username or profile URL"><input value={fields.social} onChange={(e) => onChange({ social: e.target.value })} placeholder="@handle" className={ic} /></Field>;
    case "calendar":
      return (
        <div className="space-y-3">
          <Field label="Event title"><input value={fields.calendar.title} onChange={(e) => onChange({ calendar: { ...fields.calendar, title: e.target.value } })} className={ic} /></Field>
          <Field label="Location"><input value={fields.calendar.location} onChange={(e) => onChange({ calendar: { ...fields.calendar, location: e.target.value } })} className={ic} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start"><input type="datetime-local" value={fields.calendar.start} onChange={(e) => onChange({ calendar: { ...fields.calendar, start: e.target.value } })} className={ic} /></Field>
            <Field label="End"><input type="datetime-local" value={fields.calendar.end} onChange={(e) => onChange({ calendar: { ...fields.calendar, end: e.target.value } })} className={ic} /></Field>
          </div>
          <Field label="Description"><textarea value={fields.calendar.description} onChange={(e) => onChange({ calendar: { ...fields.calendar, description: e.target.value } })} className="min-h-[60px] w-full rounded-lg border border-border bg-card p-3 text-sm outline-none focus:border-primary" /></Field>
        </div>
      );
    case "bitcoin":
    case "ethereum":
      return (
        <div className="space-y-3">
          <Field label="Wallet address"><input value={fields.crypto.address} onChange={(e) => onChange({ crypto: { ...fields.crypto, address: e.target.value } })} className={ic} /></Field>
          <Field label="Amount (optional)"><input value={fields.crypto.amount} onChange={(e) => onChange({ crypto: { ...fields.crypto, amount: e.target.value } })} className={ic} /></Field>
          <Field label="Label"><input value={fields.crypto.label} onChange={(e) => onChange({ crypto: { ...fields.crypto, label: e.target.value } })} className={ic} /></Field>
        </div>
      );
    case "upi":
      return (
        <div className="space-y-3">
          <Field label="UPI VPA"><input value={fields.upi.vpa} onChange={(e) => onChange({ upi: { ...fields.upi, vpa: e.target.value } })} placeholder="name@upi" className={ic} /></Field>
          <Field label="Payee name"><input value={fields.upi.name} onChange={(e) => onChange({ upi: { ...fields.upi, name: e.target.value } })} className={ic} /></Field>
          <Field label="Amount"><input value={fields.upi.amount} onChange={(e) => onChange({ upi: { ...fields.upi, amount: e.target.value } })} className={ic} /></Field>
          <Field label="Note"><input value={fields.upi.note} onChange={(e) => onChange({ upi: { ...fields.upi, note: e.target.value } })} className={ic} /></Field>
        </div>
      );
    case "pdf":
    case "image":
    case "video":
    case "audio":
    case "menu":
    case "form":
    case "api":
      return <Field label="URL"><input value={fields.mediaUrl} onChange={(e) => onChange({ mediaUrl: e.target.value })} placeholder="https://..." className={ic} /></Field>;
    case "appstore":
    case "playstore":
      return <Field label="App ID or store URL"><input value={fields.appId} onChange={(e) => onChange({ appId: e.target.value })} placeholder={type === "appstore" ? "123456789" : "com.example.app"} className={ic} /></Field>;
    default:
      return null;
  }
}
