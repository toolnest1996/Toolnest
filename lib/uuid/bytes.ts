export function setVersion(bytes: Uint8Array, version: number): void {
  bytes[6] = (bytes[6]! & 0x0f) | ((version & 0x0f) << 4);
}

export function setVariant(bytes: Uint8Array): void {
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
}

export function getVersion(bytes: Uint8Array): number {
  return (bytes[6]! >> 4) & 0x0f;
}

export function getVariant(bytes: Uint8Array): "rfc4122" | "reserved" | "invalid" {
  const v = bytes[8]!;
  if ((v & 0x80) === 0) return "invalid";
  if ((v & 0xc0) === 0x80) return "rfc4122";
  return "reserved";
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(hex: string): Uint8Array | null {
  const clean = hex.replace(/[^0-9a-f]/gi, "");
  if (clean.length !== 32) return null;
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    const byte = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return null;
    out[i] = byte;
  }
  return out;
}

export function writeUInt48BE(view: DataView, offset: number, value: bigint): void {
  const hi = Number((value >> 16n) & 0xffffffffn);
  const lo = Number(value & 0xffffn);
  view.setUint32(offset, hi);
  view.setUint16(offset + 4, lo);
}

export function readUInt48BE(view: DataView, offset: number): bigint {
  const hi = BigInt(view.getUint32(offset));
  const lo = BigInt(view.getUint16(offset + 4));
  return (hi << 16n) | lo;
}

export function unixMsToUuidTimestamp(ms: number): bigint {
  return BigInt(ms) * 10_000n + 0x01b21dd213814000n;
}

export function uuidTimestampToUnixMs(ts: bigint): number {
  return Number((ts - 0x01b21dd213814000n) / 10_000n);
}
