export type Base64Alphabet = "standard" | "url-safe";
export type Base64Operation = "encode" | "decode";
export type InputKind = "text" | "hex" | "file";
export type OutputFormat = "plain" | "mime-wrap" | "data-uri";

export interface Base64Options {
  alphabet: Base64Alphabet;
  padding: boolean;
  outputFormat: OutputFormat;
  mimeType: string;
  mimeLineWidth: number;
}

export interface Base64Result {
  ok: true;
  output: string;
  bytes: Uint8Array;
  stats: Base64Stats;
}

export interface Base64Error {
  ok: false;
  message: string;
}

export type Base64Outcome = Base64Result | Base64Error;

export interface Base64Stats {
  inputBytes: number;
  outputBytes: number;
  outputChars: number;
  ratio: number;
  lines: number;
}

export const DEFAULT_BASE64_OPTIONS: Base64Options = {
  alphabet: "standard",
  padding: true,
  outputFormat: "plain",
  mimeType: "text/plain",
  mimeLineWidth: 76,
};

export const BASE64_SAMPLES = [
  {
    id: "utf8",
    label: "UTF-8 text",
    hint: "Unicode + emoji",
    text: "ToolNest — Ultra Base64 Studio 🚀\nHello, world!",
    operation: "encode" as const,
  },
  {
    id: "json",
    label: "JSON payload",
    hint: "API body",
    text: '{"user":"admin","token":"eyJhbGciOiJIUzI1NiJ9","active":true}',
    operation: "encode" as const,
  },
  {
    id: "b64",
    label: "Base64 sample",
    hint: "Decode me",
    text: "VG9vbE5lc3QgaXMgYXdlc29tZS4=",
    operation: "decode" as const,
  },
  {
    id: "urlsafe",
    label: "URL-safe",
    hint: "JWT-style",
    text: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
    operation: "decode" as const,
  },
];

const DATA_URI_RE = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i;

export function stripBase64Input(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/^data:[^;]+;base64,/i, "");
}

export function detectInputKind(input: string): InputKind | "base64" | "data-uri" {
  const trimmed = input.trim();
  if (!trimmed) return "text";
  if (DATA_URI_RE.test(trimmed)) return "data-uri";
  if (/^(?:[0-9a-fA-F]{2}\s*)+$/.test(trimmed.replace(/\s/g, "")) && trimmed.replace(/\s/g, "").length >= 2) {
    return "hex";
  }
  const compact = stripBase64Input(trimmed);
  if (/^[A-Za-z0-9+/_-]+=*$/.test(compact) && compact.length >= 4) return "base64";
  return "text";
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function applyAlphabet(b64: string, alphabet: Base64Alphabet, padding: boolean): string {
  let out = b64;
  if (alphabet === "url-safe") {
    out = out.replace(/\+/g, "-").replace(/\//g, "_");
    if (!padding) out = out.replace(/=+$/, "");
  }
  return out;
}

export function normalizeForDecode(raw: string, alphabet: Base64Alphabet): string {
  let s = stripBase64Input(raw.trim());
  if (alphabet === "url-safe" || /^[A-Za-z0-9_-]+=*$/.test(s)) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
  }
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return s;
}

export function wrapMimeLines(b64: string, width: number): string {
  if (width <= 0) return b64;
  const parts: string[] = [];
  for (let i = 0; i < b64.length; i += width) {
    parts.push(b64.slice(i, i + width));
  }
  return parts.join("\n");
}

export function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, "");
  if (clean.length % 2 !== 0) throw new Error("Hex input must have an even number of characters.");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array, grouped = true): string {
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(grouped ? " " : "");
  return grouped ? hex.replace(/(.{48})/g, "$1\n").trim() : hex;
}

export function parseDataUri(input: string): { mime: string; bytes: Uint8Array } | null {
  const m = input.trim().match(DATA_URI_RE);
  if (!m) return null;
  const mime = m[1] || "application/octet-stream";
  const b64 = normalizeForDecode(m[2]!, "standard");
  return { mime, bytes: base64ToBytes(b64) };
}

export function buildStats(inputBytes: number, output: string): Base64Stats {
  const outputBytes = new TextEncoder().encode(output).length;
  return {
    inputBytes,
    outputBytes,
    outputChars: output.length,
    ratio: inputBytes ? outputBytes / inputBytes : 0,
    lines: output ? output.split("\n").length : 0,
  };
}

