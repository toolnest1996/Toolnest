import { computeTextStats, exportAsCsv, extractTextFromFile, type TextStats } from "./case-converter-utils";

export type ReverseMode =
  | "characters"
  | "words"
  | "sentences"
  | "lines"
  | "paragraphs"
  | "mirror"
  | "upside-down"
  | "rtl";

export interface ReverseOptions {
  graphemeAware: boolean;
  preserveWhitespace: boolean;
  preservePunctuation: boolean;
  trimLines: boolean;
  perLine: boolean;
  rtlWrap: boolean;
}

export interface ReverseResult {
  ok: true;
  output: string;
  mode: ReverseMode;
  stats: TextStats;
}

export interface ReverseError {
  ok: false;
  message: string;
}

export type ReverseOutcome = ReverseResult | ReverseError;

export interface PalindromeReport {
  isExact: boolean;
  isIgnoreCase: boolean;
  isIgnoreSpaces: boolean;
  isIgnorePunctuation: boolean;
  normalized: string;
  reversed: string;
  length: number;
  message: string;
}

export interface ReverseAnalysis {
  detected: string;
  suggestions: string[];
  hasUnicode: boolean;
  hasEmoji: boolean;
  hasRtl: boolean;
  lineCount: number;
  wordCount: number;
  looksPalindrome: boolean;
}

export interface ReversePreset {
  id: ReverseMode;
  label: string;
  hint: string;
  category: "core" | "structural" | "unicode";
}

export interface HistoryEntry {
  id: string;
  mode: ReverseMode;
  input: string;
  output: string;
  at: number;
}

export const DEFAULT_REVERSE_OPTIONS: ReverseOptions = {
  graphemeAware: true,
  preserveWhitespace: true,
  preservePunctuation: true,
  trimLines: false,
  perLine: false,
  rtlWrap: true,
};

export const REVERSE_PRESETS: ReversePreset[] = [
  { id: "characters", label: "Reverse characters", hint: "olleh ← hello", category: "core" },
  { id: "words", label: "Reverse words", hint: "world hello ← hello world", category: "core" },
  { id: "sentences", label: "Reverse sentences", hint: "Flip sentence order", category: "structural" },
  { id: "lines", label: "Reverse lines", hint: "Bottom line becomes top", category: "structural" },
  { id: "paragraphs", label: "Reverse paragraphs", hint: "Block order flip", category: "structural" },
  { id: "mirror", label: "Mirror text", hint: "Per-line character mirror", category: "core" },
  { id: "upside-down", label: "Upside-down", hint: "Unicode flip ɥǝllo", category: "unicode" },
  { id: "rtl", label: "RTL override", hint: "Right-to-left display", category: "unicode" },
];

export const REVERSE_SAMPLES = [
  { id: "plain", label: "Plain", text: "ToolNest reverse text studio" },
  { id: "unicode", label: "Unicode", text: "café 日本語 — hello 🌍 world" },
  { id: "multiline", label: "Multi-line", text: "First line\nSecond line\nThird line" },
  { id: "palindrome", label: "Palindrome", text: "A man a plan a canal Panama" },
  { id: "sentences", label: "Sentences", text: "Hello world. How are you? Fine thanks!" },
];

const HISTORY_KEY = "toolnest-reverse-studio-history";
const HISTORY_MAX = 50;

/** Upside-down / flipped Unicode map (Latin + digits + common punctuation). */
const FLIP_CHAR: Record<string, string> = {
  a: "ɐ", b: "q", c: "ɔ", d: "p", e: "ǝ", f: "ɟ", g: "ƃ", h: "ɥ", i: "ᴉ", j: "ɾ", k: "ʞ", l: "l",
  m: "ɯ", n: "u", o: "o", p: "d", q: "b", r: "ɹ", s: "s", t: "ʇ", u: "n", v: "ʌ", w: "ʍ", x: "x", y: "ʎ", z: "z",
  A: "∀", B: "q", C: "Ɔ", D: "p", E: "Ǝ", F: "Ⅎ", G: "פ", H: "H", I: "I", J: "ſ", K: "ʞ", L: "˥", M: "W",
  N: "N", O: "O", P: "Ԁ", Q: "Ό", R: "ᴚ", S: "S", T: "⊥", U: "∩", V: "Λ", W: "M", X: "X", Y: "⅄", Z: "Z",
  "0": "0", "1": "⇂", "2": "ζ", "3": "ε", "4": "ㄣ", "5": "ϛ", "6": "9", "7": "ㄥ", "8": "8", "9": "6",
  ".": "˙", ",": "'", "?": "¿", "!": "¡", '"': "„", "'": ",", "(": ")", ")": "(", "[": "]", "]": "[",
  "{": "}", "}": "{", "<": ">", ">": "<", "&": "⅋", "_": "‾",
};

