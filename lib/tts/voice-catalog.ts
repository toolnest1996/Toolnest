import fallbackVoices from "./fallback-voices.json";

export interface EdgeVoiceDto {
  id: string;
  name: string;
  locale: string;
  gender: string;
  friendlyName: string;
  localService: boolean;
}

export interface RawEdgeVoice {
  ShortName: string;
  Locale: string;
  Gender: string;
  FriendlyName: string;
  Status: string;
}

export const FALLBACK_EDGE_VOICES = fallbackVoices as EdgeVoiceDto[];

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

export function formatVoiceDisplayName(v: EdgeVoiceDto): string {
  const idMatch = v.id.match(/-([A-Za-z]+?)(?:Multilingual)?Neural$/);
  if (idMatch?.[1]) return idMatch[1];

  let label = v.friendlyName || v.name;
  label = label.replace(/^Microsoft\s+/i, "");
  label = label.replace(/\s*Online\s*\([^)]*\)/gi, "");
  label = label.replace(/\s*-\s*.+$/, "").trim();
  return label || v.id;
}

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

export function mapRawEdgeVoices(raw: RawEdgeVoice[]): EdgeVoiceDto[] {
  return raw
    .filter((v) => v.Status === "GA" || v.Status === "Preview")
    .map((v) => ({
      id: v.ShortName,
      name: v.ShortName,
      locale: v.Locale,
      gender: v.Gender,
      friendlyName: v.FriendlyName,
      localService: false,
    }));
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
