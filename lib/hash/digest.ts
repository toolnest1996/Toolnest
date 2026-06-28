import { md5, ripemd160, sha1 } from "@noble/hashes/legacy.js";
import { sha224, sha256, sha384, sha512 } from "@noble/hashes/sha2.js";
import { sha3_224, sha3_256, sha3_384, sha3_512 } from "@noble/hashes/sha3.js";
import { blake2b, blake2s } from "@noble/hashes/blake2.js";
import { blake3 } from "@noble/hashes/blake3.js";
import { hmac as nobleHmac } from "@noble/hashes/hmac.js";
import type { CHash } from "@noble/hashes/utils.js";
import { adler32, crc32 } from "./checksum";
import { encodeDigest } from "./encode";
import type { DigestAlgorithm, HashCategory, HashRequest, HashResult, OutputEncoding } from "./types";
import { whirlpool } from "./whirlpool";

type HashFn = (data: Uint8Array) => Uint8Array;

const REGISTRY: Record<
  DigestAlgorithm,
  { label: string; category: HashCategory; fn: HashFn; noble?: CHash; outputLen: number }
> = {
  md5: { label: "MD5", category: "legacy", fn: md5, noble: md5, outputLen: 16 },
  sha1: { label: "SHA-1", category: "legacy", fn: sha1, noble: sha1, outputLen: 20 },
  sha224: { label: "SHA-224", category: "sha2", fn: sha224, noble: sha224, outputLen: 28 },
  sha256: { label: "SHA-256", category: "sha2", fn: sha256, noble: sha256, outputLen: 32 },
  sha384: { label: "SHA-384", category: "sha2", fn: sha384, noble: sha384, outputLen: 48 },
  sha512: { label: "SHA-512", category: "sha2", fn: sha512, noble: sha512, outputLen: 64 },
  "sha3-224": { label: "SHA3-224", category: "sha3", fn: sha3_224, noble: sha3_224, outputLen: 28 },
  "sha3-256": { label: "SHA3-256", category: "sha3", fn: sha3_256, noble: sha3_256, outputLen: 32 },
  "sha3-384": { label: "SHA3-384", category: "sha3", fn: sha3_384, noble: sha3_384, outputLen: 48 },
  "sha3-512": { label: "SHA3-512", category: "sha3", fn: sha3_512, noble: sha3_512, outputLen: 64 },
  "blake2b-256": {
    label: "BLAKE2b-256",
    category: "blake",
    fn: (d) => blake2b(d, { dkLen: 32 }),
    outputLen: 32,
  },
  "blake2b-512": {
    label: "BLAKE2b-512",
    category: "blake",
    fn: (d) => blake2b(d, { dkLen: 64 }),
    outputLen: 64,
  },
  "blake2s-256": {
    label: "BLAKE2s-256",
    category: "blake",
    fn: (d) => blake2s(d, { dkLen: 32 }),
    outputLen: 32,
  },
  blake3: { label: "BLAKE3", category: "blake", fn: blake3, noble: blake3, outputLen: 32 },
  ripemd160: { label: "RIPEMD-160", category: "legacy", fn: ripemd160, noble: ripemd160, outputLen: 20 },
  whirlpool: { label: "Whirlpool", category: "other", fn: whirlpool, outputLen: 64 },
  crc32: { label: "CRC-32", category: "checksum", fn: crc32, outputLen: 4 },
  adler32: { label: "Adler-32", category: "checksum", fn: adler32, outputLen: 4 },
};

export function getAlgorithmMeta(algo: DigestAlgorithm) {
  return REGISTRY[algo];
}

export function listAlgorithmsByCategory(category: HashCategory): DigestAlgorithm[] {
  return (Object.keys(REGISTRY) as DigestAlgorithm[]).filter((k) => REGISTRY[k].category === category);
}

function digestOne(
  data: Uint8Array,
  algo: DigestAlgorithm,
  hmacKey?: Uint8Array,
): Uint8Array {
  const entry = REGISTRY[algo];
  if (hmacKey) {
    if (algo === "blake2b-256" || algo === "blake2b-512") {
      return blake2b(data, { key: hmacKey, dkLen: entry.outputLen });
    }
    if (algo === "blake2s-256") {
      return blake2s(data, { key: hmacKey, dkLen: 32 });
    }
    if (algo === "blake3") {
      return blake3(data, { key: hmacKey });
    }
    if (entry.noble) {
      return nobleHmac(entry.noble, hmacKey, data);
    }
    throw new Error(`HMAC not supported for ${algo}`);
  }
  return entry.fn(data);
}

export function hashBytes(data: Uint8Array, request: HashRequest): HashResult[] {
  const key = request.hmac && request.hmacKey ? new TextEncoder().encode(request.hmacKey) : undefined;
  return request.algorithms.map((algo) => {
    const bytes = digestOne(data, algo, key);
    return {
      algorithm: algo,
      digest: encodeDigest(bytes, request.encoding),
      bytes: bytes.length,
      hmac: !!key,
    };
  });
}

export async function hashText(text: string, request: HashRequest): Promise<HashResult[]> {
  return hashBytes(new TextEncoder().encode(text), request);
}

export async function hashFileBuffer(
  buffer: ArrayBuffer,
  request: HashRequest,
  onProgress?: (pct: number) => void,
): Promise<HashResult[]> {
  const data = new Uint8Array(buffer);
  onProgress?.(100);
  return hashBytes(data, request);
}

export { REGISTRY as HASH_REGISTRY };
