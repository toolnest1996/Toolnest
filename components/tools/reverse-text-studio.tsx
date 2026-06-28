"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Check,
  Copy,
  Download,
  FlipHorizontal,
  History,
  Layers,
  Loader2,
  Redo2,
  RotateCcw,
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
  analyzeReverseInput,
  batchTransformLines,
  checkPalindrome,
  clearHistory,
  computeTextStats,
  DEFAULT_REVERSE_OPTIONS,
  exportAsCsv,
  extractTextFromFile,
  loadHistory,
  REVERSE_PRESETS,
  REVERSE_SAMPLES,
  saveHistoryEntry,
  smartReverseSuggestions,
  transformReverse,
  type HistoryEntry,
  type ReverseMode,
  type ReverseOptions,
} from "./reverse-text-utils";

type Tab = "studio" | "batch" | "palindrome" | "stats" | "history" | "api";

const TABS: { id: Tab; label: string; icon: typeof RotateCcw }[] = [
  { id: "studio", label: "Studio", icon: RotateCcw },
  { id: "batch", label: "Batch", icon: Layers },
  { id: "palindrome", label: "Palindrome", icon: FlipHorizontal },
  { id: "stats", label: "Statistics", icon: BarChart3 },
  { id: "history", label: "History", icon: History },
  { id: "api", label: "API", icon: Sparkles },
];

const SETTINGS_KEY = "toolnest-reverse-studio-settings";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

