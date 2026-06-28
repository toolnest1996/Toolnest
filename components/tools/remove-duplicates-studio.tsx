"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Check,
  Copy,
  Download,
  Filter,
  History,
  Layers,
  ListFilter,
  Loader2,
  Redo2,
  ScanLine,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  Undo2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import {
  analyzeDedupeInput,
  batchTransformBlocks,
  clearHistory,
  computeTextStats,
  DEDUPE_PRESETS,
  DEDUPE_SAMPLES,
  DEFAULT_DEDUPE_OPTIONS,
  exportAsCsv,
  extractTextFromFile,
  loadHistory,
  saveHistoryEntry,
  smartDedupeSuggestions,
  transformDedupe,
  type DedupeMode,
  type DedupeOptions,
  type HistoryEntry,
} from "./remove-duplicates-utils";

type Tab = "studio" | "highlight" | "batch" | "stats" | "history" | "api";

const TABS: { id: Tab; label: string; icon: typeof Filter }[] = [
  { id: "studio", label: "Studio", icon: Filter },
  { id: "highlight", label: "Duplicates", icon: ListFilter },
  { id: "batch", label: "Batch", icon: Layers },
  { id: "stats", label: "Statistics", icon: BarChart3 },
  { id: "history", label: "History", icon: History },
  { id: "api", label: "API", icon: Sparkles },
];

const SETTINGS_KEY = "toolnest-dedupe-studio-settings";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

