export type UrlOperation = "encode" | "decode";

export type UrlEncodeMode =
  | "component"
  | "uri"
  | "path"
  | "query"
  | "form"
  | "rfc3986";

export type UrlDecodeMode = "component" | "uri" | "form" | "auto";

export interface UrlOptions {
  encodeMode: UrlEncodeMode;
  decodeMode: UrlDecodeMode;
  uppercaseHex: boolean;
  encodeSpacesAsPlus: boolean;
  preserveLineBreaks: boolean;
}

export interface UrlStats {
  inputChars: number;
  outputChars: number;
  inputBytes: number;
  outputBytes: number;
  ratio: number;
  encodedSequences: number;
  invalidSequences: number;
}

export interface UrlResult {
  ok: true;
  output: string;
  stats: UrlStats;
  mode: string;
}

export interface UrlError {
  ok: false;
  message: string;
}

export type UrlOutcome = UrlResult | UrlError;

export interface ValidationReport {
  valid: boolean;
  message: string;
  issues: string[];
  encodedPercent: number;
  possiblyDoubleEncoded: boolean;
  invalidSequences: number;
}

export interface ParsedQueryParam {
  key: string;
  value: string;
  keyRaw: string;
  valueRaw: string;
}

export interface ParsedUrlStructure {
  ok: boolean;
  error?: string;
  href?: string;
  protocol?: string;
  username?: string;
  password?: string;
  host?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  queryParams: ParsedQueryParam[];
}

export interface InputAnalysis {
  detected: string;
  looksEncoded: boolean;
  looksUrl: boolean;
  looksQueryString: boolean;
  looksFormData: boolean;
  hasUnicode: boolean;
  hasInvalidEncoding: boolean;
  suggestions: string[];
}

export const DEFAULT_URL_OPTIONS: UrlOptions = {
  encodeMode: "component",
  decodeMode: "auto",
  uppercaseHex: true,
  encodeSpacesAsPlus: false,
  preserveLineBreaks: true,
};

export const URL_SAMPLES = [
  {
    id: "unicode",
    label: "Unicode",
    hint: "UTF-8 & emoji",
    text: "café & 日本語 🌐 — ToolNest",
    operation: "encode" as const,
    mode: "component" as UrlEncodeMode,
  },
  {
    id: "query",
    label: "Query string",
    hint: "name=value pairs",
    text: "name=John Doe&city=New York&discount=50% off",
    operation: "encode" as const,
    mode: "query" as UrlEncodeMode,
  },
  {
    id: "full-url",
    label: "Full URL",
    hint: "encodeURI style",
    text: "https://example.com/search?q=hello world&lang=en#results",
    operation: "encode" as const,
    mode: "uri" as UrlEncodeMode,
  },
  {
    id: "form",
    label: "Form data",
    hint: "application/x-www-form-urlencoded",
    text: "user=admin@example.com&note=hello world&tags=a+b",
    operation: "encode" as const,
    mode: "form" as UrlEncodeMode,
  },
  {
    id: "encoded",
    label: "Percent-encoded",
    hint: "Decode me",
    text: "Hello%20World%21%26foo%3Dbar%2Fbazz",
    operation: "decode" as const,
    mode: "component" as UrlEncodeMode,
  },
  {
    id: "plus",
    label: "Plus encoding",
    hint: "Spaces as +",
    text: "email=test%40mail.com&message=hello+world+there",
    operation: "decode" as const,
    mode: "form" as UrlDecodeMode,
  },
];

const HISTORY_KEY = "toolnest-url-studio-history";
const HISTORY_MAX = 40;

function isUnreserved(byte: number): boolean {
  return (
    (byte >= 0x41 && byte <= 0x5a) ||
    (byte >= 0x61 && byte <= 0x7a) ||
    (byte >= 0x30 && byte <= 0x39) ||
    byte === 0x2d ||
    byte === 0x2e ||
    byte === 0x5f ||
    byte === 0x7e
  );
}

