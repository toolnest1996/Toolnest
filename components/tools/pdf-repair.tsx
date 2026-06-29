"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Eye,
  FileArchive,
  FolderUp,
  History,
  Loader2,
  Shield,
  Star,
  UploadCloud,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { useFavorites } from "@/lib/store/use-favorites";
import { PdfEncryptedError, type PdfDocument } from "./pdf-merge-utils";
import {
  DEFAULT_REPAIR_OPTIONS,
  analyzePdfIssues,
  executeBatchRepair,
  parsePdf,
  repairPdf,
  renderThumb,
  smartRepairTips,
  zipRepairedFiles,
  type PdfIssueReport,
  type RepairStrategy,
} from "./pdf-repair-utils";

type Lang = "en" | "es";
type Tab = "studio" | "preview" | "batch" | "history" | "api";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    studio: "Studio", preview: "Preview", batch: "Batch", history: "History", api: "API",
    drop: "Drop a PDF to diagnose & repair", private: "100% private · in-browser", repair: "Repair & Download",
    previewBtn: "Preview", favorite: "Favorite", favorited: "Favorited", batchZip: "Batch ZIP",
    emptyHistory: "No repairs yet.", strategy: "Strategy", issues: "Detected issues",
  },
  es: {
    studio: "Estudio", preview: "Vista previa", batch: "Lote", history: "Historial", api: "API",
    drop: "Suelta un PDF para reparar", private: "100% privado", repair: "Reparar", previewBtn: "Vista previa",
    favorite: "Favorito", favorited: "Favorito", batchZip: "ZIP", emptyHistory: "Sin historial.",
    strategy: "Estrategia", issues: "Problemas detectados",
  },
};

const STRATEGIES: { id: RepairStrategy; label: string; hint: string }[] = [
  { id: "resave", label: "Re-save (pdf-lib)", hint: "Fast — rewrites PDF structure" },
  { id: "flatten", label: "Flatten / copy pages", hint: "Copy pages into a fresh document" },
  { id: "rasterize", label: "Rasterize rebuild", hint: "Render pages to JPG — best for heavy corruption" },
];

const SETTINGS_KEY = "toolnest-pdf-repair-settings";
const HISTORY_KEY = "toolnest-pdf-repair-history";
const LANG_KEY = "toolnest-pdf-repair-lang";

interface HistoryEntry { id: string; name: string; strategy: RepairStrategy; bytes: number; ts: number; }

