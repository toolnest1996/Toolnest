"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileJson,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  UploadCloud,
  Wand2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import {
  analyzeJson,
  escapeJsonString,
  flattenJson,
  JSON_SAMPLES,
  jsonToCsv,
  parseJson,
  queryJsonPath,
  repairJson,
  sortJsonKeys,
  stringifyJson,
  treeMatches,
  type JsonIndent,
} from "./json-formatter-utils";

type Tab = "editor" | "tree" | "transform";

const TABS: { id: Tab; label: string }[] = [
  { id: "editor", label: "Editor" },
  { id: "tree", label: "Tree View" },
  { id: "transform", label: "Transform" },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function JsonTreeNode({
  name,
  value,
  path,
  depth,
  search,
  defaultOpen,
}: {
  name: string;
  value: unknown;
  path: string;
  depth: number;
  search: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? depth < 2);
  const isObject = value !== null && typeof value === "object";
  const isArray = Array.isArray(value);
  const expandable = isObject && (isArray ? value.length > 0 : Object.keys(value as object).length > 0);

  if (!treeMatches(value, search, path) && search.trim()) {
    if (!expandable) return null;
    const children = isArray
      ? (value as unknown[]).map((item, i) => ({ key: String(i), val: item, p: `${path}[${i}]` }))
      : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ key: k, val: v, p: `${path}.${k}` }));
    const visible = children.filter((c) => treeMatches(c.val, search, c.p));
    if (visible.length === 0) return null;
  }

  const preview = (() => {
    if (value === null) return "null";
    if (typeof value === "string") return `"${value.length > 48 ? `${value.slice(0, 48)}…` : value}"`;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (isArray) return `Array(${value.length})`;
    if (isObject) return `Object(${Object.keys(value as object).length})`;
    return String(value);
  })();

  const typeColor =
    value === null
      ? "text-muted"
      : typeof value === "string"
        ? "text-emerald-600 dark:text-emerald-400"
        : typeof value === "number"
          ? "text-sky-600 dark:text-sky-400"
          : typeof value === "boolean"
            ? "text-amber-600 dark:text-amber-400"
            : "text-violet-600 dark:text-violet-400";

  return (
    <div className="select-none font-mono text-xs">
      <div
        className={cn(
          "flex items-center gap-1 rounded-md py-0.5 hover:bg-muted/40",
          expandable && "cursor-pointer",
        )}
        style={{ paddingLeft: depth * 14 }}
        onClick={() => expandable && setOpen((o) => !o)}
      >
        {expandable ? (
          open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span className="text-foreground">{name}</span>
        {!expandable && <span className="text-muted">:</span>}
        <span className={cn("truncate", typeColor)}>{preview}</span>
      </div>
      {expandable && open && (
        <div>
          {isArray
            ? (value as unknown[]).map((item, i) => (
                <JsonTreeNode
                  key={`${path}-${i}`}
                  name={`[${i}]`}
                  value={item}
                  path={`${path}[${i}]`}
                  depth={depth + 1}
                  search={search}
                />
              ))
            : Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                <JsonTreeNode
                  key={`${path}-${k}`}
                  name={k}
                  value={v}
                  path={`${path}.${k}`}
                  depth={depth + 1}
                  search={search}
                />
              ))}
        </div>
      )}
    </div>
  );
}