export function ReverseTextStudio() {
  const fileRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<string[]>([]);
  const redoStack = useRef<string[]>([]);

  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<ReverseMode>("characters");
  const [options, setOptions] = useState<ReverseOptions>({ ...DEFAULT_REVERSE_OPTIONS });
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

  const analysis = useMemo(() => analyzeReverseInput(input), [input]);
  const palindrome = useMemo(() => checkPalindrome(input), [input]);
  const inputStats = useMemo(() => computeTextStats(input), [input]);
  const outputStats = useMemo(() => computeTextStats(output), [output]);
  const smartTips = useMemo(() => smartReverseSuggestions(input, mode), [input, mode]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<ReverseOptions & { mode: ReverseMode }>;
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
      return;
    }
    const result = transformReverse(input, mode, options);
    if (!result.ok) {
      setError(result.message);
      setOutput("");
      return;
    }
    setOutput(result.output);
    setError("");
  }, [input, mode, options]);

  useEffect(() => {
    if (!live || tab !== "studio") return;
    const t = setTimeout(run, 180);
    return () => clearTimeout(t);
  }, [live, tab, run]);

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

  const loadSample = (text: string) => {
    pushUndo(input);
    setInput(text);
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
    const payload = `ToolNest Reverse Text (${mode}):\n${text}`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "ToolNest Reverse Text", text: payload });
        return;
      } catch {
        /* fall through */
      }
    }
    await navigator.clipboard.writeText(payload);
    toast.success("Copied to clipboard");
  };

  const downloadText = (ext: "txt" | "csv") => {
    const text = tab === "batch" ? batchOut : output;
    if (!text) {
      toast.error("Nothing to export");
      return;
    }
    const body = ext === "csv" ? exportAsCsv(text.split("\n")) : text;
    downloadBlob(new Blob([body], { type: ext === "csv" ? "text/csv" : "text/plain;charset=utf-8" }), `reverse-${mode}.${ext}`);
    toast.success("Download started");
  };

  const runBatch = () => {
    const lines = input.split("\n");
    const results = batchTransformLines(lines, mode, options);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) toast.error(`${failed.length} line(s) failed`);
    else toast.success("Batch complete");
    setBatchOut(results.map((r) => (r.ok ? (r.output ?? "") : `# line ${r.line}: ${r.error}`)).join("\n"));
  };

  const commitHistory = () => {
    if (!input.trim() || !output.trim()) return;
    setHistory(
      saveHistoryEntry({
        mode,
        input: input.slice(0, 4000),
        output: output.slice(0, 4000),
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
  };

  const updateOption = <K extends keyof ReverseOptions>(key: K, value: ReverseOptions[K]) => {
    setOptions((o) => ({ ...o, [key]: value }));
  };

  const presetsByCategory = useMemo(
    () => ({
      core: REVERSE_PRESETS.filter((p) => p.category === "core"),
      structural: REVERSE_PRESETS.filter((p) => p.category === "structural"),
      unicode: REVERSE_PRESETS.filter((p) => p.category === "unicode"),
    }),
    [],
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Words" value={inputStats.words} />
        <Stat label="Characters" value={inputStats.characters} />
        <Stat label="Lines" value={inputStats.lines} />
        <Stat label="Emoji" value={analysis.hasEmoji ? "Yes" : "No"} />
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
        <p className="font-display text-lg font-semibold">Ultra Reverse Text Studio</p>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Reverse characters, words, lines, sentences — mirror, upside-down Unicode, RTL, palindrome checker, batch,
          DOCX/PDF import — 100% client-side.
        </p>
        {fileName && <p className="mt-2 text-xs font-medium text-primary">{fileName}</p>}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.md,.docx,.pdf,text/plain,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void loadFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {REVERSE_SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => loadSample(s.text)}
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
              Reverse
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

          {(["core", "structural", "unicode"] as const).map((cat) => (
            <div key={cat}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{cat}</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              <p className="mb-3 text-sm font-medium">Reverse options</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={options.graphemeAware} onChange={(e) => updateOption("graphemeAware", e.target.checked)} />
                  Grapheme-aware (emoji-safe)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={options.preserveWhitespace}
                    onChange={(e) => updateOption("preserveWhitespace", e.target.checked)}
                  />
                  Preserve whitespace (word reverse)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={options.preservePunctuation}
                    onChange={(e) => updateOption("preservePunctuation", e.target.checked)}
                  />
                  Keep punctuation on words
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={options.trimLines} onChange={(e) => updateOption("trimLines", e.target.checked)} />
                  Trim lines before reverse
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={options.perLine} onChange={(e) => updateOption("perLine", e.target.checked)} />
                  Character reverse per line
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={options.rtlWrap} onChange={(e) => updateOption("rtlWrap", e.target.checked)} />
                  RTL bidi wrap (U+202E)
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
                className={`${inputClass()} min-h-[240px] resize-y py-2 text-sm leading-relaxed`}
                placeholder="Enter text to reverse…"
                spellCheck
                aria-label="Reverse text input"
              />
            </Field>
            <Field label="Output (live preview)">
              <textarea
                readOnly
                value={output}
                rows={12}
                className={`${inputClass()} min-h-[240px] resize-y py-2 text-sm leading-relaxed`}
                placeholder="Reversed text appears here…"
                aria-label="Reverse text output"
                dir={mode === "rtl" ? "rtl" : undefined}
              />
            </Field>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</p>
          )}
        </>
      )}

      {tab === "batch" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Apply <span className="font-mono">{mode}</span> to each line independently.
          </p>
          <Field label="Batch input (one per line)">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={8}
              className={`${inputClass()} min-h-[160px] resize-y py-2 text-sm`}
            />
          </Field>
          <Button variant="gradient" onClick={runBatch}>
            <Layers className="h-4 w-4" />
            Run batch
          </Button>
          {batchOut && (
            <Field label="Batch output">
              <textarea readOnly value={batchOut} rows={8} className={`${inputClass()} text-sm`} />
            </Field>
          )}
        </div>
      )}

      {tab === "palindrome" && (
        <div className="space-y-4">
          <div
            className={cn(
              "rounded-xl border p-5",
              palindrome.isIgnorePunctuation || palindrome.isExact
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-border bg-card",
            )}
          >
            <p className="text-lg font-semibold">{palindrome.message}</p>
            <p className="mt-2 text-sm text-muted">Normalized length: {palindrome.length} characters</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["Exact match", palindrome.isExact],
                ["Ignore case", palindrome.isIgnoreCase],
                ["Ignore spaces", palindrome.isIgnoreSpaces],
                ["Ignore punctuation", palindrome.isIgnorePunctuation],
              ] as const
            ).map(([label, val]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <span className="text-sm">{label}</span>
                <span className={cn("text-sm font-medium", val ? "text-emerald-500" : "text-muted")}>{val ? "Yes" : "No"}</span>
              </div>
            ))}
          </div>
          {palindrome.normalized && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Normalized (for check)">
                <textarea readOnly value={palindrome.normalized} rows={4} className={`${inputClass()} font-mono text-xs`} />
              </Field>
              <Field label="Reversed normalized">
                <textarea readOnly value={palindrome.reversed} rows={4} className={`${inputClass()} font-mono text-xs`} />
              </Field>
            </div>
          )}
        </div>
      )}

      {tab === "stats" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["Input words", inputStats.words],
              ["Input characters", inputStats.characters],
              ["Input lines", inputStats.lines],
              ["Sentences", inputStats.sentences],
              ["Paragraphs", inputStats.paragraphs],
              ["Reading time", `${inputStats.readingTimeMin} min`],
              ["Output words", outputStats.words],
              ["Output characters", outputStats.characters],
              ["Palindrome", analysis.looksPalindrome ? "Likely" : "No"],
              ["Has RTL script", analysis.hasRtl ? "Yes" : "No"],
              ["Has emoji", analysis.hasEmoji ? "Yes" : "No"],
              ["Unicode", analysis.hasUnicode ? "Yes" : "No"],
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
            <p className="text-sm text-muted">{history.length} saved conversion(s) — stored locally.</p>
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
            <p className="text-sm text-muted">No history yet — reverse text and click Save.</p>
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
                      <span className="text-xs font-medium text-primary">{h.mode}</span>
                      <span className="text-[10px] text-muted">{new Date(h.at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">{h.input}</p>
                    <p className="truncate text-xs">{h.output}</p>
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
          <p className="text-sm text-muted">Server-side reverse for automation. Browser studio stays client-side.</p>
          <pre className="overflow-x-auto rounded-lg bg-muted/30 p-4 text-xs">{`POST /api/v1/reverse
Content-Type: application/json

{
  "input": "hello world",
  "mode": "words",
  "options": {
    "graphemeAware": true,
    "preserveWhitespace": true
  }
}`}</pre>
          <p className="text-xs text-muted">
            Modes: characters, words, sentences, lines, paragraphs, mirror, upside-down, rtl · Palindrome: GET query or
            separate check in response
          </p>
        </div>
      )}
    </div>
  );
}