export function PdfRepair() {
  const favorites = useFavorites();
  const slug = "pdf-repair";

  const inputRef = useRef<HTMLInputElement>(null);
  const batchRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<PdfDocument | null>(null);
  const [rawBytes, setRawBytes] = useState<ArrayBuffer | null>(null);
  const [batchSources, setBatchSources] = useState<PdfDocument[]>([]);
  const [report, setReport] = useState<PdfIssueReport | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("studio");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingUnlock, setPendingUnlock] = useState<{ file: File; password: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lang, setLang] = useState<Lang>("en");
  const [strategy, setStrategy] = useState<RepairStrategy>("resave");
  const [password, setPassword] = useState("");
  const [dpi, setDpi] = useState(150);

  const t = (k: string) => STRINGS[lang][k] ?? STRINGS.en[k] ?? k;

  const tips = useMemo(
    () => (report ? smartRepairTips(report, strategy) : []),
    [report, strategy],
  );

  const loadPdf = async (file: File, pwd?: string) => {
    setLoading(true);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    const buf = await file.arrayBuffer();
    setRawBytes(buf);
    try {
      const doc = await parsePdf(file, pwd);
      setSource(doc);
      setReport(await analyzePdfIssues(doc.bytes, pwd));
      try {
        setThumbUrl(await renderThumb(doc.bytes, 0));
      } catch {
        setThumbUrl(null);
      }
      toast.success("PDF loaded — issues analyzed");
    } catch (e) {
      if (e instanceof PdfEncryptedError) {
        setPendingUnlock({ file, password: "" });
        return;
      }
      setSource(null);
      setReport(await analyzePdfIssues(buf, pwd));
      toast.warning("Could not fully parse PDF — try repair strategies");
    } finally {
      setLoading(false);
    }
  };

  const addBatch = async (files: FileList | File[]) => {
    const pdfs = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    setLoading(true);
    try {
      const loaded: PdfDocument[] = [];
      for (const f of pdfs) {
        try { loaded.push(await parsePdf(f)); } catch { /* skip */ }
      }
      if (loaded.length) {
        setBatchSources((p) => [...p, ...loaded]);
        toast.success(`${loaded.length} PDF(s) queued`);
      }
    } finally {
      setLoading(false);
    }
  };

  const repairBytes = rawBytes ?? source?.bytes ?? null;

  const runRepair = async (download: boolean) => {
    const bytes = rawBytes ?? source?.bytes;
    if (!bytes) return;
    setBusy(true);
    setProgress(0);
    try {
      const data = await repairPdf(bytes, {
        ...DEFAULT_REPAIR_OPTIONS,
        strategy,
        password: password || undefined,
        dpi,
      }, setProgress);
      const blob = new Blob([data as BlobPart], { type: "application/pdf" });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      if (download) {
        const stem = source?.name.replace(/\.pdf$/i, "") || "repaired";
        downloadBlob(blob, `${stem}-repaired.pdf`);
        setHistory((h) => [{ id: crypto.randomUUID(), name: source?.name ?? "document.pdf", strategy, bytes: data.byteLength, ts: Date.now() }, ...h].slice(0, 20));
        toast.success(`Repaired · ${formatBytes(data.byteLength)}`);
      } else {
        setTab("preview");
        toast.success("Preview ready");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Repair failed");
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
      const files = await executeBatchRepair(
        list.map((d) => ({ name: d.name, bytes: d.bytes })),
        { ...DEFAULT_REPAIR_OPTIONS, strategy, password: password || undefined, dpi },
        setProgress,
      );
      if (files.length === 1) {
        downloadBlob(new Blob([files[0]!.data as BlobPart], { type: "application/pdf" }), `${files[0]!.name}.pdf`);
      } else {
        downloadBlob(await zipRepairedFiles(files), "batch-repair.zip");
      }
      toast.success(`Batch complete · ${files.length} file(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw) as { strategy?: RepairStrategy; dpi?: number };
        if (s.strategy) setStrategy(s.strategy);
        if (typeof s.dpi === "number") setDpi(s.dpi);
      }
      const h = localStorage.getItem(HISTORY_KEY);
      if (h) setHistory(JSON.parse(h) as HistoryEntry[]);
      const l = localStorage.getItem(LANG_KEY) as Lang | null;
      if (l && STRINGS[l]) setLang(l);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ strategy, dpi }));
  }, [strategy, dpi]);

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
            <option value="en">English</option>
            <option value="es">Español</option>
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
        <p className="font-display text-lg font-semibold">Ultra PDF Repair Studio</p>
        <p className="mt-1 text-sm text-muted">{source ? `${source.name} · ${formatBytes(source.size)}` : t("drop")}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}><UploadCloud className="h-4 w-4" /> Add PDF</Button>
          <Button type="button" variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); batchRef.current?.click(); }}><FolderUp className="h-4 w-4" /> Batch</Button>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadPdf(f); e.target.value = ""; }} />
        <input ref={batchRef} type="file" accept=".pdf,application/pdf" multiple className="hidden" onChange={(e) => { if (e.target.files) void addBatch(e.target.files); e.target.value = ""; }} />
      </div>

      {pendingUnlock && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <input type="password" value={pendingUnlock.password} onChange={(e) => setPendingUnlock({ ...pendingUnlock, password: e.target.value })} className={cn(inputClass(), "max-w-xs")} placeholder="PDF password" />
          <Button size="sm" onClick={() => { void loadPdf(pendingUnlock.file, pendingUnlock.password); setPendingUnlock(null); }}>Unlock</Button>
        </div>
      )}

      {(source || report) && (
        <>
          {report && (
            <div className={cn("rounded-xl border px-4 py-3 text-sm", report.severity === "critical" ? "border-red-500/30 bg-red-500/5" : report.severity === "warning" ? "border-amber-500/30 bg-amber-500/5" : "border-border bg-card")}>
              <p className="mb-2 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" /> {t("issues")} ({report.severity})</p>
              <ul className="list-inside list-disc text-muted">{report.summary.map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="mt-2 text-xs text-muted">{report.pageCount} pages · {formatBytes(report.fileSize)}</p>
            </div>
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
              <div className="rounded-xl border border-border bg-card p-4">
                {thumbUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={thumbUrl} alt="Preview" className="mx-auto max-w-md rounded-lg border border-border" />
                ) : (
                  <p className="py-12 text-center text-muted">No preview — file may be too damaged for thumbnail.</p>
                )}
              </div>
              <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                <Field label={t("strategy")}>
                  <select value={strategy} onChange={(e) => setStrategy(e.target.value as RepairStrategy)} className={inputClass()}>
                    {STRATEGIES.map((s) => <option key={s.id} value={s.id}>{s.label} — {s.hint}</option>)}
                  </select>
                </Field>
                {report?.encrypted && (
                  <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass()} /></Field>
                )}
                {strategy === "rasterize" && (
                  <Field label={`DPI: ${dpi}`}><input type="range" min={72} max={300} value={dpi} onChange={(e) => setDpi(Number(e.target.value))} className="w-full accent-[var(--primary)]" /></Field>
                )}
                <div className="flex flex-col gap-2">
                  <Button variant="gradient" disabled={busy || !repairBytes} onClick={() => void runRepair(true)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />} {t("repair")}</Button>
                  <Button variant="outline" disabled={busy || !repairBytes} onClick={() => void runRepair(false)}><Eye className="h-4 w-4" /> {t("previewBtn")}</Button>
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
              <p className="text-sm text-muted">{batchSources.length || (source ? 1 : 0)} PDF(s)</p>
              <Button variant="gradient" disabled={busy} onClick={() => void runBatch()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} {t("batchZip")}</Button>
            </div>
          )}

          {tab === "history" && (
            <div className="rounded-xl border border-border bg-card p-4">
              {history.length === 0 ? <p className="py-8 text-center text-muted">{t("emptyHistory")}</p> : (
                <ul className="divide-y divide-border text-sm">{history.map((h) => <li key={h.id} className="flex justify-between py-2"><span>{h.name} · {h.strategy}</span><span className="text-muted">{formatBytes(h.bytes)}</span></li>)}</ul>
              )}
            </div>
          )}

          {tab === "api" && (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <p className="flex items-center gap-2 font-medium"><Shield className="h-4 w-4 text-primary" /> POST /api/v1/pdf/repair</p>
              <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs">{`POST /api/v1/pdf/repair
{
  "pdf": "JVBERi0x...",
  "options": { "strategy": "resave" }
}`}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
