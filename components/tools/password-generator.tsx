"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileArchive,
  FileText,
  History,
  Info,
  KeyRound,
  Languages,
  Loader2,
  QrCode as QrIcon,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Wifi,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  DEFAULT_OPTIONS,
  aiRecommend,
  checkBreach,
  computeStrength,
  copyToClipboard,
  exportCsv,
  exportJson,
  exportPdf,
  exportTxt,
  generate,
  generateBulk,
  generateQrDataUrl,
  wifiQrPayload,
  type BreachResult,
  type ExportFormat,
  type GenMode,
  type GenOptions,
  type StrengthInfo,
} from "./password-generator-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";
type Tab = "studio" | "bulk" | "history" | "api";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    generate: "Generate", regenerate: "Regenerate", copy: "Copy", copied: "Copied!",
    length: "Length", upper: "Uppercase (A-Z)", lower: "Lowercase (a-z)",
    number: "Numbers (0-9)", symbol: "Symbols (!@#)", custom: "Custom characters",
    excludeSimilar: "Exclude similar (l 1 I O 0)", excludeAmbiguous: "Exclude ambiguous ({ } [ ] ...)",
    requireAll: "Ensure one char from each set",
    mode: "Mode", strength: "Strength", entropy: "Entropy", crackTime: "Crack time",
    pool: "Pool size", breach: "Check breach", breachSafe: "Not found in breaches",
    breachFound: "Found in breaches", breachError: "Breach check unavailable",
    bulkCount: "How many", bulkGenerate: "Generate bulk", bulkExport: "Export",
    history: "History", emptyHistory: "No passwords saved yet.",
    favorite: "Favorite", favorited: "Favorited", ai: "AI recommendations",
    studio: "Studio", api: "API",
    random: "Random", passphrase: "Passphrase", pronounceable: "Pronounceable",
    pin: "PIN", wifi: "Wi-Fi",
    wordCount: "Word count", separator: "Separator", capitalize: "Capitalize",
    appendNumber: "Append number", appendSymbol: "Append symbol",
    pronLower: "Lowercase only",
    ssid: "Wi-Fi SSID (network name)", encryption: "Encryption", hidden: "Hidden network",
    qr: "QR code", wifiQr: "Wi-Fi QR (scan to connect)",
    qrDownload: "Download PNG", qrDownloaded: "QR downloaded", copyPayload: "Copy QR payload",
    show: "Show", hide: "Hide", apply: "Apply",
    private: "100% private · generated in your browser",
  },
  es: { generate: "Generar", regenerate: "Regenerar", copy: "Copiar", copied: "Copiado!",
    length: "Longitud", upper: "Mayúsculas (A-Z)", lower: "Minúsculas (a-z)",
    number: "Números (0-9)", symbol: "Símbolos (!@#)", custom: "Caracteres personalizados",
    excludeSimilar: "Excluir similares (l 1 I O 0)", excludeAmbiguous: "Excluir ambiguos",
    requireAll: "Asegurar uno de cada conjunto", mode: "Modo", strength: "Fortaleza",
    entropy: "Entropía", crackTime: "Tiempo de crack", pool: "Tamaño pool",
    breach: "Verificar filtración", breachSafe: "No en filtraciones",
    breachFound: "Encontrado en filtraciones", breachError: "Verificación no disponible",
    bulkCount: "Cuántos", bulkGenerate: "Generar lote", bulkExport: "Exportar",
    history: "Historial", emptyHistory: "Sin contraseñas guardadas.",
    favorite: "Favorito", favorited: "Favorito", ai: "Recomendaciones IA",
    studio: "Estudio", api: "API",
    random: "Aleatorio", passphrase: "Frase", pronounceable: "Pronunciable",
    pin: "PIN", wifi: "Wi-Fi",
    wordCount: "Palabras", separator: "Separador", capitalize: "Capitalizar",
    appendNumber: "Añadir número", appendSymbol: "Añadir símbolo", pronLower: "Solo minúsculas",
    ssid: "SSID Wi-Fi", encryption: "Cifrado", hidden: "Oculto",
    qr: "Código QR", wifiQr: "QR Wi-Fi (escanea para conectar)",
    qrDownload: "Descargar PNG", qrDownloaded: "QR descargado", copyPayload: "Copiar payload QR",
    show: "Mostrar", hide: "Ocultar", apply: "Aplicar",
    private: "100% privado · en tu navegador" },
  de: { generate: "Generieren", regenerate: "Neu", copy: "Kopieren", copied: "Kopiert!",
    length: "Länge", upper: "Großbuchstaben", lower: "Kleinbuchstaben",
    number: "Zahlen", symbol: "Symbole", custom: "Eigene Zeichen",
    excludeSimilar: "Ähnliche ausschließen", excludeAmbiguous: "Mehrdeutige ausschließen",
    requireAll: "Je ein Zeichen pro Set", mode: "Modus", strength: "Stärke",
    entropy: "Entropie", crackTime: "Knackzeit", pool: "Poolgröße",
    breach: "Datenleck-Check", breachSafe: "Nicht in Lecks",
    breachFound: "In Lecks gefunden", breachError: "Check nicht verfügbar",
    bulkCount: "Wie viele", bulkGenerate: "Stapel", bulkExport: "Export",
    history: "Verlauf", emptyHistory: "Keine gespeichert.",
    favorite: "Favorit", favorited: "Favorit", ai: "KI-Empfehlungen",
    studio: "Studio", api: "API",
    random: "Zufällig", passphrase: "Passphrase", pronounceable: "Aussprechbar",
    pin: "PIN", wifi: "WLAN",
    wordCount: "Wörter", separator: "Trenner", capitalize: "Großschreiben",
    appendNumber: "Zahl anhängen", appendSymbol: "Symbol anhängen", pronLower: "Nur Kleinbuchstaben",
    ssid: "WLAN-SSID", encryption: "Verschlüsselung", hidden: "Versteckt",
    qr: "QR-Code", wifiQr: "WLAN-QR (scannen zum Verbinden)",
    qrDownload: "PNG herunterladen", qrDownloaded: "QR heruntergeladen", copyPayload: "QR-Payload kopieren",
    show: "Anzeigen", hide: "Verbergen", apply: "Anwenden",
    private: "100% privat · im Browser" },
  fr: { generate: "Générer", regenerate: "Régénérer", copy: "Copier", copied: "Copié !",
    length: "Longueur", upper: "Majuscules", lower: "Minuscules",
    number: "Chiffres", symbol: "Symboles", custom: "Caractères personnalisés",
    excludeSimilar: "Exclure similaires", excludeAmbiguous: "Exclure ambigus",
    requireAll: "Un de chaque type", mode: "Mode", strength: "Force",
    entropy: "Entropie", crackTime: "Temps de cassage", pool: "Taille du pool",
    breach: "Vérifier fuite", breachSafe: "Non trouvé dans les fuites",
    breachFound: "Trouvé dans les fuites", breachError: "Vérification indisponible",
    bulkCount: "Combien", bulkGenerate: "Générer en lot", bulkExport: "Exporter",
    history: "Historique", emptyHistory: "Aucun mot de passe enregistré.",
    favorite: "Favori", favorited: "Favori", ai: "Recommandations IA",
    studio: "Studio", api: "API",
    random: "Aléatoire", passphrase: "Phrase", pronounceable: "Prononçable",
    pin: "PIN", wifi: "Wi-Fi",
    wordCount: "Mots", separator: "Séparateur", capitalize: "Capitaliser",
    appendNumber: "Ajouter chiffre", appendSymbol: "Ajouter symbole", pronLower: "Minuscules seulement",
    ssid: "SSID Wi-Fi", encryption: "Chiffrement", hidden: "Caché",
    qr: "QR code", wifiQr: "QR Wi-Fi (scanner pour connecter)",
    qrDownload: "Télécharger PNG", qrDownloaded: "QR téléchargé", copyPayload: "Copier le payload QR",
    show: "Afficher", hide: "Masquer", apply: "Appliquer",
    private: "100% privé · dans le navigateur" },
  tr: { generate: "Üret", regenerate: "Yeniden", copy: "Kopyala", copied: "Kopyalandı!",
    length: "Uzunluk", upper: "Büyük harf", lower: "Küçük harf",
    number: "Rakamlar", symbol: "Semboller", custom: "Özel karakterler",
    excludeSimilar: "Benzerleri çıkar", excludeAmbiguous: "Belirsizleri çıkar",
    requireAll: "Her setten bir karakter", mode: "Mod", strength: "Güç",
    entropy: "Entropi", crackTime: "Kırılma süresi", pool: "Havuz boyutu",
    breach: "Sızıntı kontrolü", breachSafe: "Sızıntıda yok",
    breachFound: "Sızıntıda bulundu", breachError: "Kontrol kullanılamıyor",
    bulkCount: "Kaç adet", bulkGenerate: "Toplu üret", bulkExport: "Dışa aktar",
    history: "Geçmiş", emptyHistory: "Henüz kayıt yok.",
    favorite: "Favori", favorited: "Favori", ai: "AI önerileri",
    studio: "Stüdyo", api: "API",
    random: "Rastgele", passphrase: "Cümle", pronounceable: "Telaffuz edilebilir",
    pin: "PIN", wifi: "Wi-Fi",
    wordCount: "Kelime", separator: "Ayraç", capitalize: "Büyük harf",
    appendNumber: "Sayı ekle", appendSymbol: "Sembol ekle", pronLower: "Sadece küçük harf",
    ssid: "Wi-Fi SSID", encryption: "Şifreleme", hidden: "Gizli",
    qr: "QR kod", wifiQr: "Wi-Fi QR (bağlanmak için tara)",
    qrDownload: "PNG indir", qrDownloaded: "QR indirildi", copyPayload: "QR payloadunu kopyala",
    show: "Göster", hide: "Gizle", apply: "Uygula",
    private: "%100 özel · tarayıcıda" },
  hi: { generate: "बनाएँ", regenerate: "फिर बनाएँ", copy: "कॉपी", copied: "कॉपी हो गई!",
    length: "लंबाई", upper: "अपरकेस (A-Z)", lower: "लोअरकेस (a-z)",
    number: "संख्याएँ (0-9)", symbol: "चिन्ह (!@#)", custom: "कस्टम अक्षर",
    excludeSimilar: "समान हटाएँ (l 1 I O 0)", excludeAmbiguous: "अस्पष्ट हटाएँ",
    requireAll: "हर सेट से एक", mode: "मोड", strength: "शक्ति",
    entropy: "एन्ट्रॉपी", crackTime: "क्रैक समय", pool: "पूल आकार",
    breach: "लीक जाँच", breachSafe: "लीक में नहीं मिला",
    breachFound: "लीक में मिला", breachError: "जाँच अनुपलब्ध",
    bulkCount: "कितने", bulkGenerate: "बल्क बनाएँ", bulkExport: "निर्यात",
    history: "इतिहास", emptyHistory: "अभी कोई सहेजा नहीं।",
    favorite: "पसंदीदा", favorited: "पसंदीदा", ai: "AI सुझाव",
    studio: "स्टूडियो", api: "API",
    random: "रैंडम", passphrase: "पासफ़्रेज़", pronounceable: "उच्चारण योग्य",
    pin: "PIN", wifi: "वाई-फाई",
    wordCount: "शब्द संख्या", separator: "विभाजक", capitalize: "कैपिटल",
    appendNumber: "नंबर जोड़ें", appendSymbol: "चिन्ह जोड़ें", pronLower: "केवल लोअरकेस",
    ssid: "वाई-फाई SSID", encryption: "एन्क्रिप्शन", hidden: "छिपा हुआ",
    qr: "QR कोड", wifiQr: "वाई-फाई QR (कनेक्ट करने के लिए स्कैन करें)",
    qrDownload: "PNG डाउनलोड", qrDownloaded: "QR डाउनलोड हुआ", copyPayload: "QR पेलोड कॉपी",
    show: "दिखाएँ", hide: "छिपाएँ", apply: "लागू करें",
    private: "100% निजी · ब्राउज़र में" },
  pt: { generate: "Gerar", regenerate: "Regenerar", copy: "Copiar", copied: "Copiado!",
    length: "Comprimento", upper: "Maiúsculas (A-Z)", lower: "Minúsculas (a-z)",
    number: "Números (0-9)", symbol: "Símbolos (!@#)", custom: "Caracteres personalizados",
    excludeSimilar: "Excluir similares (l 1 I O 0)", excludeAmbiguous: "Excluir ambíguos",
    requireAll: "Um de cada conjunto", mode: "Modo", strength: "Força",
    entropy: "Entropia", crackTime: "Tempo de quebra", pool: "Tamanho do pool",
    breach: "Verificar vazamento", breachSafe: "Não em vazamentos",
    breachFound: "Encontrado em vazamentos", breachError: "Verificação indisponível",
    bulkCount: "Quantos", bulkGenerate: "Gerar em lote", bulkExport: "Exportar",
    history: "Histórico", emptyHistory: "Nenhuma senha salva.",
    favorite: "Favorito", favorited: "Favorito", ai: "Recomendações IA",
    studio: "Estúdio", api: "API",
    random: "Aleatório", passphrase: "Frase", pronounceable: "Pronunciável",
    pin: "PIN", wifi: "Wi-Fi",
    wordCount: "Palavras", separator: "Separador", capitalize: "Capitalizar",
    appendNumber: "Anexar número", appendSymbol: "Anexar símbolo", pronLower: "Apenas minúsculas",
    ssid: "SSID Wi-Fi", encryption: "Criptografia", hidden: "Oculto",
    qr: "Código QR", wifiQr: "QR Wi-Fi (escanear para conectar)",
    qrDownload: "Baixar PNG", qrDownloaded: "QR baixado", copyPayload: "Copiar payload QR",
    show: "Mostrar", hide: "Ocultar", apply: "Aplicar",
    private: "100% privado · no navegador" },
  ja: { generate: "生成", regenerate: "再生成", copy: "コピー", copied: "コピーしました！",
    length: "長さ", upper: "大文字 (A-Z)", lower: "小文字 (a-z)",
    number: "数字 (0-9)", symbol: "記号 (!@#)", custom: "カスタム文字",
    excludeSimilar: "類似文字を除外 (l 1 I O 0)", excludeAmbiguous: "曖昧な文字を除外",
    requireAll: "各セットから1文字", mode: "モード", strength: "強度",
    entropy: "エントロピー", crackTime: "クラック時間", pool: "プールサイズ",
    breach: "漏洩チェック", breachSafe: "漏洩なし",
    breachFound: "漏洩あり", breachError: "チェック不可",
    bulkCount: "個数", bulkGenerate: "一括生成", bulkExport: "エクスポート",
    history: "履歴", emptyHistory: "保存されたパスワードはありません。",
    favorite: "お気に入り", favorited: "お気に入り", ai: "AI推奨",
    studio: "スタジオ", api: "API",
    random: "ランダム", passphrase: "フレーズ", pronounceable: "発音可能",
    pin: "PIN", wifi: "Wi-Fi",
    wordCount: "単語数", separator: "区切り", capitalize: "先頭大文字",
    appendNumber: "数字追加", appendSymbol: "記号追加", pronLower: "小文字のみ",
    ssid: "Wi-Fi SSID", encryption: "暗号化", hidden: "非公開",
    qr: "QRコード", wifiQr: "Wi-Fi QR (スキャンで接続)",
    qrDownload: "PNGをダウンロード", qrDownloaded: "QRをダウンロードしました", copyPayload: "QRペイロードをコピー",
    show: "表示", hide: "非表示", apply: "適用",
    private: "100%プライベート · ブラウザ内" },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français",
  tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