const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const EMOJI_RE = /\p{Extended_Pictographic}/u;

let graphemeSegmenter: Intl.Segmenter | null = null;

function getGraphemeSegmenter(): Intl.Segmenter | null {
  if (graphemeSegmenter) return graphemeSegmenter;
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return graphemeSegmenter;
  }
  return null;
}

export function splitGraphemes(text: string): string[] {
  const seg = getGraphemeSegmenter();
  if (seg) return [...seg.segment(text)].map((s) => s.segment);
  return [...text];
}

function reverseGraphemes(text: string): string {
  return splitGraphemes(text).reverse().join("");
}

function reverseCharacters(text: string, options: ReverseOptions): string {
  if (options.perLine) {
    return text
      .split("\n")
      .map((line) => (options.graphemeAware ? reverseGraphemes(line) : [...line].reverse().join("")))
      .join("\n");
  }
  return options.graphemeAware ? reverseGraphemes(text) : [...text].reverse().join("");
}

function reverseWords(text: string, options: ReverseOptions): string {
  if (options.preserveWhitespace) {
    const parts = text.match(/\S+|\s+/g) ?? [];
    const wordSlots: number[] = [];
    parts.forEach((p, i) => {
      if (/\S/.test(p)) wordSlots.push(i);
    });
    const words = wordSlots.map((i) => parts[i]!);
    const reversed = [...words].reverse();
    wordSlots.forEach((slot, i) => {
      parts[slot] = reversed[i]!;
    });
    return parts.join("");
  }
  const words = text.split(/\s+/).filter(Boolean);
  return words.reverse().join(" ");
}

function reverseSentences(text: string): string {
  const chunks = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? (text ? [text] : []);
  return chunks.reverse().join("").trimEnd();
}

function reverseLines(text: string, options: ReverseOptions): string {
  let lines = text.split("\n");
  if (options.trimLines) lines = lines.map((l) => l.trim());
  return lines.reverse().join("\n");
}

function reverseParagraphs(text: string): string {
  const blocks = text.split(/\n\s*\n/);
  return blocks.reverse().join("\n\n");
}

function mirrorText(text: string, options: ReverseOptions): string {
  return text
    .split("\n")
    .map((line) => (options.graphemeAware ? reverseGraphemes(line) : [...line].reverse().join("")))
    .join("\n");
}

function upsideDown(text: string, options: ReverseOptions): string {
  const reversed = options.graphemeAware ? reverseGraphemes(text) : [...text].reverse().join("");
  return [...reversed]
    .map((ch) => FLIP_CHAR[ch] ?? FLIP_CHAR[ch.toLowerCase()] ?? ch)
    .join("");
}

function applyRtl(text: string, options: ReverseOptions): string {
  if (!options.rtlWrap) return text;
  return `\u202E${text}\u202C`;
}

