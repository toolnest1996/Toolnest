import { computeTextStats, exportAsCsv, extractTextFromFile, type TextStats } from "./case-converter-utils";

export type DedupeMode =
  | "lines"
  | "words"
  | "sentences"
  | "paragraphs"
  | "csv-rows"
  | "json-objects"
  | "emails"
  | "urls"
  | "numbers"
  | "custom";

export type KeepOccurrence = "first" | "last";
export type MatchMode = "exact" | "fuzzy";
export type SortWhen = "none" | "before" | "after";

export interface DedupeOptions {
  caseSensitive: boolean;
  trimWhitespace: boolean;
  ignorePunctuation: boolean;
  ignoreEmpty: boolean;
  keep: KeepOccurrence;
  sortWhen: SortWhen;
  sortOrder: "asc" | "desc";
  matchMode: MatchMode;
  fuzzyThreshold: number;
  customPattern: string;
  csvDelimiter: string;
  jsonKey: string;
}

export interface DedupeItemMeta {
  index: number;
  raw: string;
  key: string;
  isDuplicate: boolean;
  kept: boolean;
  duplicateOf: number | null;
  occurrence: number;
}

export interface DedupeStats {
  total: number;
  unique: number;
  removed: number;
  duplicateGroups: number;
  inputBytes: number;
  outputBytes: number;
}

export interface DedupeResult {
  ok: true;
  output: string;
  mode: DedupeMode;
  stats: DedupeStats;
  items: DedupeItemMeta[];
  textStats: TextStats;
}

export interface DedupeError {
  ok: false;
  message: string;
}

export type DedupeOutcome = DedupeResult | DedupeError;

export interface DedupeAnalysis {
  detected: string;
  suggestions: string[];
  lineCount: number;
  looksLikeCsv: boolean;
  looksLikeJson: boolean;
  emailCount: number;
  urlCount: number;
}

export interface HistoryEntry {
  id: string;
  mode: DedupeMode;
  input: string;
  output: string;
  removed: number;
  at: number;
}

export interface DedupePreset {
  id: DedupeMode;
  label: string;
  hint: string;
  category: "text" | "structured" | "extract";
}

export const DEFAULT_DEDUPE_OPTIONS: DedupeOptions = {
  caseSensitive: false,
  trimWhitespace: true,
  ignorePunctuation: false,
  ignoreEmpty: true,
  keep: "first",
  sortWhen: "none",
  sortOrder: "asc",
  matchMode: "exact",
  fuzzyThreshold: 0.92,
  customPattern: "",
  csvDelimiter: ",",
  jsonKey: "",
};

export const DEDUPE_PRESETS: DedupePreset[] = [
  { id: "lines", label: "Duplicate lines", hint: "One entry per line", category: "text" },
  { id: "words", label: "Duplicate words", hint: "Unique words in text", category: "text" },
  { id: "sentences", label: "Duplicate sentences", hint: "Split on . ! ?", category: "text" },
  { id: "paragraphs", label: "Duplicate paragraphs", hint: "Blank-line blocks", category: "text" },
  { id: "csv-rows", label: "CSV rows", hint: "Dedupe spreadsheet rows", category: "structured" },
  { id: "json-objects", label: "JSON objects", hint: "Array of objects", category: "structured" },
  { id: "emails", label: "Email addresses", hint: "Extract & unique", category: "extract" },
  { id: "urls", label: "URLs", hint: "Extract & unique links", category: "extract" },
  { id: "numbers", label: "Numbers", hint: "Extract & unique digits", category: "extract" },
  { id: "custom", label: "Custom pattern", hint: "Regex extract", category: "extract" },
];

export const DEDUPE_SAMPLES = [
  {
    id: "lines",
    label: "Lines",
    text: "apple\nbanana\napple\ncherry\nbanana\nApple",
    mode: "lines" as DedupeMode,
  },
  {
    id: "csv",
    label: "CSV",
    text: "name,email\nJohn,a@x.com\nJane,b@y.com\nJohn,a@x.com",
    mode: "csv-rows" as DedupeMode,
  },
  {
    id: "json",
    label: "JSON",
    text: '[{"id":1,"name":"A"},{"id":2,"name":"B"},{"id":1,"name":"A"}]',
    mode: "json-objects" as DedupeMode,
  },
  {
    id: "emails",
    label: "Emails",
    text: "Contact admin@test.com or support@test.com and admin@test.com again.",
    mode: "emails" as DedupeMode,
  },
  {
    id: "fuzzy",
    label: "Fuzzy",
    text: "colour\ncolor\ncolour\nfavorite\nfavourite",
    mode: "lines" as DedupeMode,
  },
];

