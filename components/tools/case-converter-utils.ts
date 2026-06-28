export type CaseMode =
  | "uppercase"
  | "lowercase"
  | "title"
  | "sentence"
  | "capitalize"
  | "toggle"
  | "camel"
  | "pascal"
  | "snake"
  | "screaming-snake"
  | "kebab"
  | "train"
  | "dot"
  | "path"
  | "constant"
  | "header"
  | "inverse"
  | "alternating"
  | "random";

export type LineSort = "none" | "asc" | "desc";

export interface CaseTransformOptions {
  locale: string;
  trimInput: boolean;
  trimLines: boolean;
  collapseSpaces: boolean;
  sortLines: LineSort;
  dedupeLines: boolean;
  smartTitle: boolean;
  preserveLineBreaks: boolean;
}

export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  lines: number;
  nonEmptyLines: number;
  sentences: number;
  paragraphs: number;
  bytes: number;
  readingTimeMin: number;
  uppercaseRatio: number;
  lowercaseRatio: number;
  digitCount: number;
  punctuationCount: number;
}

export interface CaseResult {
  ok: true;
  output: string;
  mode: CaseMode;
  stats: TextStats;
}

export interface CaseError {
  ok: false;
  message: string;
}

export type CaseOutcome = CaseResult | CaseError;

export interface InputAnalysis {
  detected: string;
  suggestions: string[];
  looksLikeCode: boolean;
  looksLikeIdentifier: boolean;
  identifierStyle?: string;
  hasUnicode: boolean;
  lineCount: number;
}

export interface HistoryEntry {
  id: string;
  mode: CaseMode;
  input: string;
  output: string;
  at: number;
}

export interface CasePreset {
  id: CaseMode;
  label: string;
  hint: string;
  category: "basic" | "programming" | "special";
}

export const DEFAULT_CASE_OPTIONS: CaseTransformOptions = {
  locale: "en",
  trimInput: false,
  trimLines: false,
  collapseSpaces: false,
  sortLines: "none",
  dedupeLines: false,
  smartTitle: true,
  preserveLineBreaks: true,
};

export const CASE_PRESETS: CasePreset[] = [
  { id: "uppercase", label: "UPPERCASE", hint: "ALL CAPS", category: "basic" },
  { id: "lowercase", label: "lowercase", hint: "all small", category: "basic" },
  { id: "title", label: "Title Case", hint: "Capitalize Words", category: "basic" },
  { id: "sentence", label: "Sentence case", hint: "First letter only", category: "basic" },
  { id: "capitalize", label: "Capitalize", hint: "Each word first letter", category: "basic" },
  { id: "toggle", label: "tOGGLE cASE", hint: "Swap upper/lower", category: "basic" },
  { id: "camel", label: "camelCase", hint: "firstWordLower", category: "programming" },
  { id: "pascal", label: "PascalCase", hint: "FirstWordUpper", category: "programming" },
  { id: "snake", label: "snake_case", hint: "underscore_words", category: "programming" },
  { id: "screaming-snake", label: "SCREAMING_SNAKE", hint: "UPPER_UNDERSCORE", category: "programming" },
  { id: "kebab", label: "kebab-case", hint: "dash-separated", category: "programming" },
  { id: "train", label: "Train-Case", hint: "Hyphen-Capitalized", category: "programming" },
  { id: "dot", label: "dot.case", hint: "period.separated", category: "programming" },
  { id: "path", label: "path/case", hint: "slash/segments", category: "programming" },
  { id: "constant", label: "CONSTANT_CASE", hint: "Same as screaming snake", category: "programming" },
  { id: "header", label: "Header-Case", hint: "Title-With-Hyphens", category: "programming" },
  { id: "inverse", label: "Inverse case", hint: "Flip each character", category: "special" },
  { id: "alternating", label: "aLtErNaTiNg", hint: "Every other letter", category: "special" },
  { id: "random", label: "RaNdOm", hint: "Randomize casing", category: "special" },
];

export const CASE_SAMPLES = [
  {
    id: "english",
    label: "English prose",
    text: "ToolNest is the best all-in-one toolkit. convert your text instantly!",
  },
  {
    id: "unicode",
    label: "Unicode",
    text: "café résumé naïve — 日本語 emoji 🚀",
  },
  {
    id: "identifier",
    label: "Identifier",
    text: "getUserProfileById HTTPRequestHandler",
  },
  {
    id: "snake",
    label: "snake_input",
    text: "hello_world_from_api_v2",
  },
  {
    id: "lines",
    label: "Multi-line",
    text: "alpha\nBeta\nGAMMA\nbeta\nalpha",
  },
];