export function transformReverse(
  text: string,
  mode: ReverseMode,
  options: ReverseOptions = DEFAULT_REVERSE_OPTIONS,
): ReverseOutcome {
  try {
    let output: string;
    switch (mode) {
      case "characters":
        output = reverseCharacters(text, options);
        break;
      case "words":
        output = reverseWords(text, options);
        break;
      case "sentences":
        output = reverseSentences(text);
        break;
      case "lines":
        output = reverseLines(text, options);
        break;
      case "paragraphs":
        output = reverseParagraphs(text);
        break;
      case "mirror":
        output = mirrorText(text, options);
        break;
      case "upside-down":
        output = upsideDown(text, options);
        break;
      case "rtl":
        output = applyRtl(text, options);
        break;
      default:
        output = reverseCharacters(text, options);
    }

    return {
      ok: true,
      output,
      mode,
      stats: computeTextStats(output),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Reverse failed" };
  }
}

function normalizePalindrome(s: string, ignoreSpaces: boolean, ignorePunctuation: boolean): string {
  let n = s;
  if (ignorePunctuation) n = n.replace(/[^\p{L}\p{N}]/gu, "");
  else if (ignoreSpaces) n = n.replace(/\s+/g, "");
  return n.toLowerCase();
}

export function checkPalindrome(text: string): PalindromeReport {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      isExact: false,
      isIgnoreCase: false,
      isIgnoreSpaces: false,
      isIgnorePunctuation: false,
      normalized: "",
      reversed: "",
      length: 0,
      message: "Enter text to check for palindrome.",
    };
  }

  const exact = trimmed === reverseGraphemes(trimmed);
  const normCase = normalizePalindrome(trimmed, false, false);
  const normSpaces = normalizePalindrome(trimmed, true, false);
  const normPunct = normalizePalindrome(trimmed, true, true);

  const revCase = reverseGraphemes(normCase);
  const revSpaces = reverseGraphemes(normSpaces);
  const revPunct = reverseGraphemes(normPunct);

  const isIgnoreCase = normCase === revCase;
  const isIgnoreSpaces = normSpaces === revSpaces;
  const isIgnorePunctuation = normPunct === revPunct;

  let message: string;
  if (exact) message = "Exact palindrome — reads the same forward and backward.";
  else if (isIgnorePunctuation) message = "Palindrome when ignoring spaces and punctuation.";
  else if (isIgnoreSpaces) message = "Palindrome when ignoring spaces.";
  else if (isIgnoreCase) message = "Palindrome when ignoring letter case.";
  else message = "Not a palindrome.";

  return {
    isExact: exact,
    isIgnoreCase,
    isIgnoreSpaces,
    isIgnorePunctuation,
    normalized: normPunct,
    reversed: revPunct,
    length: normPunct.length,
    message,
  };
}

export function analyzeReverseInput(input: string): ReverseAnalysis {
  const trimmed = input.trim();
  const suggestions: string[] = [];
  const hasUnicode = /[^\x00-\x7F]/.test(trimmed);
  const hasEmoji = EMOJI_RE.test(trimmed);
  const hasRtl = RTL_RE.test(trimmed);
  const lineCount = input.split("\n").length;
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const pal = trimmed ? checkPalindrome(trimmed) : null;
  const looksPalindrome = Boolean(pal?.isIgnorePunctuation || pal?.isExact);

  if (!trimmed) {
    return {
      detected: "empty",
      suggestions: ["Paste text or import TXT, CSV, DOCX, or PDF."],
      hasUnicode: false,
      hasEmoji: false,
      hasRtl: false,
      lineCount: 0,
      wordCount: 0,
      looksPalindrome: false,
    };
  }

  if (hasEmoji) suggestions.push("Emoji detected — grapheme-aware mode keeps multi-codepoint emoji intact.");
  if (hasUnicode) suggestions.push("Unicode text — grapheme segmentation preserves combined characters.");
  if (hasRtl) suggestions.push("RTL script detected — RTL override mode adds bidi control characters.");
  if (lineCount > 2) suggestions.push("Multiple lines — try Reverse lines or Mirror per line.");
  if (wordCount > 3 && !trimmed.includes("\n")) suggestions.push("Multiple words — Reverse words keeps spacing layout.");
  if (looksPalindrome) suggestions.push("This text appears to be a palindrome — see Palindrome tab.");

  let detected = "plain text";
  if (looksPalindrome) detected = "palindrome candidate";
  else if (hasEmoji) detected = "text with emoji";
  else if (hasRtl) detected = "RTL text";
  else if (lineCount > 1) detected = "multi-line text";

  return {
    detected,
    suggestions: [...new Set(suggestions)].slice(0, 5),
    hasUnicode,
    hasEmoji,
    hasRtl,
    lineCount,
    wordCount,
    looksPalindrome,
  };
}

export function smartReverseSuggestions(input: string, mode: ReverseMode): string[] {
  const analysis = analyzeReverseInput(input);
  const tips = [...analysis.suggestions];
  if (mode === "upside-down") tips.unshift("Upside-down reverses first, then maps to Unicode flip characters.");
  if (mode === "rtl") tips.unshift("RTL mode wraps text with U+202E/U+202C for right-to-left display.");
  if (mode === "characters" && !analysis.hasEmoji && input.length > 500) {
    tips.unshift("Long text — per-line reverse in Settings can be easier to read.");
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
  mode: ReverseMode,
  options: ReverseOptions,
): BatchLineResult[] {
  return lines.map((line, i) => {
    if (!line.trim()) return { line: i + 1, ok: true, output: "" };
    const result = transformReverse(line, mode, options);
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

export { extractTextFromFile, exportAsCsv, computeTextStats };