const HISTORY_KEY = "toolnest-dedupe-studio-history";
const HISTORY_MAX = 50;

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+|www\.[^\s<>"{}|\\^`[\]]+/gi;
const NUMBER_RE = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi;

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const val = a[i - 1] === b[j - 1] ? row[j - 1]! : Math.min(row[j]!, row[j - 1]!, prev) + 1;
      row[j - 1]! = prev;
      prev = val;
    }
    row[b.length]! = prev;
  }
  return row[b.length]!;
}

function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

export function normalizeKey(raw: string, options: DedupeOptions): string {
  let k = raw;
  if (options.trimWhitespace) k = k.trim();
  if (!options.caseSensitive) k = k.toLocaleLowerCase();
  if (options.ignorePunctuation) k = k.replace(/[^\p{L}\p{N}\s]/gu, "");
  if (options.trimWhitespace) k = k.replace(/\s+/g, " ").trim();
  return k;
}

function sortItems(items: string[], options: DedupeOptions): string[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    const cmp = normalizeKey(a, options).localeCompare(normalizeKey(b, options));
    return options.sortOrder === "asc" ? cmp : -cmp;
  });
  return sorted;
}

function findFuzzyMatch(key: string, kept: { key: string; index: number }[], threshold: number): number | null {
  for (const k of kept) {
    if (similarity(key, k.key) >= threshold) return k.index;
  }
  return null;
}

export function dedupeList(
  items: string[],
  options: DedupeOptions,
): { output: string[]; meta: DedupeItemMeta[] } {
  let list = [...items];
  if (options.ignoreEmpty) list = list.filter((x) => x.trim() !== "");
  if (options.sortWhen === "before") list = sortItems(list, options);

  const work = options.keep === "last" ? [...list].reverse() : list;
  const keptKeys: { key: string; index: number }[] = [];
  const keptItems: string[] = [];
  const meta: DedupeItemMeta[] = [];

  work.forEach((raw, wi) => {
    const index = options.keep === "last" ? list.length - 1 - wi : wi;
    const key = normalizeKey(raw, options);

    let duplicateOf: number | null = null;
    let isDuplicate = false;

    if (options.matchMode === "fuzzy") {
      duplicateOf = findFuzzyMatch(key, keptKeys, options.fuzzyThreshold);
      isDuplicate = duplicateOf !== null;
    } else {
      const found = keptKeys.find((k) => k.key === key);
      if (found) {
        duplicateOf = found.index;
        isDuplicate = true;
      }
    }

    if (!isDuplicate) {
      keptKeys.push({ key, index });
      keptItems.push(raw);
      meta.push({
        index,
        raw,
        key,
        isDuplicate: false,
        kept: true,
        duplicateOf: null,
        occurrence: 1,
      });
    } else {
      const master = meta.find((m) => m.index === duplicateOf && m.kept);
      if (master) master.occurrence += 1;
      meta.push({
        index,
        raw,
        key,
        isDuplicate: true,
        kept: false,
        duplicateOf,
        occurrence: 0,
      });
    }
  });

  let output = options.keep === "last" ? keptItems.reverse() : keptItems;
  if (options.sortWhen === "after") output = sortItems(output, options);

  meta.sort((a, b) => a.index - b.index);
  return { output, meta };
}

function splitLines(text: string): string[] {
  return text.split("\n");
}

function splitWords(text: string): string[] {
  return text.match(/\S+/gu) ?? [];
}