export function JsonFormatter() {
  const fileRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<string[]>([]);

  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("editor");
  const [indent, setIndent] = useState<JsonIndent>(2);
  const [showSettings, setShowSettings] = useState(false);
  const [treeSearch, setTreeSearch] = useState("");
  const [jsonPath, setJsonPath] = useState("");
  const [pathResult, setPathResult] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [copied, setCopied] = useState<"input" | "output" | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [sortKeys, setSortKeys] = useState(false);
  const [escapeUnicode, setEscapeUnicode] = useState(false);

  const liveResult = useMemo(() => parseJson(input.trim()), [input]);
  const activeParsed = liveResult.ok ? liveResult.value : null;

  const stats = useMemo(() => {
    if (!activeParsed) {
      return {
        inputBytes: new TextEncoder().encode(input).length,
        outputBytes: new TextEncoder().encode(output).length,
        keys: 0,
        objects: 0,
        arrays: 0,
        strings: 0,
        numbers: 0,
        booleans: 0,
        nulls: 0,
        maxDepth: 0,
      };
    }
    return analyzeJson(activeParsed, new TextEncoder().encode(input).length, output);
  }, [activeParsed, input, output]);

  const pushUndo = useCallback((snapshot: string) => {
    undoStack.current = [...undoStack.current.slice(-24), snapshot];
    setCanUndo(true);
  }, []);

  const runFormat = useCallback(
    (minify = false) => {
      const source = input.trim();
      if (!source) {
        setError("Paste or upload JSON first.");
        setOutput("");
        return;
      }

      let result = parseJson(source);
      if (!result.ok) {
        const repaired = repairJson(source);
        result = parseJson(repaired);
        if (result.ok) {
          toast.info("Auto-repaired JSON before formatting.");
          setInput(repaired);
        }
      }

      if (!result.ok) {
        setError(
          result.line
            ? `${result.message} (line ${result.line}, column ${result.column})`
            : result.message,
        );
        setOutput("");
        return;
      }

      let value = result.value;
      if (sortKeys) value = sortJsonKeys(value);

      let text = stringifyJson(value, indent, minify);
      if (escapeUnicode && !minify) {
        text = text.replace(/[\u007f-\uffff]/g, (ch) => {
          const code = ch.charCodeAt(0);
          return code <= 0xffff ? `\\u${code.toString(16).padStart(4, "0")}` : ch;
        });
      }

      setOutput(text);
      setError("");
      toast.success(minify ? "JSON minified" : "JSON formatted");
    },
    [input, indent, sortKeys, escapeUnicode],
  );

  const runRepair = useCallback(() => {
    if (!input.trim()) return;
    pushUndo(input);
    const repaired = repairJson(input);
    setInput(repaired);
    const result = parseJson(repaired);
    if (result.ok) {
      setError("");
      toast.success("JSON repaired — click Format to beautify");
    } else {
      setError(result.message);
      toast.error("Still invalid after repair");
    }
  }, [input, pushUndo]);

  const runValidate = useCallback(() => {
    const result = parseJson(input);
    if (result.ok) {
      setError("");
      toast.success("Valid JSON");
    } else {
      setError(
        result.line
          ? `${result.message} (line ${result.line}, column ${result.column})`
          : result.message,
      );
      toast.error("Invalid JSON");
    }
  }, [input]);

  const runPathQuery = useCallback(() => {
    if (!activeParsed) {
      toast.error("Valid JSON required");
      return;
    }
    const found = queryJsonPath(activeParsed, jsonPath);
    if (found === undefined) {
      setPathResult("");
      toast.error("Path not found");
      return;
    }
    setPathResult(stringifyJson(found, indent, false));
    toast.success("Path matched");
  }, [activeParsed, jsonPath, indent]);

  const runFlatten = useCallback(() => {
    if (!activeParsed) {
      toast.error("Valid JSON required");
      return;
    }
    const flat = flattenJson(activeParsed);
    setPathResult(JSON.stringify(flat, null, indent === "tab" ? "\t" : indent));
    toast.success("Flattened to dot notation");
  }, [activeParsed, indent]);

  const runCsv = useCallback(() => {
    if (!activeParsed) {
      toast.error("Valid JSON required");
      return;
    }
    const csv = jsonToCsv(activeParsed);
    if (!csv) {
      toast.error("CSV export needs a non-empty array of flat objects");
      return;
    }
    setPathResult(csv);
    toast.success("Converted to CSV");
  }, [activeParsed]);

  const loadSample = useCallback(
    (json: string) => {
      pushUndo(input);
      setInput(json);
      setOutput("");
      setError("");
      toast.success("Sample loaded");
    },
    [input, pushUndo],
  );

  const loadFile = useCallback(
    async (file: File) => {
      setLoadingFile(true);
      try {
        const text = await file.text();
        pushUndo(input);
        setInput(text);
        setOutput("");
        setError("");
        toast.success(`Loaded ${file.name}`);
      } catch {
        toast.error("Could not read file");
      } finally {
        setLoadingFile(false);
      }
    },
    [input, pushUndo],
  );

  const copyText = async (text: string, which: "input" | "output") => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
    toast.success("Copied");
  };

  const downloadOutput = (ext: "json" | "csv" | "txt") => {
    const text =
      ext === "csv" ? pathResult || (activeParsed ? jsonToCsv(activeParsed) : null) : output || pathResult;
    if (!text) {
      toast.error("Nothing to download");
      return;
    }
    const type = ext === "csv" ? "text/csv" : ext === "json" ? "application/json" : "text/plain";
    downloadBlob(new Blob([text], { type }), `formatted.${ext}`);
    toast.success("Download started");
  };

  const undo = () => {
    const prev = undoStack.current.pop();
    if (prev === undefined) return;
    setInput(prev);
    setCanUndo(undoStack.current.length > 0);
    setOutput("");
    setError("");
  };

  const clearAll = () => {
    pushUndo(input);
    setInput("");
    setOutput("");
    setPathResult("");
    setError("");
    setJsonPath("");
  };

  const valid = liveResult.ok;
  const displayError =
    error ||
    (input.trim() && !liveResult.ok && tab !== "editor" ? liveResult.message : "");

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Stat label="Input" value={formatBytes(stats.inputBytes)} />
        <Stat label="Output" value={formatBytes(stats.outputBytes)} />
        <Stat label="Keys" value={stats.keys} />
        <Stat label="Depth" value={stats.maxDepth} />
        <Stat label="Objects" value={stats.objects} />
        <Stat label="Arrays" value={stats.arrays} />
        <Stat label="Strings" value={stats.strings} />
        <Stat
          label="Status"
          value={input.trim() ? (valid ? "Valid" : error || liveResult.ok === false ? "Error" : "—") : "Empty"}
        />
      </div>

      {/* Upload + samples */}
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
          dragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border bg-card hover:border-primary/50",
        )}
      >
        {loadingFile ? (
          <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
        ) : (
          <UploadCloud className="mb-2 h-8 w-8 text-primary" />
        )}
        <p className="font-display text-lg font-semibold">Ultra JSON Studio</p>
        <p className="mt-1 max-w-lg text-sm text-muted">
          Drop a .json file, paste API responses, validate, repair, explore the tree, query paths, and
          export — 100% in your browser.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void loadFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {JSON_SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => loadSample(s.json)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-left text-xs transition-colors hover:border-primary/40 hover:bg-card-hover"
          >
            <span className="font-medium text-foreground">{s.label}</span>
            <span className="ml-1.5 text-muted">· {s.hint}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="gradient" onClick={() => runFormat(false)}>
          <Sparkles className="h-4 w-4" />
          Format
        </Button>
        <Button variant="outline" onClick={() => runFormat(true)}>
          <Zap className="h-4 w-4" />
          Minify
        </Button>
        <Button variant="outline" onClick={runValidate}>
          <Check className="h-4 w-4" />
          Validate
        </Button>
        <Button variant="outline" onClick={runRepair}>
          <Wand2 className="h-4 w-4" />
          Repair
        </Button>
        <Button variant="outline" onClick={() => copyText(output || input, output ? "output" : "input")}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Copy
        </Button>
        <Button variant="outline" onClick={() => downloadOutput("json")} disabled={!output}>
          <Download className="h-4 w-4" />
          Download
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
      </div>

      {showSettings && (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium">Output settings</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Indent">
              <select
                value={String(indent)}
                onChange={(e) => setIndent(e.target.value === "tab" ? "tab" : Number(e.target.value) as 2 | 4)}
                className={inputClass()}
              >
                <option value="2">2 spaces</option>
                <option value="4">4 spaces</option>
                <option value="tab">Tab</option>
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sortKeys} onChange={(e) => setSortKeys(e.target.checked)} />
              Sort keys alphabetically
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={escapeUnicode}
                onChange={(e) => setEscapeUnicode(e.target.checked)}
              />
              Escape non-ASCII as \\u
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!input.trim()) return;
                pushUndo(input);
                setInput(escapeJsonString(input));
                toast.success("Input wrapped as JSON string");
              }}
            >
              Wrap as JSON string
            </Button>
          </div>
        </div>
      )}

      {(error || displayError) && (
        <p className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          {error || displayError}
        </p>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id ? "bg-primary text-white" : "text-muted hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "editor" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="JSON Input">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={16}
              spellCheck={false}
              className={`${inputClass()} min-h-[280px] resize-y py-3 font-mono text-xs leading-relaxed`}
              placeholder='{"key": "value"}'
            />
          </Field>
          <Field label="Output">
            <textarea
              readOnly
              value={output}
              rows={16}
              className={`${inputClass()} min-h-[280px] resize-y bg-muted/20 py-3 font-mono text-xs leading-relaxed`}
              placeholder="Formatted JSON appears here…"
            />
          </Field>
        </div>
      )}

      {tab === "tree" && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={treeSearch}
              onChange={(e) => setTreeSearch(e.target.value)}
              placeholder="Search keys, values, paths…"
              className={inputClass()}
            />
            <Button variant="outline" size="sm" onClick={runValidate}>
              <RefreshCw className="h-4 w-4" />
              Sync tree
            </Button>
          </div>
          {!activeParsed ? (
            <p className="py-8 text-center text-sm text-muted">
              Paste valid JSON to explore the interactive tree.
            </p>
          ) : (
            <div className="max-h-[480px] overflow-auto rounded-xl border border-border bg-muted/10 p-3">
              <JsonTreeNode name="root" value={activeParsed} path="$" depth={0} search={treeSearch} />
            </div>
          )}
        </div>
      )}

      {tab === "transform" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Braces className="h-4 w-4 text-primary" />
              JSONPath query
            </p>
            <Field label="Path (e.g. data.users[0].name)">
              <input
                value={jsonPath}
                onChange={(e) => setJsonPath(e.target.value)}
                className={inputClass()}
                placeholder="data.users[0].name"
              />
            </Field>
            <Button variant="gradient" onClick={runPathQuery} disabled={!activeParsed}>
              Run query
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={runFlatten} disabled={!activeParsed}>
                Flatten (dot keys)
              </Button>
              <Button variant="outline" size="sm" onClick={runCsv} disabled={!activeParsed}>
                JSON → CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadOutput("csv")} disabled={!pathResult}>
                <FileJson className="h-4 w-4" />
                Download CSV
              </Button>
            </div>
          </div>
          <Field label="Transform result">
            <textarea
              readOnly
              value={pathResult}
              rows={14}
              className={`${inputClass()} min-h-[260px] resize-y bg-muted/20 py-3 font-mono text-xs`}
              placeholder="Query, flatten, or CSV output…"
            />
          </Field>
        </div>
      )}
    </div>
  );
}