export function encodeBase64(
  input: string,
  inputKind: InputKind,
  fileBytes: Uint8Array | null,
  options: Base64Options,
): Base64Outcome {
  try {
    let bytes: Uint8Array;
    if (inputKind === "file" && fileBytes) {
      bytes = fileBytes;
    } else if (inputKind === "hex") {
      bytes = hexToBytes(input);
    } else {
      bytes = textToBytes(input);
    }

    let b64 = bytesToBase64(bytes);
    b64 = applyAlphabet(b64, options.alphabet, options.padding);

    let output = b64;
    if (options.outputFormat === "mime-wrap") {
      output = wrapMimeLines(b64, options.mimeLineWidth);
    } else if (options.outputFormat === "data-uri") {
      output = `data:${options.mimeType};base64,${b64}`;
    }

    return {
      ok: true,
      output,
      bytes,
      stats: buildStats(bytes.length, output),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Encode failed" };
  }
}

export function decodeBase64(input: string, options: Base64Options): Base64Outcome {
  try {
    const dataUri = parseDataUri(input);
    let bytes: Uint8Array;
    let mime = options.mimeType;

    if (dataUri) {
      bytes = dataUri.bytes;
      mime = dataUri.mime;
    } else {
      const normalized = normalizeForDecode(input, options.alphabet);
      if (!/^[A-Za-z0-9+/]+=*$/.test(normalized)) {
        return { ok: false, message: "Invalid Base64 characters detected." };
      }
      bytes = base64ToBytes(normalized);
    }

    const text = bytesToText(bytes);
    const output = text;

    return {
      ok: true,
      output,
      bytes,
      stats: buildStats(new TextEncoder().encode(input.trim()).length, output),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Decode failed — check padding and alphabet." };
  }
}

export function validateBase64(input: string): { valid: boolean; message: string } {
  try {
    const normalized = normalizeForDecode(input, "standard");
    if (!normalized) return { valid: false, message: "Empty input" };
    base64ToBytes(normalized);
    return { valid: true, message: "Valid Base64" };
  } catch {
    return { valid: false, message: "Invalid Base64 string" };
  }
}

export function batchTransform(
  lines: string[],
  operation: Base64Operation,
  options: Base64Options,
): { line: number; ok: boolean; output: string; error?: string }[] {
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return { line: i + 1, ok: true, output: "" };
    const result =
      operation === "encode"
        ? encodeBase64(trimmed, "text", null, options)
        : decodeBase64(trimmed, options);
    if (!result.ok) return { line: i + 1, ok: false, output: "", error: result.message };
    return { line: i + 1, ok: true, output: result.output };
  });
}

export function hexDump(bytes: Uint8Array, maxRows = 256): string {
  const rows = Math.min(Math.ceil(bytes.length / 16), maxRows);
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const offset = r * 16;
    const slice = bytes.subarray(offset, offset + 16);
    const hex = [...slice].map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const ascii = [...slice].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${offset.toString(16).padStart(8, "0")}  ${hex.padEnd(47, " ")}  ${ascii}`);
  }
  if (bytes.length > rows * 16) lines.push(`… ${bytes.length - rows * 16} more bytes`);
  return lines.join("\n");
}

export function guessExtension(mime: string): string {
  const map: Record<string, string> = {
    "text/plain": "txt",
    "application/json": "json",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "application/zip": "zip",
  };
  return map[mime] ?? "bin";
}

export async function readFileAsBytes(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/** Smart suggestions from input analysis (client-side heuristics). */
export function analyzeInput(input: string): {
  detected: ReturnType<typeof detectInputKind>;
  suggestions: string[];
} {
  const detected = detectInputKind(input);
  const suggestions: string[] = [];
  if (detected === "data-uri") suggestions.push("Data URI detected — decode will extract MIME and binary.");
  if (detected === "hex") suggestions.push("Hex input detected — switch Input mode to Hex or encode from binary.");
  if (detected === "base64") suggestions.push("Base64-like input — try Decode mode.");
  if (input.includes("\n") && input.split("\n").length > 1) suggestions.push("Multiple lines — use Batch tab for line-by-line processing.");
  if (/[^\x00-\x7F]/.test(input)) suggestions.push("Non-ASCII text — UTF-8 encoding preserved.");
  return { detected, suggestions };
}
