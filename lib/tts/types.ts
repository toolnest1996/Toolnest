export type TtsExportFormat = "mp3" | "webm";
export type EmotionPreset = "neutral" | "cheerful" | "calm" | "sad" | "angry" | "excited" | "newscast" | "whisper";

export interface TtsOptions {
  engine: "browser" | "cloud";
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
