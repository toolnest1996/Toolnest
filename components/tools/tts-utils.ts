export type TtsEngine = "browser" | "cloud";
export type TtsExportFormat = "mp3" | "webm";
export type EmotionPreset = "neutral" | "cheerful" | "calm" | "sad" | "angry" | "excited" | "newscast" | "whisper";
export type VoiceGenderFilter = "all" | "female" | "male" | "child";

export interface TtsOptions {
  engine: TtsEngine;
  voiceId: string;
  lang: string;
  rate: number;
  pitch: number;
  volume: number;
  emotion: EmotionPreset;
  exportFormat: TtsExportFormat;
  useSsml: boolean;
  ssmlRaw: string;
}

export interface PronunciationEntry {
  word: string;
  speakAs: string;
}

export interface TtsChapter {
  id: string;
  title: string;
  start: number;
  end: number;
  text: string;
}

export interface TtsBookmark {
  id: string;
  label: string;
  offset: number;
  at: number;
}

export interface EdgeVoiceDto {
  id: string;
  name: string;
  locale: string;
  gender: string;
  friendlyName: string;
  localService: boolean;
}

export interface BrowserVoiceDto {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

export const DEFAULT_TTS_OPTIONS: TtsOptions = {
  engine: "cloud",
  voiceId: "en-US-JennyNeural",
  lang: "en-US",
  rate: 1,
  pitch: 1,
  volume: 1,
  emotion: "neutral",
  exportFormat: "mp3",
  useSsml: false,
  ssmlRaw: "",
};

export const EMOTION_PRESETS: { id: EmotionPreset; label: string; hint: string }[] = [
  { id: "neutral", label: "Neutral", hint: "Natural default" },
  { id: "cheerful", label: "Cheerful", hint: "Bright & upbeat" },
  { id: "calm", label: "Calm", hint: "Soft & steady" },
  { id: "sad", label: "Sad", hint: "Lower, slower" },
  { id: "angry", label: "Angry", hint: "Intense & fast" },
  { id: "excited", label: "Excited", hint: "Energetic" },
  { id: "newscast", label: "Newscast", hint: "Professional" },
  { id: "whisper", label: "Whisper", hint: "Quiet & soft" },
];

export const TTS_SAMPLES = [
  { id: "intro", label: "Intro", text: "Welcome to ToolNest Ultra Text to Speech Studio. Natural voices, dozens of languages, export to MP3." },
  { id: "long", label: "Paragraph", text: "The quick brown fox jumps over the lazy dog. Text to speech helps accessibility, learning, and content creation. ToolNest processes long documents in chapters with bookmarks and subtitles." },
  { id: "unicode", label: "Unicode", text: "Bonjour! Hola. Guten Tag. こんにちは. ToolNest supports multilingual neural voices." },
];

const DICT_KEY = "toolnest-tts-pronunciation";
const FAV_KEY = "toolnest-tts-favorites";
const HISTORY_KEY = "toolnest-tts-history";
const BOOKMARKS_KEY = "toolnest-tts-bookmarks";
const SETTINGS_KEY = "toolnest-tts-settings";

export interface ProsodyValues {
  rate: string | number;
  pitch: string;
  volume: string | number;
}

export function emotionToProsody(emotion: EmotionPreset): ProsodyValues {
  switch (emotion) {
    case "cheerful":
      return { rate: "1.08", pitch: "+5%", volume: "medium" };
    case "calm":
      return { rate: "0.92", pitch: "-2%", volume: "soft" };
    case "sad":
      return { rate: "0.85", pitch: "-8%", volume: "soft" };
    case "angry":
      return { rate: "1.15", pitch: "+3%", volume: "loud" };
    case "excited":
      return { rate: "1.12", pitch: "+8%", volume: "loud" };
    case "newscast":
      return { rate: "medium", pitch: "medium", volume: "medium" };
    case "whisper":
      return { rate: "0.88", pitch: "-5%", volume: "x-soft" };
    default:
      return { rate: "default", pitch: "default", volume: "default" };
  }
}

export function rateToProsody(rate: number): string {
  if (rate <= 0.7) return "x-slow";
  if (rate <= 0.9) return "slow";
  if (rate >= 1.35) return "x-fast";
  if (rate >= 1.1) return "fast";
  return rate === 1 ? "default" : `${Math.round((rate - 1) * 100)}%`;
}

export function pitchToProsody(pitch: number): string {
  if (pitch <= 0.75) return "x-low";
  if (pitch <= 0.9) return "low";
  if (pitch >= 1.35) return "x-high";
  if (pitch >= 1.1) return "high";
  return pitch === 1 ? "default" : `${Math.round((pitch - 1) * 100)}%`;
}

export function volumeToProsody(volume: number): string | number {
  if (volume <= 0.3) return "silent";
  if (volume <= 0.6) return "soft";
  if (volume >= 1.3) return "x-loud";
  if (volume >= 1.1) return "loud";
  return Math.round(volume * 100);
}

export function buildSsml(text: string, voice: string, options: TtsOptions): string {
  if (options.useSsml && options.ssmlRaw.trim()) {
    return options.ssmlRaw.trim();
  }
  const prosody = emotionToProsody(options.emotion);
  const rate = rateToProsody(options.rate);
  const pitch = pitchToProsody(options.pitch);
  const volume = volumeToProsody(options.volume);
  const escaped = escapeXml(text);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${options.lang}"><voice name="${voice}"><prosody rate="${rate}" pitch="${pitch}" volume="${volume}">${escaped}</prosody></voice></speak>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function stripSsmlToText(ssml: string): string {
  return ssml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function applyPronunciationDictionary(text: string, entries: PronunciationEntry[]): string {
  let out = text;
  for (const { word, speakAs } of entries) {
    if (!word.trim()) continue;
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, speakAs);
  }
  return out;
}

export function chunkText(text: string, maxLen = 2800): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxLen) return [trimmed];

  const chunks: string[] = [];
  let rest = trimmed;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf(". ", maxLen);
    if (cut < maxLen * 0.4) cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.4) cut = rest.lastIndexOf(" ", maxLen);
    if (cut <= 0) cut = maxLen;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function splitChapters(text: string): TtsChapter[] {
  const parts = text.split(/(?=^#{1,3}\s)|(?=^\d+\.\s)/m).filter(Boolean);
  if (parts.length <= 1) {
    const paras = text.split(/\n\s*\n/).filter((p) => p.trim());
    if (paras.length <= 1) {
      return [{ id: "1", title: "Chapter 1", start: 0, end: text.length, text }];
    }
    let offset = 0;
    return paras.map((p, i) => {
      const start = text.indexOf(p, offset);
      const ch = { id: String(i + 1), title: `Section ${i + 1}`, start, end: start + p.length, text: p };
      offset = start + p.length;
      return ch;
    });
  }
  let offset = 0;
  return parts.map((p, i) => {
    const start = text.indexOf(p, offset);
    const title = p.split("\n")[0]?.replace(/^#+\s*/, "").trim() || `Chapter ${i + 1}`;
    const ch = { id: String(i + 1), title, start, end: start + p.length, text: p.trim() };
    offset = start + p.length;
    return ch;
  });
}

export function estimateDurationSec(text: string, rate: number): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const wpm = 150 * rate;
  return Math.max(1, Math.ceil((words / wpm) * 60));
}

export interface VttCue {
  start: number;
  end: number;
  text: string;
}

export function generateWebVTT(text: string, rate: number): string {
  const sentences = text.match(/[^.!?…]+[.!?…]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text.trim()];
  let t = 0;
  const cues: VttCue[] = sentences.map((s) => {
    const dur = estimateDurationSec(s, rate);
    const cue = { start: t, end: t + dur, text: s };
    t += dur;
    return cue;
  });

  const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
  };

  return `WEBVTT\n\n${cues.map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`).join("\n")}`;
}

export function formatVoiceDisplayName(v: EdgeVoiceDto): string {
  const idMatch = v.id.match(/-([A-Za-z]+?)(?:Multilingual)?Neural$/);
  if (idMatch?.[1]) return idMatch[1];

  let label = v.friendlyName || v.name;
  label = label.replace(/^Microsoft\s+/i, "");
  label = label.replace(/\s*Online\s*\([^)]*\)/gi, "");
  label = label.replace(/\s*-\s*.+$/, "").trim();
  return label || v.id;
}

export const POPULAR_VOICE_IDS = [
  "en-US-JennyNeural",
  "en-US-GuyNeural",
  "en-US-AriaNeural",
  "en-GB-SoniaNeural",
  "en-GB-RyanNeural",
  "en-IN-NeerjaNeural",
  "en-AU-NatashaNeural",
  "bn-BD-NabanitaNeural",
  "bn-IN-TanishaaNeural",
  "hi-IN-SwaraNeural",
  "ar-SA-ZariyahNeural",
  "ur-PK-UzmaNeural",
  "ta-IN-PallaviNeural",
  "te-IN-ShrutiNeural",
  "mr-IN-AarohiNeural",
  "zh-CN-XiaoxiaoNeural",
  "ja-JP-NanamiNeural",
  "ko-KR-SunHiNeural",
  "fr-FR-DeniseNeural",
  "de-DE-KatjaNeural",
  "es-ES-ElviraNeural",
];

export const QUICK_LOCALE_PICKS: { locale: string; label: string }[] = [
  { locale: "en-US", label: "US English" },
  { locale: "en-GB", label: "UK English" },
  { locale: "en-IN", label: "English (India)" },
  { locale: "en-AU", label: "English (Australia)" },
  { locale: "en-CA", label: "English (Canada)" },
  { locale: "en-SG", label: "English (Singapore)" },
  { locale: "bn-BD", label: "Bengali (Bangladesh)" },
  { locale: "bn-IN", label: "Bengali (India)" },
  { locale: "hi-IN", label: "Hindi" },
  { locale: "ur-PK", label: "Urdu" },
  { locale: "ar-SA", label: "Arabic" },
  { locale: "ta-IN", label: "Tamil" },
  { locale: "te-IN", label: "Telugu" },
  { locale: "mr-IN", label: "Marathi" },
  { locale: "zh-CN", label: "Chinese" },
  { locale: "ja-JP", label: "Japanese" },
  { locale: "ko-KR", label: "Korean" },
  { locale: "fr-FR", label: "French" },
  { locale: "de-DE", label: "German" },
  { locale: "es-ES", label: "Spanish" },
  { locale: "pt-BR", label: "Portuguese (Brazil)" },
  { locale: "it-IT", label: "Italian" },
  { locale: "vi-VN", label: "Vietnamese" },
  { locale: "id-ID", label: "Indonesian" },
  { locale: "ms-MY", label: "Malay" },
  { locale: "tr-TR", label: "Turkish" },
  { locale: "pl-PL", label: "Polish" },
  { locale: "nl-NL", label: "Dutch" },
  { locale: "fil-PH", label: "Filipino" },
  { locale: "gu-IN", label: "Gujarati" },
  { locale: "kn-IN", label: "Kannada" },
  { locale: "ml-IN", label: "Malayalam" },
  { locale: "pa-IN", label: "Punjabi" },
  { locale: "sw-KE", label: "Swahili" },
  { locale: "fa-IR", label: "Persian" },
];

export function localeLabel(locale: string): string {
  const [lang, region] = locale.split("-");
  if (!lang) return locale;
  try {
    const langName = new Intl.DisplayNames(["en"], { type: "language" }).of(lang) ?? lang;
    if (!region) return langName;
    const regionName = new Intl.DisplayNames(["en"], { type: "region" }).of(region) ?? region;
    return `${langName} (${regionName})`;
  } catch {
    return locale;
  }
}

export interface LocaleOption {
  locale: string;
  label: string;
  count: number;
}

export function buildLocaleOptions(voices: EdgeVoiceDto[]): LocaleOption[] {
  const counts = new Map<string, number>();
  for (const v of voices) {
    counts.set(v.locale, (counts.get(v.locale) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([locale, count]) => ({ locale, label: localeLabel(locale), count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function sortVoicesForPicker(voices: EdgeVoiceDto[]): EdgeVoiceDto[] {
  const rank = (id: string) => {
    const i = POPULAR_VOICE_IDS.indexOf(id);
    return i === -1 ? 999 : i;
  };
  return [...voices].sort((a, b) => {
    const ra = rank(a.id);
    const rb = rank(b.id);
    if (ra !== rb) return ra - rb;
    const lc = a.locale.localeCompare(b.locale);
    if (lc !== 0) return lc;
    return (a.friendlyName || a.name).localeCompare(b.friendlyName || b.name);
  });
}

export function groupVoicesByLocale(voices: EdgeVoiceDto[]): { locale: string; label: string; voices: EdgeVoiceDto[] }[] {
  const sorted = sortVoicesForPicker(voices);
  const map = new Map<string, EdgeVoiceDto[]>();
  for (const v of sorted) {
    const list = map.get(v.locale) ?? [];
    list.push(v);
    map.set(v.locale, list);
  }
  return Array.from(map.entries())
    .map(([locale, groupVoices]) => ({ locale, label: localeLabel(locale), voices: groupVoices }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function pickDefaultVoiceForLocale(voices: EdgeVoiceDto[], locale: string): EdgeVoiceDto | null {
  const inLocale = voices.filter((v) => v.locale === locale);
  if (!inLocale.length) return null;
  return (
    inLocale.find((v) => POPULAR_VOICE_IDS.includes(v.id)) ??
    inLocale.find((v) => v.gender.toLowerCase() === "female") ??
    inLocale[0] ??
    null
  );
}

export function filterEdgeVoices(
  voices: EdgeVoiceDto[],
  locale: string,
  gender: VoiceGenderFilter,
  query: string,
): EdgeVoiceDto[] {
  return voices.filter((v) => {
    if (locale && locale !== "all") {
      const filter = locale.toLowerCase();
      const voiceLocale = v.locale.toLowerCase();
      if (locale.includes("-")) {
        if (voiceLocale !== filter) return false;
      } else if (!voiceLocale.startsWith(filter)) {
        return false;
      }
    }
    if (gender === "female" && v.gender.toLowerCase() !== "female") return false;
    if (gender === "male" && v.gender.toLowerCase() !== "male") return false;
    if (gender === "child" && !/child|kid|junior/i.test(v.name + v.friendlyName)) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!`${v.name} ${v.friendlyName} ${v.locale} ${localeLabel(v.locale)}`.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });
}

export function classifyVoiceGender(name: string, gender: string): string {
  if (/child|kid|junior/i.test(name)) return "child";
  return gender.toLowerCase();
}

export function getBrowserVoices(): BrowserVoiceDto[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices().map((v) => ({
    voiceURI: v.voiceURI,
    name: v.name,
    lang: v.lang,
    localService: v.localService,
    default: v.default,
  }));
}

export function findBrowserVoice(lang: string, voiceURI?: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (voiceURI) {
    const found = voices.find((v) => v.voiceURI === voiceURI);
    if (found) return found;
  }
  return voices.find((v) => v.lang.startsWith(lang)) ?? voices[0] ?? null;
}

export interface SpeakCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (msg: string) => void;
  onBoundary?: (charIndex: number) => void;
}

export function speakBrowser(text: string, options: TtsOptions, browserVoiceURI: string, cb: SpeakCallbacks): () => void {
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = findBrowserVoice(options.lang, browserVoiceURI);
  if (voice) utter.voice = voice;
  utter.rate = options.rate;
  utter.pitch = options.pitch;
  utter.volume = options.volume;
  utter.onstart = () => cb.onStart?.();
  utter.onend = () => cb.onEnd?.();
  utter.onerror = () => cb.onError?.("Browser speech failed");
  utter.onboundary = (e) => {
    if (e.name === "word" || e.name === "sentence") cb.onBoundary?.(e.charIndex);
  };
  window.speechSynthesis.speak(utter);
  return () => window.speechSynthesis.cancel();
}

export function pauseBrowser(): void {
  window.speechSynthesis.pause();
}

export function resumeBrowser(): void {
  window.speechSynthesis.resume();
}

export function stopBrowser(): void {
  window.speechSynthesis.cancel();
}

export interface HistoryEntry {
  id: string;
  text: string;
  voiceId: string;
  at: number;
}

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(text: string, voiceId: string): HistoryEntry[] {
  const entry: HistoryEntry = { id: crypto.randomUUID(), text: text.slice(0, 500), voiceId, at: Date.now() };
  const next = [entry, ...loadHistory()].slice(0, 40);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function loadFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function toggleFavorite(voiceId: string): string[] {
  const favs = loadFavorites();
  const next = favs.includes(voiceId) ? favs.filter((f) => f !== voiceId) : [...favs, voiceId];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  return next;
}

export function loadDictionary(): PronunciationEntry[] {
  try {
    return JSON.parse(localStorage.getItem(DICT_KEY) ?? "[]") as PronunciationEntry[];
  } catch {
    return [];
  }
}

export function saveDictionary(entries: PronunciationEntry[]): void {
  localStorage.setItem(DICT_KEY, JSON.stringify(entries));
}

export function loadBookmarks(docKey: string): TtsBookmark[] {
  try {
    const all = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) ?? "{}") as Record<string, TtsBookmark[]>;
    return all[docKey] ?? [];
  } catch {
    return [];
  }
}

export function saveBookmarks(docKey: string, bookmarks: TtsBookmark[]): void {
  try {
    const all = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) ?? "{}") as Record<string, TtsBookmark[]>;
    all[docKey] = bookmarks;
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(all));
  } catch {
    /* quota */
  }
}

const SCRIPT_LOCALES: { re: RegExp; locale: string; label: string; voiceId: string }[] = [
  { re: /[\u0980-\u09FF]/, locale: "bn-BD", label: "Bengali", voiceId: "bn-BD-NabanitaNeural" },
  { re: /[\u0900-\u097F]/, locale: "hi-IN", label: "Hindi", voiceId: "hi-IN-SwaraNeural" },
  { re: /[\u0600-\u06FF]/, locale: "ar-SA", label: "Arabic", voiceId: "ar-SA-ZariyahNeural" },
  { re: /[\u4E00-\u9FFF]/, locale: "zh-CN", label: "Chinese", voiceId: "zh-CN-XiaoxiaoNeural" },
  { re: /[\u3040-\u30FF]/, locale: "ja-JP", label: "Japanese", voiceId: "ja-JP-NanamiNeural" },
  { re: /[\uAC00-\uD7AF]/, locale: "ko-KR", label: "Korean", voiceId: "ko-KR-SunHiNeural" },
  { re: /[\u0E00-\u0E7F]/, locale: "th-TH", label: "Thai", voiceId: "th-TH-PremwadeeNeural" },
  { re: /[\u0400-\u04FF]/, locale: "ru-RU", label: "Russian", voiceId: "ru-RU-SvetlanaNeural" },
  { re: /[\u0370-\u03FF]/, locale: "el-GR", label: "Greek", voiceId: "el-GR-AthinaNeural" },
  { re: /[\u0590-\u05FF]/, locale: "he-IL", label: "Hebrew", voiceId: "he-IL-HilaNeural" },
  { re: /[\u0B80-\u0BFF]/, locale: "ta-IN", label: "Tamil", voiceId: "ta-IN-PallaviNeural" },
  { re: /[\u0C00-\u0C7F]/, locale: "te-IN", label: "Telugu", voiceId: "te-IN-ShrutiNeural" },
];

export interface LocaleHint {
  locale: string;
  label: string;
  voiceId: string;
}

export function detectTextLocaleHint(text: string): LocaleHint | null {
  const sample = text.replace(/\s+/g, "").slice(0, 800);
  if (!sample) return null;
  for (const entry of SCRIPT_LOCALES) {
    if (entry.re.test(sample)) {
      return { locale: entry.locale, label: entry.label, voiceId: entry.voiceId };
    }
  }
  return null;
}

export function findVoiceForLocale(
  voices: EdgeVoiceDto[],
  locale: string,
  preferredId?: string,
): EdgeVoiceDto | null {
  if (preferredId) {
    const exact = voices.find((v) => v.id === preferredId);
    if (exact) return exact;
  }
  const lang = locale.split("-")[0]?.toLowerCase();
  return (
    voices.find((v) => v.locale === locale) ??
    voices.find((v) => v.locale.toLowerCase().startsWith(`${lang}-`)) ??
    voices.find((v) => v.id.toLowerCase().startsWith(`${lang}-`)) ??
    null
  );
}

export function voiceMatchesTextLocale(text: string, lang: string): boolean {
  const hint = detectTextLocaleHint(text);
  if (!hint) return true;
  const hintLang = hint.locale.split("-")[0]?.toLowerCase();
  const voiceLang = lang.split("-")[0]?.toLowerCase();
  return hintLang === voiceLang;
}

export function resolveExportVoice(
  text: string,
  options: TtsOptions,
  voices: EdgeVoiceDto[],
): { options: TtsOptions; switched: boolean; reason?: string } {
  const hint = detectTextLocaleHint(text);
  if (!hint) return { options, switched: false };

  if (voiceMatchesTextLocale(text, options.lang)) {
    return { options, switched: false };
  }

  const voice = findVoiceForLocale(voices, hint.locale, hint.voiceId);
  if (!voice) {
    return { options, switched: false };
  }

  return {
    options: { ...options, voiceId: voice.id, lang: voice.locale },
    switched: true,
    reason: `${hint.label} text detected — using ${formatVoiceDisplayName(voice)}`,
  };
}

export function analyzeTtsInput(text: string): { detected: string; suggestions: string[]; wordCount: number; estMin: number } {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const suggestions: string[] = [];
  const localeHint = detectTextLocaleHint(text);

  if (!text.trim()) suggestions.push("Paste text, import a file, or fetch a web page URL.");
  if (words > 500) suggestions.push("Long text — cloud export processes in chunks; use chapters for navigation.");
  if (text.includes("<speak")) suggestions.push("SSML detected — enable SSML mode in Settings.");
  if (localeHint) {
    suggestions.push(
      `${localeHint.label} script detected — cloud export requires a ${localeHint.locale.split("-")[0]}-* neural voice (auto-selected on export).`,
    );
  } else if (/[\u0600-\u06FF]/.test(text)) {
    suggestions.push("Arabic script — pick an ar-* neural voice for best results.");
  }

  let detected = "plain text";
  if (text.includes("<speak")) detected = "SSML";
  else if (localeHint) detected = localeHint.label;
  else if (words > 200) detected = "long document";
  return { detected, suggestions, wordCount: words, estMin: Math.ceil(words / 150) };
}

export async function fetchCloudVoices(): Promise<{ voices: EdgeVoiceDto[]; source: "live" | "fallback" }> {
  try {
    const res = await fetch("/api/v1/tts/voices", { cache: "no-store" });
    const data = (await res.json()) as {
      ok?: boolean;
      voices?: EdgeVoiceDto[];
      source?: "live" | "fallback";
      error?: string;
    };
    if (res.ok && data.ok && data.voices?.length) {
      return { voices: data.voices, source: data.source ?? "live" };
    }
    throw new Error(data.error ?? `Voice API HTTP ${res.status}`);
  } catch {
    try {
      const res = await fetch("/tts-voices-fallback.json", { cache: "force-cache" });
      if (res.ok) {
        const voices = (await res.json()) as EdgeVoiceDto[];
        if (voices.length) return { voices, source: "fallback" };
      }
    } catch {
      /* ignore */
    }
    throw new Error("Could not load cloud voices");
  }
}

export async function synthesizeCloud(
  text: string,
  options: TtsOptions,
  ssml?: string,
): Promise<{ blob: Blob; mime: string; ext: string }> {
  const res = await fetch("/api/v1/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      voice: options.voiceId,
      lang: options.lang,
      format: options.exportFormat,
      ssml: ssml ?? (options.useSsml ? options.ssmlRaw : undefined),
      emotion: options.emotion,
      rate: options.rate,
      pitch: options.pitch,
      volume: options.volume,
    }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    error?: string;
    audio?: string;
    mime?: string;
    ext?: string;
    bytes?: number;
  };
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "Synthesis failed");
  }
  if (!data.audio || !data.bytes) {
    throw new Error(
      data.error ??
        "No audio generated — pick a neural voice that matches your text language (e.g. bn-BD for Bengali).",
    );
  }
  const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
  if (bytes.length === 0) {
    throw new Error("Downloaded audio is empty — try a voice matching your text language.");
  }
  return {
    blob: new Blob([bytes], { type: data.mime ?? "audio/mpeg" }),
    mime: data.mime ?? "audio/mpeg",
    ext: data.ext ?? "mp3",
  };
}

export async function fetchUrlText(url: string): Promise<string> {
  const res = await fetch("/api/v1/tts/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error ?? "Fetch failed");
  return data.text as string;
}

export { SETTINGS_KEY };
