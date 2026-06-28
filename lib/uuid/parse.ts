import { NIL_UUID, MAX_UUID } from "./constants";
import {
  bytesToHex,
  getVariant,
  getVersion,
  hexToBytes,
  readUInt48BE,
  uuidTimestampToUnixMs,
} from "./bytes";
import { formatUuid, normalizeUuidInput, type UuidOutputFormat } from "./format";

export interface ParsedUuid {
  raw: Uint8Array;
  canonical: string;
  version: number | null;
  variant: "rfc4122" | "reserved" | "invalid";
  isNil: boolean;
  isMax: boolean;
  timestamp?: {
    unixMs: number;
    iso: string;
  };
  node?: string;
  clockSeq?: number;
}

const UUID_RE =
  /^(?:urn:uuid:)?[\{\(]?[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}[\}\)]?$/i;

export function isUuidShape(input: string): boolean {
  return UUID_RE.test(input.trim());
}

export function parseUuid(input: string): ParsedUuid | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (lower === NIL_UUID || normalizeUuidInput(lower) === "0".repeat(32)) {
    const raw = hexToBytes("0".repeat(32))!;
    return {
      raw,
      canonical: NIL_UUID,
      version: null,
      variant: "rfc4122",
      isNil: true,
      isMax: false,
    };
  }

  const normalized = normalizeUuidInput(trimmed);
  if (normalized === "f".repeat(32)) {
    const raw = hexToBytes(normalized)!;
    return {
      raw,
      canonical: MAX_UUID,
      version: null,
      variant: "rfc4122",
      isNil: false,
      isMax: true,
    };
  }

  if (!UUID_RE.test(trimmed)) return null;
  const raw = hexToBytes(normalized);
  if (!raw) return null;

  const version = getVersion(raw);
  const variant = getVariant(raw);
  const canonical = formatUuid(raw, "standard");
  const parsed: ParsedUuid = {
    raw,
    canonical,
    version,
    variant,
    isNil: bytesToHex(raw) === "0".repeat(32),
    isMax: bytesToHex(raw) === "f".repeat(32),
  };

  if (variant === "rfc4122" && (version === 1 || version === 6)) {
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const timeLow = BigInt(view.getUint32(0));
    const timeMid = BigInt(view.getUint16(4));
    const timeHi = BigInt(view.getUint16(6) & 0x0fff);
    const ts = (timeHi << 48n) | (timeMid << 32n) | timeLow;
    const unixMs = uuidTimestampToUnixMs(ts);
    parsed.timestamp = { unixMs, iso: new Date(unixMs).toISOString() };
    parsed.clockSeq = view.getUint16(8) & 0x3fff;
    parsed.node = bytesToHex(raw.slice(10));
  } else if (variant === "rfc4122" && version === 7) {
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    const unixMs = Number(readUInt48BE(view, 0));
    parsed.timestamp = { unixMs, iso: new Date(unixMs).toISOString() };
  }

  return parsed;
}

export function validateUuid(input: string): { valid: boolean; error?: string; parsed?: ParsedUuid } {
  if (!input.trim()) return { valid: false, error: "Empty input" };
  const parsed = parseUuid(input);
  if (!parsed) return { valid: false, error: "Invalid UUID format" };
  if (parsed.variant === "invalid") return { valid: false, error: "Invalid variant bits", parsed };
  return { valid: true, parsed };
}

export function detectCollisions(uuids: string[]): { unique: number; duplicates: string[]; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  for (const line of uuids) {
    const p = parseUuid(line);
    if (!p) continue;
    const key = p.canonical;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, c]) => c > 1).map(([k]) => k);
  return { unique: counts.size, duplicates, counts };
}

export function versionLabel(version: number | null): string {
  if (version === null) return "N/A";
  const map: Record<number, string> = {
    1: "Time-based (v1)",
    3: "Name-based MD5 (v3)",
    4: "Random (v4)",
    5: "Name-based SHA-1 (v5)",
    6: "Reordered time (v6)",
    7: "Unix timestamp (v7)",
    8: "Custom (v8)",
  };
  return map[version] ?? `Unknown (${version})`;
}

export function formatParsed(parsed: ParsedUuid, format: UuidOutputFormat): string {
  return formatUuid(parsed.raw, format);
}
