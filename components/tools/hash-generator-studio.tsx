"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileKey,
  Fingerprint,
  History,
  Layers,
  Loader2,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, inputClass } from "./shared";
import { cn, downloadBlob, formatBytes } from "@/lib/utils";
import { hashFileBuffer, hashText, compareHashes, getAlgorithmMeta } from "@/lib/hash";
import {
  ALGORITHM_GROUPS,
  clearHistory,
  DEFAULT_HASH_OPTIONS,
  exportHashesCsv,
  exportHashesJson,
  exportHashesTxt,
  exportHashesXml,
  findDuplicateDigests,
  loadFavorites,
  loadHistory,
  QUICK_PRESETS,
  saveHistoryEntry,
  SETTINGS_KEY,
  smartHashSuggestions,
  toHashRequest,
  toggleFavorite,
  type DigestAlgorithm,
  type HashHistoryEntry,
  type HashResult,
  type HashStudioOptions,
} from "./hash-generator-utils";

type Tab = "studio" | "files" | "verify" | "batch" | "history" | "api";

const TABS: { id: Tab; label: string; icon: typeof Fingerprint }[] = [
  { id: "studio", label: "Studio", icon: Fingerprint },
  { id: "files", label: "Files", icon: UploadCloud },
  { id: "verify", label: "Verify", icon: ScanLine },
  { id: "batch", label: "Batch", icon: Layers },
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

interface FileRow {
  name: string;
  size: number;
  hashes: HashResult[];
}

export function HashGeneratorStudio() {
  const fileRef = useRef<HTMLInputElement>(null);
  const skipSave = useRef(true);

  const [options, setOptions] = useState<HashStudioOptions>({ ...DEFAULT_HASH_OPTIONS });
  const [tab, setTab] = useState<Tab>("studio");
  const [text, setText] = useState("");
  const [results, setResults] = useState<HashResult[]>([]);
  const [fileRows, setFileRows] = useState<FileRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifyExpected, setVerifyExpected] = useState("");
  const [batchLines, setBatchLines] = useState("");
  const [batchOut, setBatchOut] = useState<{ line: string; hashes: HashResult[] }[]>([]);
  const [history, setHistory] = useState<HashHistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  const request = useMemo(() => toHashRequest(options), [options]);
  const suggestions = useMemo(
    () => smartHashSuggestions(options, text.length, fileRows.length),
    [options, text.length, fileRows.length],
  );
  const dupes = useMemo(
    () => findDuplicateDigests(fileRows.map((f) => ({ label: f.name, hashes: f.hashes }))),
    [fileRows],
  );
  const verifyMatch = useMemo(() => {
    if (!verifyExpected.trim() || !results.length) return null;
    return results.some((r) => compareHashes(r.digest, verifyExpected));
  }, [verifyExpected, results]);

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

  const runTextHash = useCallback(async () => {
    if (!text && tab === "studio") {
      setResults([]);
      return;
    }
    setBusy(true);
    try {
      const hashes = await hashText(text, request);
      setResults(hashes);
      if (text.trim()) {
        saveHistoryEntry({
          algorithms: options.algorithms,
          sample: hashes[0]?.digest ?? "",
          inputPreview: text.slice(0, 48),
        });
        setHistory(loadHistory());
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hash failed");
    } finally {
      setBusy(false);
    }
  }, [text, request, options.algorithms, tab]);

  useEffect(() => {
    if (!options.live || tab !== "studio") return;
    const t = setTimeout(() => void runTextHash(), 250);
    return () => clearTimeout(t);
  }, [text, options.live, tab, runTextHash]);

  const toggleAlgo = (algo: DigestAlgorithm) => {
    setOptions((o) => {
      const has = o.algorithms.includes(algo);
      const algorithms = has ? o.algorithms.filter((a) => a !== algo) : [...o.algorithms, algo];
      return { ...o, algorithms: algorithms.length ? algorithms : ["sha256"] };
    });
  };

  const applyPreset = (algos: DigestAlgorithm[]) => {
    setOptions((o) => ({ ...o, algorithms: algos }));
    toast.success(`Selected ${algos.length} algorithm(s)`);
  };

  const hashFiles = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    const rows: FileRow[] = [];
    try {
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const hashes = await hashFileBuffer(buffer, request);
        rows.push({ name: file.name, size: file.size, hashes });
      }
      setFileRows(rows);
      toast.success(`Hashed ${rows.length} file(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "File hash failed");
    } finally {
      setBusy(false);
    }
  };

  const onDropFiles = (files: FileList | File[]) => {
    void hashFiles(Array.from(files));
  };

  const runBatch = async () => {
    const lines = batchLines.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setBusy(true);
    try {
      const out: { line: string; hashes: HashResult[] }[] = [];
      for (const line of lines) {
        out.push({ line, hashes: await hashText(line, request) });
      }
      setBatchOut(out);
      toast.success(`Hashed ${lines.length} lines`);
    } finally {
      setBusy(false);
    }
  };

  const copyDigest = async (digest: string) => {
    await navigator.clipboard.writeText(digest);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1200);
  };

  const exportRows = (format: "txt" | "csv" | "json" | "xml", source: "text" | "files") => {
    const rows =
      source === "files"
        ? fileRows.map((f) => ({ label: f.name, hashes: f.hashes }))
        : [{ label: "input", hashes: results }];
    if (!rows[0]?.hashes.length) return;
    const map = {
      txt: { content: exportHashesTxt(rows), mime: "text/plain", ext: "txt" },
      csv: { content: exportHashesCsv(rows), mime: "text/csv", ext: "csv" },
      json: { content: exportHashesJson(rows), mime: "application/json", ext: "json" },
      xml: { content: exportHashesXml(rows), mime: "application/xml", ext: "xml" },
    };
    const { content, mime, ext } = map[format];
    downloadBlob(new Blob([content], { type: mime }), `hashes-${Date.now()}.${ext}`);
    toast.success(`Downloaded .${ext}`);
  };

  const update = <K extends keyof HashStudioOptions>(key: K, value: HashStudioOptions[K]) => {
    setOptions((o) => ({ ...o, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Algorithms" value={options.algorithms.length} />
        <Stat label="Output" value={options.encoding.replace("hex-", "")} />
        <Stat label="Mode" value={options.hmac ? "HMAC" : "Digest"} />
        <Stat label="Results" value={results.length || fileRows.length || "—"} />
        <Stat label="Dupes" value={dupes.length || "—"} />
        <Stat label="Live" value={options.live ? "on" : "off"} />
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
          if (e.dataTransfer.files.length) onDropFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center sm:p-8",
          dragging ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50",
        )}
      >
        <UploadCloud className="mb-2 h-8 w-8 text-primary" />
        <p className="font-display text-lg font-semibold">Ultra Hash Generator Studio</p>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          MD5 · SHA-1/2/3 · BLAKE2/3 · RIPEMD · Whirlpool · CRC32 · Adler-32 · HMAC — text & files, 100% in-browser
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onDropFiles(e.target.files);
            e.target.value = "";
          }}
        />
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

      <div className="flex flex-wrap gap-2">
        {QUICK_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => applyPreset(p.algos)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-primary/40"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">Algorithms</p>
        {ALGORITHM_GROUPS.map((g) => (
          <div key={g.id}>
            <p className="mb-1 text-xs text-muted">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.algos.map((algo) => (
                <button
                  key={algo}
                  type="button"
                  onClick={() => toggleAlgo(algo)}
                  className={cn(
                    "rounded-md border px-2 py-1 text-xs",
                    options.algorithms.includes(algo)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/30",
                  )}
                >
                  {getAlgorithmMeta(algo).label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Output encoding">
          <select value={options.encoding} onChange={(e) => update("encoding", e.target.value as HashStudioOptions["encoding"])} className={inputClass()}>
            <option value="hex-lower">Hex (lowercase)</option>
            <option value="hex-upper">Hex (UPPERCASE)</option>
            <option value="base64">Base64</option>
          </select>
        </Field>
        <Field label="HMAC mode">
          <select value={options.hmac ? "on" : "off"} onChange={(e) => update("hmac", e.target.value === "on")} className={inputClass()}>
            <option value="off">Digest only</option>
            <option value="on">HMAC</option>
          </select>
        </Field>
        <Field label="Live hash">
          <select value={options.live ? "on" : "off"} onChange={(e) => update("live", e.target.value === "on")} className={inputClass()}>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </Field>
      </div>

      {options.hmac && (
        <Field label="HMAC secret key">
          <input
            value={options.hmacKey}
            onChange={(e) => update("hmacKey", e.target.value)}
            className={inputClass()}
            placeholder="Shared secret for HMAC"
            type="password"
            autoComplete="off"
          />
        </Field>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="gradient" onClick={() => void runTextHash()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
          Hash now
        </Button>
        {results.length > 0 && (
          <>
            <Button variant="outline" onClick={() => exportRows("txt", "text")}><Download className="h-4 w-4" /> TXT</Button>
            <Button variant="outline" onClick={() => exportRows("json", "text")}><Download className="h-4 w-4" /> JSON</Button>
          </>
        )}
      </div>

      {tab === "studio" && (
        <>
          <Field label="Input text">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              className={`${inputClass()} min-h-[160px] resize-y py-2 font-mono text-sm`}
              placeholder="Enter text to hash…"
            />
          </Field>
          {results.length > 0 && (
            <ul className="space-y-2">
              {results.map((r) => (
                <li key={r.algorithm} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold">
                      {getAlgorithmMeta(r.algorithm).label}
                      {r.hmac && " (HMAC)"}
                    </span>
                    <button type="button" onClick={() => void copyDigest(r.digest)} className="text-muted hover:text-foreground">
                      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <code className="block break-all font-mono text-xs">{r.digest}</code>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "files" && (
        <div className="space-y-4">
          {fileRows.length === 0 ? (
            <p className="text-sm text-muted">Drop files on the upload zone or click to select multiple files.</p>
          ) : (
            <>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => exportRows("csv", "files")}><Download className="h-4 w-4" /> Export CSV</Button>
                <Button variant="outline" size="sm" onClick={() => exportRows("json", "files")}><Download className="h-4 w-4" /> Export JSON</Button>
              </div>
              {dupes.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
                  <p className="font-medium text-amber-600 dark:text-amber-400">Duplicate digests detected</p>
                  <ul className="mt-2 space-y-1 font-mono text-xs">
                    {dupes.map((d) => (
                      <li key={`${d.algorithm}-${d.digest}`}>{d.algorithm}: {d.labels.join(" = ")}</li>
                    ))}
                  </ul>
                </div>
              )}
              <ul className="space-y-3">
                {fileRows.map((f) => (
                  <li key={f.name} className="rounded-xl border border-border p-4">
                    <p className="font-medium">{f.name} <span className="text-xs text-muted">({formatBytes(f.size)})</span></p>
                    <ul className="mt-2 space-y-1">
                      {f.hashes.map((h) => (
                        <li key={h.algorithm} className="font-mono text-xs break-all">
                          <span className="text-muted">{getAlgorithmMeta(h.algorithm).label}:</span> {h.digest}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {tab === "verify" && (
        <div className="space-y-4">
          <Field label="Expected hash (any algorithm output)">
            <input value={verifyExpected} onChange={(e) => setVerifyExpected(e.target.value)} className={`${inputClass()} font-mono text-sm`} placeholder="Paste expected digest to compare" />
          </Field>
          {verifyMatch !== null && (
            <div className={cn("flex items-center gap-2 rounded-xl border p-4 text-sm", verifyMatch ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive")}>
              <ShieldCheck className="h-5 w-5" />
              {verifyMatch ? "Match — at least one computed hash equals the expected value." : "No match — none of the computed hashes match."}
            </div>
          )}
          <p className="text-xs text-muted">Hash your text in Studio first, then paste a known checksum here.</p>
        </div>
      )}

      {tab === "batch" && (
        <div className="space-y-4">
          <Field label="One input per line">
            <textarea value={batchLines} onChange={(e) => setBatchLines(e.target.value)} rows={8} className={`${inputClass()} font-mono text-sm`} placeholder="line1&#10;line2" />
          </Field>
          <Button variant="gradient" onClick={() => void runBatch()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
            Hash all lines
          </Button>
          {batchOut.length > 0 && (
            <ul className="max-h-[400px] space-y-2 overflow-y-auto rounded-xl border border-border p-3">
              {batchOut.map((row) => (
                <li key={row.line} className="rounded-lg bg-muted/30 px-3 py-2 text-xs">
                  <p className="font-medium">{row.line}</p>
                  {row.hashes.map((h) => (
                    <p key={h.algorithm} className="font-mono break-all text-muted">{h.algorithm}: {h.digest}</p>
                  ))}
                </li>
              ))}
            </ul>
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
            <p className="text-sm text-muted">No history yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((h) => (
                <li key={h.id} className="flex items-start justify-between rounded-xl border border-border px-4 py-3">
                  <div>
                    <p className="font-mono text-sm break-all">{h.sample}</p>
                    <p className="text-xs text-muted">{h.algorithms.join(", ")} · {h.inputPreview} · {new Date(h.at).toLocaleString()}</p>
                  </div>
                  <button type="button" onClick={() => setFavorites(toggleFavorite(h.sample))} className="text-muted hover:text-primary">
                    <Star className={cn("h-4 w-4", favorites.includes(h.sample.toLowerCase()) && "fill-primary text-primary")} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 font-mono text-sm">
          <p className="font-sans text-muted">Server-side hashing via REST API (max 10 MB input).</p>
          <pre className="overflow-x-auto rounded-xl bg-muted/30 p-4 text-xs">{`POST /api/v1/hash
Content-Type: application/json

{
  "input": "hello world",
  "algorithms": ["sha256", "md5"],
  "encoding": "hex-lower",
  "hmac": false,
  "hmacKey": ""
}`}</pre>
          <p className="font-sans text-xs text-muted">
            <FileKey className="inline h-3.5 w-3.5" /> Browser studio never uploads your text or files unless you call the API.
          </p>
        </div>
      )}
    </div>
  );
}
