import {
  compareHashes,
  hashText,
  listAlgorithmsByCategory,
  type DigestAlgorithm,
  type HashRequest,
  type HashResult,
  type OutputEncoding,
  DIGEST_ALGORITHMS,
  HMAC_CAPABLE,
} from "@/lib/hash";

export type { DigestAlgorithm, HashRequest, HashResult, OutputEncoding };
export { compareHashes, hashText, listAlgorithmsByCategory, DIGEST_ALGORITHMS, HMAC_CAPABLE };

export interface HashStudioOptions {
  algorithms: DigestAlgorithm[];
  encoding: OutputEncoding;
  hmac: boolean;
  hmacKey: string;
  live: boolean;
}

export const DEFAULT_HASH_OPTIONS: HashStudioOptions = {
  algorithms: ["sha256"],
  encoding: "hex-lower",
  hmac: false,
  hmacKey: "",
  live: true,
};

export const ALGORITHM_GROUPS: { id: string; label: string; algos: DigestAlgorithm[] }[] = [
  { id: "sha2", label: "SHA-2", algos: listAlgorithmsByCategory("sha2") },
  { id: "sha3", label: "SHA-3", algos: listAlgorithmsByCategory("sha3") },
  { id: "blake", label: "BLAKE", algos: listAlgorithmsByCategory("blake") },
  { id: "legacy", label: "Legacy", algos: listAlgorithmsByCategory("legacy") },
  { id: "checksum", label: "Checksum", algos: listAlgorithmsByCategory("checksum") },
  { id: "other", label: "Other", algos: listAlgorithmsByCategory("other") },
];

export const QUICK_PRESETS: { id: string; label: string; algos: DigestAlgorithm[] }[] = [
  { id: "secure", label: "Secure (SHA-256 + SHA-512)", algos: ["sha256", "sha512"] },
  { id: "sha2-all", label: "All SHA-2", algos: listAlgorithmsByCategory("sha2") },
  { id: "sha3-all", label: "All SHA-3", algos: listAlgorithmsByCategory("sha3") },
  { id: "legacy-all", label: "Legacy audit", algos: ["md5", "sha1", "ripemd160"] },
  { id: "file-check", label: "File checksum", algos: ["crc32", "adler32", "sha256"] },
];

export const SETTINGS_KEY = "toolnest-hash-studio-settings";
const HISTORY_KEY = "toolnest-hash-history";
const FAVORITES_KEY = "toolnest-hash-favorites";

export interface HashHistoryEntry {
  id: string;
  algorithms: DigestAlgorithm[];
  sample: string;
  inputPreview: string;
  at: number;
}

export function loadHistory(): HashHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HashHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: Omit<HashHistoryEntry, "id" | "at">): void {
  const next: HashHistoryEntry[] = [
    { ...entry, id: crypto.randomUUID(), at: Date.now() },
    ...loadHistory(),
  ].slice(0, 40);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function toggleFavorite(digest: string): string[] {
  const key = digest.toLowerCase();
  const current = loadFavorites();
  const next = current.includes(key) ? current.filter((f) => f !== key) : [key, ...current].slice(0, 50);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
}

export function toHashRequest(opts: HashStudioOptions): HashRequest {
  return {
    algorithms: opts.algorithms.length ? opts.algorithms : ["sha256"],
    encoding: opts.encoding,
    hmac: opts.hmac,
    hmacKey: opts.hmacKey || undefined,
  };
}

export function exportHashesTxt(rows: { label: string; hashes: HashResult[] }[]): string {
  return rows
    .map((r) =>
      r.hashes.map((h) => `${r.label}\t${h.algorithm}\t${h.digest}`).join("\n"),
    )
    .join("\n");
}

export function exportHashesCsv(rows: { label: string; hashes: HashResult[] }[]): string {
  const lines = ["label,algorithm,digest,hmac"];
  for (const r of rows) {
    for (const h of r.hashes) {
      lines.push(`"${r.label.replace(/"/g, '""')}","${h.algorithm}","${h.digest}",${h.hmac}`);
    }
  }
  return lines.join("\n");
}

export function exportHashesJson(rows: { label: string; hashes: HashResult[] }[]): string {
  return JSON.stringify({ rows, exportedAt: new Date().toISOString() }, null, 2);
}

export function exportHashesXml(rows: { label: string; hashes: HashResult[] }[]): string {
  const items = rows
    .flatMap((r) =>
      r.hashes.map(
        (h) =>
          `  <hash label="${escapeXml(r.label)}" algorithm="${h.algorithm}" hmac="${h.hmac}">${escapeXml(h.digest)}</hash>`,
      ),
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<hashes>\n${items}\n</hashes>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function smartHashSuggestions(opts: HashStudioOptions, inputLen: number, fileCount: number): string[] {
  const tips: string[] = [];
  if (opts.algorithms.includes("md5") || opts.algorithms.includes("sha1")) {
    tips.push("MD5 and SHA-1 are legacy — use SHA-256 or SHA-512 for security-sensitive applications.");
  }
  if (opts.hmac && !opts.hmacKey.trim()) {
    tips.push("Enter an HMAC secret key to compute message authentication codes.");
  }
  if (fileCount > 1) {
    tips.push("Multi-file mode detects duplicate digests across uploaded files.");
  }
  if (inputLen > 100_000) {
    tips.push("Large input — hashing runs locally in chunked passes without uploading data.");
  }
  if (opts.algorithms.includes("blake3")) {
    tips.push("BLAKE3 is extremely fast — ideal for large files and content-addressed storage.");
  }
  if (opts.algorithms.includes("sha3-256")) {
    tips.push("SHA3-256 uses a different construction than SHA-2 — preferred in some post-quantum planning.");
  }
  if (tips.length === 0) {
    tips.push("SHA-256 is the default for passwords, artifacts, and API signatures. Enable HMAC for secret-key authentication.");
  }
  return tips;
}

export function findDuplicateDigests(
  rows: { label: string; hashes: HashResult[] }[],
): { digest: string; algorithm: DigestAlgorithm; labels: string[] }[] {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    for (const h of row.hashes) {
      const key = `${h.algorithm}::${h.digest.toLowerCase()}`;
      const labels = map.get(key) ?? [];
      labels.push(row.label);
      map.set(key, labels);
    }
  }
  return [...map.entries()]
    .filter(([, labels]) => labels.length > 1)
    .map(([key, labels]) => {
      const [algorithm, digest] = key.split("::") as [DigestAlgorithm, string];
      return { algorithm, digest, labels };
    });
}
