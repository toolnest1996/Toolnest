import {
  analyzeEntropy,
  detectCollisions,
  generateBulk,
  type GenerateOptions,
  type UuidOutputFormat,
  type UuidVersion,
  UUID_NAMESPACES,
  validateUuid,
  versionLabel,
  type ParsedUuid,
} from "@/lib/uuid";
import { downloadBlob } from "@/lib/utils";
import QRCode from "qrcode";

export type { GenerateOptions, UuidOutputFormat, UuidVersion, ParsedUuid };
export { UUID_NAMESPACES, analyzeEntropy, detectCollisions, generateBulk, validateUuid, versionLabel };

export interface UuidStudioOptions {
  version: UuidVersion;
  count: number;
  format: UuidOutputFormat;
  namespace: keyof typeof UUID_NAMESPACES | "custom";
  customNamespace: string;
  name: string;
  seed: string;
  v8Prefix: string;
  livePreview: boolean;
}

export const DEFAULT_UUID_OPTIONS: UuidStudioOptions = {
  version: "v4",
  count: 10,
  format: "standard",
  namespace: "url",
  customNamespace: "",
  name: "example.com",
  seed: "",
  v8Prefix: "",
  livePreview: true,
};

export const UUID_PRESETS: { id: UuidVersion; label: string; hint: string }[] = [
  { id: "v4", label: "v4 Random", hint: "Cryptographically secure random — default for most apps" },
  { id: "v7", label: "v7 Time-sortable", hint: "Unix ms timestamp + random — great for databases" },
  { id: "v1", label: "v1 Time-based", hint: "Classic MAC/time UUID (random node in browser)" },
  { id: "v6", label: "v6 Reordered", hint: "Sort-friendly time-based layout (RFC 9562)" },
  { id: "v5", label: "v5 SHA-1", hint: "Deterministic from namespace + name" },
  { id: "v3", label: "v3 MD5", hint: "Legacy deterministic namespace UUID" },
  { id: "v8", label: "v8 Custom", hint: "Vendor-specific custom layout" },
  { id: "nil", label: "Nil UUID", hint: "All zeros — null sentinel" },
  { id: "max", label: "Max UUID", hint: "All ones — upper bound sentinel" },
];

export const FORMAT_OPTIONS: { id: UuidOutputFormat; label: string }[] = [
  { id: "standard", label: "Standard (lowercase)" },
  { id: "uppercase", label: "UPPERCASE" },
  { id: "lowercase", label: "lowercase" },
  { id: "no-hyphens", label: "No hyphens" },
  { id: "braces", label: "{braces}" },
  { id: "urn", label: "URN format" },
];

export const SETTINGS_KEY = "toolnest-uuid-studio-settings";
const HISTORY_KEY = "toolnest-uuid-history";
const FAVORITES_KEY = "toolnest-uuid-favorites";
const MAX_HISTORY = 50;

export interface UuidHistoryEntry {
  id: string;
  version: UuidVersion;
  count: number;
  sample: string;
  at: number;
}

export function loadHistory(): UuidHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as UuidHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: Omit<UuidHistoryEntry, "id" | "at">): void {
  const next: UuidHistoryEntry[] = [
    { ...entry, id: crypto.randomUUID(), at: Date.now() },
    ...loadHistory(),
  ].slice(0, MAX_HISTORY);
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

export function toggleFavorite(uuid: string): string[] {
  const canonical = validateUuid(uuid).parsed?.canonical ?? uuid.toLowerCase();
  const current = loadFavorites();
  const next = current.includes(canonical)
    ? current.filter((f) => f !== canonical)
    : [canonical, ...current].slice(0, 100);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return next;
}

export function toGenerateOptions(opts: UuidStudioOptions): GenerateOptions {
  return {
    version: opts.version,
    count: opts.count,
    format: opts.format,
    namespace: opts.namespace === "custom" ? opts.customNamespace : opts.namespace,
    name: opts.name,
    seed: opts.seed || undefined,
    v8Prefix: opts.v8Prefix || undefined,
  };
}

export function exportAsTxt(uuids: string[]): string {
  return uuids.join("\n");
}

export function exportAsCsv(uuids: string[]): string {
  return "uuid\n" + uuids.map((u) => `"${u.replace(/"/g, '""')}"`).join("\n");
}

export function exportAsJson(uuids: string[]): string {
  return JSON.stringify({ uuids, count: uuids.length, generatedAt: new Date().toISOString() }, null, 2);
}

export function exportAsXml(uuids: string[]): string {
  const items = uuids.map((u) => `  <uuid>${escapeXml(u)}</uuid>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<uuids count="${uuids.length}">\n${items}\n</uuids>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function parseUuidList(text: string): string[] {
  return text
    .split(/[\r\n,;\t]+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function smartUuidSuggestions(opts: UuidStudioOptions): string[] {
  const tips: string[] = [];
  if (opts.version === "v4" && opts.count > 100_000) {
    tips.push("Generating 100k+ v4 UUIDs may take a moment — browser stays responsive via chunked processing.");
  }
  if ((opts.version === "v3" || opts.version === "v5") && !opts.name.trim()) {
    tips.push("v3/v5 require a name string — same namespace + name always yields the same UUID.");
  }
  if (opts.version === "v7") {
    tips.push("v7 UUIDs are time-sortable — ideal for primary keys in PostgreSQL and distributed logs.");
  }
  if (opts.seed.trim() && opts.version === "v4") {
    tips.push("Seeded v4 is deterministic for testing — not suitable for production security.");
  }
  if (opts.version === "v1" || opts.version === "v6") {
    tips.push("Browser v1/v6 uses a random node ID (not MAC) per RFC privacy recommendations.");
  }
  if (opts.count === 1 && opts.format === "urn") {
    tips.push("URN format is common in SAML, XML schemas, and enterprise document IDs.");
  }
  if (tips.length === 0) {
    tips.push("v4 is recommended for general-purpose unique IDs. Use v7 when sort-by-time matters.");
  }
  return tips;
}

export function validateUuidList(lines: string[]): {
  line: number;
  input: string;
  valid: boolean;
  error?: string;
  parsed?: ParsedUuid;
}[] {
  return lines.map((input, i) => {
    const result = validateUuid(input);
    return {
      line: i + 1,
      input,
      valid: result.valid,
      error: result.error,
      parsed: result.parsed,
    };
  });
}

export function qrFilename(uuid: string, ext: "png" | "svg"): string {
  const safe = uuid.replace(/[^a-z0-9-]/gi, "").slice(0, 36) || "uuid";
  return `uuid-qr-${safe}.${ext}`;
}

export async function createUuidQrDataUrl(uuid: string, width = 512): Promise<string> {
  return QRCode.toDataURL(uuid, {
    margin: 2,
    width,
    errorCorrectionLevel: "M",
    color: { dark: "#0d0d1a", light: "#ffffff" },
  });
}

export async function createUuidQrSvg(uuid: string): Promise<string> {
  return QRCode.toString(uuid, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0d0d1a", light: "#ffffff" },
  });
}

export async function downloadUuidQrPng(uuid: string, width = 512): Promise<void> {
  const dataUrl = await createUuidQrDataUrl(uuid, width);
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  downloadBlob(blob, qrFilename(uuid, "png"));
}

export async function downloadUuidQrSvg(uuid: string): Promise<void> {
  const svg = await createUuidQrSvg(uuid);
  downloadBlob(new Blob([svg], { type: "image/svg+xml" }), qrFilename(uuid, "svg"));
}
