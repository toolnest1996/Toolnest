"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  Download,
  Fingerprint,
  History,
  Layers,
  Loader2,
  QrCode,
  ScanLine,
  Settings2,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob } from "@/lib/utils";
import {
  analyzeEntropy,
  clearHistory,
  createUuidQrDataUrl,
  downloadUuidQrPng,
  downloadUuidQrSvg,
  DEFAULT_UUID_OPTIONS,
  detectCollisions,
  exportAsCsv,
  exportAsJson,
  exportAsTxt,
  exportAsXml,
  FORMAT_OPTIONS,
  generateBulk,
  loadFavorites,
  loadHistory,
  parseUuidList,
  saveHistoryEntry,
  SETTINGS_KEY,
  smartUuidSuggestions,
  toGenerateOptions,
  toggleFavorite,
  UUID_PRESETS,
  validateUuid,
  validateUuidList,
  versionLabel,
  type UuidHistoryEntry,
  type UuidStudioOptions,
  type UuidVersion,
} from "./uuid-generator-utils";

type Tab = "studio" | "validate" | "batch" | "analyze" | "history" | "api";

const TABS: { id: Tab; label: string; icon: typeof Fingerprint }[] = [
  { id: "studio", label: "Studio", icon: Fingerprint },
  { id: "validate", label: "Validate", icon: ScanLine },
  { id: "batch", label: "Batch", icon: Layers },
  { id: "analyze", label: "Analyze", icon: BarChart3 },
  { id: "history", label: "History", icon: History },
  { id: "api", label: "API", icon: Sparkles },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

export function UuidGeneratorStudio() {
  const fileRef = useRef<HTMLInputElement>(null);
  const skipSave = useRef(true);

  const [mounted, setMounted] = useState(false);
  const [options, setOptions] = useState<UuidStudioOptions>({ ...DEFAULT_UUID_OPTIONS });
  const [tab, setTab] = useState<Tab>("studio");
  const [results, setResults] = useState<string[]>([]);
  const [preview, setPreview] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [validateInput, setValidateInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [history, setHistory] = useState<UuidHistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrDownloading, setQrDownloading] = useState<"png" | "svg" | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [dragging, setDragging] = useState(false);

  const suggestions = useMemo(() => smartUuidSuggestions(options), [options]);
  const collisionReport = useMemo(() => detectCollisions(results), [results]);
  const entropy = useMemo(() => analyzeEntropy(results), [results]);
  const validationRows = useMemo(
    () => (validateInput.trim() ? validateUuidList(parseUuidList(validateInput)) : []),
    [validateInput],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) setOptions((o) => ({ ...o, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
    setHistory(loadHistory());
    setFavorites(loadFavorites());
    skipSave.current = false;
  }, []);

  useEffect(() => {
    if (skipSave.current) return;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(options));
  }, [options]);

  const update = <K extends keyof UuidStudioOptions>(key: K, value: UuidStudioOptions[K]) => {
    setOptions((o) => ({ ...o, [key]: value }));
  };

  const runGenerate = useCallback(
    async (countOverride?: number) => {
      const count = countOverride ?? options.count;
      if (count < 1 || count > 1_000_000) {
        toast.error("Quantity must be between 1 and 1,000,000");
        return;
      }
      setGenerating(true);
      setProgress(0);
      try {
        const genOpts = toGenerateOptions({ ...options, count });
        const uuids = await generateBulk(genOpts, (done, total) => setProgress(Math.round((done / total) * 100)));
        setResults(uuids);
        setPreview(uuids.slice(0, 5));
        saveHistoryEntry({ version: options.version, count, sample: uuids[0] ?? "" });
        setHistory(loadHistory());
        if (uuids[0]) {
          createUuidQrDataUrl(uuids[0], 256).then(setQrDataUrl).catch(() => setQrDataUrl(null));
        } else {
          setQrDataUrl(null);
        }
        toast.success(`Generated ${uuids.length.toLocaleString()} UUID${uuids.length === 1 ? "" : "s"}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Generation failed");
      } finally {
        setGenerating(false);
        setProgress(0);
      }
    },
    [options],
  );

  useEffect(() => {
    if (!options.livePreview || !mounted || tab !== "studio") return;
    const timer = setTimeout(() => {
      void generateBulk(toGenerateOptions({ ...options, count: 3 })).then(setPreview).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [options, mounted, tab]);

  const copyAll = async () => {
    if (!results.length) return;
    await navigator.clipboard.writeText(exportAsTxt(results));
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 1500);
  };

  const download = (format: "txt" | "csv" | "json" | "xml") => {
    if (!results.length) return;
    const map = {
      txt: { content: exportAsTxt(results), mime: "text/plain", ext: "txt" },
      csv: { content: exportAsCsv(results), mime: "text/csv", ext: "csv" },
      json: { content: exportAsJson(results), mime: "application/json", ext: "json" },
      xml: { content: exportAsXml(results), mime: "application/xml", ext: "xml" },
    };
    const { content, mime, ext } = map[format];
    downloadBlob(new Blob([content], { type: mime }), `uuids-${Date.now()}.${ext}`);
    toast.success(`Downloaded .${ext}`);
  };

  const downloadQr = async (format: "png" | "svg") => {
    const uuid = results[0];
    if (!uuid) {
      toast.error("Generate UUIDs first");
      return;
    }
    setQrDownloading(format);
    try {
      if (format === "png") await downloadUuidQrPng(uuid, 512);
      else await downloadUuidQrSvg(uuid);
      toast.success(`QR downloaded as .${format}`);
    } catch {
      toast.error("QR download failed");
    } finally {
      setQrDownloading(null);
    }
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    if (tab === "validate") setValidateInput(text);
    else if (tab === "batch") setBatchInput(text);
    else setValidateInput(text);
    toast.success(`Loaded ${file.name}`);
  };

  const needsName = options.version === "v3" || options.version === "v5";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Generated" value={results.length || "—"} />
        <Stat label="Version" value={options.version} />
        <Stat label="Format" value={options.format.split("-")[0] ?? options.format} />
        <Stat label="Unique" value={results.length ? collisionReport.unique : "—"} />
        <Stat label="Collisions" value={results.length ? collisionReport.duplicates.length : "—"} />
        <Stat label="Entropy" value={results.length ? `${entropy.estimatedEntropyBits.toFixed(0)}b` : "—"} />
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void handleFile(f);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center sm:p-8",
          dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
        )}
      >
        <UploadCloud className="mb-2 h-8 w-8 text-primary" />
        <p className="font-display text-lg font-semibold">Ultra UUID Generator Studio</p>
        <p className="mt-1 max-w-xl text-sm text-muted">
          v1 · v3 · v4 · v5 · v6 · v7 · v8 · Nil · Max — bulk up to 1M · validate · parse · export · API
        </p>
        <input ref={fileRef} type="file" accept=".txt,.csv,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }} />
      </div>

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="mb-1 flex items-center gap-2 font-medium text-primary">
            <Wand2 className="h-4 w-4" />
            Smart assist
          </p>
          <ul className="list-inside list-disc text-muted">
            {suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-1 border-b border-border pb-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium capitalize",
              tab === id ? "border-b-2 border-primary text-primary" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "studio" && (
        <>
          <div className="flex flex-wrap gap-2">
            {UUID_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.hint}
                onClick={() => update("version", p.id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs",
                  options.version === p.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Field label="Quantity">
              <input
                type="number"
                min={1}
                max={1_000_000}
                value={options.count}
                onChange={(e) => update("count", Math.min(1_000_000, Math.max(1, Number(e.target.value) || 1)))}
                className={inputClass()}
              />
            </Field>
            <Field label="Output format">
              <select value={options.format} onChange={(e) => update("format", e.target.value as UuidStudioOptions["format"])} className={inputClass()}>
                {FORMAT_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Live preview">
              <select value={options.livePreview ? "on" : "off"} onChange={(e) => update("livePreview", e.target.value === "on")} className={inputClass()}>
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </Field>
          </div>

          {needsName && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Namespace">
                <select value={options.namespace} onChange={(e) => update("namespace", e.target.value as UuidStudioOptions["namespace"])} className={inputClass()}>
                  <option value="dns">DNS</option>
                  <option value="url">URL</option>
                  <option value="oid">OID</option>
                  <option value="x500">X.500 DN</option>
                  <option value="custom">Custom UUID</option>
                </select>
              </Field>
              {options.namespace === "custom" && (
                <Field label="Custom namespace UUID">
                  <input value={options.customNamespace} onChange={(e) => update("customNamespace", e.target.value)} className={inputClass()} placeholder="6ba7b811-9dad-11d1-80b4-00c04fd430c8" />
                </Field>
              )}
              <Field label="Name (v3/v5)">
                <input value={options.name} onChange={(e) => update("name", e.target.value)} className={inputClass()} placeholder="example.com" />
              </Field>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="gradient" onClick={() => void runGenerate()} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
              Generate {options.count.toLocaleString()} UUID{options.count === 1 ? "" : "s"}
            </Button>
            {generating && <span className="self-center text-sm text-muted">{progress}%</span>}
            <Button variant="outline" onClick={() => setShowSettings((s) => !s)} className={cn(showSettings && "border-primary text-primary")}>
              <Settings2 className="h-4 w-4" />
              Advanced
            </Button>
            {results.length > 0 && (
              <>
                <Button variant="outline" onClick={() => void copyAll()}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Copy all
                </Button>
                <Button variant="outline" onClick={() => download("txt")}><Download className="h-4 w-4" /> TXT</Button>
                <Button variant="outline" onClick={() => download("csv")}><Download className="h-4 w-4" /> CSV</Button>
                <Button variant="outline" onClick={() => download("json")}><Download className="h-4 w-4" /> JSON</Button>
                <Button variant="outline" onClick={() => download("xml")}><Download className="h-4 w-4" /> XML</Button>
              </>
            )}
          </div>

          {showSettings && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              {options.version === "v4" && (
                <Field label="Seed (deterministic v4 — testing only)">
                  <input value={options.seed} onChange={(e) => update("seed", e.target.value)} className={inputClass()} placeholder="Optional seed string" />
                </Field>
              )}
              {options.version === "v8" && (
                <Field label="v8 custom prefix (hex, up to 12 chars)">
                  <input value={options.v8Prefix} onChange={(e) => update("v8Prefix", e.target.value)} className={inputClass()} placeholder="a1b2c3" />
                </Field>
              )}
              {options.count > 100_000 && (
                <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  Large batch ({options.count.toLocaleString()}) — generation runs in chunks to keep UI responsive.
                </p>
              )}
            </div>
          )}

          {(preview.length > 0 || results.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <Field label={results.length ? `Output (${results.length.toLocaleString()})` : "Live preview"}>
                <textarea
                  readOnly
                  value={(results.length ? results : preview).slice(0, 500).join("\n") + (results.length > 500 ? `\n… +${(results.length - 500).toLocaleString()} more` : "")}
                  rows={12}
                  className={`${inputClass()} min-h-[200px] resize-y py-2 font-mono text-xs`}
                />
              </Field>
              {qrDataUrl && results[0] && (
                <div className="rounded-xl border border-border bg-card p-4 text-center lg:min-w-[220px]">
                  <p className="mb-2 flex items-center justify-center gap-1 text-sm font-medium">
                    <QrCode className="h-4 w-4" />
                    QR — first UUID
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR code of first UUID" className="mx-auto rounded-lg" width={180} height={180} />
                  <p className="mt-2 break-all font-mono text-[10px] text-muted">{results[0]}</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!qrDownloading}
                      onClick={() => void downloadQr("png")}
                    >
                      {qrDownloading === "png" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      PNG
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!qrDownloading}
                      onClick={() => void downloadQr("svg")}
                    >
                      {qrDownloading === "svg" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      SVG
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "validate" && (
        <div className="space-y-4">
          <Field label="Paste UUIDs (one per line)">
            <textarea
              value={validateInput}
              onChange={(e) => setValidateInput(e.target.value)}
              rows={8}
              className={`${inputClass()} min-h-[120px] resize-y py-2 font-mono text-sm`}
              placeholder="550e8400-e29b-41d4-a716-446655440000&#10;urn:uuid:6ba7b810-9dad-11d1-80b4-00c04fd430c8"
            />
          </Field>
          {validationRows.length > 0 && (
            <ul className="max-h-[400px] space-y-2 overflow-y-auto rounded-xl border border-border p-3">
              {validationRows.map((row) => (
                <li key={row.line} className={cn("rounded-lg px-3 py-2 text-sm", row.valid ? "bg-success/10" : "bg-destructive/10")}>
                  <span className="font-mono text-xs text-muted">#{row.line}</span>{" "}
                  <span className="font-mono">{row.input}</span>
                  {row.valid && row.parsed ? (
                    <p className="mt-1 text-xs text-muted">
                      {versionLabel(row.parsed.version)} · {row.parsed.variant}
                      {row.parsed.timestamp ? ` · ${row.parsed.timestamp.iso}` : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-destructive">{row.error}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "batch" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Generate or validate large lists. Import a .txt/.csv file via drag-and-drop above.</p>
          <Field label="Batch quantity">
            <input type="number" min={1} max={1_000_000} value={options.count} onChange={(e) => update("count", Number(e.target.value) || 1)} className={inputClass()} />
          </Field>
          <Button variant="gradient" onClick={() => void runGenerate(options.count)} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
            Bulk generate
          </Button>
          {batchInput && (
            <Field label="Imported for validation">
              <textarea readOnly value={batchInput.slice(0, 2000)} rows={6} className={`${inputClass()} font-mono text-xs`} />
            </Field>
          )}
        </div>
      )}

      {tab === "analyze" && (
        <div className="space-y-4">
          {results.length === 0 ? (
            <p className="text-sm text-muted">Generate UUIDs in Studio first to analyze entropy and collisions.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Total bits (RFC)" value={entropy.totalBits} />
                <Stat label="Est. entropy" value={`${entropy.estimatedEntropyBits.toFixed(1)} bits`} />
                <Stat label="Unique chars" value={entropy.uniqueChars} />
                <Stat label="Collision risk" value={entropy.collisionRisk} />
              </div>
              {collisionReport.duplicates.length > 0 && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                  <p className="font-medium text-destructive">Collisions detected ({collisionReport.duplicates.length})</p>
                  <ul className="mt-2 font-mono text-xs">
                    {collisionReport.duplicates.slice(0, 10).map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => { clearHistory(); setHistory([]); toast.success("History cleared"); }}>
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted">No generation history yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                  <div>
                    <p className="font-mono text-sm">{h.sample}</p>
                    <p className="text-xs text-muted">{h.version} · {h.count.toLocaleString()} · {new Date(h.at).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = toggleFavorite(h.sample);
                      setFavorites(next);
                      toast.success(next.includes(h.sample) ? "Added to favorites" : "Removed from favorites");
                    }}
                    className="text-muted hover:text-primary"
                  >
                    <Star className={cn("h-4 w-4", favorites.includes(h.sample) && "fill-primary text-primary")} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {favorites.length > 0 && (
            <>
              <p className="text-sm font-medium">Favorites</p>
              <ul className="space-y-1 font-mono text-xs">
                {favorites.map((f) => (
                  <li key={f} className="rounded-lg border border-border px-3 py-2">{f}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 font-mono text-sm">
          <p className="font-sans text-muted">Automate UUID generation via REST API.</p>
          <pre className="overflow-x-auto rounded-xl bg-muted/30 p-4 text-xs">{`POST /api/v1/uuid
Content-Type: application/json

{
  "version": "v4",
  "count": 100,
  "format": "standard",
  "namespace": "url",
  "name": "example.com"
}`}</pre>
          <pre className="overflow-x-auto rounded-xl bg-muted/30 p-4 text-xs">{`// Response
{
  "ok": true,
  "uuids": ["..."],
  "count": 100,
  "version": "v4"
}`}</pre>
          <p className="font-sans text-xs text-muted">100% client-side in the browser studio. API optional for server pipelines. Max 10,000 per API request.</p>
        </div>
      )}
    </div>
  );
}
