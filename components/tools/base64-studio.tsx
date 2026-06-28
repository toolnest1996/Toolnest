"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  Binary,
  Check,
  Copy,
  Download,
  FileCode2,
  Layers,
  Loader2,
  ScanLine,
  Settings2,
  Shield,
  Sparkles,
  Trash2,
  Undo2,
  UploadCloud,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import {
  analyzeInput,
  BASE64_SAMPLES,
  batchTransform,
  bytesToHex,
  decodeBase64,
  DEFAULT_BASE64_OPTIONS,
  encodeBase64,
  guessExtension,
  hexDump,
  readFileAsBytes,
  validateBase64,
  type Base64Alphabet,
  type Base64Operation,
  type Base64Options,
  type InputKind,
  type OutputFormat,
} from "./base64-utils";

type Tab = "studio" | "batch" | "inspector" | "api";

const TABS: { id: Tab; label: string }[] = [
  { id: "studio", label: "Studio" },
  { id: "batch", label: "Batch" },
  { id: "inspector", label: "Inspector" },
  { id: "api", label: "API" },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

export function Base64Studio({ defaultOperation = "encode" }: { defaultOperation?: Base64Operation }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const undoStack = useRef<string[]>([]);

  const [operation, setOperation] = useState<Base64Operation>(defaultOperation);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("studio");
  const [inputKind, setInputKind] = useState<InputKind>("text");
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileMime, setFileMime] = useState("application/octet-stream");
  const [options, setOptions] = useState<Base64Options>({ ...DEFAULT_BASE64_OPTIONS });
  const [showSettings, setShowSettings] = useState(false);
  const [live, setLive] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [lastBytes, setLastBytes] = useState<Uint8Array | null>(null);
  const [batchOut, setBatchOut] = useState("");

  const analysis = useMemo(() => analyzeInput(input), [input]);

  const stats = useMemo(() => {
    const inBytes =
      inputKind === "file" && fileBytes
        ? fileBytes.length
        : new TextEncoder().encode(input).length;
    const outBytes = new TextEncoder().encode(output).length;
    return {
      inBytes,
      outBytes,
      ratio: inBytes ? (outBytes / inBytes).toFixed(2) : "—",
      lines: output ? output.split("\n").length : 0,
    };
  }, [input, output, inputKind, fileBytes]);

  const run = useCallback(() => {
    if (operation === "encode") {
      if (inputKind === "file" && !fileBytes) {
        setError("Upload a file to encode.");
        setOutput("");
        return;
      }
      if (inputKind !== "file" && !input.trim()) {
        setError("Enter text or hex to encode.");
        setOutput("");
        return;
      }
      const mime = inputKind === "file" ? fileMime : options.mimeType;
      const result = encodeBase64(input, inputKind, fileBytes, { ...options, mimeType: mime });
      if (!result.ok) {
        setError(result.message);
        setOutput("");
        setLastBytes(null);
        return;
      }
      setOutput(result.output);
      setLastBytes(result.bytes);
      setError("");
      return;
    }

    if (!input.trim()) {
      setError("Paste Base64 or a data URI to decode.");
      setOutput("");
      return;
    }
    const result = decodeBase64(input, options);
    if (!result.ok) {
      setError(result.message);
      setOutput("");
      setLastBytes(null);
      return;
    }
    setOutput(result.output);
    setLastBytes(result.bytes);
    setError("");
  }, [operation, input, inputKind, fileBytes, fileMime, options]);

  useEffect(() => {
    if (!live || tab !== "studio") return;
    const t = setTimeout(run, 280);
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
        const bytes = await readFileAsBytes(file);
        pushUndo(input);
        setFileBytes(bytes);
        setFileName(file.name);
        setFileMime(file.type || "application/octet-stream");
        setInputKind("file");
        setInput("");
        setOptions((o) => ({ ...o, mimeType: file.type || "application/octet-stream", outputFormat: "data-uri" }));
        toast.success(`Loaded ${file.name} (${formatBytes(file.size)})`);
      } catch {
        toast.error("Could not read file");
      } finally {
        setLoadingFile(false);
      }
    },
    [input, pushUndo],
  );

  const loadSample = (text: string, op: Base64Operation) => {
    pushUndo(input);
    setInput(text);
    setOperation(op);
    setInputKind("text");
    setFileBytes(null);
    setFileName("");
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

  const downloadText = (ext: string, mime: string) => {
    const text = tab === "batch" ? batchOut : output;
    if (!text && !lastBytes) {
      toast.error("Nothing to download");
      return;
    }
    if (lastBytes && operation === "decode" && tab === "studio") {
      const extGuess = guessExtension(fileMime || options.mimeType);
      const buffer = lastBytes.slice().buffer;
      downloadBlob(new Blob([buffer], { type: fileMime || "application/octet-stream" }), `decoded.${extGuess}`);
    } else {
      downloadBlob(new Blob([text], { type: mime }), `base64-output.${ext}`);
    }
    toast.success("Download started");
  };

  const runBatch = () => {
    const lines = input.split("\n");
    const results = batchTransform(lines, operation, options);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      toast.error(`${failed.length} line(s) failed`);
    } else {
      toast.success("Batch complete");
    }
    setBatchOut(results.map((r) => (r.ok ? r.output : `# line ${r.line}: ${r.error}`)).join("\n"));
  };

  const runValidate = () => {
    const v = validateBase64(input);
    if (v.valid) toast.success(v.message);
    else toast.error(v.message);
    setError(v.valid ? "" : v.message);
  };

  const swapIO = () => {
    if (!output) return;
    pushUndo(input);
    setInput(output);
    setOutput("");
    setOperation((o) => (o === "encode" ? "decode" : "encode"));
    setInputKind("text");
    setFileBytes(null);
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
    setFileBytes(null);
    setFileName("");
    setLastBytes(null);
  };

  const updateOption = <K extends keyof Base64Options>(key: K, value: Base64Options[K]) => {
    setOptions((o) => ({ ...o, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Input" value={formatBytes(stats.inBytes)} />
        <Stat label="Output" value={formatBytes(stats.outBytes)} />
        <Stat label="Ratio" value={stats.ratio} />
        <Stat label="Lines" value={stats.lines} />
        <Stat label="Mode" value={operation === "encode" ? "Encode" : "Decode"} />
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
        <p className="font-display text-lg font-semibold">Ultra Base64 Studio</p>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Encode & decode text, hex, and files. URL-safe, MIME wrap, data URIs, batch lines, hex inspector — 100%
          client-side.
        </p>
        {fileName && (
          <p className="mt-2 text-xs font-medium text-primary">
            File: {fileName} · {fileBytes ? formatBytes(fileBytes.length) : ""}
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void loadFile(file);
            e.target.value = "";
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {BASE64_SAMPLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => loadSample(s.text, s.operation)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-left text-xs transition-colors hover:border-primary/40"
          >
            <span className="font-medium">{s.label}</span>
            <span className="ml-1.5 text-muted">· {s.hint}</span>
          </button>
        ))}
      </div>

      {analysis.suggestions.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          <p className="mb-1 flex items-center gap-2 font-medium text-primary">
            <ScanLine className="h-4 w-4" />
            Smart detect
          </p>
          <ul className="list-inside list-disc text-muted">
            {analysis.suggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

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
        <Button variant="outline" onClick={copyOut} disabled={!output && !batchOut}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          Copy
        </Button>
        <Button variant="outline" onClick={() => downloadText("txt", "text/plain")} disabled={!output && !batchOut}>
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
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} />
          Live
        </label>
      </div>

      {showSettings && (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <p className="mb-3 text-sm font-medium">Encoding options</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Input mode">
              <select
                value={inputKind}
                onChange={(e) => setInputKind(e.target.value as InputKind)}
                className={inputClass()}
              >
                <option value="text">UTF-8 text</option>
                <option value="hex">Hex bytes</option>
                <option value="file">File (uploaded)</option>
              </select>
            </Field>
            <Field label="Alphabet">
              <select
                value={options.alphabet}
                onChange={(e) => updateOption("alphabet", e.target.value as Base64Alphabet)}
                className={inputClass()}
              >
                <option value="standard">Standard (+/)</option>
                <option value="url-safe">URL-safe (-_)</option>
              </select>
            </Field>
            <Field label="Output format">
              <select
                value={options.outputFormat}
                onChange={(e) => updateOption("outputFormat", e.target.value as OutputFormat)}
                className={inputClass()}
              >
                <option value="plain">Plain Base64</option>
                <option value="mime-wrap">MIME wrapped (76 cols)</option>
                <option value="data-uri">Data URI</option>
              </select>
            </Field>
            <Field label="MIME type">
              <input
                value={options.mimeType}
                onChange={(e) => updateOption("mimeType", e.target.value)}
                className={inputClass()}
                placeholder="text/plain"
              />
            </Field>
            <Field label="MIME line width">
              <input
                type="number"
                min={64}
                max={120}
                value={options.mimeLineWidth}
                onChange={(e) => updateOption("mimeLineWidth", Number(e.target.value) || 76)}
                className={inputClass()}
              />
            </Field>
            <label className="flex items-center gap-2 self-end text-sm">
              <input
                type="checkbox"
                checked={options.padding}
                onChange={(e) => updateOption("padding", e.target.checked)}
              />
              Include padding (=)
            </label>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-error/30 bg-error/5 px-4 py-3 text-sm text-error" role="alert">
          {error}
        </p>
      )}

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

      {tab === "studio" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label={operation === "encode" ? "Input" : "Base64 / Data URI input"}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={14}
              spellCheck={false}
              disabled={inputKind === "file" && !!fileBytes}
              className={`${inputClass()} min-h-[280px] resize-y py-3 font-mono text-xs leading-relaxed`}
              placeholder={
                operation === "encode"
                  ? inputKind === "hex"
                    ? "48656c6c6f"
                    : "Enter text to encode…"
                  : "Paste Base64 or data:image/png;base64,…"
              }
              aria-label="Base64 input"
            />
          </Field>
          <Field label="Output">
            <textarea
              readOnly
              value={output}
              rows={14}
              className={`${inputClass()} min-h-[280px] resize-y bg-muted/20 py-3 font-mono text-xs leading-relaxed`}
              placeholder="Output appears here…"
              aria-label="Base64 output"
            />
          </Field>
        </div>
      )}

      {tab === "batch" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <Field label="One item per line">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={12}
                className={`${inputClass()} min-h-[240px] font-mono text-xs`}
                placeholder={"line1\nline2\nline3"}
              />
            </Field>
            <Button variant="gradient" onClick={runBatch}>
              <Layers className="h-4 w-4" />
              Batch {operation}
            </Button>
          </div>
          <Field label="Batch output">
            <textarea readOnly value={batchOut} rows={12} className={`${inputClass()} min-h-[240px] bg-muted/20 font-mono text-xs`} />
          </Field>
        </div>
      )}

      {tab === "inspector" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Binary className="h-4 w-4 text-primary" />
              Hex view
            </p>
            <pre className="max-h-[320px] overflow-auto rounded-xl bg-muted/20 p-3 font-mono text-xs leading-relaxed">
              {lastBytes ? bytesToHex(lastBytes) : "Run encode/decode to inspect bytes."}
            </pre>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium">
              <FileCode2 className="h-4 w-4 text-primary" />
              Hex dump
            </p>
            <pre className="max-h-[320px] overflow-auto rounded-xl bg-muted/20 p-3 font-mono text-xs leading-relaxed">
              {lastBytes ? hexDump(lastBytes) : "No binary data yet."}
            </pre>
          </div>
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <p className="flex items-center gap-2 font-medium">
            <Zap className="h-4 w-4 text-primary" />
            REST API — POST /api/v1/base64
          </p>
          <p className="text-sm text-muted">
            Programmatic encode/decode for integrations. All processing is stateless on the server — do not send
            secrets unless you self-host.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-muted/20 p-4 font-mono text-xs leading-relaxed">{`POST /api/v1/base64
Content-Type: application/json

{
  "action": "encode",
  "input": "Hello, ToolNest!",
  "options": {
    "alphabet": "standard",
    "padding": true,
    "outputFormat": "plain"
  }
}

// Response
{ "ok": true, "output": "SGVsbG8sIFRvb2xOZXN0IQ==", "stats": { ... } }`}</pre>
          <p className="flex items-center gap-2 text-xs text-muted">
            <Shield className="h-3.5 w-3.5" />
            Browser studio remains fully offline-capable — API is optional for automation.
          </p>
        </div>
      )}
    </div>
  );
}

/** @deprecated use Base64Studio */
export function Base64Encode() {
  return <Base64Studio defaultOperation="encode" />;
}

export function Base64Decode() {
  return <Base64Studio defaultOperation="decode" />;
}
