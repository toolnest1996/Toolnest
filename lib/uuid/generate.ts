import { NIL_UUID, MAX_UUID, UUID_NAMESPACES, type UuidNamespaceKey, type UuidVersion } from "./constants";
import {
  hexToBytes,
  setVariant,
  setVersion,
  unixMsToUuidTimestamp,
  writeUInt48BE,
} from "./bytes";
import { formatUuid, type UuidOutputFormat } from "./format";
import { md5 } from "./md5";

export interface GenerateOptions {
  version: UuidVersion;
  count?: number;
  format?: UuidOutputFormat;
  /** v3/v5 namespace preset or custom UUID string */
  namespace?: UuidNamespaceKey | string;
  /** v3/v5 name string */
  name?: string;
  /** Optional seed string for deterministic v4 (testing only) */
  seed?: string;
  /** Optional custom prefix hex (up to 6 bytes) for v8 */
  v8Prefix?: string;
}

export interface GeneratorState {
  lastTimestamp: bigint;
  clockSeq: number;
  seedCounter: number;
  seedBytes: Uint8Array | null;
}

export function createGeneratorState(): GeneratorState {
  const clockSeq = crypto.getRandomValues(new Uint8Array(2));
  return {
    lastTimestamp: 0n,
    clockSeq: ((clockSeq[0]! << 8) | clockSeq[1]!) & 0x3fff,
    seedCounter: 0,
    seedBytes: null,
  };
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

async function sha1(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest("SHA-1", toArrayBuffer(data));
  return new Uint8Array(hash);
}

async function seededRandomBytes(state: GeneratorState, seed: string, length: number): Promise<Uint8Array> {
  if (!state.seedBytes) {
    const enc = new TextEncoder().encode(seed);
    const hash = await crypto.subtle.digest("SHA-256", toArrayBuffer(enc));
    state.seedBytes = new Uint8Array(hash);
  }
  const out = new Uint8Array(length);
  let offset = 0;
  while (offset < length) {
    const counter = new Uint8Array(4);
    new DataView(counter.buffer).setUint32(0, state.seedCounter++);
    const combined = new Uint8Array(state.seedBytes.length + 4);
    combined.set(state.seedBytes);
    combined.set(counter, state.seedBytes.length);
    const block = new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(combined)));
    out.set(block.subarray(0, Math.min(block.length, length - offset)), offset);
    offset += block.length;
  }
  return out;
}

function randomNode(): Uint8Array {
  const node = crypto.getRandomValues(new Uint8Array(6));
  node[0] = (node[0]! | 0x01) & 0xff;
  return node;
}

function nextTimestamp(state: GeneratorState): bigint {
  let ts = unixMsToUuidTimestamp(Date.now());
  if (ts <= state.lastTimestamp) {
    state.clockSeq = (state.clockSeq + 1) & 0x3fff;
    ts = state.lastTimestamp + 1n;
  }
  state.lastTimestamp = ts;
  return ts;
}

function packV1Like(state: GeneratorState, version: 1 | 6): Uint8Array {
  const ts = nextTimestamp(state);
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  const node = randomNode();

  if (version === 1) {
    view.setUint32(0, Number(ts & 0xffffffffn));
    view.setUint16(4, Number((ts >> 32n) & 0xffffn));
    view.setUint16(6, Number((ts >> 48n) & 0x0fffn) | 0x1000);
  } else {
    view.setUint32(0, Number(ts & 0xffffffffn));
    view.setUint16(4, Number((ts >> 32n) & 0xffffn));
    view.setUint16(6, Number((ts >> 48n) & 0x0fffn) | 0x6000);
  }

  view.setUint16(8, state.clockSeq | 0x8000);
  bytes.set(node, 10);
  setVariant(bytes);
  return bytes;
}

async function packNameBased(
  version: 3 | 5,
  namespaceUuid: string,
  name: string,
): Promise<Uint8Array> {
  const nsBytes = hexToBytes(namespaceUuid.replace(/-/g, ""));
  if (!nsBytes) throw new Error("Invalid namespace UUID");

  const nameBytes = new TextEncoder().encode(name);
  const payload = new Uint8Array(16 + nameBytes.length);
  payload.set(nsBytes);
  payload.set(nameBytes, 16);

  const hash = version === 3 ? md5(payload) : await sha1(payload);
  setVersion(hash, version);
  setVariant(hash);
  return hash;
}