/** Reserved characters preserved by encodeURI (RFC 3986). */
const URI_PRESERVE = new Set([0x3b, 0x2c, 0x2f, 0x3f, 0x3a, 0x40, 0x26, 0x3d, 0x2b, 0x24, 0x23]);

function percentEncodeByte(byte: number, uppercaseHex: boolean): string {
  const hex = byte.toString(16);
  return `%${uppercaseHex ? hex.toUpperCase() : hex.padStart(2, "0")}`;
}

function rfc3986EncodeSegment(
  text: string,
  preserve: Set<number>,
  options: UrlOptions,
): string {
  const bytes = new TextEncoder().encode(text);
  let out = "";
  for (const b of bytes) {
    if (isUnreserved(b) || preserve.has(b)) {
      out += String.fromCharCode(b);
    } else if (options.encodeSpacesAsPlus && b === 0x20) {
      out += "+";
    } else {
      out += percentEncodeByte(b, options.uppercaseHex);
    }
  }
  return out;
}

function encodePathSegments(text: string, options: UrlOptions): string {
  return text
    .split("/")
    .map((seg) => rfc3986EncodeSegment(seg, new Set(), options))
    .join("/");
}

function encodeQueryString(text: string, options: UrlOptions): string {
  const trimmed = text.trim().replace(/^\?/, "");
  if (!trimmed) return "";
  return trimmed
    .split("&")
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq === -1) {
        return rfc3986EncodeSegment(pair, new Set(), options);
      }
      const key = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      return `${rfc3986EncodeSegment(key, new Set(), options)}=${rfc3986EncodeSegment(value, new Set(), options)}`;
    })
    .join("&");
}