function splitSentences(text: string): string[] {
  return text.match(/[^.!?…]+[.!?…]*\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? (text.trim() ? [text.trim()] : []);
}

function splitParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

function dedupeWordsInText(text: string, options: DedupeOptions): DedupeOutcome {
  const words = splitWords(text);
  const { output, meta } = dedupeList(words, options);
  return buildResult(output.join(" "), "words", meta, text);
}

function dedupeSentences(text: string, options: DedupeOptions): DedupeOutcome {
  const parts = splitSentences(text);
  const { output, meta } = dedupeList(parts, options);
  return buildResult(output.join(" "), "sentences", meta, text);
}

function dedupeParagraphs(text: string, options: DedupeOptions): DedupeOutcome {
  const parts = splitParagraphs(text);
  const { output, meta } = dedupeList(parts, options);
  return buildResult(output.join("\n\n"), "paragraphs", meta, text);
}

function dedupeCsvRows(text: string, options: DedupeOptions): DedupeOutcome {
  const lines = splitLines(text).filter((l) => l.trim());
  const { output, meta } = dedupeList(lines, options);
  return buildResult(output.join("\n"), "csv-rows", meta, text);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function dedupeJsonObjects(text: string, options: DedupeOptions): DedupeOutcome {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    return { ok: false, message: "Invalid JSON — expected an array of objects." };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, message: "JSON root must be an array for object deduplication." };
  }

  const keyField = options.jsonKey.trim();
  const entries = parsed.map((item, index) => {
    let key: string;
    if (keyField && item && typeof item === "object" && keyField in (item as object)) {
      key = String((item as Record<string, unknown>)[keyField]);
    } else {
      key = stableStringify(item);
    }
    return { item, key, index };
  });

  const keys = entries.map((e) => e.key);
  const { output: keptKeys, meta } = dedupeList(keys, options);

  const keyBuckets = new Map<string, unknown[]>();
  entries.forEach((e) => {
    const bucket = keyBuckets.get(e.key) ?? [];
    bucket.push(e.item);
    keyBuckets.set(e.key, bucket);
  });

  const result = keptKeys.map((k) => {
    const bucket = keyBuckets.get(k) ?? [];
    return options.keep === "last" ? bucket[bucket.length - 1] : bucket[0];
  });

  return buildResult(JSON.stringify(result, null, 2), "json-objects", meta, text);
}

function extractMatches(text: string, re: RegExp): string[] {
  return [...text.matchAll(re)].map((m) => m[0]);
}

function dedupeExtracted(text: string, mode: DedupeMode, options: DedupeOptions): DedupeOutcome {
  let re: RegExp;
  switch (mode) {
    case "emails":
      re = EMAIL_RE;
      break;
    case "urls":
      re = URL_RE;
      break;
    case "numbers":
      re = NUMBER_RE;
      break;
    case "custom": {
      if (!options.customPattern.trim()) {
        return { ok: false, message: "Enter a custom regex pattern in Settings." };
      }
      try {
        re = new RegExp(options.customPattern, "gu");
      } catch (e) {
        return { ok: false, message: e instanceof Error ? e.message : "Invalid regex pattern." };
      }
      break;
    }
    default:
      return { ok: false, message: "Unsupported extract mode." };
  }

  const matches = extractMatches(text, re);
  const { output, meta } = dedupeList(matches, options);
  return buildResult(output.join("\n"), mode, meta, text);
}

function buildResult(output: string, mode: DedupeMode, meta: DedupeItemMeta[], input: string): DedupeResult {
  const total = meta.length;
  const removed = meta.filter((m) => m.isDuplicate).length;
  const unique = total - removed;
  const duplicateGroups = new Set(meta.filter((m) => m.isDuplicate).map((m) => m.duplicateOf)).size;

  return {
    ok: true,
    output,
    mode,
    stats: {
      total,
      unique,
      removed,
      duplicateGroups,
      inputBytes: new TextEncoder().encode(input).length,
      outputBytes: new TextEncoder().encode(output).length,
    },
    items: meta,
    textStats: computeTextStats(output),
  };
}

