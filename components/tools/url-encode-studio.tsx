"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Check,
  Copy,
  Download,
  Globe,
  History,
  Layers,
  Link2,
  Loader2,
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
  analyzeInput,
  batchTransform,
  buildShareText,
  clearHistory,
  DEFAULT_URL_OPTIONS,
  loadHistory,
  parseUrlStructure,
  readTextFile,
  saveHistoryEntry,
  smartUrlSuggestions,
  transformUrl,
  URL_SAMPLES,
  validatePercentEncoding,
  type HistoryEntry,
  type UrlDecodeMode,
  type UrlEncodeMode,
  type UrlOperation,
  type UrlOptions,
} from "./url-encode-utils";

type Tab = "studio" | "batch" | "inspector" | "history" | "api";

const TABS: { id: Tab; label: string; icon: typeof Globe }[] = [
  { id: "studio", label: "Studio", icon: Globe },
  { id: "batch", label: "Batch", icon: Layers },
  { id: "inspector", label: "Inspector", icon: Link2 },
  { id: "history", label: "History", icon: History },
  { id: "api", label: "API", icon: Sparkles },
];

const ENCODE_MODES: { id: UrlEncodeMode; label: string; hint: string }[] = [
  { id: "component", label: "Component", hint: "encodeURIComponent — query values" },
  { id: "uri", label: "URI", hint: "encodeURI — full URLs" },
  { id: "path", label: "Path", hint: "Encode segments, keep /" },
  { id: "query", label: "Query", hint: "key=value pairs" },
  { id: "form", label: "Form", hint: "x-www-form-urlencoded (+)" },
  { id: "rfc3986", label: "RFC 3986", hint: "Strict unreserved only" },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

export function UrlEncodeStudio({ defaultOperation = "encode" }: { defaultOperation?: UrlOperation }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<string[]>([]);

  const [operation, setOperation] = useState<UrlOperation>(defaultOperation);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("studio");
  const [options, setOptions] = useState<UrlOptions>({ ...DEFAULT_URL_OPTIONS });
  const [showSettings, setShowSettings] = useState(false);
  const [live, setLive] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [batchOut, setBatchOut] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [fileName, setFileName] = useState("");

  const analysis = useMemo(() => analyzeInput(input), [input]);
  const validation = useMemo(() => validatePercentEncoding(input), [input]);
  const parsed = useMemo(() => parseUrlStructure(input), [input]);
  const smartTips = useMemo(() => smartUrlSuggestions(input, operation), [input, operation]);

  const stats = useMemo(() => {
    const inBytes = new TextEncoder().encode(input).length;
    const outBytes = new TextEncoder().encode(output).length;
    return {
      inBytes,
      outBytes,
      ratio: inBytes ? (outBytes / inBytes).toFixed(2) : "—",
      lines: output ? output.split("\n").length : 0,
    };
  }, [input, output]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const run = useCallback(() => {
    if (!input.trim()) {
      setError("Enter text, a URL, or query string.");
      setOutput("");
      return;
    }
    const result = transformUrl(input, operation, options);
    if (!result.ok) {
      setError(result.message);
      setOutput("");
      return;
    }
    setOutput(result.output);
    setError("");
  }, [input, operation, options]);

  useEffect(() => {
    if (!live || tab !== "studio") return;
    const t = setTimeout(run, 220);
    return () => clearTimeout(t);
  }, [live, tab, run]);

  const pushUndo = useCallback((snapshot: string) => {
    undoStack.current = [...undoStack.current.slice(-24), snapshot];
    setCanUndo(true);
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      setLoadingFile(true);
      try {
        const text = await readTextFile(file);
        pushUndo(input);
        setInput(text);
        setFileName(file.name);
        toast.success(`Loaded ${file.name} (${formatBytes(file.size)})`);
      } catch {
        toast.error("Could not read file");
      } finally {
        setLoadingFile(false);
      }
    },
    [input, pushUndo],
  );

  const loadSample = (text: string, op: UrlOperation, mode?: UrlEncodeMode | UrlDecodeMode) => {
    pushUndo(input);
    setInput(text);
    setOperation(op);
    if (mode && op === "encode") {
      setOptions((o) => ({ ...o, encodeMode: mode as UrlEncodeMode }));
    }
    if (mode && op === "decode") {
      setOptions((o) => ({ ...o, decodeMode: mode as UrlDecodeMode }));
    }
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
    const text = buildShareText(tab === "batch" ? batchOut : output, operation);
    if (!text) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "ToolNest URL Studio", text });
        return;
      } catch {
        /* fall through */
      }
    }
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard (share not available)");
  };

  const downloadText = () => {
    const text = tab === "batch" ? batchOut : output;
    if (!text) {
      toast.error("Nothing to download");
      return;
    }
    downloadBlob(new Blob([text], { type: "text/plain;charset=utf-8" }), `url-${operation}.txt`);
    toast.success("Download started");
  };

  const runBatch = () => {
    const lines = input.split("\n");
    const results = batchTransform(lines, operation, options);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) toast.error(`${failed.length} line(s) failed`);
    else toast.success("Batch complete");
    setBatchOut(results.map((r) => (r.ok ? (r.output ?? "") : `# line ${r.line}: ${r.error}`)).join("\n"));
  };

  const runValidate = () => {
    if (validation.valid) toast.success(validation.message);
    else toast.error(validation.message);
    setError(validation.valid ? "" : validation.message);
  };

  const commitHistory = () => {
    if (!input.trim() || !output.trim()) return;
    const next = saveHistoryEntry({
      operation,
      input: input.slice(0, 2000),
      output: output.slice(0, 2000),
      mode: operation === "encode" ? options.encodeMode : options.decodeMode,
    });
    setHistory(next);
    toast.success("Saved to history");
  };

  const restoreHistory = (entry: HistoryEntry) => {
    pushUndo(input);
    setInput(entry.input);
    setOutput(entry.output);
    setOperation(entry.operation);
    setTab("studio");
    toast.success("Restored from history");
  };

  const swapIO = () => {
    if (!output) return;
    pushUndo(input);
    setInput(output);
    setOutput("");
    setOperation((o) => (o === "encode" ? "decode" : "encode"));
    toast.success("Swapped — mode toggled");
  };

  const undo = () => {
    const prev = undoStack.current.pop();
    if (prev === undefined) return;
    setInput(prev);
    setCanUndo(undoStack.current.length > 0);
  };

  const clearAll = () => {
    pushUndo(input);
    setInput("");
    setOutput("");
    setBatchOut("");
    setError("");
    setFileName("");
  };

  const updateOption = <K extends keyof UrlOptions>(key: K, value: UrlOptions[K]) => {
    setOptions((o) => ({ ...o, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Input" value={formatBytes(stats.inBytes)} />
        <Stat label="Output" value={formatBytes(stats.outBytes)} />
        <Stat label="Ratio" value={stats.ratio} />
        <Stat label="Lines" value={stats.lines} />
        <Stat label="Mode" value={operation === "encode" ? options.encodeMode : options.decodeMode} />
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
        <p className="font-display text-lg font-semibold">Ultra URL Encode Studio</p>
        <p className="mt-1 max-w-xl text-sm text-muted">
          RFC 3986 encode & decode. Component, URI, path, query, form-data — UTF-8, batch, inspector, history — 100%
          client-side.
        </p>
        {fileName && <p className="mt-2 text-xs font-medium text-primary">File: {fileName}</p>}
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.csv,.json,.url,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void loadFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {URL_SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => loadSample(s.text, s.operation, s.mode)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-left text-xs transition-colors hover:border-primary/40"
          >
            <span className="font-medium">{s.label}</span>
            <span className="ml-1.5 text-muted">· {s.hint}</span>
          </button>
        ))}
      </div>

      {(smartTips.length > 0 || analysis.suggestions.length > 0) && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="mb-1 flex items-center gap-2 font-medium text-primary">
            <ScanLine className="h-4 w-4" />
            Smart assist
          </p>
          <ul className="list-inside list-disc text-muted">
            {(smartTips.length ? smartTips : analysis.suggestions).map((s) => (
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
            <div className="flex rounded-lg border border-border p-0.5">
              {(["encode", "decode"] as const).map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setOperation(op)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                    operation === op ? "bg-primary text-white" : "text-muted hover:text-foreground",
                  )}
                >
                  {op}
                </button>
              ))}
            </div>
            <Button variant="gradient" onClick={run}>
              <Sparkles className="h-4 w-4" />
              {operation === "encode" ? "Encode" : "Decode"}
            </Button>
            <Button variant="outline" onClick={swapIO}>
              <ArrowDownUp className="h-4 w-4" />
              Swap
            </Button>
            <Button variant="outline" onClick={runValidate}>
              <Check className="h-4 w-4" />
              Validate
            </Button>
            <Button variant="outline" onClick={copyOut} disabled={!output}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copy
            </Button>
            <Button variant="outline" onClick={shareOut} disabled={!output}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <Button variant="outline" onClick={downloadText} disabled={!output}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" onClick={commitHistory} disabled={!output}>
              <History className="h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" onClick={undo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" />
              Undo
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
              Live
            </label>
          </div>

          {operation === "encode" && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ENCODE_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateOption("encodeMode", m.id)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-colors",
                    options.encodeMode === m.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/40",
                  )}
                >
                  <p className="font-medium">{m.label}</p>
                  <p className="text-xs text-muted">{m.hint}</p>
                </button>
              ))}
            </div>
          )}

          {operation === "decode" && (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "auto", label: "Auto-detect" },
                  { id: "component", label: "Component" },
                  { id: "uri", label: "URI" },
                  { id: "form", label: "Form (+)" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateOption("decodeMode", m.id)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                    options.decodeMode === m.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {showSettings && (
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <p className="mb-3 text-sm font-medium">Encoding options</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={options.uppercaseHex}
                    onChange={(e) => updateOption("uppercaseHex", e.target.checked)}
                  />
                  Uppercase hex (%20)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={options.encodeSpacesAsPlus}
                    onChange={(e) => updateOption("encodeSpacesAsPlus", e.target.checked)}
                  />
                  Spaces as + (form style)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={options.preserveLineBreaks}
                    onChange={(e) => updateOption("preserveLineBreaks", e.target.checked)}
                  />
                  Preserve line breaks (batch lines)
                </label>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Input">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={10}
                className={`${inputClass()} min-h-[200px] resize-y py-2 font-mono text-xs`}
                placeholder="Text, URL, query string, or percent-encoded value…"
                spellCheck={false}
                aria-label="URL encode/decode input"
              />
            </Field>
            <Field label="Output">
              <textarea
                readOnly
                value={output}
                rows={10}
                className={`${inputClass()} min-h-[200px] resize-y py-2 font-mono text-xs`}
                placeholder="Result appears here…"
                aria-label="URL encode/decode output"
              />
            </Field>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </>
      )}

      {tab === "batch" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">One value per line — each line encoded or decoded independently.</p>
          <Field label="Batch input (one per line)">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={8}
              className={`${inputClass()} min-h-[160px] resize-y py-2 font-mono text-xs`}
            />
          </Field>
          <Button variant="gradient" onClick={runBatch}>
            <Layers className="h-4 w-4" />
            Run batch
          </Button>
          {batchOut && (
            <Field label="Batch output">
              <textarea readOnly value={batchOut} rows={8} className={`${inputClass()} font-mono text-xs`} />
            </Field>
          )}
        </div>
      )}

      {tab === "inspector" && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Parse URL structure, query parameters, and encoding health.</p>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-sm font-medium">Percent-encoding validation</p>
            <p className={cn("text-sm", validation.valid ? "text-emerald-500" : "text-destructive")}>
              {validation.message}
            </p>
            {validation.issues.length > 0 && (
              <ul className="mt-2 list-inside list-disc text-xs text-muted">
                {validation.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </div>
          {parsed.ok ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["Protocol", parsed.protocol],
                  ["Host", parsed.host],
                  ["Path", parsed.pathname],
                  ["Search", parsed.search],
                  ["Hash", parsed.hash],
                  ["Full href", parsed.href],
                ] as const
              ).map(([label, val]) =>
                val ? (
                  <div key={label} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
                    <p className="mt-1 break-all font-mono text-xs">{val}</p>
                  </div>
                ) : null,
              )}
              {parsed.queryParams.length > 0 && (
                <div className="col-span-full rounded-xl border border-border bg-card p-4">
                  <p className="mb-2 text-sm font-medium">Query parameters ({parsed.queryParams.length})</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border text-muted">
                          <th className="py-2 pr-4">Key</th>
                          <th className="py-2">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.queryParams.map((p, i) => (
                          <tr key={`${p.key}-${i}`} className="border-b border-border/50">
                            <td className="py-2 pr-4 font-mono">{p.key}</td>
                            <td className="py-2 font-mono">{p.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">{parsed.error ?? "Enter a URL to inspect."}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!parsed.pathname) return;
                setInput(parsed.pathname);
                setOptions((o) => ({ ...o, encodeMode: "path" }));
                setTab("studio");
              }}
            >
              Encode path only
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!parsed.search) return;
                setInput(parsed.search.replace(/^\?/, ""));
                setOptions((o) => ({ ...o, encodeMode: "query" }));
                setTab("studio");
              }}
            >
              Encode query only
            </Button>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">Last {history.length} conversions stored locally.</p>
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
            <p className="text-sm text-muted">No history yet — convert something and click Save.</p>
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
                      <span className="text-xs font-medium capitalize text-primary">
                        {h.operation} · {h.mode}
                      </span>
                      <span className="text-[10px] text-muted">{new Date(h.at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-muted">{h.input}</p>
                    <p className="truncate font-mono text-xs">{h.output}</p>
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
          <p className="text-sm text-muted">
            Server-side encode/decode for automation. Browser studio stays 100% client-side.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-muted/30 p-4 text-xs">{`POST /api/v1/url
Content-Type: application/json

{
  "action": "encode",
  "input": "hello world & café",
  "options": {
    "encodeMode": "component",
    "decodeMode": "auto",
    "uppercaseHex": true,
    "encodeSpacesAsPlus": false
  }
}`}</pre>
          <p className="text-xs text-muted">
            encodeMode: component | uri | path | query | form | rfc3986 · decodeMode: component | uri | form | auto
          </p>
        </div>
      )}
    </div>
  );
}
