"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import {
  Check,
  ClipboardPaste,
  Copy,
  Download,
  Eye,
  FolderUp,
  History,
  Languages,
  Loader2,
  Link2,
  Pipette,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  ZoomIn,
  ZoomOut,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import {
  aiRecommendColors,
  canvasScreenshotBlob,
  clientToImageCoords,
  complementaryColor,
  contrastRatio,
  dedupePalette,
  detectGradients,
  exportPalette,
  extractDominantColors,
  extractDominantColorsWorker,
  formatColor,
  isSupportedInput,
  loadImageFromUrl,
  loadImageToCanvas,
  nearestMaterial,
  nearestPantone,
  nearestTailwind,
  pickPixel,
  renderMagnifierLens,
  rgbaToHex,
  rgbaToValues,
  simulateColorBlindness,
  sortPalette,
  type ColorBlindMode,
  type ColorFormat,
  type ImageColorMeta,
  type PaletteColor,
  type PaletteExportFormat,
  type PaletteSort,
  type PickedColor,
  type Rgba,
  type ColorValues,
} from "./color-picker-utils";

type Lang = "en" | "es" | "de" | "fr" | "tr" | "hi" | "pt" | "ja";
type Tab = "studio" | "palette" | "contrast" | "accessibility" | "export" | "history" | "api";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", palette: "Palette", contrast: "Contrast", a11y: "A11y", export: "Export", history: "History", api: "API",
    drop: "Drop images, paste, URL, or browse", dropHint: "PNG · JPG · WebP · AVIF · GIF · BMP · SVG — 100% in-browser",
    addFiles: "Add images", addFolder: "Folder", paste: "Paste", urlImport: "URL", clear: "Clear",
    private: "100% private · in-browser", favorite: "Favorite", favorited: "Favorited", ai: "AI tips",
    extract: "Extract palette", lensZoom: "Lens zoom", pickHint: "Click or hover to pick · up to 1000× lens",
    emptyHistory: "No picks yet.", copy: "Copy", screenshot: "Screenshot", emptyPalette: "Extract palette from image",
    contrastCheck: "WCAG contrast", fg: "Foreground", bg: "Background", exportPalette: "Export palette",
  },
  es: { studio: "Estudio", palette: "Paleta", contrast: "Contraste", a11y: "A11y", export: "Exportar", history: "Historial", api: "API", drop: "Suelta imágenes", dropHint: "100% navegador", addFiles: "Añadir", addFolder: "Carpeta", paste: "Pegar", urlImport: "URL", clear: "Limpiar", private: "100% privado", favorite: "Favorito", favorited: "Favorito", ai: "Consejos IA", extract: "Extraer paleta", lensZoom: "Zoom lente", pickHint: "Clic para elegir", emptyHistory: "Sin colores.", copy: "Copiar", screenshot: "Captura", emptyPalette: "Extraer paleta", contrastCheck: "Contraste WCAG", fg: "Primer plano", bg: "Fondo", exportPalette: "Exportar paleta" },
  de: { studio: "Studio", palette: "Palette", contrast: "Kontrast", a11y: "A11y", export: "Export", history: "Verlauf", api: "API", drop: "Bilder ablegen", dropHint: "100% Browser", addFiles: "Hinzufügen", addFolder: "Ordner", paste: "Einfügen", urlImport: "URL", clear: "Löschen", private: "100% privat", favorite: "Favorit", favorited: "Favorit", ai: "KI-Tipps", extract: "Palette extrahieren", lensZoom: "Linsen-Zoom", pickHint: "Klicken zum Auswählen", emptyHistory: "Keine.", copy: "Kopieren", screenshot: "Screenshot", emptyPalette: "Palette extrahieren", contrastCheck: "WCAG-Kontrast", fg: "Vordergrund", bg: "Hintergrund", exportPalette: "Palette exportieren" },
  fr: { studio: "Studio", palette: "Palette", contrast: "Contraste", a11y: "A11y", export: "Exporter", history: "Historique", api: "API", drop: "Déposez images", dropHint: "100% navigateur", addFiles: "Ajouter", addFolder: "Dossier", paste: "Coller", urlImport: "URL", clear: "Effacer", private: "100% privé", favorite: "Favori", favorited: "Favori", ai: "Conseils IA", extract: "Extraire palette", lensZoom: "Zoom loupe", pickHint: "Cliquer pour choisir", emptyHistory: "Aucun.", copy: "Copier", screenshot: "Capture", emptyPalette: "Extraire palette", contrastCheck: "Contraste WCAG", fg: "Premier plan", bg: "Arrière-plan", exportPalette: "Exporter palette" },
  tr: { studio: "Stüdyo", palette: "Palet", contrast: "Kontrast", a11y: "Erişilebilirlik", export: "Dışa aktar", history: "Geçmiş", api: "API", drop: "Görsel bırakın", dropHint: "%100 tarayıcı", addFiles: "Ekle", addFolder: "Klasör", paste: "Yapıştır", urlImport: "URL", clear: "Temizle", private: "%100 özel", favorite: "Favori", favorited: "Favori", ai: "AI ipuçları", extract: "Palet çıkar", lensZoom: "Lens zoom", pickHint: "Seçmek için tıklayın", emptyHistory: "Yok.", copy: "Kopyala", screenshot: "Ekran görüntüsü", emptyPalette: "Palet çıkar", contrastCheck: "WCAG kontrast", fg: "Ön plan", bg: "Arka plan", exportPalette: "Palet dışa aktar" },
  hi: { studio: "स्टूडियो", palette: "पैलेट", contrast: "कंट्रास्ट", a11y: "A11y", export: "निर्यात", history: "इतिहास", api: "API", drop: "छवियाँ छोड़ें", dropHint: "100% ब्राउज़र", addFiles: "जोड़ें", addFolder: "फ़ोल्डर", paste: "पेस्ट", urlImport: "URL", clear: "साफ़", private: "100% निजी", favorite: "पसंदीदा", favorited: "पसंदीदा", ai: "AI सुझाव", extract: "पैलेट निकालें", lensZoom: "लेंस ज़ूम", pickHint: "चुनने के लिए क्लिक करें", emptyHistory: "कोई नहीं।", copy: "कॉपी", screenshot: "स्क्रीनशॉट", emptyPalette: "पैलेट निकालें", contrastCheck: "WCAG कंट्रास्ट", fg: "अग्रभूमि", bg: "पृष्ठभूमि", exportPalette: "पैलेट निर्यात" },
  pt: { studio: "Estúdio", palette: "Paleta", contrast: "Contraste", a11y: "A11y", export: "Exportar", history: "Histórico", api: "API", drop: "Solte imagens", dropHint: "100% navegador", addFiles: "Adicionar", addFolder: "Pasta", paste: "Colar", urlImport: "URL", clear: "Limpar", private: "100% privado", favorite: "Favorito", favorited: "Favorito", ai: "Dicas IA", extract: "Extrair paleta", lensZoom: "Zoom lente", pickHint: "Clique para escolher", emptyHistory: "Nenhum.", copy: "Copiar", screenshot: "Captura", emptyPalette: "Extrair paleta", contrastCheck: "Contraste WCAG", fg: "Primeiro plano", bg: "Fundo", exportPalette: "Exportar paleta" },
  ja: { studio: "スタジオ", palette: "パレット", contrast: "コントラスト", a11y: "アクセシビリティ", export: "エクスポート", history: "履歴", api: "API", drop: "画像をドロップ", dropHint: "100%ブラウザ", addFiles: "追加", addFolder: "フォルダ", paste: "ペースト", urlImport: "URL", clear: "消去", private: "100%プライベート", favorite: "お気に入り", favorited: "お気に入り", ai: "AIヒント", extract: "パレット抽出", lensZoom: "レンズズーム", pickHint: "クリックで選択", emptyHistory: "なし。", copy: "コピー", screenshot: "スクリーンショット", emptyPalette: "パレット抽出", contrastCheck: "WCAGコントラスト", fg: "前景", bg: "背景", exportPalette: "パレット出力" },
};