export function encodeUrl(input: string, options: UrlOptions): UrlOutcome {
  try {
    if (!input && input !== "") {
      return { ok: false, message: "Input is empty." };
    }

    const lines = options.preserveLineBreaks ? input.split("\n") : [input];
    const encodedLines = lines.map((line) => {
      switch (options.encodeMode) {
        case "component":
          return rfc3986EncodeSegment(line, new Set(), options);
        case "uri":
          return rfc3986EncodeSegment(line, URI_PRESERVE, options);
        case "path":
          return encodePathSegments(line, options);
        case "query":
          return encodeQueryString(line, options);
        case "form":
          return encodeQueryString(line, { ...options, encodeSpacesAsPlus: true });
        case "rfc3986":
          return rfc3986EncodeSegment(line, new Set(), { ...options, encodeSpacesAsPlus: false });
        default:
          return rfc3986EncodeSegment(line, new Set(), options);
      }
    });

    const output = options.preserveLineBreaks ? encodedLines.join("\n") : encodedLines[0] ?? "";
    const validation = validatePercentEncoding(output);
    return {
      ok: true,
      output,
      stats: buildStats(input, output, validation),
      mode: options.encodeMode,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Encode failed" };
  }
}

function decodeWithMode(input: string, mode: UrlDecodeMode): string {
  const normalized =
    mode === "form" || mode === "auto"
      ? input.replace(/\+/g, " ")
      : input;

  if (mode === "uri") {
    return decodeURI(normalized);
  }
  return decodeURIComponent(normalized);
}

function tryDecode(input: string, options: UrlOptions): string {
  const attempts: UrlDecodeMode[] =
    options.decodeMode === "auto"
      ? ["component", "form", "uri"]
      : [options.decodeMode];

  let lastError: Error | null = null;
  for (const mode of attempts) {
    try {
      return decodeWithMode(input, mode);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error("Decode failed");
    }
  }
  throw lastError ?? new Error("Could not decode input with any mode.");
}

export function decodeUrl(input: string, options: UrlOptions): UrlOutcome {
  try {
    if (!input.trim()) {
      return { ok: false, message: "Input is empty." };
    }

    const lines = options.preserveLineBreaks ? input.split("\n") : [input];
    const decodedLines = lines.map((line) => tryDecode(line.trim(), options));
    const output = options.preserveLineBreaks ? decodedLines.join("\n") : decodedLines[0] ?? "";

    return {
      ok: true,
      output,
      stats: buildStats(input, output, validatePercentEncoding(input)),
      mode: options.decodeMode === "auto" ? "auto-detect" : options.decodeMode,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Decode failed" };
  }
}

export function transformUrl(
  input: string,
  operation: UrlOperation,
  options: UrlOptions,
): UrlOutcome {
  return operation === "encode" ? encodeUrl(input, options) : decodeUrl(input, options);
}

function countPercentSequences(input: string): { encoded: number; invalid: number } {
  let encoded = 0;
  let invalid = 0;
  for (let i = 0; i < input.length; i++) {
    if (input[i] !== "%") continue;
    const seq = input.slice(i, i + 3);
    if (/^%[0-9A-Fa-f]{2}$/.test(seq)) {
      encoded++;
      i += 2;
    } else {
      invalid++;
    }
  }
  return { encoded, invalid };
}

function buildStats(input: string, output: string, validation: ValidationReport): UrlStats {
  const inputBytes = new TextEncoder().encode(input).length;
  const outputBytes = new TextEncoder().encode(output).length;
  return {
    inputChars: input.length,
    outputChars: output.length,
    inputBytes,
    outputBytes,
    ratio: inputBytes ? outputBytes / inputBytes : 0,
    encodedSequences: validation.encodedPercent,
    invalidSequences: validation.invalidSequences,
  };
}

export function validatePercentEncoding(input: string): ValidationReport {
  const issues: string[] = [];
  const { encoded, invalid } = countPercentSequences(input);
  const total = input.length || 1;
  const encodedPercent = Math.round((encoded * 3 * 100) / total);

  if (invalid > 0) {
    issues.push(`${invalid} invalid % sequence(s) — expected two hex digits after %.`);
  }

  const doublePattern = /%25[0-9A-Fa-f]{2}/g;
  const doubleMatches = input.match(doublePattern);
  const possiblyDoubleEncoded = (doubleMatches?.length ?? 0) > 0;
  if (possiblyDoubleEncoded) {
    issues.push("Possible double-encoding detected (%25 = encoded percent sign).");
  }

  if (input.includes("+") && !input.includes(" ")) {
    issues.push("Contains + characters — may be form-urlencoded (space as +).");
  }

  if (/[^\x00-\x7F]/.test(input) && encoded === 0) {
    issues.push("Non-ASCII characters without percent-encoding — may need encoding.");
  }

  const valid = invalid === 0;
  const message = valid
    ? encoded > 0
      ? `Valid percent-encoding (${encoded} sequence(s)).`
      : "No percent-encoding detected — input appears plain text."
    : `Invalid encoding: ${issues[0] ?? "unknown issue"}`;

  return {
    valid,
    message,
    issues,
    encodedPercent,
    possiblyDoubleEncoded,
    invalidSequences: invalid,
  };
}

export function analyzeInput(input: string): InputAnalysis {
  const trimmed = input.trim();
  const validation = validatePercentEncoding(trimmed);
  const looksEncoded = /%[0-9A-Fa-f]{2}/.test(trimmed) || (trimmed.includes("+") && !trimmed.includes(" "));
  const looksUrl = /^https?:\/\//i.test(trimmed) || /^[\w.-]+\.[a-z]{2,}/i.test(trimmed);
  const looksQueryString = /(?:^|[?&])[^=&\s]+=[^&]*/.test(trimmed) && !looksUrl;
  const looksFormData = looksQueryString && trimmed.includes("+");
  const hasUnicode = /[^\x00-\x7F]/.test(trimmed);
  const suggestions: string[] = [];

  if (!trimmed) {
    return {
      detected: "empty",
      looksEncoded: false,
      looksUrl: false,
      looksQueryString: false,
      looksFormData: false,
      hasUnicode: false,
      hasInvalidEncoding: false,
      suggestions: ["Paste text, a URL, or query string to begin."],
    };
  }

  if (validation.possiblyDoubleEncoded) {
    suggestions.push("Try Decode twice or use auto-detect to unwrap double-encoding.");
  }
  if (looksUrl) {
    suggestions.push("Full URL detected — use URI mode to preserve :// and ? structure.");
  }
  if (looksQueryString && !looksUrl) {
    suggestions.push("Query string detected — Query or Form mode encodes each key/value pair.");
  }
  if (hasUnicode && !looksEncoded) {
    suggestions.push("Unicode/emoji present — Component or RFC 3986 mode ensures UTF-8 percent bytes.");
  }
  if (validation.invalidSequences > 0) {
    suggestions.push("Fix invalid % sequences before decoding.");
  }
  if (looksFormData) {
    suggestions.push("Form-urlencoded (+ spaces) — use Form decode mode.");
  }

  let detected = "plain text";
  if (looksUrl) detected = "URL";
  else if (looksQueryString) detected = "query string";
  else if (looksEncoded) detected = "percent-encoded";
  else if (hasUnicode) detected = "unicode text";

  return {
    detected,
    looksEncoded,
    looksUrl,
    looksQueryString,
    looksFormData,
    hasUnicode,
    hasInvalidEncoding: validation.invalidSequences > 0,
    suggestions,
  };
}

export function smartUrlSuggestions(
  input: string,
  operation: UrlOperation,
): string[] {
  const analysis = analyzeInput(input);
  const tips = [...analysis.suggestions];

  if (operation === "encode" && analysis.looksEncoded) {
    tips.unshift("Input already looks encoded — decode first to avoid double-encoding.");
  }
  if (operation === "decode" && !analysis.looksEncoded && !analysis.looksFormData) {
    tips.unshift("Input may not be encoded — switch to Encode if you meant to percent-encode.");
  }

  return [...new Set(tips)].slice(0, 5);
}

export function parseUrlStructure(input: string): ParsedUrlStructure {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Empty input", queryParams: [] };
  }

  let href = trimmed;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) {
    if (href.startsWith("//")) {
      href = `https:${href}`;
    } else if (/^[\w.-]+\.[a-z]{2,}/i.test(href) || href.includes("/")) {
      href = `https://${href}`;
    } else if (href.includes("=") && !href.includes(" ")) {
      href = `https://example.com/?${href.replace(/^\?/, "")}`;
    } else {
      return { ok: false, error: "Not a recognizable URL — try adding https://", queryParams: [] };
    }
  }

  try {
    const u = new URL(href);
    const queryParams: ParsedQueryParam[] = [];
    u.searchParams.forEach((value, key) => {
      queryParams.push({
        key,
        value,
        keyRaw: key,
        valueRaw: value,
      });
    });

    return {
      ok: true,
      href: u.href,
      protocol: u.protocol,
      username: u.username || undefined,
      password: u.password || undefined,
      host: u.host,
      hostname: u.hostname,
      port: u.port || undefined,
      pathname: u.pathname,
      search: u.search || undefined,
      hash: u.hash || undefined,
      queryParams,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Invalid URL",
      queryParams: [],
    };
  }
}

export interface BatchLineResult {
  line: number;
  ok: boolean;
  output?: string;
  error?: string;
}

export function batchTransform(
  lines: string[],
  operation: UrlOperation,
  options: UrlOptions,
): BatchLineResult[] {
  return lines.map((line, i) => {
    if (!line.trim()) {
      return { line: i + 1, ok: true, output: "" };
    }
    const result = transformUrl(line, operation, options);
    if (!result.ok) {
      return { line: i + 1, ok: false, error: result.message };
    }
    return { line: i + 1, ok: true, output: result.output };
  });
}

export interface HistoryEntry {
  id: string;
  operation: UrlOperation;
  input: string;
  output: string;
  mode: string;
  at: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: Omit<HistoryEntry, "id" | "at">): HistoryEntry[] {
  const full: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    at: Date.now(),
  };
  const prev = loadHistory();
  const next = [full, ...prev].slice(0, HISTORY_MAX);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

export async function readTextFile(file: File): Promise<string> {
  return file.text();
}

export function buildShareText(output: string, operation: UrlOperation): string {
  return `ToolNest URL ${operation === "encode" ? "Encode" : "Decode"}:\n${output}`;
}