export function RemoveDuplicatesStudio() {
  const fileRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<DedupeMode>("lines");
  const [options, setOptions] = useState<DedupeOptions>({ ...DEFAULT_DEDUPE_OPTIONS });
  const [tab, setTab] = useState<Tab>("studio");
  const [live, setLive] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [batchOut, setBatchOut] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [lastResult, setLastResult] = useState<ReturnType<typeof transformDedupe> | null>(null);

  const analysis = useMemo(() => analyzeDedupeInput(input), [input]);
  const inputStats = useMemo(() => computeTextStats(input), [input]);
  const smartTips = useMemo(() => smartDedupeSuggestions(input, mode, options), [input, mode, options]);

  const dedupeStats = lastResult && lastResult.ok ? lastResult.stats : null;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<DedupeOptions & { mode: DedupeMode }>;
      const { mode: savedMode, ...savedOptions } = s;
      setOptions((o) => ({ ...o, ...savedOptions }));
      if (savedMode) setMode(savedMode);
    } catch {
      /* ignore */
    }
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...options, mode }));
  }, [options, mode]);

  const run = useCallback(() => {
    if (!input.trim()) {
      setOutput("");
      setError("");
      setLastResult(null);
      return;
    }
    const result = transformDedupe(input, mode, options);
    setLastResult(result);
    if (!result.ok) {
      setError(result.message);
      setOutput("");
      return;
    }
    setOutput(result.output);
    setError("");
  }, [input, mode, options]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!input.trim()) {
        setOutput("");
        setError("");
        setLastResult(null);
        return;
      }
      const result = transformDedupe(input, mode, options);
      setLastResult(result);
      if (!result.ok) {
        setError(result.message);
        if (live && tab === "studio") setOutput("");
        return;
      }
      setError("");
      if (live && tab === "studio") setOutput(result.output);
    }, 200);
    return () => clearTimeout(t);
  }, [input, mode, options, live, tab]);

  const pushUndo = useCallback((snapshot: string) => {
    undoStack.current = [...undoStack.current.slice(-49), snapshot];
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      setLoadingFile(true);
      try {
        const { text, format } = await extractTextFromFile(file);
        pushUndo(input);
        setInput(text);
        setFileName(`${file.name} (${format})`);
        toast.success(`Imported ${file.name} · ${formatBytes(file.size)}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Import failed");
      } finally {
        setLoadingFile(false);
      }
    },
    [input, pushUndo],
  );

  const loadSample = (text: string, sampleMode?: DedupeMode) => {
    pushUndo(input);
    setInput(text);
    if (sampleMode) setMode(sampleMode);
    toast.success("Sample loaded");
  };

  const copyOut = async () => {
    const text = tab === "batch" ? batchOut : output;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success("Copied");
  };

  const shareOut = async () => {
    const text = tab === "batch" ? batchOut : output;
    if (!text) return;
    const payload = `ToolNest Remove Duplicates (${mode}):\n${text}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "ToolNest Remove Duplicates", text: payload });
        return;
      } catch {
        /* fall through */
      }
    }
    await navigator.clipboard.writeText(payload);
    toast.success("Copied to clipboard");
  };

  const downloadText = (ext: "txt" | "csv" | "json") => {
    const text = tab === "batch" ? batchOut : output;
    if (!text) {
      toast.error("Nothing to export");
      return;
    }
    const mime =
      ext === "json" ? "application/json" : ext === "csv" ? "text/csv" : "text/plain;charset=utf-8";
    const body = ext === "csv" && mode !== "json-objects" ? exportAsCsv(text.split("\n")) : text;
    downloadBlob(new Blob([body], { type: mime }), `dedupe-${mode}.${ext}`);
    toast.success("Download started");
  };

  const runBatch = () => {
    const blocks = input.split(/\n---\n/);
    const results = batchTransformBlocks(blocks, mode, options);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) toast.error(`${failed.length} block(s) failed`);
    else toast.success("Batch complete");
    setBatchOut(
      results
        .map((r) =>
          r.ok ? (r.output ?? "") : `# block ${r.block}: ${r.error}`,
        )
        .join("\n---\n"),
    );
  };

  const commitHistory = () => {
    if (!input.trim() || !output.trim() || !dedupeStats) return;
    setHistory(
      saveHistoryEntry({
        mode,
        input: input.slice(0, 4000),
        output: output.slice(0, 4000),
        removed: dedupeStats.removed,
      }),
    );
    toast.success("Saved to history");
  };

  const restoreHistory = (entry: HistoryEntry) => {
    pushUndo(input);
    setInput(entry.input);
    setOutput(entry.output);
    setMode(entry.mode);
    setTab("studio");
    toast.success("Restored from history");
  };

  const undo = () => {
    const prev = undoStack.current.pop();
    if (prev === undefined) return;
    redoStack.current.push(input);
    setInput(prev);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  };

  const redo = () => {
    const next = redoStack.current.pop();
    if (next === undefined) return;
    undoStack.current.push(input);
    setInput(next);
    setCanRedo(redoStack.current.length > 0);
    setCanUndo(true);
  };

  const clearAll = () => {
    pushUndo(input);
    setInput("");
    setOutput("");
    setBatchOut("");
    setError("");
    setFileName("");
    setLastResult(null);
  };

  const updateOption = <K extends keyof DedupeOptions>(key: K, value: DedupeOptions[K]) => {
    setOptions((o) => ({ ...o, [key]: value }));
  };

  const presetsByCategory = useMemo(
    () => ({
      text: DEDUPE_PRESETS.filter((p) => p.category === "text"),
      structured: DEDUPE_PRESETS.filter((p) => p.category === "structured"),
      extract: DEDUPE_PRESETS.filter((p) => p.category === "extract"),
    }),
    [],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total" value={dedupeStats?.total ?? "—"} />
        <Stat label="Unique" value={dedupeStats?.unique ?? "—"} />
        <Stat label="Removed" value={dedupeStats?.removed ?? "—"} />
        <Stat label="Groups" value={dedupeStats?.duplicateGroups ?? "—"} />
        <Stat label="Mode" value={mode} />
        <Stat label="Detected" value={analysis.detected} />
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) void loadFile(file);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all sm:p-8",
          dragging ? "border-primary bg-primary/5 scale-[1.01]" : "border-border bg-card hover:border-primary/50",
        )}
      >
        {loadingFile ? (
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
        ) : (
          <UploadCloud className="mb-2 h-8 w-8 text-primary" />
        )}
        <p className="font-display text-lg font-semibold">Ultra Remove Duplicates Studio</p>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Dedupe lines, words, CSV, JSON, emails, URLs — exact & fuzzy match, highlight duplicates, batch, import
          TXT/CSV/JSON/DOCX/PDF — 100% client-side.
        </p>
        {fileName && <p className="mt-2 text-xs font-medium text-primary">{fileName}</p>}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.json,.md,.docx,.pdf,text/plain,text/csv,application/json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void loadFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {DEDUPE_SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => loadSample(s.text, s.mode)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-left text-xs transition-colors hover:border-primary/40"
          >
            <span className="font-medium">{s.label}</span>
          </button>
        ))}
      </div>

      {smartTips.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="mb-1 flex items-center gap-2 font-medium text-primary">
            <ScanLine className="h-4 w-4" />
            Smart assist
          </p>
          <ul className="list-inside list-disc text-muted">
            {smartTips.map((s) => (
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
              "flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-medium transition-colors",
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
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="gradient" onClick={run}>
              <Sparkles className="h-4 w-4" />
              Remove duplicates
            </Button>
            <Button variant="outline" onClick={copyOut} disabled={!output}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copy
            </Button>
            <Button variant="outline" onClick={shareOut} disabled={!output}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button variant="outline" onClick={() => downloadText("txt")} disabled={!output}>
              <Download className="h-4 w-4" />
              TXT
            </Button>
            <Button variant="outline" onClick={() => downloadText("csv")} disabled={!output}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            {mode === "json-objects" && (
              <Button variant="outline" onClick={() => downloadText("json")} disabled={!output}>
                <Download className="h-4 w-4" />
                JSON
              </Button>
            )}
            <Button variant="outline" onClick={commitHistory} disabled={!output}>
              <History className="h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" onClick={undo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" />
              Undo
            </Button>
            <Button variant="outline" onClick={redo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4" />
              Redo
            </Button>
            <Button variant="outline" onClick={clearAll}>
              <Trash2 className="h-4 w-4" />
              Clear
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSettings((s) => !s)}
              className={cn(showSettings && "border-primary text-primary")}
            >
              <Settings2 className="h-4 w-4" />
              Settings
            </Button>
            <label className="ml-auto flex items-center gap-2 text-sm">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
              Live preview
            </label>
          </div>

          {(["text", "structured", "extract"] as const).map((cat) => (
            <div key={cat}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{cat}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                {presetsByCategory[cat].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setMode(p.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors",
                      mode === p.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="text-xs text-muted">{p.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {showSettings && (
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <p className="mb-3 text-sm font-medium">Matching options</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Keep occurrence">
                  <select
                    value={options.keep}
                    onChange={(e) => updateOption("keep", e.target.value as DedupeOptions["keep"])}
                    className={inputClass()}
                  >
                    <option value="first">First occurrence</option>
                    <option value="last">Last occurrence</option>
                  </select>
                </Field>
                <Field label="Match mode">
                  <select
                    value={options.matchMode}
                    onChange={(e) => updateOption("matchMode", e.target.value as DedupeOptions["matchMode"])}
                    className={inputClass()}
                  >
                    <option value="exact">Exact</option>
                    <option value="fuzzy">Fuzzy (similarity)</option>
                  </select>
                </Field>
                <Field label="Sort">
                  <select
                    value={options.sortWhen}
                    onChange={(e) => updateOption("sortWhen", e.target.value as DedupeOptions["sortWhen"])}
                    className={inputClass()}
                  >
                    <option value="none">No sort</option>
                    <option value="before">Before dedupe</option>
                    <option value="after">After dedupe</option>
                  </select>
                </Field>
                {options.matchMode === "fuzzy" && (
                  <Field label={`Fuzzy threshold (${Math.round(options.fuzzyThreshold * 100)}%)`}>
                    <input
                      type="range"
                      min={0.7}
                      max={1}
                      step={0.01}
                      value={options.fuzzyThreshold}
                      onChange={(e) => updateOption("fuzzyThreshold", Number(e.target.value))}
                      className="w-full"
                    />
                  </Field>
                )}
                {mode === "json-objects" && (
                  <Field label="JSON key field (optional)">
                    <input
                      value={options.jsonKey}
                      onChange={(e) => updateOption("jsonKey", e.target.value)}
                      className={inputClass()}
                      placeholder="id"
                    />
                  </Field>
                )}
                {mode === "custom" && (
                  <Field label="Custom regex">
                    <input
                      value={options.customPattern}
                      onChange={(e) => updateOption("customPattern", e.target.value)}
                      className={inputClass()}
                      placeholder="\\b\\w+@\\w+\\.\\w+\\b"
                    />
                  </Field>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={options.caseSensitive}
                    onChange={(e) => updateOption("caseSensitive", e.target.checked)}
                  />
                  Case-sensitive
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={options.trimWhitespace}
                    onChange={(e) => updateOption("trimWhitespace", e.target.checked)}
                  />
                  Trim whitespace
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={options.ignorePunctuation}
                    onChange={(e) => updateOption("ignorePunctuation", e.target.checked)}
                  />
                  Ignore punctuation
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={options.ignoreEmpty}
                    onChange={(e) => updateOption("ignoreEmpty", e.target.checked)}
                  />
                  Skip empty lines
                </label>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Input">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={12}
                className={`${inputClass()} min-h-[240px] resize-y py-2 text-sm leading-relaxed font-mono`}
                placeholder="Paste lines, CSV, JSON array, or import a file…"
                spellCheck={false}
                aria-label="Remove duplicates input"
              />
            </Field>
            <Field label="Output (unique only)">
              <textarea
                readOnly
                value={output}
                rows={12}
                className={`${inputClass()} min-h-[240px] resize-y py-2 text-sm leading-relaxed font-mono`}
                placeholder="Deduplicated output…"
                aria-label="Remove duplicates output"
              />
            </Field>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
          )}
        </>
      )}

      {tab === "highlight" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Duplicate entries highlighted. Kept rows shown in green; removed duplicates in amber.
          </p>
          {!lastResult?.ok || !lastResult.items.length ? (
            <p className="text-sm text-muted">Run dedupe in Studio to see duplicate analysis.</p>
          ) : (
            <ul className="max-h-[480px] space-y-1 overflow-y-auto rounded-xl border border-border bg-card p-3 font-mono text-xs">
              {lastResult.items.map((item) => (
                <li
                  key={`${item.index}-${item.raw}`}
                  className={cn(
                    "rounded px-2 py-1",
                    item.kept && item.occurrence > 1 && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                    item.kept && item.occurrence === 1 && "bg-card",
                    item.isDuplicate && "bg-amber-500/15 text-amber-800 line-through dark:text-amber-300",
                  )}
                >
                  <span className="mr-2 text-muted">{item.index + 1}.</span>
                  {item.raw || "(empty)"}
                  {item.kept && item.occurrence > 1 && (
                    <span className="ml-2 text-[10px] text-emerald-600">×{item.occurrence}</span>
                  )}
                  {item.isDuplicate && item.duplicateOf !== null && (
                    <span className="ml-2 text-[10px] text-amber-600">dup of #{item.duplicateOf + 1}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "batch" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Separate blocks with <code className="rounded bg-muted px-1">---</code> on its own line. Each block is
            deduplicated independently.
          </p>
          <Field label="Batch input">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={8}
              className={`${inputClass()} min-h-[160px] resize-y py-2 text-sm font-mono`}
            />
          </Field>
          <Button variant="gradient" onClick={runBatch}>
            <Layers className="h-4 w-4" />
            Run batch
          </Button>
          {batchOut && (
            <Field label="Batch output">
              <textarea readOnly value={batchOut} rows={8} className={`${inputClass()} font-mono text-sm`} />
            </Field>
          )}
        </div>
      )}

      {tab === "stats" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["Input lines", inputStats.lines],
              ["Input words", inputStats.words],
              ["Input characters", inputStats.characters],
              ["Total items", dedupeStats?.total ?? "—"],
              ["Unique kept", dedupeStats?.unique ?? "—"],
              ["Duplicates removed", dedupeStats?.removed ?? "—"],
              ["Duplicate groups", dedupeStats?.duplicateGroups ?? "—"],
              ["Bytes saved", dedupeStats ? dedupeStats.inputBytes - dedupeStats.outputBytes : "—"],
              ["Emails detected", analysis.emailCount],
              ["URLs detected", analysis.urlCount],
              ["Match mode", options.matchMode],
              ["Keep", options.keep],
            ] as const
          ).map(([label, val]) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{val}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{history.length} saved run(s) — stored locally.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearHistory();
                setHistory([]);
                toast.success("History cleared");
              }}
            >
              Clear history
            </Button>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-muted">No history yet — dedupe text and click Save.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => restoreHistory(h)}
                    className="w-full rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-primary">
                        {h.mode} · removed {h.removed}
                      </span>
                      <span className="text-[10px] text-muted">{new Date(h.at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">{h.input}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <p className="font-medium">REST API</p>
          <p className="text-sm text-muted">Server-side deduplication for automation.</p>
          <pre className="overflow-x-auto rounded-lg bg-muted/30 p-4 text-xs">{`POST /api/v1/dedupe
Content-Type: application/json

{
  "input": "apple\\nbanana\\napple",
  "mode": "lines",
  "options": {
    "caseSensitive": false,
    "keep": "first",
    "matchMode": "fuzzy",
    "fuzzyThreshold": 0.92
  }
}`}</pre>
        </div>
      )}
    </div>
  );
}