const STRENGTH_COLORS: Record<StrengthInfo["score"], string> = {
  0: "var(--error)",
  1: "var(--error)",
  2: "var(--accent)",
  3: "var(--secondary)",
  4: "var(--success)",
};

const STRENGTH_WIDTH: Record<StrengthInfo["score"], string> = {
  0: "20%", 1: "40%", 2: "60%", 3: "80%", 4: "100%",
};

interface HistoryEntry {
  id: string;
  password: string;
  mode: GenMode;
  entropy: number;
  ts: number;
}

const HISTORY_KEY = "toolnest-password-history";
const SETTINGS_KEY = "toolnest-password-settings";
const LANG_KEY = "toolnest-password-lang";

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

let _idCounter = 0;
const nextId = () => `pwd-${Date.now()}-${++_idCounter}`;

export function PasswordGenerator() {
  const favorites = useFavorites();
  const slug = "password-gen";

  const [options, setOptions] = useState<GenOptions>(DEFAULT_OPTIONS);
  const [password, setPassword] = useState("");
  const [strength, setStrength] = useState<StrengthInfo | null>(null);
  const [show, setShow] = useState(true);
  const [copied, setCopied] = useState(false);
  const [breach, setBreach] = useState<BreachResult | null>(null);
  const [breachLoading, setBreachLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("studio");
  const [showSettings, setShowSettings] = useState(true);
  const [bulkCount, setBulkCount] = useState(10);
  const [bulk, setBulk] = useState<{ password: string; entropy: number; score: StrengthInfo["score"] }[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lang, setLang] = useState<Lang>("en");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrLoading, setQrLoading] = useState(false);
  const [aiRecs, setAiRecs] = useState<ReturnType<typeof aiRecommend>>([]);

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

  const regen = useCallback(() => {
    const pwd = generate(options);
    setPassword(pwd);
    const s = computeStrength(pwd, options);
    setStrength(s);
    setBreach(null);
    setAiRecs(aiRecommend(pwd, options, s));
  }, [options]);

  // Regenerate whenever options change (debounced via effect)
  useEffect(() => { regen(); }, [regen]);

  // QR generation (raw password or Wi-Fi payload)
  useEffect(() => {
    let cancelled = false;
    if (!password) { setQrDataUrl(""); return; }
    setQrLoading(true);
    const payload = options.mode === "wifi" && options.wifiSsid
      ? wifiQrPayload(options.wifiSsid, password, options.wifiEncryption, options.wifiHidden)
      : password;
    void generateQrDataUrl(payload, { width: 280, margin: 2 })
      .then((url) => { if (!cancelled) { setQrDataUrl(url); setQrLoading(false); } })
      .catch(() => { if (!cancelled) { setQrDataUrl(""); setQrLoading(false); } });
    return () => { cancelled = true; };
  }, [password, options.mode, options.wifiSsid, options.wifiEncryption, options.wifiHidden]);

  const onCopy = useCallback(async (text?: string) => {
    const target = text ?? password;
    if (!target) return;
    const ok = await copyToClipboard(target);
    if (ok) {
      setCopied(true);
      toast.success(t("copied"));
      setTimeout(() => setCopied(false), 1500);
      // Save to history
      setHistory((h) => {
        const entry: HistoryEntry = { id: nextId(), password: target, mode: options.mode, entropy: strength?.entropy ?? 0, ts: Date.now() };
        const next = [entry, ...h].slice(0, 50);
        saveHistory(next);
        return next;
      });
    } else {
      toast.error("Clipboard blocked");
    }
  }, [password, options.mode, strength, t]);

  const onBreach = useCallback(async () => {
    if (!password) return;
    setBreachLoading(true);
    try {
      const r = await checkBreach(password);
      setBreach(r);
      if (r.error) toast.error(t("breachError") + ": " + r.error);
      else if (r.found) toast.error(`${t("breachFound")} — ${r.count.toLocaleString()} times`);
      else toast.success(t("breachSafe"));
    } finally {
      setBreachLoading(false);
    }
  }, [password, t]);

  const onBulk = useCallback(() => {
    const pwds = generateBulk(options, bulkCount);
    const rows = pwds.map((p) => {
      const s = computeStrength(p, options);
      return { password: p, entropy: s.entropy, score: s.score };
    });
    setBulk(rows);
    toast.success(`${rows.length} passwords generated`);
  }, [options, bulkCount]);

  const onExport = useCallback(async (format: ExportFormat, source: "single" | "bulk") => {
    const pwds = source === "single" ? (password ? [password] : []) : bulk.map((b) => b.password);
    if (!pwds.length) { toast.error("Nothing to export"); return; }
    let blob: Blob;
    let ext: string;
    switch (format) {
      case "txt": blob = exportTxt(pwds); ext = "txt"; break;
      case "csv": blob = exportCsv(pwds); ext = "csv"; break;
      case "json": blob = exportJson(pwds); ext = "json"; break;
      case "pdf": blob = await exportPdf(pwds); ext = "pdf"; break;
    }
    downloadBlob(blob, `toolnest-passwords.${ext}`);
    toast.success(`Exported ${pwds.length} as ${ext.toUpperCase()}`);
  }, [password, bulk]);

  const applyAi = useCallback((action?: Partial<GenOptions>) => {
    if (!action) return;
    setOptions((o) => ({ ...o, ...action }));
    toast.success("Applied AI recommendation");
  }, []);

  const modeTabs: { id: GenMode; label: string; icon: typeof KeyRound }[] = [
    { id: "random", label: t("random"), icon: KeyRound },
    { id: "passphrase", label: t("passphrase"), icon: Sparkles },
    { id: "pronounceable", label: t("pronounceable"), icon: FileText },
    { id: "pin", label: t("pin"), icon: KeyRound },
    { id: "wifi", label: t("wifi"), icon: Wifi },
  ];

  const isRandomLike = options.mode === "random" || options.mode === "wifi";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <ShieldCheck className="h-3.5 w-3.5" /> {t("private")}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
            <Zap className="h-3.5 w-3.5 text-primary" /> Web Crypto · rejection sampling
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
            <Star className="h-3.5 w-3.5" /> {favorites.isFavorite(slug) ? t("favorited") : t("favorite")}
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

      {/* Mode tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {modeTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setOptions((o) => ({ ...o, mode: id }))}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium",
              options.mode === id ? "bg-primary text-white" : "text-muted hover:text-foreground",
            )}
            aria-pressed={options.mode === id}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Password display */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <code className={cn(
            "flex-1 break-all font-mono text-lg leading-relaxed",
            !show && "text-muted",
          )} aria-live="polite" aria-label="Generated password">
            {password ? (show ? password : "•".repeat(Math.min(password.length, 64))) : "—"}
          </code>
          <Button variant="ghost" size="icon" onClick={() => setShow((s) => !s)} aria-label={show ? t("hide") : t("show")}>
            {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={regen} aria-label={t("regenerate")}>
            <RefreshCw className="h-5 w-5" />
          </Button>
          <Button variant="gradient" size="icon" onClick={() => void onCopy()} aria-label={t("copy")}>
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Strength meter */}
      {strength && (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4" /> {t("strength")}
            </span>
            <span style={{ color: STRENGTH_COLORS[strength.score] }} className="font-semibold">{strength.label}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: STRENGTH_WIDTH[strength.score], backgroundColor: STRENGTH_COLORS[strength.score] }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <Stat label={t("entropy")} value={`${strength.entropy.toFixed(1)} bits`} />
            <Stat label={t("crackTime")} value={strength.crackLabel} />
            <Stat label={t("pool")} value={strength.poolSize.toLocaleString()} />
            <Stat label={t("length")} value={String(strength.length)} />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="outline" disabled={!password || breachLoading} onClick={() => void onBreach()}>
              {breachLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {t("breach")}
            </Button>
            {breach?.checked && !breach.error && (
              breach.found ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-error/10 px-3 py-1 text-xs text-error">
                  <ShieldAlert className="h-3.5 w-3.5" /> {t("breachFound")} ({breach.count.toLocaleString()})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs text-success">
                  <ShieldCheck className="h-3.5 w-3.5" /> {t("breachSafe")}
                </span>
              )
            )}
            {breach?.error && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" /> {t("breachError")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* AI recommendations */}
      {aiRecs.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" /> {t("ai")}
          </p>
          <ul className="space-y-2">
            {aiRecs.map((rec, i) => (
              <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                <div className="flex items-start gap-2.5">
                  {rec.level === "critical" ? <ShieldAlert className="mt-0.5 h-4 w-4 text-error" />
                    : rec.level === "warning" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
                    : <Info className="mt-0.5 h-4 w-4 text-primary" />}
                  <div>
                    <p className="font-medium">{rec.title}</p>
                    <p className="text-xs text-muted">{rec.detail}</p>
                  </div>
                </div>
                {rec.action && (
                  <Button size="sm" variant="outline" onClick={() => applyAi(rec.action)}>{t("apply")}</Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* QR code */}
      {qrDataUrl && (
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <p className="mb-3 flex items-center justify-center gap-2 text-sm font-medium">
            <QrIcon className="h-4 w-4" />
            {options.mode === "wifi" && options.wifiSsid ? t("wifiQr") : t("qr")}
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR code" className="mx-auto rounded-lg bg-white p-2" width={280} height={280} />
          <p className="mt-2 text-xs text-muted">Scan with any phone camera to import</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  const res = await fetch(qrDataUrl);
                  const blob = await res.blob();
                  const name = options.mode === "wifi" && options.wifiSsid
                    ? `toolnest-wifi-qr-${options.wifiSsid.replace(/[^a-z0-9_-]/gi, "_")}.png`
                    : "toolnest-password-qr.png";
                  downloadBlob(blob, name);
                  toast.success(t("qrDownloaded"));
                } catch {
                  toast.error("Download failed");
                }
              }}
            >
              <Download className="h-3.5 w-3.5" /> {t("qrDownload")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const payload = options.mode === "wifi" && options.wifiSsid
                  ? wifiQrPayload(options.wifiSsid, password, options.wifiEncryption, options.wifiHidden)
                  : password;
                const ok = await copyToClipboard(payload);
                if (ok) toast.success(t("copied"));
                else toast.error("Clipboard blocked");
              }}
            >
              <ClipboardCopy className="h-3.5 w-3.5" /> {t("copyPayload")}
            </Button>
          </div>
        </div>
      )}
      {qrLoading && !qrDataUrl && (
        <div className="flex items-center justify-center rounded-2xl border border-border bg-card p-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        </div>
      )}

      {/* Settings */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{t("mode")}: <span className="text-primary capitalize">{options.mode}</span></p>
          <Button size="sm" variant="ghost" onClick={() => setShowSettings((s) => !s)}>
            <Settings2 className="h-4 w-4" /> {showSettings ? t("hide") : t("show")}
          </Button>
        </div>
        {showSettings && (
          <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
            {isRandomLike && (
              <Field label={t("length")}>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={256}
                    value={Math.min(options.length, 256)}
                    onChange={(e) => setOptions((o) => ({ ...o, length: Number(e.target.value) }))}
                    className="flex-1 accent-[var(--primary)]"
                  />
                  <input
                    type="number"
                    min={1}
                    max={1024}
                    value={options.length}
                    onChange={(e) => setOptions((o) => ({ ...o, length: Number(e.target.value) || 1 }))}
                    className={cn(inputClass(), "w-20")}
                  />
                </div>
              </Field>
            )}
            {options.mode === "pin" && (
              <Field label={`${t("length")} (digits)`}>
                <input
                  type="range" min={1} max={32} value={options.length}
                  onChange={(e) => setOptions((o) => ({ ...o, length: Number(e.target.value) }))}
                  className="w-full accent-[var(--primary)]"
                />
                <p className="mt-1 text-xs text-muted">{options.length} digits · {(options.length * Math.log2(10)).toFixed(2)} bits</p>
              </Field>
            )}
            {options.mode === "passphrase" && (
              <>
                <Field label={t("wordCount")}>
                  <input
                    type="range" min={2} max={12} value={options.wordCount}
                    onChange={(e) => setOptions((o) => ({ ...o, wordCount: Number(e.target.value) }))}
                    className="w-full accent-[var(--primary)]"
                  />
                  <p className="mt-1 text-xs text-muted">{options.wordCount} words · ~{(options.wordCount * 9.5).toFixed(0)} bits</p>
                </Field>
                <Field label={t("separator")}>
                  <input
                    value={options.separator}
                    onChange={(e) => setOptions((o) => ({ ...o, separator: e.target.value }))}
                    placeholder="-"
                    className={inputClass()}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.capitalize} onChange={(e) => setOptions((o) => ({ ...o, capitalize: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("capitalize")}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.appendNumber} onChange={(e) => setOptions((o) => ({ ...o, appendNumber: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("appendNumber")}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.appendSymbol} onChange={(e) => setOptions((o) => ({ ...o, appendSymbol: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("appendSymbol")}</label>
              </>
            )}
            {options.mode === "pronounceable" && (
              <>
                <Field label={t("length")}>
                  <div className="flex items-center gap-3">
                    <input type="range" min={4} max={128} value={Math.min(options.length, 128)} onChange={(e) => setOptions((o) => ({ ...o, length: Number(e.target.value) }))} className="flex-1 accent-[var(--primary)]" />
                    <input type="number" min={4} max={256} value={options.length} onChange={(e) => setOptions((o) => ({ ...o, length: Number(e.target.value) || 4 }))} className={cn(inputClass(), "w-20")} />
                  </div>
                </Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.pronounceLowerOnly} onChange={(e) => setOptions((o) => ({ ...o, pronounceLowerOnly: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("pronLower")}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.number} onChange={(e) => setOptions((o) => ({ ...o, number: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("number")}</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.symbol} onChange={(e) => setOptions((o) => ({ ...o, symbol: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("symbol")}</label>
              </>
            )}
            {options.mode === "wifi" && (
              <>
                <Field label={t("ssid")}>
                  <input
                    value={options.wifiSsid}
                    onChange={(e) => setOptions((o) => ({ ...o, wifiSsid: e.target.value }))}
                    placeholder="MyHomeNetwork"
                    className={inputClass()}
                  />
                </Field>
                <Field label={t("encryption")}>
                  <select
                    value={options.wifiEncryption}
                    onChange={(e) => setOptions((o) => ({ ...o, wifiEncryption: e.target.value as GenOptions["wifiEncryption"] }))}
                    className={inputClass()}
                  >
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP (legacy)</option>
                    <option value="nopass">No password</option>
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.wifiHidden} onChange={(e) => setOptions((o) => ({ ...o, wifiHidden: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("hidden")}</label>
              </>
            )}
            {(options.mode === "random" || options.mode === "wifi") && (
              <>
                {options.mode === "random" && (
                  <>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.upper} onChange={(e) => setOptions((o) => ({ ...o, upper: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("upper")}</label>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.lower} onChange={(e) => setOptions((o) => ({ ...o, lower: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("lower")}</label>
                    {options.mode === "random" && (
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.symbol} onChange={(e) => setOptions((o) => ({ ...o, symbol: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("symbol")}</label>
                    )}
                    {options.mode === "random" && (
                      <Field label={t("custom")}>
                        <input
                          value={options.custom}
                          onChange={(e) => setOptions((o) => ({ ...o, custom: e.target.value }))}
                          placeholder="extra chars"
                          className={inputClass()}
                        />
                      </Field>
                    )}
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.excludeSimilar} onChange={(e) => setOptions((o) => ({ ...o, excludeSimilar: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("excludeSimilar")}</label>
                    {options.mode === "random" && (
                      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.excludeAmbiguous} onChange={(e) => setOptions((o) => ({ ...o, excludeAmbiguous: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("excludeAmbiguous")}</label>
                    )}
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={options.requireAllSets} onChange={(e) => setOptions((o) => ({ ...o, requireAllSets: e.target.checked }))} className="h-4 w-4 accent-[var(--primary)]" /> {t("requireAll")}</label>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Export single */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="gradient" onClick={regen}>
          <RefreshCw className="h-4 w-4" /> {t("regenerate")}
        </Button>
        <Button variant="outline" onClick={() => void onCopy()}>
          {copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />} {t("copy")}
        </Button>
        <div className="ml-2 flex items-center gap-1.5 text-xs text-muted">
          <Download className="h-3.5 w-3.5" /> {t("bulkExport")}:
        </div>
        <Button size="sm" variant="ghost" onClick={() => void onExport("txt", "single")}><FileText className="h-3.5 w-3.5" /> TXT</Button>
        <Button size="sm" variant="ghost" onClick={() => void onExport("csv", "single")}>CSV</Button>
        <Button size="sm" variant="ghost" onClick={() => void onExport("json", "single")}>JSON</Button>
        <Button size="sm" variant="ghost" onClick={() => void onExport("pdf", "single")}>PDF</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {([
          ["studio", t("studio"), KeyRound],
          ["bulk", t("bulkGenerate"), FileArchive],
          ["history", t("history"), History],
          ["api", t("api"), ShieldCheck],
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

      {tab === "bulk" && (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("bulkCount")}>
              <input
                type="number" min={1} max={10000} value={bulkCount}
                onChange={(e) => setBulkCount(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))}
                className={cn(inputClass(), "w-28")}
              />
            </Field>
            <Button variant="gradient" onClick={onBulk}><Zap className="h-4 w-4" /> {t("bulkGenerate")}</Button>
            <div className="ml-auto flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={() => void onExport("txt", "bulk")}>TXT</Button>
              <Button size="sm" variant="ghost" onClick={() => void onExport("csv", "bulk")}>CSV</Button>
              <Button size="sm" variant="ghost" onClick={() => void onExport("json", "bulk")}>JSON</Button>
              <Button size="sm" variant="ghost" onClick={() => void onExport("pdf", "bulk")}>PDF</Button>
            </div>
          </div>
          {bulk.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="min-w-full text-xs">
                <thead className="bg-card-hover text-left">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Password</th>
                    <th className="px-3 py-2">Entropy</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {bulk.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 text-muted">{i + 1}</td>
                      <td className="px-3 py-2 font-mono break-all">{row.password}</td>
                      <td className="px-3 py-2">{row.entropy.toFixed(1)}</td>
                      <td className="px-3 py-2">
                        <span style={{ color: STRENGTH_COLORS[row.score] }}>●</span>
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="ghost" onClick={() => void onCopy(row.password)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                <li key={h.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="truncate font-mono">{h.password}</p>
                    <p className="text-xs text-muted">{new Date(h.ts).toLocaleString()} · {h.mode} · {h.entropy.toFixed(1)} bits</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => void onCopy(h.password)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4 text-primary" /> POST /api/v1/password</p>
          <p className="text-sm text-muted">
            Returns cryptographically-secure passwords with entropy, score, crack time, optional breach check and AI recommendations.
            Server uses the same Web Crypto engine as the browser studio.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/password \\
  -H "Content-Type: application/json" \\
  -d '{
    "count": 10,
    "options": {
      "mode": "random",
      "length": 24,
      "upper": true, "lower": true, "number": true, "symbol": true,
      "excludeSimilar": true, "requireAllSets": true
    },
    "breachCheck": false
  }'`}</pre>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">Modes</p>
              <ul className="mt-2 list-inside list-disc text-muted">
                <li><code>random</code> — full charset pool</li>
                <li><code>passphrase</code> — Diceware-style words</li>
                <li><code>pronounceable</code> — CV-CVC syllable pattern</li>
                <li><code>pin</code> — digits only</li>
                <li><code>wifi</code> — WPA-2/3 friendly, ≤63 chars</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">Response</p>
              <pre className="mt-2 overflow-x-auto text-muted">{`{
  "ok": true,
  "count": 10,
  "mode": "random",
  "passwords": [
    { "password": "K7#m...", "entropyBits": 157.3, "score": 4, "label": "Very strong" }
  ],
  "aiRecommendations": [...]
}`}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card-hover px-2 py-1.5 text-center">
      <p className="font-display text-sm font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}