const LANG_LABELS: Record<Lang, string> = {
  en: "English", es: "Español", de: "Deutsch", fr: "Français", tr: "Türkçe", hi: "हिन्दी", pt: "Português", ja: "日本語",
};

const COLOR_FORMATS: ColorFormat[] = ["hex", "hexa", "rgb", "rgba", "hsl", "hsla", "hsv", "hsb", "cmyk", "lab", "lch", "xyz", "css", "tailwind", "material"];
const EXPORT_FORMATS: PaletteExportFormat[] = ["css", "json", "txt", "gpl", "ase", "svg", "pdf"];

const HISTORY_KEY = "toolnest-color-picker-history";
const SETTINGS_KEY = "toolnest-color-picker-settings";
const LANG_KEY = "toolnest-color-picker-lang";

interface ImageItem { id: string; meta: ImageColorMeta; previewUrl: string; canvas: HTMLCanvasElement; }

function valueForFormat(values: ColorValues, f: ColorFormat): string {
  if (f === "css") return values.cssVar;
  const key = f as keyof ColorValues;
  return String(values[key] ?? values.hex);
}

function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
let _id = 0;
const nextId = () => `cp-${Date.now()}-${++_id}`;

export function ColorPicker() {
  const favorites = useFavorites();
  const slug = "color-picker";

  const [items, setItems] = useState<ImageItem[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("studio");
  const [lang, setLang] = useState<Lang>("en");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lensZoom, setLensZoom] = useState(32);
  const [imgZoom, setImgZoom] = useState(1);
  const [lensUrl, setLensUrl] = useState("");
  const [picked, setPicked] = useState<PickedColor | null>(null);
  const [pickHistory, setPickHistory] = useState<PickedColor[]>([]);
  const [palette, setPalette] = useState<PaletteColor[]>([]);
  const [gradients, setGradients] = useState<ReturnType<typeof detectGradients>>([]);
  const [copied, setCopied] = useState("");
  const [displayFormat, setDisplayFormat] = useState<ColorFormat>("hex");
  const [paletteSort, setPaletteSort] = useState<PaletteSort>("frequency");
  const [useWorker, setUseWorker] = useState(true);
  const [cbMode, setCbMode] = useState<ColorBlindMode>("normal");
  const [contrastFg, setContrastFg] = useState<Rgba>({ r: 0, g: 0, b: 0, a: 255 });
  const [contrastBg, setContrastBg] = useState<Rgba>({ r: 255, g: 255, b: 255, a: 255 });
  const [urlInput, setUrlInput] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [exportFmt, setExportFmt] = useState<PaletteExportFormat>("css");

  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const t = useCallback((k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k, [lang]);
  const active = items[activeIdx];

  useEffect(() => {
    try {
      const s = localStorage.getItem(SETTINGS_KEY);
      if (s) {
        const p = JSON.parse(s);
        if (p.lensZoom) setLensZoom(p.lensZoom);
        if (p.displayFormat) setDisplayFormat(p.displayFormat);
        if (typeof p.useWorker === "boolean") setUseWorker(p.useWorker);
      }
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
      setPickHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ lensZoom, displayFormat, useWorker })); } catch { /* ignore */ }
  }, [lensZoom, displayFormat, useWorker]);
  useEffect(() => { try { localStorage.setItem(LANG_KEY, lang); } catch { /* ignore */ } }, [lang]);

  useEffect(() => () => {
    items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
  }, []);

  const addCanvasItem = useCallback((canvas: HTMLCanvasElement, meta: ImageColorMeta) => {
    const previewUrl = canvas.toDataURL("image/png");
    setItems((prev) => [...prev, { id: nextId(), meta, previewUrl, canvas }]);
    if (!items.length) setActiveIdx(0);
  }, [items.length]);

  const addFiles = useCallback(async (files: File[]) => {
    let n = 0;
    for (const file of files) {
      if (!isSupportedInput(file) && !file.type.startsWith("image/")) {
        toast.error(`Unsupported: ${file.name}`);
        continue;
      }
      try {
        const { canvas, meta } = await loadImageToCanvas(file);
        addCanvasItem(canvas, meta);
        n++;
      } catch {
        toast.error(`${file.name}: failed to load`);
      }
    }
    if (n) toast.success(`${n} image(s) added`);
  }, [addCanvasItem]);

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

  const importUrl = async () => {
    if (!urlInput.trim()) return;
    setBusy(true);
    try {
      const { canvas, meta } = await loadImageFromUrl(urlInput.trim());
      addCanvasItem(canvas, { ...meta, name: urlInput.slice(0, 60) });
      setUrlInput("");
      setShowUrl(false);
      toast.success("Image loaded from URL");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "URL import failed — CORS may block this host");
    } finally {
      setBusy(false);
    }
  };

  const handlePick = useCallback((clientX: number, clientY: number) => {
    if (!active || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const { x, y } = clientToImageCoords(clientX, clientY, rect, active.meta.width, active.meta.height);
    const rgba = pickPixel(active.canvas, x, y);
    const entry: PickedColor = { id: nextId(), rgba, x, y, ts: Date.now() };
    setPicked(entry);
    setContrastFg(rgba);
    setPickHistory((h) => {
      const n = [entry, ...h.filter((p) => p.rgba.r !== rgba.r || p.rgba.g !== rgba.g || p.rgba.b !== rgba.b || p.rgba.a !== rgba.a)].slice(0, 100);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(n));
      return n;
    });
    setLensUrl(renderMagnifierLens(active.canvas, x, y, lensZoom));
  }, [active, lensZoom]);

  const handleMove = useCallback((clientX: number, clientY: number) => {
    if (!active || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const { x, y } = clientToImageCoords(clientX, clientY, rect, active.meta.width, active.meta.height);
    setLensUrl(renderMagnifierLens(active.canvas, x, y, lensZoom));
  }, [active, lensZoom]);

  const extractPalette = async () => {
    if (!active) return;
    setBusy(true);
    try {
      let colors: PaletteColor[] | null = null;
      if (useWorker) colors = await extractDominantColorsWorker(active.canvas, 12, true);
      if (!colors) colors = extractDominantColors(active.canvas, 12, true);
      const deduped = dedupePalette(colors, 10);
      setPalette(sortPalette(deduped, paletteSort));
      setGradients(detectGradients(active.canvas));
      setTab("palette");
      toast.success(`${deduped.length} dominant colors extracted`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  };

  const copyVal = async (val: string) => {
    await navigator.clipboard.writeText(val);
    setCopied(val);
    setTimeout(() => setCopied(""), 1200);
    toast.success("Copied");
  };

  const downloadExport = async () => {
    if (!palette.length) { toast.error("Extract palette first"); return; }
    const name = active?.meta.name.replace(/\.[^.]+$/, "") ?? "palette";
    const result = exportPalette(exportFmt, palette, name);
    const blob = result instanceof Promise ? await result : typeof result === "string" ? new Blob([result], { type: "text/plain" }) : result;
    const ext = exportFmt === "pdf" ? "pdf" : exportFmt === "ase" ? "ase" : exportFmt === "svg" ? "svg" : exportFmt === "gpl" ? "gpl" : exportFmt === "json" ? "json" : exportFmt === "css" ? "css" : "txt";
    downloadBlob(blob, `${name}-palette.${ext}`);
    toast.success(`Exported ${exportFmt.toUpperCase()}`);
  };

  const screenshot = async () => {
    if (!active) return;
    downloadBlob(await canvasScreenshotBlob(active.canvas), `${active.meta.name.replace(/\.[^.]+$/, "")}-screenshot.png`);
    toast.success("Screenshot saved");
  };

  const sortedPalette = useMemo(() => sortPalette(palette, paletteSort), [palette, paletteSort]);
  const pickedValues = picked ? rgbaToValues(picked.rgba) : null;
  const pickedSim = picked ? simulateColorBlindness(picked.rgba, cbMode) : null;
  const contrast = contrastRatio(contrastFg, contrastBg);
  const recs = useMemo(
    () => aiRecommendColors(picked?.rgba ?? null, palette, active?.meta ?? null),
    [picked, palette, active],
  );

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void addFiles(Array.from(e.dataTransfer.files));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "+" || e.key === "=") { e.preventDefault(); setLensZoom((z) => clamp(z * 1.5, 2, 1000)); }
    if (e.key === "-") { e.preventDefault(); setLensZoom((z) => clamp(z / 1.5, 2, 1000)); }
    if (e.key === "e" && !e.ctrlKey) { e.preventDefault(); void extractPalette(); }
  };

  const applyRec = (action?: string) => {
    if (action === "extract") void extractPalette();
    if (action === "contrast") setTab("contrast");
    if (action === "complement" && picked) {
      const c = complementaryColor(picked.rgba);
      void copyVal(rgbaToHex(c.r, c.g, c.b).hex);
    }
    if (action === "tailwind" && picked) void copyVal(nearestTailwind(picked.rgba).name);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6" onKeyDown={onKeyDown} tabIndex={0}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <Pipette className="h-3.5 w-3.5" /> {t("private")}
          </span>
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
          onDrop={onDrop}
          className={cn("flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-14 text-center", dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50")}
        >
          <Pipette className="mb-4 h-14 w-14 text-primary" />
          <p className="font-display text-xl font-semibold">{t("drop")}</p>
          <p className="mt-2 text-sm text-muted">{t("dropHint")}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="gradient" type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}><UploadCloud className="h-4 w-4" /> {t("addFiles")}</Button>
            <Button variant="outline" type="button" onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}><FolderUp className="h-4 w-4" /> {t("addFolder")}</Button>
            <Button variant="outline" type="button" onClick={(e) => { e.stopPropagation(); setShowUrl(true); }}><Link2 className="h-4 w-4" /> {t("urlImport")}</Button>
          </div>
          {showUrl && (
            <div className="mt-4 flex w-full max-w-md gap-2" onClick={(e) => e.stopPropagation()}>
              <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://example.com/image.png" className={cn(inputClass(), "flex-1")} />
              <Button variant="gradient" disabled={busy} onClick={() => void importUrl()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load"}</Button>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} />
          <input ref={folderInputRef} type="file" multiple className="hidden" {...{ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>} onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><UploadCloud className="h-4 w-4" /> {t("addFiles")}</Button>
          <Button variant="outline" size="sm" onClick={() => setShowUrl((s) => !s)}><Link2 className="h-4 w-4" /> {t("urlImport")}</Button>
          <Button variant="outline" size="sm" onClick={() => void screenshot()}><Camera className="h-4 w-4" /> {t("screenshot")}</Button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void addFiles(Array.from(e.target.files ?? []))} />
          <Button variant="outline" size="sm" className="ml-auto text-error" onClick={() => { items.forEach((i) => URL.revokeObjectURL(i.previewUrl)); setItems([]); setPicked(null); setPalette([]); }}><Trash2 className="h-4 w-4" /> {t("clear")}</Button>
        </div>
      )}

      {showUrl && items.length > 0 && (
        <div className="flex gap-2">
          <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://..." className={cn(inputClass(), "flex-1")} />
          <Button variant="gradient" disabled={busy} onClick={() => void importUrl()}>Load URL</Button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
            {([["studio", t("studio"), Pipette], ["palette", t("palette"), Sparkles], ["contrast", t("contrast"), Eye], ["accessibility", t("a11y"), Eye], ["export", t("export"), Download], ["history", t("history"), History], ["api", t("api"), Settings2]] as const).map(([k, lbl, Icon]) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={cn("flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium", tab === k ? "bg-primary text-white" : "text-muted hover:text-foreground")}>
                <Icon className="h-4 w-4" /><span className="hidden sm:inline">{lbl}</span>
              </button>
            ))}
          </div>

          {tab === "studio" && active && (
            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                {items.length > 1 && (
                  <select value={activeIdx} onChange={(e) => setActiveIdx(Number(e.target.value))} className={cn(inputClass(), "w-auto max-w-full")}>
                    {items.map((it, i) => <option key={it.id} value={i}>{it.meta.name}</option>)}
                  </select>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setImgZoom((z) => clamp(z - 0.25, 0.25, 4))}><ZoomOut className="h-4 w-4" /></Button>
                  <span className="text-xs text-muted tabular-nums">{Math.round(imgZoom * 100)}%</span>
                  <Button size="sm" variant="outline" onClick={() => setImgZoom((z) => clamp(z + 0.25, 0.25, 4))}><ZoomIn className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void extractPalette()}><Sparkles className="h-4 w-4" /> {t("extract")}</Button>
                </div>
                <div className="relative overflow-auto rounded-2xl border border-border bg-card p-2 max-h-[560px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={active.previewUrl}
                    alt={active.meta.name}
                    draggable={false}
                    className="max-w-none cursor-crosshair"
                    style={{ transform: `scale(${imgZoom})`, transformOrigin: "top left" }}
                    onClick={(e) => handlePick(e.clientX, e.clientY)}
                    onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
                  />
                  {lensUrl && (
                    <div className="pointer-events-none absolute bottom-4 right-4 rounded-xl border-2 border-primary bg-card p-1 shadow-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={lensUrl} alt="Magnifier" width={160} height={160} className="rounded-lg" />
                      <p className="px-1 text-center text-[10px] text-muted">{lensZoom}× lens</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted">{t("pickHint")} · {active.meta.width}×{active.meta.height}px</p>
              </div>

              <div className="space-y-4">
                <Field label={t("lensZoom")}>
                  <input type="range" min={2} max={1000} step={1} value={lensZoom} onChange={(e) => setLensZoom(Number(e.target.value))} className="w-full accent-[var(--primary)]" />
                  <span className="text-xs text-muted tabular-nums">{lensZoom}×</span>
                </Field>
                <Field label="Display format">
                  <select value={displayFormat} onChange={(e) => setDisplayFormat(e.target.value as ColorFormat)} className={inputClass()}>
                    {COLOR_FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                  </select>
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={useWorker} onChange={(e) => setUseWorker(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
                  Web Worker palette extraction
                </label>

                {picked && pickedValues && (
                  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="h-20 rounded-lg border border-border" style={{ backgroundColor: rgbaToHex(picked.rgba.r, picked.rgba.g, picked.rgba.b, picked.rgba.a).hexa }} />
                    <p className="text-xs text-muted">Pixel ({picked.x}, {picked.y}) · α {Math.round((picked.rgba.a / 255) * 100)}%</p>
                    <button type="button" onClick={() => void copyVal(formatColor(picked.rgba, displayFormat))} className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 font-mono text-xs hover:bg-card-hover">
                      {formatColor(picked.rgba, displayFormat)}
                      {copied === formatColor(picked.rgba, displayFormat) ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4 text-muted" />}
                    </button>
                    <div className="max-h-40 space-y-1 overflow-y-auto">
                      {COLOR_FORMATS.filter((f) => f !== "tailwind" && f !== "material").map((f) => (
                        <button key={f} type="button" onClick={() => void copyVal(valueForFormat(pickedValues, f))} className="flex w-full items-center justify-between rounded px-2 py-1 font-mono text-[10px] hover:bg-card-hover">
                          <span className="uppercase text-muted">{f}</span>
                          <span className="truncate">{valueForFormat(pickedValues, f)}</span>
                        </button>
                      ))}
                    </div>
                    <div className="space-y-1 border-t border-border pt-2 text-xs">
                      <p>Tailwind: <button type="button" className="text-primary hover:underline" onClick={() => void copyVal(nearestTailwind(picked.rgba).name)}>{nearestTailwind(picked.rgba).name}</button> (ΔE {nearestTailwind(picked.rgba).deltaE})</p>
                      <p>Material: <button type="button" className="text-primary hover:underline" onClick={() => void copyVal(nearestMaterial(picked.rgba).name)}>{nearestMaterial(picked.rgba).name}</button></p>
                      <p>Pantone ≈ <button type="button" className="text-primary hover:underline" onClick={() => void copyVal(nearestPantone(picked.rgba).name)}>{nearestPantone(picked.rgba).name}</button></p>
                    </div>
                  </div>
                )}

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
              </div>
            </div>
          )}

          {tab === "palette" && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="gradient" disabled={busy || !active} onClick={() => void extractPalette()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {t("extract")}</Button>
                <select value={paletteSort} onChange={(e) => setPaletteSort(e.target.value as PaletteSort)} className={cn(inputClass(), "w-auto")}>
                  <option value="frequency">Sort: frequency</option>
                  <option value="hue">Sort: hue</option>
                  <option value="lightness">Sort: lightness</option>
                  <option value="saturation">Sort: saturation</option>
                </select>
              </div>
              {sortedPalette.length === 0 ? (
                <p className="py-12 text-center text-muted">{t("emptyPalette")}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {sortedPalette.map((c) => (
                    <button key={c.hex} type="button" onClick={() => void copyVal(c.hex)} className="flex items-center gap-3 rounded-lg border border-border p-2 text-left hover:bg-card-hover">
                      <span className="h-12 w-12 shrink-0 rounded-md border border-border" style={{ backgroundColor: c.hex }} />
                      <span className="min-w-0">
                        <span className="block font-mono text-sm">{c.hex}</span>
                        <span className="text-xs text-muted">{c.percentage}%</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {gradients.length > 0 && (
                <div className="space-y-2 border-t border-border pt-4">
                  <p className="text-sm font-medium">Gradient hints</p>
                  {gradients.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="h-6 w-6 rounded border" style={{ background: g.start }} />
                      <span>→</span>
                      <span className="h-6 w-6 rounded border" style={{ background: g.end }} />
                      <span className="text-muted capitalize">{g.direction} · {g.confidence}% confidence</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "contrast" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <p className="font-medium">{t("contrastCheck")}</p>
                <Field label={t("fg")}>
                  <input type="color" value={rgbaToHex(contrastFg.r, contrastFg.g, contrastFg.b).hex} onChange={(e) => { const c = e.target.value; setContrastFg({ r: parseInt(c.slice(1, 3), 16), g: parseInt(c.slice(3, 5), 16), b: parseInt(c.slice(5, 7), 16), a: 255 }); }} className="h-10 w-full cursor-pointer rounded border border-border" />
                </Field>
                <Field label={t("bg")}>
                  <input type="color" value={rgbaToHex(contrastBg.r, contrastBg.g, contrastBg.b).hex} onChange={(e) => { const c = e.target.value; setContrastBg({ r: parseInt(c.slice(1, 3), 16), g: parseInt(c.slice(3, 5), 16), b: parseInt(c.slice(5, 7), 16), a: 255 }); }} className="h-10 w-full cursor-pointer rounded border border-border" />
                </Field>
                {picked && (
                  <Button size="sm" variant="outline" onClick={() => { setContrastFg(picked.rgba); setContrastBg({ r: 255, g: 255, b: 255, a: 255 }); }}>Use picked as foreground</Button>
                )}
              </div>
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="rounded-lg p-6 text-center text-lg font-semibold" style={{ color: rgbaToHex(contrastFg.r, contrastFg.g, contrastFg.b).hex, backgroundColor: rgbaToHex(contrastBg.r, contrastBg.g, contrastBg.b).hex }}>
                  Sample text Aa
                </div>
                <p className="text-2xl font-bold tabular-nums">{contrast.ratio}:1</p>
                <ul className="space-y-1 text-sm">
                  <li className={contrast.aaNormal ? "text-success" : "text-error"}>WCAG AA normal text (4.5:1): {contrast.aaNormal ? "Pass" : "Fail"}</li>
                  <li className={contrast.aaLarge ? "text-success" : "text-error"}>WCAG AA large text (3:1): {contrast.aaLarge ? "Pass" : "Fail"}</li>
                  <li className={contrast.aaaNormal ? "text-success" : "text-error"}>WCAG AAA normal (7:1): {contrast.aaaNormal ? "Pass" : "Fail"}</li>
                  <li className={contrast.aaaLarge ? "text-success" : "text-error"}>WCAG AAA large (4.5:1): {contrast.aaaLarge ? "Pass" : "Fail"}</li>
                </ul>
              </div>
            </div>
          )}

          {tab === "accessibility" && (
            !picked ? (
              <p className="py-12 text-center text-muted">Pick a color in Studio first.</p>
            ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(["normal", "protanopia", "deuteranopia", "tritanopia"] as ColorBlindMode[]).map((mode) => {
                const sim = simulateColorBlindness(picked.rgba, mode);
                const hex = rgbaToHex(sim.r, sim.g, sim.b).hex;
                return (
                  <div key={mode} className="rounded-xl border border-border bg-card p-4">
                    <p className="mb-2 text-sm font-medium capitalize">{mode}</p>
                    <div className="mb-2 h-16 rounded-lg border" style={{ backgroundColor: hex }} />
                    <p className="font-mono text-xs">{hex}</p>
                  </div>
                );
              })}
              <div className="sm:col-span-2">
                <Field label="Simulation mode (live lens)">
                  <select value={cbMode} onChange={(e) => setCbMode(e.target.value as ColorBlindMode)} className={inputClass()}>
                    <option value="normal">Normal vision</option>
                    <option value="protanopia">Protanopia</option>
                    <option value="deuteranopia">Deuteranopia</option>
                    <option value="tritanopia">Tritanopia</option>
                  </select>
                </Field>
                {pickedSim && (
                  <div className="mt-3 h-20 rounded-lg border" style={{ backgroundColor: rgbaToHex(pickedSim.r, pickedSim.g, pickedSim.b).hex }} />
                )}
              </div>
            </div>
            )
          )}

          {tab === "export" && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-4 max-w-md">
              <Field label={t("exportPalette")}>
                <select value={exportFmt} onChange={(e) => setExportFmt(e.target.value as PaletteExportFormat)} className={inputClass()}>
                  {EXPORT_FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
              </Field>
              <Button variant="gradient" disabled={!palette.length} onClick={() => void downloadExport()}><Download className="h-4 w-4" /> Download {exportFmt.toUpperCase()}</Button>
              <p className="text-xs text-muted">ASE · GPL · CSS · JSON · TXT · SVG · PDF palette formats supported.</p>
            </div>
          )}

          {tab === "history" && (
            <div className="rounded-xl border border-border bg-card p-4">
              {pickHistory.length === 0 ? <p className="py-12 text-center text-sm text-muted">{t("emptyHistory")}</p> : (
                <div className="flex flex-wrap gap-2">
                  {pickHistory.map((p) => (
                    <button key={p.id} type="button" title={rgbaToHex(p.rgba.r, p.rgba.g, p.rgba.b).hex} onClick={() => void copyVal(rgbaToHex(p.rgba.r, p.rgba.g, p.rgba.b).hex)} className="h-10 w-10 rounded-md border border-border" style={{ backgroundColor: rgbaToHex(p.rgba.r, p.rgba.g, p.rgba.b, p.rgba.a).hexa }} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <p className="font-medium">POST /api/v1/image/color-pick</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`curl -X POST https://toolnest.io/api/v1/image/color-pick \\
  -H "Content-Type: application/json" \\
  -d '{
    "image": "data:image/png;base64,...",
    "x": 120,
    "y": 45,
    "extractPalette": true,
    "paletteCount": 8
  }'`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
