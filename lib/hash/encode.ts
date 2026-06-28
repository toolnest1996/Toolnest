export function bytesToHex(bytes: Uint8Array, upper = false): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return upper ? hex.toUpperCase() : hex;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export function encodeDigest(bytes: Uint8Array, encoding: "hex-lower" | "hex-upper" | "base64"): string {
  switch (encoding) {
    case "hex-upper":
      return bytesToHex(bytes, true);
    case "base64":
      return bytesToBase64(bytes);
    default:
      return bytesToHex(bytes, false);
  }
}

export function normalizeHashInput(value: string): string {
  return value.trim().replace(/^0x/i, "").replace(/\s+/g, "").toLowerCase();
}

export function compareHashes(a: string, b: string): boolean {
  return normalizeHashInput(a) === normalizeHashInput(b);
}
