export type DigestAlgorithm =
  | "md5"
  | "sha1"
  | "sha224"
  | "sha256"
  | "sha384"
  | "sha512"
  | "sha3-224"
  | "sha3-256"
  | "sha3-384"
  | "sha3-512"
  | "blake2b-256"
  | "blake2b-512"
  | "blake2s-256"
  | "blake3"
  | "ripemd160"
  | "whirlpool"
  | "crc32"
  | "adler32";

export type OutputEncoding = "hex-lower" | "hex-upper" | "base64";

export type HashCategory = "sha2" | "sha3" | "blake" | "legacy" | "checksum" | "other";

export interface HashRequest {
  algorithms: DigestAlgorithm[];
  hmac?: boolean;
  hmacKey?: string;
  encoding: OutputEncoding;
}

export interface HashResult {
  algorithm: DigestAlgorithm;
  digest: string;
  bytes: number;
  hmac: boolean;
}

export interface FileHashResult {
  name: string;
  size: number;
  hashes: HashResult[];
}

export const DIGEST_ALGORITHMS: DigestAlgorithm[] = [
  "md5",
  "sha1",
  "sha224",
  "sha256",
  "sha384",
  "sha512",
  "sha3-224",
  "sha3-256",
  "sha3-384",
  "sha3-512",
  "blake2b-256",
  "blake2b-512",
  "blake2s-256",
  "blake3",
  "ripemd160",
  "whirlpool",
  "crc32",
  "adler32",
];

export const HMAC_CAPABLE: DigestAlgorithm[] = DIGEST_ALGORITHMS.filter(
  (a) => a !== "crc32" && a !== "adler32",
);
