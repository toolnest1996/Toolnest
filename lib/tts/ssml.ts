import type { EmotionPreset, TtsOptions } from "./types";

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

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