const TITLE_SMALL_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "from", "by", "in", "of", "as", "vs", "via",
]);

const HISTORY_KEY = "toolnest-case-studio-history";
const HISTORY_MAX = 50;

function splitWords(input: string): string[] {
  const s = input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[\s_\-./\\]+/g, " ")
    .trim();
  if (!s) return [];
  return s.split(/\s+/).filter(Boolean);
}

function toAsciiLower(word: string, locale: string): string {
  return word.toLocaleLowerCase(locale);
}

function toAsciiUpper(word: string, locale: string): string {
  return word.toLocaleUpperCase(locale);
}

function capitalizeFirst(word: string, locale: string): string {
  const m = word.match(/^(\P{L}*)(\p{L})(.*)$/u);
  if (!m) return word;
  return `${m[1]}${m[2]!.toLocaleUpperCase(locale)}${m[3]!.toLocaleLowerCase(locale)}`;
}

function toggleChar(c: string, locale: string): string {
  const upper = c.toLocaleUpperCase(locale);
  return upper === c ? c.toLocaleLowerCase(locale) : upper;
}

function applyPreprocess(text: string, options: CaseTransformOptions): string {
  let out = text;
  if (options.trimInput) out = out.trim();
  if (options.collapseSpaces) out = out.replace(/[^\S\n]+/g, " ");

  const lines = options.preserveLineBreaks ? out.split("\n") : [out];
  let processed = lines.map((line) => {
    let l = line;
    if (options.trimLines) l = l.trim();
    if (options.collapseSpaces) l = l.replace(/[^\S\n]+/g, " ");
    return l;
  });

  if (options.dedupeLines) {
    const seen = new Set<string>();
    processed = processed.filter((line) => {
      const key = line;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (options.sortLines === "asc") {
    processed = [...processed].sort((a, b) => a.localeCompare(b, options.locale));
  } else if (options.sortLines === "desc") {
    processed = [...processed].sort((a, b) => b.localeCompare(a, options.locale));
  }

  return options.preserveLineBreaks ? processed.join("\n") : processed.join("\n");
}

function transformLine(line: string, mode: CaseMode, options: CaseTransformOptions): string {
  const locale = options.locale;

  switch (mode) {
    case "uppercase":
      return line.toLocaleUpperCase(locale);
    case "lowercase":
      return line.toLocaleLowerCase(locale);
    case "title":
      return line.replace(/\S+/gu, (word, idx, str) => {
        const lower = word.toLocaleLowerCase(locale);
        if (options.smartTitle) {
          const isFirst = idx === 0 || /^\s*$/.test(str.slice(0, idx));
          if (!isFirst && TITLE_SMALL_WORDS.has(lower)) return lower;
        }
        return capitalizeFirst(word, locale);
      });
    case "sentence":
      return line
        .toLocaleLowerCase(locale)
        .replace(/(^\s*\p{L})|([.!?…]\s+\p{L})/gu, (m) => m.toLocaleUpperCase(locale));
    case "capitalize":
      return line.replace(/\S+/gu, (word) => capitalizeFirst(word, locale));
    case "toggle":
      return [...line].map((c) => toggleChar(c, locale)).join("");
    case "inverse":
      return [...line].map((c) => toggleChar(c, locale)).join("");
    case "alternating": {
      let upperNext = false;
      return [...line]
        .map((c) => {
          if (!/\p{L}/u.test(c)) return c;
          const out = upperNext ? c.toLocaleUpperCase(locale) : c.toLocaleLowerCase(locale);
          upperNext = !upperNext;
          return out;
        })
        .join("");
    }
    case "random":
      return [...line]
        .map((c) => {
          if (!/\p{L}/u.test(c)) return c;
          return Math.random() > 0.5 ? c.toLocaleUpperCase(locale) : c.toLocaleLowerCase(locale);
        })
        .join("");
    case "camel":
    case "pascal":
    case "snake":
    case "screaming-snake":
    case "kebab":
    case "train":
    case "dot":
    case "path":
    case "constant":
    case "header": {
      const words = splitWords(line);
      if (!words.length) return line;
      const lower = words.map((w) => toAsciiLower(w, locale));
      switch (mode) {
        case "camel":
          return lower
            .map((w, i) => (i === 0 ? w : capitalizeFirst(w, locale)))
            .join("");
        case "pascal":
          return lower.map((w) => capitalizeFirst(w, locale)).join("");
        case "snake":
          return lower.join("_");
        case "screaming-snake":
        case "constant":
          return words.map((w) => toAsciiUpper(w, locale)).join("_");
        case "kebab":
          return lower.join("-");
        case "train":
          return words.map((w) => capitalizeFirst(toAsciiLower(w, locale), locale)).join("-");
        case "dot":
          return lower.join(".");
        case "path":
          return lower.join("/");
        case "header":
          return words.map((w) => capitalizeFirst(toAsciiLower(w, locale), locale)).join("-");
        default:
          return line;
      }
    }
    default:
      return line;
  }
}

export function transformCase(text: string, mode: CaseMode, options: CaseTransformOptions = DEFAULT_CASE_OPTIONS): CaseOutcome {
  try {
    const preprocessed = applyPreprocess(text, options);
    const output = options.preserveLineBreaks
      ? preprocessed.split("\n").map((line) => transformLine(line, mode, options)).join("\n")
      : transformLine(preprocessed.replace(/\n/g, " "), mode, options);

    return {
      ok: true,
      output,
      mode,
      stats: computeTextStats(output),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Transform failed" };
  }
}

export function computeTextStats(text: string): TextStats {
  const trimmed = text.trim();
  const lines = text.split("\n");
  const nonEmptyLines = lines.filter((l) => l.trim()).length;
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;
  const sentences = trimmed ? (trimmed.match(/[.!?…]+(\s|$)/g) || []).length || (trimmed ? 1 : 0) : 0;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter(Boolean).length : 0;
  const letters = [...text].filter((c) => /\p{L}/u.test(c));
  const upper = letters.filter((c) => c === c.toLocaleUpperCase() && c !== c.toLocaleLowerCase()).length;
  const lower = letters.filter((c) => c === c.toLocaleLowerCase() && c !== c.toLocaleUpperCase()).length;
  const letterCount = letters.length || 1;

  return {
    characters: chars,
    charactersNoSpaces: charsNoSpaces,
    words,
    lines: lines.length,
    nonEmptyLines,
    sentences,
    paragraphs,
    bytes: new TextEncoder().encode(text).length,
    readingTimeMin: Math.max(1, Math.ceil(words / 200)),
    uppercaseRatio: Math.round((upper / letterCount) * 100),
    lowercaseRatio: Math.round((lower / letterCount) * 100),
    digitCount: (text.match(/\d/g) || []).length,
    punctuationCount: (text.match(/[^\p{L}\p{N}\s]/gu) || []).length,
  };
}

export function detectIdentifierStyle(text: string): string | undefined {
  const sample = text.trim().split(/\s+/)[0] ?? "";
  if (!sample) return undefined;
  if (/^[a-z][a-zA-Z0-9]*$/.test(sample) && /[A-Z]/.test(sample)) return "camelCase";
  if (/^[A-Z][a-zA-Z0-9]*$/.test(sample)) return "PascalCase";
  if (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(sample)) return "snake_case";
  if (/^[A-Z0-9]+(_[A-Z0-9]+)+$/.test(sample)) return "SCREAMING_SNAKE";
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(sample)) return "kebab-case";
  if (/^[A-Z][a-z0-9]*(-[A-Z][a-z0-9]*)+$/.test(sample)) return "Train-Case";
  if (/^[a-z0-9]+(\.[a-z0-9]+)+$/.test(sample)) return "dot.case";
  if (/^[a-z0-9]+(\/[a-z0-9]+)+$/.test(sample)) return "path/case";
  return undefined;
}

export function analyzeText(input: string): InputAnalysis {
  const trimmed = input.trim();
  const suggestions: string[] = [];
  const hasUnicode = /[^\x00-\x7F]/.test(trimmed);
  const lineCount = input.split("\n").length;
  const identifierStyle = detectIdentifierStyle(trimmed);
  const looksLikeIdentifier = Boolean(identifierStyle) || /[_\-.\\/]/.test(trimmed);
  const looksLikeCode = /[{();=]|function |const |let |var |import |class /.test(trimmed);

  if (!trimmed) {
    return {
      detected: "empty",
      suggestions: ["Paste text or import a TXT, CSV, DOCX, or PDF file."],
      looksLikeCode: false,
      looksLikeIdentifier: false,
      hasUnicode: false,
      lineCount: 0,
    };
  }

  if (identifierStyle) {
    suggestions.push(`Detected ${identifierStyle} — try the matching programming case preset.`);
  }
  if (looksLikeCode) {
    suggestions.push("Code-like input — camelCase, snake_case, or kebab-case work well for identifiers.");
  }
  if (hasUnicode) {
    suggestions.push("Unicode text — locale-aware casing preserves accents and scripts.");
  }
  if (lineCount > 5) {
    suggestions.push("Multiple lines — enable sort or dedupe in Settings for list cleanup.");
  }
  if (/^\s*[A-Z\s]+\s*$/.test(trimmed) && trimmed.length > 3) {
    suggestions.push("Mostly uppercase — lowercase or sentence case may improve readability.");
  }
  if (trimmed === trimmed.toLowerCase() && trimmed.includes(" ")) {
    suggestions.push("All lowercase prose — try Title Case or Sentence case.");
  }

  let detected = "plain text";
  if (looksLikeCode) detected = "code";
  else if (identifierStyle) detected = identifierStyle;
  else if (hasUnicode) detected = "unicode text";
  else if (lineCount > 1) detected = "multi-line text";

  return {
    detected,
    suggestions: [...new Set(suggestions)].slice(0, 5),
    looksLikeCode,
    looksLikeIdentifier,
    identifierStyle,
    hasUnicode,
    lineCount,
  };
}

export function smartCaseSuggestions(input: string, mode: CaseMode): string[] {
  const analysis = analyzeText(input);
  const tips = [...analysis.suggestions];

  if (mode === "title" && analysis.hasUnicode) {
    tips.unshift("Title Case uses Unicode letter boundaries — works with accented characters.");
  }
  if (["camel", "pascal", "snake", "kebab"].includes(mode) && !analysis.looksLikeIdentifier && input.includes(" ")) {
    tips.unshift("Programming cases split on spaces and punctuation — ideal for phrases and identifiers.");
  }
  if (mode === "random" || mode === "alternating") {
    tips.unshift("Fun modes are per-character — results differ on each random run.");
  }

  return [...new Set(tips)].slice(0, 5);
}

export interface BatchLineResult {
  line: number;
  ok: boolean;
  output?: string;
  error?: string;
}

export function batchTransformLines(
  lines: string[],
  mode: CaseMode,
  options: CaseTransformOptions,
): BatchLineResult[] {
  return lines.map((line, i) => {
    if (!line.trim()) return { line: i + 1, ok: true, output: "" };
    const result = transformCase(line, mode, { ...options, preserveLineBreaks: false });
    if (!result.ok) return { line: i + 1, ok: false, error: result.message };
    return { line: i + 1, ok: true, output: result.output };
  });
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: Omit<HistoryEntry, "id" | "at">): HistoryEntry[] {
  const full: HistoryEntry = { ...entry, id: crypto.randomUUID(), at: Date.now() };
  const next = [full, ...loadHistory()].slice(0, HISTORY_MAX);
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

async function extractDocxText(bytes: ArrayBuffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) throw new Error("Invalid DOCX — missing document.xml");

  return xml
    .replace(/<w:tab[^/]*\/>/g, "\t")
    .replace(/<w:br[^/]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(bytes: ArrayBuffer): Promise<string> {
  const { loadPdfJs } = await import("./pdf-merge-utils");
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) parts.push(line);
  }
  doc.destroy();
  if (!parts.length) throw new Error("No extractable text in PDF (may be scanned/image-only).");
  return parts.join("\n\n");
}

export type ImportFormat = "txt" | "csv" | "docx" | "pdf" | "unknown";

export function detectImportFormat(file: File): ImportFormat {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".text")) return "txt";
  if (file.type.includes("pdf")) return "pdf";
  if (file.type.includes("wordprocessingml")) return "docx";
  if (file.type.includes("csv") || file.type.includes("text")) return "txt";
  return "unknown";
}

export async function extractTextFromFile(file: File): Promise<{ text: string; format: ImportFormat }> {
  const format = detectImportFormat(file);
  const bytes = await file.arrayBuffer();

  switch (format) {
    case "docx":
      return { text: await extractDocxText(bytes), format };
    case "pdf":
      return { text: await extractPdfText(bytes), format };
    case "csv":
    case "txt":
    case "unknown":
      return { text: new TextDecoder("utf-8").decode(bytes), format: format === "unknown" ? "txt" : format };
    default:
      return { text: new TextDecoder("utf-8").decode(bytes), format: "txt" };
  }
}

export function exportAsCsv(lines: string[]): string {
  return lines.map((line) => `"${line.replace(/"/g, '""')}"`).join("\n");
}
