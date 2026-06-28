"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { FileDrop } from "./shared";

const ALGOS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function ChecksumGenerator() {
  const [files, setFiles] = useState<File[]>([]);
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  const handleFiles = async (next: File[]) => {
    setFiles(next);
    setHashes({});
    if (next.length === 0) return;
    setBusy(true);
    try {
      const buffer = await next[0].arrayBuffer();
      const result: Record<string, string> = {};
      for (const algo of ALGOS) {
        const digest = await crypto.subtle.digest(algo, buffer);
        result[algo] = toHex(digest);
      }
      setHashes(result);
    } finally {
      setBusy(false);
    }
  };

  const copy = async (algo: string) => {
    await navigator.clipboard.writeText(hashes[algo]);
    setCopied(algo);
    setTimeout(() => setCopied(""), 1500);
  };

  return (
    <div className="space-y-6">
      <FileDrop
        files={files}
        onFiles={handleFiles}
        hint="Any file type. Hashing happens locally in your browser."
      />

      {busy && <p className="text-sm text-muted">Calculating checksums...</p>}

      {Object.keys(hashes).length > 0 && (
        <div className="space-y-3">
          {ALGOS.map((algo) => (
            <div
              key={algo}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-semibold">{algo}</span>
                <button
                  onClick={() => copy(algo)}
                  className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
                >
                  {copied === algo ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-success" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </>
                  )}
                </button>
              </div>
              <code className="block break-all font-mono text-xs text-muted">
                {hashes[algo]}
              </code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