async function packV4(state: GeneratorState, seed?: string): Promise<Uint8Array> {
  const bytes =
    seed && seed.length > 0
      ? await seededRandomBytes(state, seed, 16)
      : crypto.getRandomValues(new Uint8Array(16));
  setVersion(bytes, 4);
  setVariant(bytes);
  return bytes;
}

function packV7(state: GeneratorState): Uint8Array {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  let ms = BigInt(Date.now());
  if (ms <= state.lastTimestamp) ms = state.lastTimestamp + 1n;
  state.lastTimestamp = ms;

  writeUInt48BE(view, 0, ms);
  const rand = crypto.getRandomValues(new Uint8Array(10));
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[7] = rand[0]!;
  bytes[8] = (rand[1]! & 0x3f) | 0x80;
  bytes.set(rand.slice(2), 9);
  return bytes;
}

function packV8(prefixHex?: string): Uint8Array {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  if (prefixHex) {
    const prefix = hexToBytes(prefixHex.replace(/-/g, "").slice(0, 12));
    if (prefix) bytes.set(prefix.slice(0, Math.min(6, prefix.length)));
  }
  setVersion(bytes, 8);
  setVariant(bytes);
  return bytes;
}

function resolveNamespace(ns?: string): string {
  if (!ns) return UUID_NAMESPACES.url;
  if (ns in UUID_NAMESPACES) return UUID_NAMESPACES[ns as UuidNamespaceKey];
  return ns;
}

export async function generateOne(
  options: GenerateOptions,
  state: GeneratorState = createGeneratorState(),
): Promise<string> {
  const format = options.format ?? "standard";
  let bytes: Uint8Array;

  switch (options.version) {
    case "nil":
      return format === "standard" ? NIL_UUID : formatUuid(hexToBytes("0".repeat(32))!, format);
    case "max":
      return format === "standard" ? MAX_UUID : formatUuid(hexToBytes("f".repeat(32))!, format);
    case "v1":
      bytes = packV1Like(state, 1);
      break;
    case "v6":
      bytes = packV1Like(state, 6);
      break;
    case "v3":
      bytes = await packNameBased(3, resolveNamespace(options.namespace), options.name ?? "");
      break;
    case "v5":
      bytes = await packNameBased(5, resolveNamespace(options.namespace), options.name ?? "");
      break;
    case "v4":
      bytes = await packV4(state, options.seed);
      break;
    case "v7":
      bytes = packV7(state);
      break;
    case "v8":
      bytes = packV8(options.v8Prefix);
      break;
    default:
      bytes = await packV4(state, options.seed);
  }

  return formatUuid(bytes, format);
}

export async function generateBulk(
  options: GenerateOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<string[]> {
  const count = Math.max(1, Math.min(options.count ?? 1, 1_000_000));
  const state = createGeneratorState();
  const results: string[] = new Array(count);
  const chunk = count > 10_000 ? 5_000 : count;

  for (let i = 0; i < count; i += chunk) {
    const end = Math.min(i + chunk, count);
    for (let j = i; j < end; j++) {
      results[j] = await generateOne(options, state);
    }
    onProgress?.(end, count);
    if (end < count) await new Promise((r) => setTimeout(r, 0));
  }

  return results;
}

export function analyzeEntropy(uuids: string[]): {
  totalBits: number;
  estimatedEntropyBits: number;
  uniqueChars: number;
  collisionRisk: "negligible" | "low" | "medium" | "high";
} {
  const n = uuids.length;
  if (n === 0) {
    return { totalBits: 122, estimatedEntropyBits: 0, uniqueChars: 0, collisionRisk: "negligible" };
  }
  const unique = new Set(uuids.map((u) => u.toLowerCase())).size;
  const chars = new Set(uuids.join("").replace(/-/g, "").split(""));
  const collisionRisk =
    unique < n ? "high" : n > 100_000 ? "medium" : n > 10_000 ? "low" : "negligible";
  return {
    totalBits: 122,
    estimatedEntropyBits: Math.min(122, Math.log2(Math.max(unique, 1) * (2 ** 32))),
    uniqueChars: chars.size,
    collisionRisk,
  };
}
