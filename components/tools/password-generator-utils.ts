/**
 * Ultra Password Generator — cryptographic RNG, entropy, modes, breach check,
 * bulk, PIN, Wi-Fi, passphrase, pronounceable, exports. 100% client-side.
 */

import { MEMORABLE_WORDS, WORDLIST_SIZE } from "./password-wordlist";

export type GenMode = "random" | "passphrase" | "pronounceable" | "pin" | "wifi";

export interface GenOptions {
  mode: GenMode;
  length: number;
  upper: boolean;
  lower: boolean;
  number: boolean;
  symbol: boolean;
  custom: string;
  /** Remove visually ambiguous chars like l 1 I O 0 | ` ' " */
  excludeSimilar: boolean;
  /** Remove braces/brackets/quotes/slashes — "ambiguous" in some fonts */
  excludeAmbiguous: boolean;
  /** Ensure at least one char from each enabled set */
  requireAllSets: boolean;
  /** Passphrase: number of words */
  wordCount: number;
  /** Passphrase: separator */
  separator: string;
  /** Passphrase: capitalize first letter */
  capitalize: boolean;
  /** Passphrase: append a number */
  appendNumber: boolean;
  /** Passphrase: append a symbol */
  appendSymbol: boolean;
  /** Pronounceable: use only lowercase (vs mixed) */
  pronounceLowerOnly: boolean;
  /** Wi-Fi: encryption type (informational; affects QR payload only) */
  wifiEncryption: "WPA" | "WEP" | "nopass";
  /** Wi-Fi: SSID (for QR) */
  wifiSsid: string;
  /** Wi-Fi: hidden network flag */
  wifiHidden: boolean;
}

export const DEFAULT_OPTIONS: GenOptions = {
  mode: "random",
  length: 20,
  upper: true,
  lower: true,
  number: true,
  symbol: true,
  custom: "",
  excludeSimilar: true,
  excludeAmbiguous: false,
  requireAllSets: true,
  wordCount: 5,
  separator: "-",
  capitalize: true,
  appendNumber: true,
  appendSymbol: false,
  pronounceLowerOnly: false,
  wifiEncryption: "WPA",
  wifiSsid: "",
  wifiHidden: false,
};

const SETS = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  number: "0123456789",
  symbol: "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
};

const SIMILAR = /[lI1O0o|`'"]/g;
const AMBIGUOUS = /[\{\}\[\]\(\)\/\\'"`~,;:.<>]/g;

const WIFI_SYMBOLS = "!@#$%^&*-_+=?"; // Wi-Fi friendly symbols (WPA-2/3 valid)

export interface StrengthInfo {
  /** bits of entropy — primary metric */
  entropy: number;
  /** 0-4 strength score (zxcvbn-style bucket) */
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  /** estimated guesses per second (10^10 — offline GPU attack) */
  guessesPerSecond: number;
  /** crack time in seconds at the above rate */
  crackSeconds: number;
  /** human-readable crack time */
  crackLabel: string;
  /** pool size used */
  poolSize: number;
  /** length of the generated value */
  length: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cryptographic RNG with rejection sampling (uniform distribution)
 * ──────────────────────────────────────────────────────────────────────────── */

/** Return a uniformly random integer in [0, max) using rejection sampling. */
export function secureRandomInt(max: number): number {
  if (max <= 0) throw new Error("max must be > 0");
  if (max === 1) return 0;
  const maxUint32 = 0xffffffff;
  // Largest multiple of `max` below 2^32
  const limit = maxUint32 - ((maxUint32 % max) + 1) % max;
  const buf = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x > limit);
  return x % max;
}