export function transformDedupe(
  text: string,
  mode: DedupeMode,
  options: DedupeOptions = DEFAULT_DEDUPE_OPTIONS,
): DedupeOutcome {
  try {
    if (!text.trim() && options.ignoreEmpty) {
      return {
        ok: true,
        output: "",
        mode,
        stats: { total: 0, unique: 0, removed: 0, duplicateGroups: 0, inputBytes: 0, outputBytes: 0 },
        items: [],
        textStats: computeTextStats(""),
      };
    }

    switch (mode) {
      case "lines": {
        const lines = splitLines(text);
        const { output, meta } = dedupeList(lines, options);
        return buildResult(output.join("\n"), mode, meta, text);
      }
      case "words":
        return dedupeWordsInText(text, options);
      case "sentences":
        return dedupeSentences(text, options);
      case "paragraphs":
        return dedupeParagraphs(text, options);
      case "csv-rows":
        return dedupeCsvRows(text, options);
      case "json-objects":
        return dedupeJsonObjects(text, options);
      case "emails":
      case "urls":
      case "numbers":
      case "custom":
        return dedupeExtracted(text, mode, options);
      default:
        return { ok: false, message: "Unknown dedupe mode." };
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Dedupe failed" };
  }
}

export function analyzeDedupeInput(input: string): DedupeAnalysis {
  const trimmed = input.trim();
  const lineCount = input.split("\n").length;
  const looksLikeCsv = lineCount > 1 && /^[^,\n]+,[^,\n]+/m.test(trimmed);
  const looksLikeJson = trimmed.startsWith("[") || trimmed.startsWith("{");
  const emailCount = (trimmed.match(EMAIL_RE) ?? []).length;
  const urlCount = (trimmed.match(URL_RE) ?? []).length;
  const suggestions: string[] = [];

  if (!trimmed) {
    return {
      detected: "empty",
      suggestions: ["Paste a list, CSV, JSON array, or import a file."],
      lineCount: 0,
      looksLikeCsv: false,
      looksLikeJson: false,
      emailCount: 0,
      urlCount: 0,
    };
  }

  if (looksLikeJson) suggestions.push("JSON detected — use JSON objects mode for array deduplication.");
  if (looksLikeCsv) suggestions.push("CSV-like rows detected — try CSV rows mode.");
  if (emailCount > 1) suggestions.push(`${emailCount} emails found — Email mode extracts and dedupes addresses.`);
  if (urlCount > 1) suggestions.push(`${urlCount} URLs found — URL mode extracts unique links.`);
  if (lineCount > 20) suggestions.push("Large list — sort after removal in Settings for clean output.");

  let detected = "plain text";
  if (looksLikeJson) detected = "JSON";
  else if (looksLikeCsv) detected = "CSV";
  else if (lineCount > 1) detected = "multi-line list";

  return {
    detected,
    suggestions: [...new Set(suggestions)].slice(0, 5),
    lineCount,
    looksLikeCsv,
    looksLikeJson,
    emailCount,
    urlCount,
  };
}

export function smartDedupeSuggestions(input: string, mode: DedupeMode, options: DedupeOptions): string[] {
  const analysis = analyzeDedupeInput(input);
  const tips = [...analysis.suggestions];
  if (options.matchMode === "fuzzy") {
    tips.unshift(`Fuzzy matching active (≥${Math.round(options.fuzzyThreshold * 100)}% similarity) — good for typos like colour/color.`);
  }
  if (!options.caseSensitive && mode === "lines") {
    tips.push("Case-insensitive mode treats Apple and apple as duplicates.");
  }
  if (mode === "json-objects" && options.jsonKey) {
    tips.push(`Deduping by JSON field "${options.jsonKey}" only.`);
  }
  return [...new Set(tips)].slice(0, 5);
}

export interface BatchBlockResult {
  block: number;
  ok: boolean;
  output?: string;
  removed?: number;
  error?: string;
}

export function batchTransformBlocks(
  blocks: string[],
  mode: DedupeMode,
  options: DedupeOptions,
): BatchBlockResult[] {
  return blocks.map((block, i) => {
    if (!block.trim()) return { block: i + 1, ok: true, output: "", removed: 0 };
    const result = transformDedupe(block, mode, options);
    if (!result.ok) return { block: i + 1, ok: false, error: result.message };
    return { block: i + 1, ok: true, output: result.output, removed: result.stats.removed };
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

export { extractTextFromFile, exportAsCsv, computeTextStats };