/** Pick `n` distinct random indices in [0, max) — Fisher-Yates partial shuffle. */
export function secureShuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickRandomChar(pool: string): string {
  return pool[secureRandomInt(pool.length)];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pool construction
 * ──────────────────────────────────────────────────────────────────────────── */

function buildPool(opts: GenOptions): { pool: string; sets: string[] } {
  const sets: string[] = [];
  if (opts.upper) sets.push(SETS.upper);
  if (opts.lower) sets.push(SETS.lower);
  if (opts.number) sets.push(SETS.number);
  if (opts.symbol) sets.push(SETS.symbol);
  if (opts.custom) sets.push(opts.custom);

  let pool = sets.join("");
  if (opts.excludeSimilar) pool = pool.replace(SIMILAR, "");
  if (opts.excludeAmbiguous) pool = pool.replace(AMBIGUOUS, "");
  // Dedupe
  pool = Array.from(new Set(pool.split(""))).join("");
  return { pool, sets: sets.map((s) => applyExclusions(s, opts)) };
}

function applyExclusions(set: string, opts: GenOptions): string {
  let s = set;
  if (opts.excludeSimilar) s = s.replace(SIMILAR, "");
  if (opts.excludeAmbiguous) s = s.replace(AMBIGUOUS, "");
  return Array.from(new Set(s.split(""))).join("");
}

/* ────────────────────────────────────────────────────────────────────────────
 * Mode: random
 * ──────────────────────────────────────────────────────────────────────────── */

export function generateRandom(opts: GenOptions): string {
  const { pool, sets } = buildPool(opts);
  if (!pool) return "";
  const len = clamp(opts.length, 1, 4096);
  const chars: string[] = [];

  if (opts.requireAllSets && sets.length > 0 && len >= sets.length) {
    // Guarantee one char from each enabled set, then fill the rest uniformly
    for (const set of sets) {
      if (set) chars.push(pickRandomChar(set));
    }
  }
  while (chars.length < len) chars.push(pickRandomChar(pool));
  return secureShuffle(chars).join("");
}

/* ────────────────────────────────────────────────────────────────────────────
 * Mode: passphrase (Diceware-style)
 * ──────────────────────────────────────────────────────────────────────────── */

export function generatePassphrase(opts: GenOptions): string {
  const n = clamp(opts.wordCount, 1, 32);
  const words: string[] = [];
  for (let i = 0; i < n; i++) {
    const w = MEMORABLE_WORDS[secureRandomInt(WORDLIST_SIZE)];
    words.push(opts.capitalize ? w.charAt(0).toUpperCase() + w.slice(1) : w);
  }
  let result = words.join(opts.separator || "-");
  if (opts.appendNumber) {
    const num = secureRandomInt(1000);
    result += `${opts.separator || "-"}${num}`;
  }
  if (opts.appendSymbol) {
    result += pickRandomChar(WIFI_SYMBOLS);
  }
  return result;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Mode: pronounceable (CV-CV-CVC pattern)
 * ──────────────────────────────────────────────────────────────────────────── */

const CONS = "bcdfghjklmnpqrstvwxz";
const VOWELS = "aeiouy";
const CONS_MIXED = CONS + CONS.toUpperCase();
const VOWELS_MIXED = VOWELS + VOWELS.toUpperCase();

export function generatePronounceable(opts: GenOptions): string {
  const len = clamp(opts.length, 4, 4096);
  const c = opts.pronounceLowerOnly ? CONS : CONS_MIXED;
  const v = opts.pronounceLowerOnly ? VOWELS : VOWELS_MIXED;
  const out: string[] = [];
  let i = 0;
  // pattern: CV-CV-...-CVC
  while (out.length < len) {
    // CV
    out.push(pickRandomChar(c));
    if (out.length >= len) break;
    out.push(pickRandomChar(v));
    i++;
    // every 2nd CV cluster, optionally append a C to make CVC
    if (i % 2 === 0 && out.length + 1 < len && secureRandomInt(2) === 0) {
      out.push(pickRandomChar(c));
    }
  }
  // Optionally add a digit & symbol at the end for strength
  if (opts.number && out.length + 1 <= len + 2) {
    out.push(String(secureRandomInt(10)));
  }
  if (opts.symbol && out.length + 1 <= len + 2) {
    out.push(pickRandomChar(WIFI_SYMBOLS));
  }
  return out.slice(0, Math.max(len, out.length)).join("");
}

/* ────────────────────────────────────────────────────────────────────────────
 * Mode: PIN (digits only)
 * ──────────────────────────────────────────────────────────────────────────── */

export function generatePin(opts: GenOptions): string {
  const len = clamp(opts.length, 1, 4096);
  const out: string[] = [];
  for (let i = 0; i < len; i++) out.push(String(secureRandomInt(10)));
  return out.join("");
}

/* ────────────────────────────────────────────────────────────────────────────
 * Mode: Wi-Fi password (WPA-2/3 friendly)
 * ──────────────────────────────────────────────────────────────────────────── */

export function generateWifiPassword(opts: GenOptions): string {
  const len = clamp(opts.length, 8, 63); // WPA max is 63
  const wifiOpts: GenOptions = {
    ...opts,
    length: len,
    upper: true,
    lower: true,
    number: true,
    // Use Wi-Fi-friendly symbols only to avoid quoting issues in QR payloads
    custom: WIFI_SYMBOLS,
    symbol: false,
    excludeSimilar: true,
    excludeAmbiguous: true,
    requireAllSets: true,
  };
  return generateRandom(wifiOpts);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Orchestrator
 * ──────────────────────────────────────────────────────────────────────────── */

export function generate(opts: GenOptions): string {
  switch (opts.mode) {
    case "passphrase": return generatePassphrase(opts);
    case "pronounceable": return generatePronounceable(opts);
    case "pin": return generatePin(opts);
    case "wifi": return generateWifiPassword(opts);
    case "random":
    default: return generateRandom(opts);
  }
}

export function generateBulk(opts: GenOptions, count: number): string[] {
  const n = clamp(count, 1, 10000);
  const out = new Array<string>(n);
  for (let i = 0; i < n; i++) out[i] = generate(opts);
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Strength / entropy
 * ──────────────────────────────────────────────────────────────────────────── */

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function formatCrackTime(seconds: number): string {
  if (seconds < 1) return "instant";
  if (seconds < 60) return `${seconds.toFixed(0)} seconds`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(0)} minutes`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(0)} hours`;
  if (seconds < 31536000) return `${(seconds / 86400).toFixed(0)} days`;
  const years = seconds / 31536000;
  if (years < 1000) return `${years.toFixed(0)} years`;
  if (years < 1e6) return `${(years / 1000).toFixed(0)} thousand years`;
  if (years < 1e9) return `${(years / 1e6).toFixed(0)} million years`;
  if (years < 1e12) return `${(years / 1e9).toFixed(0)} billion years`;
  if (years < 1e15) return `${(years / 1e12).toFixed(0)} trillion years`;
  return `${(years / 1e15).toExponential(2)} quadrillion years`;
}

export function computeStrength(password: string, opts: GenOptions): StrengthInfo {
  if (!password) {
    return {
      entropy: 0, score: 0, label: "Empty",
      guessesPerSecond: 1e10, crackSeconds: Infinity, crackLabel: "—",
      poolSize: 0, length: 0,
    };
  }

  let entropy: number;
  let poolSize: number;
  const len = password.length;

  if (opts.mode === "passphrase") {
    // Entropy = wordCount * log2(wordlist) + optional digits + symbol
    const perWord = Math.log2(WORDLIST_SIZE);
    let e = opts.wordCount * perWord;
    if (opts.capitalize) e += opts.wordCount * 1; // each word capital/not ~1 bit
    if (opts.appendNumber) e += Math.log2(1000);
    if (opts.appendSymbol) e += Math.log2(WIFI_SYMBOLS.length);
    entropy = e;
    poolSize = WORDLIST_SIZE;
  } else if (opts.mode === "pin") {
    poolSize = 10;
    entropy = len * Math.log2(poolSize);
  } else if (opts.mode === "pronounceable") {
    // ~2 bits per char for pronounceable syllable structure (conservative)
    entropy = len * 2;
    poolSize = (CONS_MIXED.length + VOWELS_MIXED.length);
  } else {
    // random / wifi — measure actual pool size from options
    const { pool } = buildPool(opts.mode === "wifi" ? {
      ...opts,
      upper: true, lower: true, number: true, symbol: false,
      custom: WIFI_SYMBOLS, excludeSimilar: true, excludeAmbiguous: true,
    } : opts);
    poolSize = pool.length || 1;
    entropy = len * Math.log2(poolSize);
  }

  // Offline GPU attack rate — ~10^10 guesses/sec is a realistic worst-case.
  const guessesPerSecond = 1e10;
  // Average crack time = 2^entropy / 2 / guessesPerSecond
  const totalGuesses = Math.pow(2, entropy);
  const crackSeconds = totalGuesses / 2 / guessesPerSecond;
  const crackLabel = formatCrackTime(crackSeconds);

  let score: StrengthInfo["score"];
  if (entropy < 28) score = 0;
  else if (entropy < 36) score = 1;
  else if (entropy < 60) score = 2;
  else if (entropy < 128) score = 3;
  else score = 4;

  const label = score === 0 ? "Very weak"
    : score === 1 ? "Weak"
    : score === 2 ? "Fair"
    : score === 3 ? "Strong"
    : "Very strong";

  return { entropy, score, label, guessesPerSecond, crackSeconds, crackLabel, poolSize, length: len };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Breach detection — HIBP k-anonymity range search
 * ──────────────────────────────────────────────────────────────────────────── */

export interface BreachResult {
  checked: boolean;
  found: boolean;
  count: number;
  suffix?: string;
  error?: string;
}

async function sha1Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export async function checkBreach(password: string): Promise<BreachResult> {
  if (!password) return { checked: false, found: false, count: 0, error: "empty" };
  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
    });
    if (!res.ok) throw new Error(`HIBP ${res.status}`);
    const text = await res.text();
    const lines = text.split("\n");
    for (const line of lines) {
      const [suf, countStr] = line.trim().split(":");
      if (suf === suffix) {
        return { checked: true, found: true, count: Number(countStr) || 0, suffix };
      }
    }
    return { checked: true, found: false, count: 0, suffix };
  } catch (e) {
    return {
      checked: false, found: false, count: 0,
      error: e instanceof Error ? e.message : "breach check failed",
    };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * QR code generation (Wi-Fi payload or raw text)
 * ──────────────────────────────────────────────────────────────────────────── */

/** Build the Wi-Fi QR payload per the standard `WIFI:` URI scheme. */
export function wifiQrPayload(ssid: string, password: string, encryption: "WPA" | "WEP" | "nopass", hidden: boolean): string {
  const esc = (s: string) => s.replace(/([\\;,":])/g, "\\$1");
  const enc = encryption === "nopass" ? "nopass" : encryption;
  let payload = `WIFI:T:${enc};S:${esc(ssid)};`;
  if (enc !== "nopass") payload += `P:${esc(password)};`;
  if (hidden) payload += `H:true;`;
  payload += ";";
  return payload;
}

export async function generateQrDataUrl(text: string, opts?: { margin?: number; width?: number; dark?: string; light?: string }): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, {
    margin: opts?.margin ?? 2,
    width: opts?.width ?? 320,
    color: {
      dark: opts?.dark ?? "#000000",
      light: opts?.light ?? "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Exports
 * ──────────────────────────────────────────────────────────────────────────── */

export type ExportFormat = "txt" | "csv" | "json" | "pdf";

export function exportTxt(passwords: string[]): Blob {
  return new Blob([passwords.join("\n") + "\n"], { type: "text/plain;charset=utf-8" });
}

export function exportCsv(passwords: string[]): Blob {
  const header = "index,password,length,entropy_bits\n";
  const rows = passwords.map((p, i) => `${i + 1},"${p.replace(/"/g, '""')}",${p.length},${computeStrength(p, DEFAULT_OPTIONS).entropy.toFixed(1)}`).join("\n");
  return new Blob([header + rows + "\n"], { type: "text/csv;charset=utf-8" });
}

export function exportJson(passwords: string[]): Blob {
  const data = passwords.map((p, i) => ({
    index: i + 1,
    password: p,
    length: p.length,
    entropyBits: Number(computeStrength(p, DEFAULT_OPTIONS).entropy.toFixed(2)),
  }));
  return new Blob([JSON.stringify({ generatedAt: new Date().toISOString(), count: passwords.length, passwords: data }, null, 2)], { type: "application/json" });
}

export async function exportPdf(passwords: string[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("ToolNest Password Export", 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()} · ${passwords.length} password(s)`, 40, 68);
  doc.setTextColor(0);
  doc.setFont("courier", "normal");
  doc.setFontSize(11);
  const maxWidth = 515; // a4 width ~595pt minus 40pt margins
  let y = 100;
  passwords.forEach((p, i) => {
    if (y > 800) { doc.addPage(); y = 50; }
    doc.text(`#${i + 1}`, 40, y);
    // Wrap long passwords
    const lines = doc.splitTextToSize(p, maxWidth - 30);
    doc.text(lines, 70, y);
    y += Math.max(16, lines.length * 13) + 6;
  });
  return doc.output("blob");
}

/* ────────────────────────────────────────────────────────────────────────────
 * AI recommendations
 * ──────────────────────────────────────────────────────────────────────────── */

export interface AiRecommendation {
  level: "info" | "warning" | "critical";
  title: string;
  detail: string;
  action?: Partial<GenOptions>;
}

export function aiRecommend(password: string, opts: GenOptions, strength: StrengthInfo): AiRecommendation[] {
  const recs: AiRecommendation[] = [];

  if (opts.mode === "pin" && opts.length < 6) {
    recs.push({
      level: "critical",
      title: "PIN too short",
      detail: "PINs under 6 digits can be brute-forced in seconds. Use at least 6 digits.",
      action: { length: 6 },
    });
  }
  if (opts.mode === "random" || opts.mode === "wifi") {
    if (opts.length < 12) {
      recs.push({
        level: "warning",
        title: "Length below 12",
        detail: "Modern GPUs brute-force short passwords fast. 16+ characters is the new baseline.",
        action: { length: 16 },
      });
    }
    if (opts.length < 20 && strength.entropy < 90) {
      recs.push({
        level: "info",
        title: "Go longer for offline safety",
        detail: "Bumping to 20+ characters pushes crack time into quadrillions of years against offline GPU attacks.",
        action: { length: 20 },
      });
    }
    const sets = [opts.upper, opts.lower, opts.number, opts.symbol].filter(Boolean).length;
    if (sets < 3) {
      recs.push({
        level: "warning",
        title: "Character pool too narrow",
        detail: "Enabling uppercase, lowercase, numbers AND symbols dramatically increases entropy per character.",
        action: { upper: true, lower: true, number: true, symbol: true },
      });
    }
    if (opts.mode === "wifi" && opts.length < 16) {
      recs.push({
        level: "info",
        title: "WPA3 sweet spot",
        detail: "A 16-20 character Wi-Fi password with mixed sets is strong yet easy to type on guest devices.",
        action: { length: 16 },
      });
    }
  }
  if (opts.mode === "passphrase") {
    if (opts.wordCount < 5) {
      recs.push({
        level: "info",
        title: "Add a word",
        detail: "5-7 word passphrases hit 45-63 bits of entropy — easy to remember, very hard to crack.",
        action: { wordCount: 5 },
      });
    }
    if (!opts.appendNumber && !opts.appendSymbol) {
      recs.push({
        level: "info",
        title: "Mix in a number or symbol",
        detail: "Appending a random number/symbol to a passphrase satisfies password policies that demand digit/symbol presence.",
        action: { appendNumber: true },
      });
    }
  }
  if (opts.mode === "pronounceable" && opts.length < 16) {
    recs.push({
      level: "warning",
      title: "Pronounceable needs length",
      detail: "Pronounceable patterns have ~2 bits/char entropy — go 16+ characters to compensate.",
      action: { length: 16 },
    });
  }
  if (strength.entropy >= 128 && recs.length === 0) {
    recs.push({
      level: "info",
      title: "Excellent",
      detail: `${strength.entropy.toFixed(0)} bits of entropy — sufficient to resist any known offline attack for the foreseeable future.`,
    });
  }
  return recs;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Clipboard
 * ──────────────────────────────────────────────────────────────────────────── */

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export { WIFI_SYMBOLS };
